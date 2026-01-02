#!/bin/bash

MODE=$1

if [ -z "$MODE" ]; then
  echo "Usage: ./deploy.sh [dev|update]"
  exit 1
fi

cleanup() {
  echo "Stopping all services..."
  kill $(jobs -p) 2>/dev/null
  exit
}

trap cleanup SIGINT SIGTERM

if [ "$MODE" == "dev" ]; then
  echo "🚀 Starting PolyTrader in Development Mode..."

  # 1. Start Backend
  echo "📦 Starting Backend (API)..."
  npm run dev &
  
  # 2. Start Frontend (if initialized)
  if [ -f "frontend/package.json" ]; then
    echo "🖥️  Starting Frontend (Dashboard)..."
    (cd frontend && npm run dev &)
  else
    echo "⚠️  Frontend not initialized. Skipping frontend start."
    echo "   To setup frontend: cd frontend && npx create-next-app@latest ."
  fi

  # Keep script running to maintain background processes
  wait
elif [ "$MODE" == "update" ]; then
  echo "🔄 Updating repository and redeploying containers..."

  if ! command -v git >/dev/null 2>&1; then
    echo "Error: git is required for update mode."
    exit 1
  fi

  BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
  if [ -z "$BRANCH" ]; then
    echo "Error: Not a git repository."
    exit 1
  fi

  # Check for uncommitted changes
  if [ -n "$(git status --porcelain)" ]; then
    if [ "$2" != "--force" ]; then
      echo "⚠️  Uncommitted changes detected. Commit or stash them, or run './deploy.sh update --force' to force update."
      exit 1
    fi
    echo "Forcing update by discarding local changes..."
  fi

  git fetch --all --prune
  git reset --hard origin/$BRANCH
  git clean -fd

  echo "✅ Updated to $(git rev-parse --short HEAD) on branch $BRANCH"

  # Find docker-compose command
  if command -v docker-compose >/dev/null 2>&1; then
    COMPOSE="docker-compose"
  elif docker compose version >/dev/null 2>&1; then
    COMPOSE="docker compose"
  else
    echo "Error: docker-compose is required to deploy containers."
    exit 1
  fi

  if [ -f docker-compose.yml ]; then
    echo "📦 Pulling, building, and starting containers..."
    $COMPOSE pull --ignore-pull-failures || true
    $COMPOSE build --pull
    $COMPOSE up -d
    echo "✅ Containers deployed"
  else
    echo "⚠️  No docker-compose.yml found; attempting a local Docker build..."
    docker build -t poly-trader .
    docker rm -f poly-trader || true
    docker run -d --restart unless-stopped --name poly-trader poly-trader
    echo "✅ Container deployed"
  fi
else
  echo "Unknown mode: $MODE"
  echo "Available modes: dev, update"
  exit 1
fi

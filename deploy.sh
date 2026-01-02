#!/bin/bash

MODE=$1

if [ -z "$MODE" ]; then
  echo "Usage: ./deploy.sh [dev]"
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
else
  echo "Unknown mode: $MODE"
  echo "Available modes: dev"
  exit 1
fi

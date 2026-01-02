#!/bin/bash

# bump.sh - Bump version of the project

TYPE="patch"

if [ "$1" == "major" ]; then
    TYPE="major"
elif [ "$1" == "minor" ]; then
    TYPE="minor"
elif [ "$1" == "patch" ]; then
    TYPE="patch"
elif [ ! -z "$1" ]; then
    echo "Usage: ./bump.sh [major|minor|patch]"
    exit 1
fi

echo "Bumping version ($TYPE)..."

# Bump root
npm version $TYPE --no-git-tag-version

# Get new version
VERSION=$(node -p "require('./package.json').version")

# Bump frontend
if [ -d "frontend" ]; then
    echo "Updating frontend to $VERSION..."
    cd frontend
    npm version $VERSION --no-git-tag-version --allow-same-version
    cd ..
fi

echo "Successfully bumped to version $VERSION"

#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Must be on a feature branch
BRANCH=$(git branch --show-current)
if [[ ! "$BRANCH" =~ ^feature/ ]]; then
  echo -e "${RED}Error: Debes estar en una rama feature/* (actual: $BRANCH)${NC}"
  exit 1
fi

FEATURE_NAME="${BRANCH#feature/}"
echo -e "${GREEN}Feature:${NC} $FEATURE_NAME"

# Get current version and calculate next minor
CURRENT_VERSION=$(node -p "require('./package.json').version")
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
NEXT_VERSION="$MAJOR.$((MINOR + 1)).0"
echo -e "${GREEN}Versión actual:${NC} $CURRENT_VERSION"
echo -e "${GREEN}Versión release:${NC} $NEXT_VERSION"

# Confirm
echo ""
echo -e "${YELLOW}Se ejecutará:${NC}"
echo "  1. git flow feature finish $FEATURE_NAME"
echo "  2. git flow release start $NEXT_VERSION"
echo "  3. Bump version en package.json → $NEXT_VERSION"
echo "  4. Commit 'version bump'"
echo "  5. git flow release finish $NEXT_VERSION"
echo "  6. Push all branches + tags"
echo ""
read -p "¿Continuar? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelado."
  exit 0
fi

# 1. Finish feature
echo -e "\n${GREEN}[1/6]${NC} Finishing feature '$FEATURE_NAME'..."
git flow feature finish "$FEATURE_NAME"

# 2. Start release
echo -e "\n${GREEN}[2/6]${NC} Starting release '$NEXT_VERSION'..."
git flow release start "$NEXT_VERSION"

# 3. Bump version
echo -e "\n${GREEN}[3/6]${NC} Bumping version to $NEXT_VERSION..."
npm version "$NEXT_VERSION" --no-git-tag-version

# 4. Commit version bump
echo -e "\n${GREEN}[4/6]${NC} Committing version bump..."
git add package.json package-lock.json 2>/dev/null || git add package.json
git commit -m "version bump"

# 5. Finish release
echo -e "\n${GREEN}[5/6]${NC} Finishing release '$NEXT_VERSION'..."
GIT_MERGE_AUTOEDIT=no git flow release finish -m "Release $NEXT_VERSION" "$NEXT_VERSION"

# 6. Push everything
echo -e "\n${GREEN}[6/6]${NC} Pushing all branches and tags..."
git push origin --all && git push origin --tags

echo -e "\n${GREEN}Release $NEXT_VERSION completado exitosamente.${NC}"

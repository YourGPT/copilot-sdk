#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Available packages
ALL_PACKAGES=("copilot-sdk" "llm-sdk")

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  🧪 YourGPT SDK Beta Publish Script${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Step 0: Select packages to publish
echo -e "${YELLOW}Which packages do you want to publish as beta?${NC}"
echo -e "  ${BLUE}1)${NC} @yourgpt/copilot-sdk only"
echo -e "  ${BLUE}2)${NC} @yourgpt/llm-sdk only"
echo -e "  ${BLUE}3)${NC} Both packages"
echo ""
read -p "Select option (1/2/3): " -n 1 -r PUBLISH_OPTION
echo ""
echo ""

case $PUBLISH_OPTION in
  1)
    PACKAGES=("copilot-sdk")
    ;;
  2)
    PACKAGES=("llm-sdk")
    ;;
  3)
    PACKAGES=("copilot-sdk" "llm-sdk")
    ;;
  *)
    echo -e "${RED}Invalid option. Aborted.${NC}"
    exit 1
    ;;
esac

# Step 1: Select beta tag type
echo -e "${YELLOW}Select npm tag for this release:${NC}"
echo -e "  ${BLUE}1)${NC} beta    (recommended for feature testing)"
echo -e "  ${BLUE}2)${NC} alpha   (early/experimental)"
echo -e "  ${BLUE}3)${NC} next    (upcoming major version)"
echo -e "  ${BLUE}4)${NC} canary  (nightly/edge)"
echo ""
read -p "Select option (1/2/3/4): " -n 1 -r TAG_OPTION
echo ""
echo ""

case $TAG_OPTION in
  1) NPM_TAG="beta" ;;
  2) NPM_TAG="alpha" ;;
  3) NPM_TAG="next" ;;
  4) NPM_TAG="canary" ;;
  *)
    echo -e "${RED}Invalid option. Using 'beta'.${NC}"
    NPM_TAG="beta"
    ;;
esac

# Step 2: Check npm login
echo -e "${YELLOW}[1/6] Checking npm authentication...${NC}"
NPM_USER=$(npm whoami 2>/dev/null)
if [ -z "$NPM_USER" ]; then
  echo -e "${RED}❌ Not logged in to npm. Run: npm login${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Logged in as: $NPM_USER${NC}"
echo ""

# Step 3: Show current versions and ask for new version
echo -e "${YELLOW}[2/6] Version Management${NC}"
echo ""

for pkg in "${PACKAGES[@]}"; do
  CURRENT_VERSION=$(node -p "require('./packages/$pkg/package.json').version")
  PKG_NAME=$(node -p "require('./packages/$pkg/package.json').name")

  echo -e "  ${BLUE}$PKG_NAME${NC}"
  echo -e "    Current version: ${YELLOW}$CURRENT_VERSION${NC}"

  # Suggest next beta version
  if [[ $CURRENT_VERSION == *"-beta"* ]] || [[ $CURRENT_VERSION == *"-alpha"* ]] || [[ $CURRENT_VERSION == *"-next"* ]] || [[ $CURRENT_VERSION == *"-canary"* ]]; then
    # Already a prerelease, increment the prerelease number
    BASE_VER=$(echo $CURRENT_VERSION | sed 's/-[a-z]*\.[0-9]*$//')
    PRENUM=$(echo $CURRENT_VERSION | grep -oE '[0-9]+$')
    SUGGESTED="${BASE_VER}-${NPM_TAG}.$((PRENUM + 1))"
  else
    # Stable version, increment PATCH and create new prerelease
    IFS='.' read -ra VER_PARTS <<< "$CURRENT_VERSION"
    PATCH=$((VER_PARTS[2] + 1))
    SUGGESTED="${VER_PARTS[0]}.${VER_PARTS[1]}.${PATCH}-${NPM_TAG}.0"
  fi

  echo -e "    Suggested: ${GREEN}$SUGGESTED${NC}"
  echo ""
  read -p "    Enter new version (or press Enter for $SUGGESTED): " NEW_VERSION

  if [ -z "$NEW_VERSION" ]; then
    NEW_VERSION=$SUGGESTED
  fi

  # Update package.json
  echo -e "    Updating to ${GREEN}$NEW_VERSION${NC}..."

  # Use node to update version
  node -e "
    const fs = require('fs');
    const pkg = require('./packages/$pkg/package.json');
    pkg.version = '$NEW_VERSION';
    fs.writeFileSync('./packages/$pkg/package.json', JSON.stringify(pkg, null, 2) + '\n');
  "

  echo -e "${GREEN}    ✓ Version updated${NC}"
  echo ""
done

# Step 4: Install dependencies
echo -e "${YELLOW}[3/6] Installing dependencies...${NC}"
pnpm install 2>/dev/null
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Step 5: Build packages
echo -e "${YELLOW}[4/6] Building packages...${NC}"
for pkg in "${PACKAGES[@]}"; do
  echo -e "  Building @yourgpt/$pkg..."
  pnpm --filter "@yourgpt/$pkg" build > /dev/null 2>&1
  if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed for @yourgpt/$pkg${NC}"
    exit 1
  fi
  echo -e "${GREEN}  ✓ @yourgpt/$pkg built${NC}"
done
echo ""

# Step 6: Show what will be published
echo -e "${YELLOW}[5/6] Packages to publish:${NC}"
echo ""
for pkg in "${PACKAGES[@]}"; do
  PKG_VERSION=$(node -p "require('./packages/$pkg/package.json').version")
  PKG_NAME=$(node -p "require('./packages/$pkg/package.json').name")
  echo -e "  ${BLUE}$PKG_NAME${NC}@${CYAN}$PKG_VERSION${NC} → ${YELLOW}$NPM_TAG${NC} tag"
done
echo ""

# Step 7: Confirm and publish
echo -e "${YELLOW}[6/6] Ready to publish with '${NPM_TAG}' tag${NC}"
echo ""
echo -e "${CYAN}Users will install with:${NC}"
for pkg in "${PACKAGES[@]}"; do
  PKG_NAME=$(node -p "require('./packages/$pkg/package.json').name")
  echo -e "  npm install ${PKG_NAME}@${NPM_TAG}"
done
echo ""

read -p "Publish these packages? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${RED}Aborted.${NC}"
  exit 1
fi

echo ""
echo -e "${BLUE}Publishing to npm with '$NPM_TAG' tag...${NC}"
echo ""

# Publish each package with tag
for pkg in "${PACKAGES[@]}"; do
  PKG_NAME=$(node -p "require('./packages/$pkg/package.json').name")
  PKG_VERSION=$(node -p "require('./packages/$pkg/package.json').version")

  echo -e "  Publishing $PKG_NAME@$PKG_VERSION → $NPM_TAG..."

  pnpm --filter "@yourgpt/$pkg" publish --tag $NPM_TAG --access public --no-git-checks 2>&1 | grep -E "(notice|error|\+|published)"

  if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo -e "${GREEN}  ✓ $PKG_NAME@$PKG_VERSION published to '$NPM_TAG'${NC}"
  else
    echo -e "${RED}  ❌ Failed to publish $PKG_NAME${NC}"
    exit 1
  fi
done

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  🧪 Beta packages published successfully!${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${BLUE}Install:${NC}"
for pkg in "${PACKAGES[@]}"; do
  PKG_NAME=$(node -p "require('./packages/$pkg/package.json').name")
  echo -e "    npm install ${PKG_NAME}@${NPM_TAG}"
done
echo ""
echo -e "  ${BLUE}npm:${NC} https://www.npmjs.com/org/yourgpt"
echo ""
echo -e "${YELLOW}⚠️  Don't forget to commit the version changes:${NC}"
echo -e "    git add packages/*/package.json"
echo -e "    git commit -m 'chore: bump version to beta'"
echo ""

#!/bin/bash
set -e

# CraftDesk Release Script
# Automates version bumping and GitHub release creation
# NPM publishing happens automatically via GitHub Actions

VERSION_TYPE=${1:-patch}

if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
  echo "Usage: $0 [patch|minor|major]"
  echo ""
  echo "Examples:"
  echo "  $0 patch   # 0.3.0 → 0.3.1 (bug fixes)"
  echo "  $0 minor   # 0.3.0 → 0.4.0 (new features)"
  echo "  $0 major   # 0.3.0 → 1.0.0 (breaking changes)"
  exit 1
fi

# Ensure we're on master
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "master" ]; then
  echo "❌ Error: Must be on master branch to create release"
  echo "Current branch: $CURRENT_BRANCH"
  exit 1
fi

# Ensure working directory is clean
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ Error: Working directory has uncommitted changes"
  git status --short
  exit 1
fi

# Pull latest
echo "📥 Pulling latest changes..."
git pull

# Bump version
echo "📦 Bumping version ($VERSION_TYPE)..."
npm version $VERSION_TYPE --no-git-tag-version

NEW_VERSION=$(node -p "require('./package.json').version")

echo ""
echo "🎯 New version: $NEW_VERSION"
echo ""
echo "📝 Please update CHANGELOG.md with changes for v$NEW_VERSION"
echo "   Add a new section at the top:"
echo ""
echo "   ## [$NEW_VERSION] - $(date +%Y-%m-%d)"
echo ""
echo "Press ENTER when done editing CHANGELOG.md..."
read -r

# Open CHANGELOG in default editor if EDITOR is set
if [ -n "$EDITOR" ]; then
  $EDITOR CHANGELOG.md
fi

# Commit version bump
echo "💾 Committing version bump..."
git add package.json CHANGELOG.md
git commit -m "Bump version to $NEW_VERSION"

# Push to master
echo "⬆️  Pushing to master..."
git push

# Create GitHub release
echo "🚀 Creating GitHub release..."
gh release create "v$NEW_VERSION" \
  --title "Release v$NEW_VERSION" \
  --notes "See [CHANGELOG.md](https://github.com/mensfeld/craftdesk/blob/master/CHANGELOG.md#${NEW_VERSION//.}) for details." \
  --verify-tag

echo ""
echo "✅ Release v$NEW_VERSION created!"
echo "🎉 GitHub Actions will automatically publish to NPM with provenance"
echo ""
echo "📦 NPM Package: https://www.npmjs.com/package/craftdesk"
echo "📋 GitHub Release: https://github.com/mensfeld/craftdesk/releases/tag/v$NEW_VERSION"
echo "🔄 Workflow: https://github.com/mensfeld/craftdesk/actions/workflows/publish.yml"

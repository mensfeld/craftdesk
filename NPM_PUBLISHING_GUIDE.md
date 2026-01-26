# NPM Publishing Guide

## Overview

This project uses **NPM Provenance** for automated publishing from GitHub Actions. This is similar to RubyGems trusted publishing, but not fully tokenless yet.

## NPM Provenance vs RubyGems Trusted Publishing

| Feature | RubyGems Trusted Publishing | NPM Provenance |
|---------|----------------------------|----------------|
| Token Required | ❌ No | ⚠️ Yes (for auth) |
| OIDC Attestation | ✅ Yes | ✅ Yes |
| Proof of Origin | ✅ Yes | ✅ Yes |
| Supply Chain Security | ✅ Yes | ✅ Yes |

NPM provenance adds cryptographic proof that your package was built from your GitHub repo, even though you still need a token for authentication.

## One-Time Setup

### 1. Create NPM Account & Claim Package Name

```bash
# Login to NPM
npm login

# First-time publish to claim the package name
npm publish --access public
```

### 2. Create NPM Automation Token

1. Go to https://www.npmjs.com/settings/[your-username]/tokens
2. Click "Generate New Token"
3. Select **"Automation"** (not Classic or Granular)
4. Copy the token

### 3. Add Token to GitHub Secrets

1. Go to https://github.com/mensfeld/craftdesk/settings/secrets/actions
2. Click "New repository secret"
3. Name: `NPM_TOKEN`
4. Value: Paste your NPM automation token
5. Click "Add secret"

### 4. Enable Provenance on NPM (Optional but recommended)

1. Go to https://www.npmjs.com/package/craftdesk/access
2. Under "Publishing access" → Enable "Require packages to be published with provenance"
3. This ensures all future publishes must include provenance

## Publishing Workflow

### Method 1: Automatic on GitHub Releases (Recommended)

```bash
# 1. Update version in package.json
npm version patch  # or minor, major

# 2. Update CHANGELOG.md with changes

# 3. Commit and push
git add package.json CHANGELOG.md
git commit -m "Bump version to $(node -p "require('./package.json').version")"
git push

# 4. Create GitHub release
gh release create v$(node -p "require('./package.json').version") \
  --title "v$(node -p "require('./package.json').version")" \
  --notes "See CHANGELOG.md for details"

# 5. GitHub Actions will automatically publish to NPM ✅
```

### Method 2: Manual Trigger

```bash
# Go to GitHub Actions → Publish to NPM → Run workflow
# Optionally specify a version to bump
```

### Method 3: Fully Automated with Release Script

Create `scripts/release.sh`:

```bash
#!/bin/bash
set -e

VERSION_TYPE=${1:-patch}  # patch, minor, or major

echo "Creating $VERSION_TYPE release..."

# Update version
npm version $VERSION_TYPE --no-git-tag-version

NEW_VERSION=$(node -p "require('./package.json').version")

# Update changelog placeholder
echo "Please update CHANGELOG.md with changes for v$NEW_VERSION"
read -p "Press enter when done..."

# Commit changes
git add package.json CHANGELOG.md
git commit -m "Bump version to $NEW_VERSION"
git push

# Create release
gh release create "v$NEW_VERSION" \
  --title "Release v$NEW_VERSION" \
  --notes-file CHANGELOG.md

echo "✅ Release v$NEW_VERSION created!"
echo "🚀 GitHub Actions will publish to NPM automatically"
```

Usage:
```bash
chmod +x scripts/release.sh
./scripts/release.sh patch   # 0.3.0 → 0.3.1
./scripts/release.sh minor   # 0.3.0 → 0.4.0
./scripts/release.sh major   # 0.3.0 → 1.0.0
```

## What Gets Published

Based on `.npmignore` and `package.json` "files" field:

✅ **Included:**
- `dist/` (compiled JavaScript)
- `bin/` (CLI entry point)
- `README.md`
- `CHANGELOG.md`
- `LICENSE.md`
- `package.json`

❌ **Excluded:**
- `src/` (TypeScript source)
- `tests/`
- `.github/`
- `docs/`
- `coverage/`
- Development config files

## Verification

After publishing, verify provenance:

```bash
# Check the package on NPM
npm view craftdesk

# Verify provenance signature
npm audit signatures
```

You should see a ✅ indicator on the NPM package page showing provenance is enabled.

## Troubleshooting

### "403 Forbidden" Error
- Check NPM_TOKEN is valid and has publish permissions
- Ensure package name isn't already taken by someone else
- Try `npm whoami` to verify authentication

### "Provenance failed" Error
- Ensure `id-token: write` permission is in workflow
- Check that you're publishing from GitHub Actions (not local)
- Verify repository is public (provenance requires public repos)

### "Version already exists"
- You forgot to bump the version in package.json
- Run `npm version patch` before creating release

## Quick Start (TL;DR)

```bash
# One-time setup
npm login
npm publish --access public  # Claims package name
# Add NPM_TOKEN to GitHub secrets

# Every release after that
npm version patch
git add package.json CHANGELOG.md
git commit -m "Bump to 0.3.1"
git push
gh release create v0.3.1 --title "v0.3.1" --generate-notes
# ✅ GitHub Actions publishes automatically with provenance
```

## Future: True Tokenless Publishing?

NPM is working on full OIDC publishing (like RubyGems), but it's not available yet. When it arrives, you'll be able to remove the NPM_TOKEN secret entirely. Track progress at: https://github.com/npm/rfcs/issues/626

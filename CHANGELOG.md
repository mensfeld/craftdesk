# Changelog

All notable changes to this project will be documented in this file.

## 0.4.0 (Unreleased)

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

### Changed
- Updated type definitions to include `collection` in all craft type unions
- Enhanced `getTypeDirectory()` to return `collections` for collection type
- Improved craft type inference to prioritize collection detection

### Documentation
- Significantly enhanced Monorepo Support section in README
- Added comprehensive examples of GitHub URL auto-conversion
- Documented all git URL syntax variations (#path:, #file:, etc.)
- Added real-world monorepo examples and use cases
- Clarified lockfile tracking for monorepo subdirectories
- Added Format Conversion section with examples and use cases
- Documented all supported target formats and their characteristics

## 0.3.0 (2025-11-18)

### Initial Release
- Package manager for Claude Code skills, agents, commands, hooks, and plugins
- Git dependency support with monorepo subdirectory extraction
- Lockfile-based reproducible installations
- Plugin system with automatic dependency resolution
- Auto-conversion of GitHub URLs
- Settings integration with `.claude/settings.json`
- MCP server support

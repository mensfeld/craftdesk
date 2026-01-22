# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.4.0 (Unreleased)

### Added
- Added `collection` craft type for grouping related crafts together
- Collections are automatically detected from `COLLECTION.md` marker files
- Collections are installed in `.claude/collections/` directory
- Type inference now supports collection detection from filenames and directory names
- Comprehensive integration tests for collection functionality
- Detailed README documentation explaining how collections work

### Changed
- Updated type definitions to include `collection` in all craft type unions
- Enhanced `getTypeDirectory()` to return `collections` for collection type
- Improved craft type inference to prioritize collection detection

## 0.3.0 (2025-11-18)

### Initial Release
- Package manager for Claude Code skills, agents, commands, hooks, and plugins
- Git dependency support with monorepo subdirectory extraction
- Lockfile-based reproducible installations
- Plugin system with automatic dependency resolution
- Auto-conversion of GitHub URLs
- Settings integration with `.claude/settings.json`
- MCP server support

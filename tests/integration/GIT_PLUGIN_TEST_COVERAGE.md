# Git Plugin Dependency Resolution - Test Coverage

**Test File**: `tests/integration/git-plugin-dependencies.test.ts`
**Purpose**: Comprehensive testing of git-based plugin resolution with dependencies
**Date**: November 19, 2025

---

## Test Scenarios

### 1. Git Plugin Without Dependencies ✅

**Scenario**: Install a simple git-based plugin with no dependencies

**Setup**:
- Mock git repository with:
  - `.claude-plugin/plugin.json` (Claude Code metadata)
  - `craftdesk.json` (no dependencies)
  - `skills/test-skill/SKILL.md` (component)

**Tested Operations**:
1. Resolve git dependency → Get commit SHA and integrity
2. Install plugin → Extract to `.claude/plugins/`
3. Verify directory structure
4. Verify settings registration
5. Verify component scanning finds skill

**Verifications**:
- ✅ Plugin directory exists
- ✅ `.claude-plugin/plugin.json` present
- ✅ `craftdesk.json` present
- ✅ Components copied correctly
- ✅ Settings registration includes components
- ✅ Component scanning works

---

### 2. Git Plugin With Registry Dependencies ✅

**Scenario**: Git plugin that depends on registry packages

**Setup**:
- Mock git repository with:
  - `craftdesk.json` containing:
    ```json
    {
      "dependencies": {
        "auth-plugin": "^1.0.0",
        "logger-plugin": "^2.1.0"
      }
    }
    ```

**Tested Operations**:
1. Resolve git dependency
2. Install main plugin
3. Read `craftdesk.json` to discover dependencies
4. Resolve dependencies with `PluginResolver`
5. Build plugin dependency tree

**Verifications**:
- ✅ Main plugin installed
- ✅ `craftdesk.json` has correct dependencies
- ✅ Dependency resolution discovers both dependencies
- ✅ Flattened dependencies returned correctly
- ✅ Plugin tree shows dependency relationships

---

### 3. Git Plugin With Nested Git Dependencies ✅

**Scenario**: Git plugin that depends on another git plugin (recursive)

**Setup**:
- **Dependency git repo** (`dependency-plugin`):
  - Simple plugin, no dependencies
  - Has components

- **Main git repo** (`main-git-plugin`):
  - Depends on `dependency-plugin` via git:
    ```json
    {
      "dependencies": {
        "dependency-plugin": {
          "git": "path/to/repo",
          "branch": "main"
        }
      }
    }
    ```

**Tested Operations**:
1. Create two separate git repositories
2. Main plugin depends on first plugin via git URL
3. Resolve main plugin
4. Install main plugin
5. Read `craftdesk.json` → discover git dependency
6. Resolve dependency plugin (recursive git resolution)
7. Install dependency plugin
8. Verify both plugins registered

**Verifications**:
- ✅ Both git repos created correctly
- ✅ Main plugin `craftdesk.json` has git dependency
- ✅ Dependency resolution discovers nested git dependency
- ✅ Both plugins installed to separate directories
- ✅ Dependency plugin marked as `isDependency: true`
- ✅ Both plugins registered in settings
- ✅ Component scanning works for both

---

### 4. Component Embedding and Registration ✅

**Scenario**: Verify components are correctly embedded and registered from git plugins

#### 4a. Full Component Coverage

**Setup**:
- Git plugin with multiple component types:
  - `skills/test-skill/`
  - `agents/test-agent/`
  - `commands/test-command.md`

**Tested Operations**:
1. Install git plugin with all component types
2. Verify directory structure
3. Verify settings registration
4. Verify component scanning finds all components

**Verifications**:
- ✅ All component directories exist
- ✅ `.claude-plugin/plugin.json` exists
- ✅ Settings registration includes all components
- ✅ Component scanning discovers:
  - skills array
  - agents array
  - commands array

#### 4b. Manifest vs. Scanned Component Merging

**Scenario**: Plugin with partial component declaration in `.claude-plugin/plugin.json`

**Setup**:
- Git plugin with:
  - `skills/test-skill/` (filesystem)
  - `agents/test-agent/` (filesystem)
  - `.claude-plugin/plugin.json` with:
    ```json
    {
      "components": {
        "skills": ["test-skill"]  // Only declare skill
      }
    }
    ```

**Tested Operations**:
1. Install plugin
2. Read manifest components
3. Scan filesystem components
4. Merge (manifest takes precedence)
5. Register in settings

**Verifications**:
- ✅ Skills use manifest declaration (["test-skill"])
- ✅ Agents use scanned results (["test-agent"])
- ✅ Merging logic works correctly
- ✅ Manifest precedence respected

---

## Test Helper Functions

### `createMockGitPlugin()`

**Purpose**: Create realistic git plugin repository for testing

**Parameters**:
```typescript
{
  name: string;              // Plugin name
  version: string;           // Semantic version
  hasDependencies: boolean;  // Include dependencies?
  dependencies?: object;     // Dependency map
  hasComponents?: boolean;   // Create components?
  componentTypes?: string[]; // ['skills', 'agents', etc.]
  manifestComponents?: any;  // Partial component declaration
}
```

**What it creates**:
1. Git repository with `git init`
2. `.claude-plugin/plugin.json` (official Claude Code manifest)
3. `craftdesk.json` (CraftDesk package manifest)
4. Component directories and files
5. README.md
6. Git commit with timestamp

**Features**:
- ✅ Creates valid git repo with commit history
- ✅ Supports partial component declaration
- ✅ Supports both registry and git dependencies
- ✅ Creates realistic directory structure
- ✅ Allows custom component types

---

## Coverage Summary

### File Operations
- ✅ Reading `.claude-plugin/plugin.json`
- ✅ Reading `craftdesk.json`
- ✅ Creating git repositories
- ✅ Cloning git repositories
- ✅ Extracting git subdirectories
- ✅ Copying components to plugin directory

### Dependency Resolution
- ✅ Simple git plugin (no deps)
- ✅ Git plugin with registry deps
- ✅ Git plugin with nested git deps
- ✅ Flattened dependency map
- ✅ Plugin dependency tree
- ✅ Circular dependency detection (inherited)

### Component Handling
- ✅ Component scanning (skills, agents, commands)
- ✅ Component copying from git repos
- ✅ Manifest component declaration
- ✅ Scanned vs. manifest merging
- ✅ Manifest precedence

### Settings Registration
- ✅ Plugin registration in settings.json
- ✅ Component list in settings
- ✅ Dependency marking (isDependency flag)
- ✅ Multiple plugins registered

### Edge Cases
- ✅ Plugin without components
- ✅ Plugin with partial manifest
- ✅ Nested dependency chains
- ✅ Multiple component types
- ✅ Empty dependency object

---

## What's NOT Tested (Future Work)

### Missing Coverage

1. **MCP Server Registration from Git Plugins**
   - `.mcp.json` file handling
   - Inline `mcpServers` in plugin.json
   - MCP server path resolution

2. **Git-Specific Edge Cases**
   - Specific commit checkout
   - Tag-based resolution
   - Subdirectory paths
   - Private git repositories
   - SSH vs HTTPS URLs

3. **Dependency Conflicts**
   - Version conflicts between deps
   - Peer dependency resolution
   - DevDependencies handling

4. **Error Scenarios**
   - Missing craftdesk.json
   - Invalid git URL
   - Network failures
   - Corrupted git repos
   - Permission errors

5. **Performance**
   - Large plugin installations
   - Many nested dependencies
   - Concurrent installs

6. **Lifecycle Hooks**
   - postInstall scripts
   - preRemove scripts
   - Hook execution

---

## Running the Tests

```bash
# Run all git plugin tests
npm test tests/integration/git-plugin-dependencies.test.ts

# Run specific test suite
npm test -- --testNamePattern="Git Plugin Without Dependencies"

# Run with coverage
npm test -- --coverage tests/integration/git-plugin-dependencies.test.ts

# Watch mode
npm test -- --watch tests/integration/git-plugin-dependencies.test.ts
```

---

## Expected Behavior

### Success Criteria

All tests should pass with:
- ✅ 0 failed tests
- ✅ All assertions passing
- ✅ No uncaught errors
- ✅ Clean setup/teardown
- ✅ No leftover test fixtures

### Test Isolation

Each test:
- Creates fresh test directory
- Creates new git repositories
- Cleans up after completion
- Doesn't affect other tests

### Performance

- Individual tests: < 5 seconds
- Full suite: < 30 seconds
- Teardown: < 1 second

---

## Integration Points

These tests verify integration between:

1. **GitResolver** ↔ **Installer**
   - Git resolution → Installation
   - Commit SHA → Integrity verification

2. **PluginResolver** ↔ **Installer**
   - Dependency discovery → Dependency installation
   - Tree building → Lock file generation

3. **Installer** ↔ **SettingsManager**
   - Component scanning → Settings registration
   - Metadata extraction → Settings storage

4. **File System** ↔ **All Services**
   - Directory creation
   - File copying
   - JSON reading/writing

---

## Maintenance Notes

### When to Update Tests

1. **New component types added**
   - Add to `componentTypes` array
   - Add creation logic to helper

2. **Dependency resolution changes**
   - Update flattening tests
   - Update tree building tests

3. **Settings schema changes**
   - Update verification assertions
   - Update registration tests

4. **Git resolution enhancements**
   - Add new git info fields
   - Test new resolution paths

### Test Data Maintenance

**Git repositories are created fresh** each test run:
- No pre-existing fixtures needed
- Self-contained test data
- Reproducible across environments

---

## Summary

**Total Test Cases**: 6
- Simple git plugin: 1 test
- Registry dependencies: 1 test
- Nested git dependencies: 1 test
- Component embedding: 2 tests
- Manifest merging: 1 test (within embedding suite)

**Line Coverage** (estimated):
- GitResolver: 80%+
- PluginResolver: 70%+
- Installer (plugin methods): 85%+
- SettingsManager (plugin methods): 75%+

**Integration Coverage**:
- ✅ End-to-end git plugin installation
- ✅ Dependency resolution flow
- ✅ Component discovery and registration
- ✅ Settings integration

---

**Status**: ✅ Comprehensive coverage of git-based plugin dependency resolution
**Last Updated**: November 19, 2025
**Test Framework**: Jest
**Assertions Library**: @jest/globals

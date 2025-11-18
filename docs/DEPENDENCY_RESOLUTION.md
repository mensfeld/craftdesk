# CraftDesk Dependency Resolution

## Overview

CraftDesk supports multiple dependency sources and resolves them intelligently, including transitive dependencies.

## Dependency Sources

### 1. Registry Dependencies (Default)

Standard dependencies are fetched from registries:

```json
{
  "dependencies": {
    "ruby-on-rails": "^7.0.0"
  }
}
```

**Resolution Process:**
1. Query the registry API for package metadata
2. Resolve version constraints
3. Fetch transitive dependencies
4. Generate lockfile with exact versions

### 2. Git Dependencies

Dependencies can be fetched directly from git repositories:

```json
{
  "dependencies": {
    "my-skill": {
      "git": "https://github.com/user/repo.git",
      "branch": "main"
    }
  }
}
```

**Resolution Process:**
1. Clone the repository (shallow clone for efficiency)
2. Check out specified branch/tag/commit
3. Look for `craftdesk.json` in the repository
4. Extract metadata and dependencies
5. Recursively resolve any dependencies found

## Handling Missing craftdesk.json

When a git dependency doesn't have a `craftdesk.json` file, the CLI:

### 1. Generates Minimal Metadata

```json
{
  "name": "repository-name",
  "version": "branch-or-tag-or-commit",
  "type": "skill",  // Inferred from structure
  "description": "Git dependency from <url>",
  "dependencies": {}
}
```

### 2. Type Inference

The system tries to infer the craft type by looking for:

1. **Marker Files:**
   - `SKILL.md` → type: "skill"
   - `AGENT.md` → type: "agent"
   - `COMMAND.md` → type: "command"
   - `HOOK.md` → type: "hook"

2. **Directory Name Patterns:**
   - Contains "skill" → type: "skill"
   - Contains "agent" → type: "agent"
   - Contains "command" → type: "command"
   - Contains "hook" → type: "hook"

3. **Default:** type: "skill"

## Monorepo Support

For git repositories containing multiple crafts:

```json
{
  "dependencies": {
    "auth-handler": {
      "git": "https://github.com/company/monorepo.git",
      "tag": "v3.0.0",
      "path": "packages/auth"
    },
    "data-processor": {
      "git": "https://github.com/company/monorepo.git",
      "tag": "v3.0.0",
      "path": "agents/processor"
    }
  }
}
```

The CLI:
1. Clones the repository once
2. Looks for `craftdesk.json` in each specified `path`
3. Installs only the contents of the specified subdirectory

## Transitive Dependencies

### From Registry Packages

Registry packages include their dependencies in metadata:
```json
{
  "name": "ruby-on-rails",
  "version": "7.1.0",
  "dependencies": {
    "activerecord": "^7.1.0",
    "actionpack": "^7.1.0"
  }
}
```

### From Git Packages

Git packages' dependencies are discovered by reading their `craftdesk.json`:
```json
// In https://github.com/user/my-skill.git/craftdesk.json
{
  "name": "my-skill",
  "version": "2.0.0",
  "dependencies": {
    "postgres-expert": "^1.0.0",  // Will be resolved from registry
    "helper-lib": {
      "git": "https://github.com/user/helper.git"  // Will be resolved from git
    }
  }
}
```

## Resolution Algorithm

```typescript
1. Start with direct dependencies from craftdesk.json
2. For each dependency:
   a. If registry: Query API for metadata
   b. If git: Clone and extract craftdesk.json
3. Add discovered dependencies to resolution queue
4. Repeat until all dependencies resolved
5. Check for version conflicts
6. Generate lockfile with exact versions
```

## Lockfile Structure

The lockfile captures the complete resolution:

```json
{
  "version": "1.0.0",
  "lockfileVersion": 1,
  "crafts": {
    "my-skill": {
      "version": "2.0.0",
      "resolved": "https://github.com/user/my-skill.git",
      "integrity": "abc123def456",  // Git commit hash
      "type": "skill",
      "git": "https://github.com/user/my-skill.git",
      "branch": "main",
      "commit": "abc123def456789012345678901234567890abcd",
      "dependencies": {
        "postgres-expert": "^1.0.0"
      }
    },
    "postgres-expert": {
      "version": "1.2.3",
      "resolved": "https://craftdesk.ai/api/v1/crafts/anthropic/postgres-expert/versions/1.2.3/download",
      "integrity": "sha256-xyz789...",
      "type": "agent",
      "registry": "https://craftdesk.ai",
      "dependencies": {}
    }
  }
}
```

## Error Handling

### Missing Dependencies
- Git repos without craftdesk.json: Generate minimal metadata
- Unreachable git repos: Fail with clear error message
- Registry packages not found: Fail with suggestions

### Version Conflicts
- Currently: Last-write-wins
- Future: Interactive conflict resolution

### Circular Dependencies
- Detected during resolution
- Fails with error showing the circular chain

## Performance Optimizations

1. **Shallow Clones:** Git repos cloned with `--depth 1`
2. **Parallel Resolution:** Registry queries run in parallel
3. **Caching:** Git repos cached for 15 minutes during resolution
4. **Minimal Transfers:** Only specified subdirectories copied for monorepos

## Example: Mixed Resolution

Given this `craftdesk.json`:
```json
{
  "dependencies": {
    "ruby-on-rails": "^7.0.0",
    "custom-auth": {
      "git": "https://github.com/company/auth.git",
      "branch": "main"
    }
  }
}
```

Resolution steps:
1. Query registry for ruby-on-rails@^7.0.0
   - Resolves to 7.1.2
   - Has dependencies: activerecord@^7.1.0, actionpack@^7.1.0
2. Clone https://github.com/company/auth.git
   - Check out main branch
   - Read craftdesk.json
   - Has dependency: jwt-helper@^2.0.0
3. Resolve transitive dependencies:
   - activerecord@^7.1.0 → 7.1.0
   - actionpack@^7.1.0 → 7.1.0
   - jwt-helper@^2.0.0 → 2.1.0
4. Generate complete lockfile with all 5 packages
# CraftDesk CLI API Documentation

## Overview

This document describes the internal API for the CraftDesk CLI, useful for contributors and developers extending the functionality.

## Core Services

### ConfigManager

Manages configuration and registry resolution.

```typescript
import { configManager } from './services/config-manager';
```

#### Methods

##### `getRegistryForPackage(packageName: string): Promise<string>`

Returns the appropriate registry URL for a given package.

**Parameters:**
- `packageName` - Package name (may be scoped like `@company/package`)

**Returns:** Registry URL

**Example:**
```typescript
const registry = await configManager.getRegistryForPackage('@company/auth');
// Returns: 'https://company.internal' (if configured)
```

##### `getAuthToken(registryName: string): Promise<string | null>`

Gets authentication token from environment variables.

**Parameters:**
- `registryName` - Registry name from craftdesk.json

**Returns:** Auth token or null

**Environment Variable Format:** `CRAFTDESK_AUTH_{REGISTRY_NAME_UPPERCASE}`

**Example:**
```typescript
// Looks for CRAFTDESK_AUTH_COMPANY_PRIVATE
const token = await configManager.getAuthToken('company-private');
```

##### `getInstallPath(): string`

Returns the installation directory path.

**Returns:** `.claude` (relative path)

##### `getCraftDeskJson(): Promise<CraftDeskJson | null>`

Reads and caches the craftdesk.json file.

**Returns:** Parsed craftdesk.json or null if not found

---

### GitResolver

Resolves git dependencies and extracts metadata.

```typescript
import { GitResolver } from './services/git-resolver';

const resolver = new GitResolver();
```

#### Methods

##### `resolveGitDependency(gitInfo: GitDependencyInfo): Promise<GitDependencyInfo>`

Resolves a git dependency by cloning and reading metadata.

**Parameters:**
```typescript
interface GitDependencyInfo {
  url: string;
  branch?: string;
  tag?: string;
  commit?: string;
  path?: string;
  craftDeskJson?: CraftDeskJson;
  resolvedCommit?: string;
}
```

**Returns:** Enhanced GitDependencyInfo with craftdesk.json and resolved commit

**Example:**
```typescript
const info = await resolver.resolveGitDependency({
  url: 'https://github.com/company/auth.git',
  branch: 'main',
  path: 'packages/auth'
});

console.log(info.craftDeskJson.name);     // 'auth-skill'
console.log(info.resolvedCommit);          // Full commit hash
```

##### `resolveAllDependencies(dependencies: Record<string, string | DependencyConfig>): Promise<{resolved, lockfile}>`

Resolves all dependencies including transitive dependencies.

**Parameters:**
- `dependencies` - Map of dependency names to version strings or config objects

**Returns:**
```typescript
{
  resolved: Record<string, any>;  // All resolved dependencies
  lockfile: {                     // Generated lockfile structure
    version: string;
    lockfileVersion: number;
    crafts: Record<string, any>;
  }
}
```

**Example:**
```typescript
const result = await resolver.resolveAllDependencies({
  'ruby-on-rails': '^7.0.0',
  'custom-auth': {
    git: 'https://github.com/company/auth.git',
    branch: 'main'
  }
});
```

---

### Installer

Handles installation of crafts from various sources.

```typescript
import { Installer } from './services/installer';

const installer = new Installer();
```

#### Methods

##### `installFromLockfile(lockfile: CraftDeskLock): Promise<void>`

Installs all crafts defined in a lockfile.

**Parameters:**
```typescript
interface CraftDeskLock {
  version: string;
  lockfileVersion: number;
  crafts: Record<string, LockEntry>;
}
```

**Throws:** Error if any craft fails to install

**Example:**
```typescript
const lockfile = await readLockfile();
await installer.installFromLockfile(lockfile);
```

##### `installCraft(name: string, entry: LockEntry): Promise<void>`

Installs a single craft.

**Parameters:**
- `name` - Craft name
- `entry` - Lockfile entry with installation details

**Example:**
```typescript
await installer.installCraft('ruby-on-rails', {
  version: '7.1.0',
  resolved: 'https://craftdesk.ai/download/...',
  type: 'skill',
  dependencies: {}
});
```

---

### RegistryClient

Communicates with CraftDesk registries.

```typescript
import { registryClient } from './services/registry-client';
```

#### Methods

##### `getCraftInfo(name: string, version?: string, registry?: string): Promise<CraftInfo | null>`

Fetches craft information from registry.

**Parameters:**
- `name` - Craft name
- `version` - Optional version constraint
- `registry` - Optional registry URL override

**Returns:** Craft metadata or null if not found

**Example:**
```typescript
const info = await registryClient.getCraftInfo('ruby-on-rails', '^7.0.0');
console.log(info.version);  // '7.1.0'
```

---

## Type Definitions

### CraftDeskJson

```typescript
interface CraftDeskJson {
  name: string;
  version: string;
  type: 'skill' | 'agent' | 'command' | 'hook';
  description?: string;
  author?: string;
  dependencies?: Record<string, string | DependencyConfig>;
  devDependencies?: Record<string, string | DependencyConfig>;
  registries?: Record<string, RegistryConfig>;
}
```

### DependencyConfig

```typescript
interface DependencyConfig {
  version?: string;      // For registry deps
  registry?: string;     // Custom registry URL
  git?: string;          // Git repository URL
  branch?: string;       // Git branch
  tag?: string;          // Git tag
  commit?: string;       // Git commit hash
  path?: string;         // Subdirectory path for monorepos
}
```

### RegistryConfig

```typescript
interface RegistryConfig {
  url: string;
  scope?: string;        // Scope for scoped packages (@company)
  auth?: string;         // DEPRECATED: Use environment variables
}
```

### LockEntry

```typescript
interface LockEntry {
  version: string;
  resolved: string;      // Download URL or git URL
  integrity: string;     // SHA-256 hash or commit hash
  type: 'skill' | 'agent' | 'command' | 'hook';
  author?: string;
  dependencies: Record<string, string>;

  // Git-specific fields
  git?: string;
  branch?: string;
  tag?: string;
  commit?: string;
  path?: string;

  // Registry-specific fields
  registry?: string;
}
```

---

## Utility Functions

### File System Utilities

```typescript
import { readCraftDeskJson, writeCraftDeskJson, ensureDir } from './utils/file-system';
```

#### `readCraftDeskJson(): Promise<CraftDeskJson | null>`

Reads craftdesk.json from current directory.

#### `writeCraftDeskJson(data: CraftDeskJson): Promise<void>`

Writes craftdesk.json to current directory.

#### `ensureDir(dirPath: string): Promise<void>`

Creates directory if it doesn't exist.

### Logger

```typescript
import { logger } from './utils/logger';
```

#### Methods

- `info(message: string)` - Info message
- `success(message: string)` - Success message (green)
- `error(message: string)` - Error message (red)
- `warn(message: string)` - Warning message (yellow)
- `debug(message: string)` - Debug message (if verbose)
- `startSpinner(message: string)` - Start loading spinner
- `updateSpinner(message: string)` - Update spinner message
- `succeedSpinner(message?: string)` - Stop spinner with success
- `failSpinner(message?: string)` - Stop spinner with failure

---

## Extension Points

### Adding New Craft Types

1. Update type definition in `src/types/craftdesk-json.ts`:

```typescript
export type CraftType = 'skill' | 'agent' | 'command' | 'hook' | 'your-new-type';
```

2. Update installer's `getTypeDirectory()` method:

```typescript
private getTypeDirectory(type: CraftType): string {
  switch (type) {
    case 'your-new-type':
      return 'your-types';
    // ...
  }
}
```

3. Update git-resolver's `inferCraftType()` method:

```typescript
if (files.includes('YOUR_TYPE.md')) return 'your-new-type';
```

### Adding New Commands

1. Create command file in `src/commands/`:

```typescript
import { Command } from 'commander';

export function createYourCommand(): Command {
  return new Command('your-command')
    .description('Your command description')
    .action(async () => {
      // Implementation
    });
}
```

2. Register in `src/index.ts`:

```typescript
import { createYourCommand } from './commands/your-command';

program.addCommand(createYourCommand());
```

### Adding New Dependency Sources

1. Update `DependencyConfig` interface
2. Modify `GitResolver.resolveAllDependencies()` to handle new source type
3. Update `Installer.installCraft()` to support new installation method

---

## Error Handling

All service methods may throw errors. Wrap calls in try-catch:

```typescript
try {
  await installer.installCraft(name, entry);
} catch (error) {
  logger.error(`Installation failed: ${error.message}`);
  process.exit(1);
}
```

## Testing

See [TESTING.md](./TESTING.md) for testing guidelines and examples.

## Contributing

When adding new functionality:

1. Add JSDoc comments to all public functions
2. Include usage examples in documentation
3. Add unit tests for new functions
4. Update integration tests if CLI behavior changes
5. Update type definitions
6. Add inline comments for complex algorithms

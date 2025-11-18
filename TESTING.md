# Testing Guide

## Overview

The CraftDesk CLI uses **Vitest** as its testing framework, providing fast and modern testing capabilities with TypeScript support.

## Test Structure

```
tests/
├── unit/                    # Unit tests for individual modules
│   ├── config-manager.test.ts
│   ├── git-resolver.test.ts
│   └── installer.test.ts
├── integration/             # Integration tests for CLI commands
│   ├── init-command.test.ts
│   └── list-command.test.ts
├── fixtures/                # Test fixtures and mock data
│   ├── craftdesk.json
│   └── craftdesk-git.json
└── helpers/                 # Test utilities
    └── test-utils.ts
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run tests with coverage
```bash
npm run test:coverage
```

### Run tests with UI
```bash
npm run test:ui
```

## Test Coverage

Coverage reports are generated using Vitest's built-in coverage tool (v8 provider).

### Viewing Coverage

After running `npm run test:coverage`, view the report:

```bash
# Terminal summary is displayed automatically

# Open HTML report in browser
open coverage/index.html
```

### Coverage Thresholds

Current coverage configuration in `vitest.config.ts`:
- Excludes: `node_modules/`, `dist/`, `bin/`, test files

## Writing Tests

### Unit Tests

Unit tests focus on testing individual functions and classes in isolation.

**Example: Testing ConfigManager**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigManager } from '../../src/services/config-manager';
import { createTempDir, cleanupTempDir } from '../helpers/test-utils';

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let tempDir: string;

  beforeEach(async () => {
    configManager = new ConfigManager();
    tempDir = await createTempDir('config-test-');
    process.chdir(tempDir);
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('should return default registry when no craftdesk.json exists', async () => {
    const registry = await configManager.getRegistryForPackage('test-package');
    expect(registry).toBe('https://craftdesk.ai');
  });
});
```

### Integration Tests

Integration tests verify that CLI commands work correctly end-to-end.

**Example: Testing CLI Commands**

```typescript
import { execSync } from 'child_process';
import path from 'path';

describe('craftdesk init command', () => {
  const cliPath = path.join(__dirname, '../../dist/index.js');

  it('should create a new craftdesk.json file', () => {
    execSync(`node ${cliPath} init --name test --version 1.0.0 --type skill`);

    const exists = await fs.pathExists('craftdesk.json');
    expect(exists).toBe(true);
  });
});
```

### Test Utilities

The `tests/helpers/test-utils.ts` file provides helper functions:

- `createTempDir(prefix)` - Creates a temporary test directory
- `cleanupTempDir(dirPath)` - Removes a temporary directory
- `copyFixture(name, targetDir)` - Copies a fixture file
- `readJsonFile(path)` - Reads and parses JSON file
- `writeJsonFile(path, data)` - Writes JSON to file
- `createMockCraftInfo(name, version)` - Creates mock craft metadata

### Mocking

Use Vitest's built-in mocking for external dependencies:

```typescript
import { vi } from 'vitest';
import { execSync } from 'child_process';

vi.mock('child_process', () => ({
  execSync: vi.fn()
}));

// In your test
const mockExecSync = vi.mocked(execSync);
mockExecSync.mockReturnValue(Buffer.from('output'));
```

## CI/CD Integration

### GitHub Actions

The `.github/workflows/ci.yml` file runs tests automatically on:
- Push to main/master/develop branches
- Pull requests to main/master/develop branches

The workflow:
1. Tests on Node.js 16.x, 18.x, and 20.x
2. Generates coverage report (Node 20.x only)
3. Uploads coverage to Codecov
4. Verifies TypeScript compilation
5. Builds the project

### Local CI Simulation

Run the same checks locally before pushing:

```bash
# Run tests
npm test

# Generate coverage
npm run test:coverage

# Type check
npx tsc --noEmit

# Build
npm run build
```

## Test Best Practices

### 1. Isolation
- Each test should be independent
- Use `beforeEach` and `afterEach` for setup/teardown
- Clean up temporary files and directories

### 2. Descriptive Names
```typescript
// Good
it('should return scoped registry for scoped package')

// Bad
it('test1')
```

### 3. Arrange-Act-Assert Pattern
```typescript
it('should parse git URL with branch', () => {
  // Arrange
  const url = 'https://github.com/user/repo.git#main';

  // Act
  const result = parseGitUrl(url);

  // Assert
  expect(result.branch).toBe('main');
  expect(result.url).toBe('https://github.com/user/repo.git');
});
```

### 4. Test Edge Cases
- Empty inputs
- Invalid data
- Error conditions
- Boundary values

### 5. Mock External Dependencies
- File system operations (when appropriate)
- Network requests
- Child processes
- Environment variables

## Debugging Tests

### Run specific test file
```bash
npm test tests/unit/config-manager.test.ts
```

### Run tests matching pattern
```bash
npm test -- --grep "git dependency"
```

### Debug with breakpoints
```bash
node --inspect-brk ./node_modules/.bin/vitest run
```

Then attach your debugger (VS Code, Chrome DevTools, etc.)

## Continuous Improvement

### Coverage Goals
- Maintain >80% code coverage
- Focus on critical paths first
- Add tests when fixing bugs

### Test Maintenance
- Update tests when changing functionality
- Remove obsolete tests
- Keep test data fixtures up to date
- Review test failures in CI promptly

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Effective Testing Strategies](https://martinfowler.com/articles/practical-test-pyramid.html)

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { createTempDir, cleanupTempDir, writeJsonFile } from '../helpers/test-utils';
import path from 'path';
import fs from 'fs-extra';

/**
 * Helper to parse JSON output from CLI, filtering out non-JSON lines
 */
function parseJsonOutput(output: string): any {
  // Find the JSON array in the output
  const lines = output.split('\n');
  let jsonStart = -1;
  let jsonEnd = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      jsonStart = i;
      break;
    }
  }

  if (jsonStart === -1) {
    return [];
  }

  // Find the end of JSON
  let bracketCount = 0;
  for (let i = jsonStart; i < lines.length; i++) {
    const line = lines[i];
    for (const char of line) {
      if (char === '[' || char === '{') bracketCount++;
      if (char === ']' || char === '}') bracketCount--;
    }
    if (bracketCount === 0) {
      jsonEnd = i;
      break;
    }
  }

  if (jsonEnd === -1) jsonEnd = lines.length - 1;

  const jsonStr = lines.slice(jsonStart, jsonEnd + 1).join('\n');
  return JSON.parse(jsonStr);
}

describe('craftdesk outdated command', () => {
  let tempDir: string;
  let originalCwd: string;
  const cliPath = path.join(__dirname, '../../dist/index.js');

  beforeEach(async () => {
    tempDir = await createTempDir('outdated-test-');
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTempDir(tempDir);
  });

  it('should show message when no crafts are installed', async () => {
    // Create craftdesk.json
    await writeJsonFile(path.join(tempDir, 'craftdesk.json'), {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {}
    });

    const output = execSync(`node ${cliPath} outdated`, {
      encoding: 'utf-8'
    });

    expect(output).toContain('No crafts installed');
  });

  it('should error when no craftdesk.json exists', async () => {
    try {
      execSync(`node ${cliPath} outdated`, {
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      expect.fail('Should have thrown');
    } catch (error: any) {
      expect(error.stderr || error.message).toContain('craftdesk.json');
    }
  });

  it('should output JSON when --json flag is used', async () => {
    // Create craftdesk.json
    await writeJsonFile(path.join(tempDir, 'craftdesk.json'), {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        'test/craft': '^1.0.0'
      }
    });

    // Create lockfile with installed craft
    await writeJsonFile(path.join(tempDir, 'craftdesk.lock'), {
      version: '1.0.0',
      lockfileVersion: 1,
      generatedAt: new Date().toISOString(),
      crafts: {
        'test/craft': {
          version: '1.0.0',
          resolved: '/api/v1/crafts/test/craft/versions/1.0.0/download',
          integrity: 'sha256-test',
          type: 'skill'
        }
      }
    });

    const output = execSync(`node ${cliPath} outdated --json`, {
      encoding: 'utf-8'
    });

    const parsed = parseJsonOutput(output);
    expect(Array.isArray(parsed)).toBe(true);
  });

  it('should check registry crafts for updates', async () => {
    // Create craftdesk.json with registry
    await writeJsonFile(path.join(tempDir, 'craftdesk.json'), {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        'author/craft': '^1.0.0'
      },
      registries: {
        default: {
          url: 'http://localhost:3000'
        }
      }
    });

    // Create lockfile
    await writeJsonFile(path.join(tempDir, 'craftdesk.lock'), {
      version: '1.0.0',
      lockfileVersion: 1,
      generatedAt: new Date().toISOString(),
      crafts: {
        'author/craft': {
          version: '1.0.0',
          resolved: '/api/v1/crafts/author/craft/versions/1.0.0/download',
          integrity: 'sha256-test',
          type: 'skill'
        }
      }
    });

    // This will fail to connect to registry but should handle gracefully
    const output = execSync(`node ${cliPath} outdated --json`, {
      encoding: 'utf-8'
    });

    const parsed = parseJsonOutput(output);
    expect(Array.isArray(parsed)).toBe(true);
  });

  it('should check git crafts for updates', async () => {
    // Create craftdesk.json
    await writeJsonFile(path.join(tempDir, 'craftdesk.json'), {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        'git-craft': {
          git: 'https://github.com/example/repo.git',
          tag: 'v1.0.0'
        }
      }
    });

    // Create lockfile with git craft
    await writeJsonFile(path.join(tempDir, 'craftdesk.lock'), {
      version: '1.0.0',
      lockfileVersion: 1,
      generatedAt: new Date().toISOString(),
      crafts: {
        'git-craft': {
          version: '1.0.0',
          resolved: 'https://github.com/example/repo.git',
          integrity: 'abc1234567890',
          type: 'skill',
          git: 'https://github.com/example/repo.git',
          tag: 'v1.0.0',
          commit: 'abc1234567890'
        }
      }
    });

    // This will try to check git (and likely fail gracefully for non-existent repo)
    const output = execSync(`node ${cliPath} outdated --json`, {
      encoding: 'utf-8'
    });

    const parsed = parseJsonOutput(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed[0].source).toBe('git');
  });

  it('should filter with --git-only flag', async () => {
    await writeJsonFile(path.join(tempDir, 'craftdesk.json'), {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {}
    });

    await writeJsonFile(path.join(tempDir, 'craftdesk.lock'), {
      version: '1.0.0',
      lockfileVersion: 1,
      generatedAt: new Date().toISOString(),
      crafts: {
        'registry-craft': {
          version: '1.0.0',
          resolved: '/api/v1/download',
          integrity: 'sha256-test',
          type: 'skill'
        },
        'git-craft': {
          version: '1.0.0',
          resolved: 'https://github.com/example/repo.git',
          integrity: 'abc1234',
          type: 'skill',
          git: 'https://github.com/example/repo.git',
          tag: 'v1.0.0'
        }
      }
    });

    const output = execSync(`node ${cliPath} outdated --git-only --json`, {
      encoding: 'utf-8'
    });

    const parsed = parseJsonOutput(output);
    // Should only include git craft
    for (const item of parsed) {
      expect(item.source).toBe('git');
    }
  });

  it('should filter with --registry-only flag', async () => {
    await writeJsonFile(path.join(tempDir, 'craftdesk.json'), {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {},
      registries: {
        default: { url: 'http://localhost:3000' }
      }
    });

    await writeJsonFile(path.join(tempDir, 'craftdesk.lock'), {
      version: '1.0.0',
      lockfileVersion: 1,
      generatedAt: new Date().toISOString(),
      crafts: {
        'author/registry-craft': {
          version: '1.0.0',
          resolved: '/api/v1/download',
          integrity: 'sha256-test',
          type: 'skill'
        },
        'git-craft': {
          version: '1.0.0',
          resolved: 'https://github.com/example/repo.git',
          integrity: 'abc1234',
          type: 'skill',
          git: 'https://github.com/example/repo.git',
          tag: 'v1.0.0'
        }
      }
    });

    const output = execSync(`node ${cliPath} outdated --registry-only --json`, {
      encoding: 'utf-8'
    });

    const parsed = parseJsonOutput(output);
    // Should only include registry craft
    for (const item of parsed) {
      expect(item.source).toBe('registry');
    }
  });

  it('should display help with --help flag', async () => {
    const output = execSync(`node ${cliPath} outdated --help`, {
      encoding: 'utf-8'
    });

    expect(output).toContain('Check for newer versions');
    expect(output).toContain('--json');
    expect(output).toContain('--git-only');
    expect(output).toContain('--registry-only');
  });
});

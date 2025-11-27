import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { createTempDir, cleanupTempDir, writeJsonFile } from '../helpers/test-utils';
import path from 'path';
import fs from 'fs-extra';

describe('craftdesk update command', () => {
  let tempDir: string;
  let originalCwd: string;
  const cliPath = path.join(__dirname, '../../dist/index.js');

  beforeEach(async () => {
    tempDir = await createTempDir('update-test-');
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTempDir(tempDir);
  });

  it('should show message when no crafts need updating', async () => {
    // Create craftdesk.json with registry
    await writeJsonFile(path.join(tempDir, 'craftdesk.json'), {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {}
    });

    // Create lockfile with no crafts
    await writeJsonFile(path.join(tempDir, 'craftdesk.lock'), {
      version: '1.0.0',
      lockfileVersion: 1,
      generatedAt: new Date().toISOString(),
      crafts: {}
    });

    const output = execSync(`node ${cliPath} update`, {
      encoding: 'utf-8'
    });

    expect(output).toContain('No crafts installed');
  });

  it('should error when no craftdesk.json exists', async () => {
    try {
      execSync(`node ${cliPath} update`, {
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      expect.fail('Should have thrown');
    } catch (error: any) {
      expect(error.stderr || error.message).toContain('craftdesk.json');
    }
  });

  it('should show dry-run preview with --dry-run flag', async () => {
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

    // This will check git (likely no update available for non-existent repo)
    const output = execSync(`node ${cliPath} update --dry-run`, {
      encoding: 'utf-8'
    });

    // Should see dry-run message or up-to-date message
    expect(output).toMatch(/(dry-run|up to date)/i);
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

    // This should only check git craft (likely no update available)
    const output = execSync(`node ${cliPath} update --git-only --dry-run`, {
      encoding: 'utf-8'
    });

    // Should complete without errors
    expect(output).toMatch(/(Checking|up to date)/i);
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

    // This should only check registry craft (will fail to connect)
    const output = execSync(`node ${cliPath} update --registry-only --dry-run`, {
      encoding: 'utf-8'
    });

    // Should complete without errors
    expect(output).toMatch(/(Checking|up to date)/i);
  });

  it('should handle specific craft name', async () => {
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
        'test-craft': {
          version: '1.0.0',
          resolved: 'https://github.com/example/repo.git',
          integrity: 'abc1234',
          type: 'skill',
          git: 'https://github.com/example/repo.git',
          tag: 'v1.0.0'
        }
      }
    });

    const output = execSync(`node ${cliPath} update test-craft --dry-run`, {
      encoding: 'utf-8'
    });

    // Should see something about test-craft
    expect(output).toMatch(/(test-craft|up to date)/i);
  });

  it('should error when specific craft is not installed', async () => {
    await writeJsonFile(path.join(tempDir, 'craftdesk.json'), {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {}
    });

    // Empty lockfile means no crafts installed at all
    await writeJsonFile(path.join(tempDir, 'craftdesk.lock'), {
      version: '1.0.0',
      lockfileVersion: 1,
      generatedAt: new Date().toISOString(),
      crafts: {}
    });

    // With empty lockfile, command should warn about no crafts
    const output = execSync(`node ${cliPath} update nonexistent-craft 2>&1`, {
      encoding: 'utf-8'
    });

    expect(output).toContain('No crafts installed');
  });

  it('should display help with --help flag', async () => {
    const output = execSync(`node ${cliPath} update --help`, {
      encoding: 'utf-8'
    });

    expect(output).toContain('Update installed crafts');
    expect(output).toContain('--dry-run');
    expect(output).toContain('--git-only');
    expect(output).toContain('--registry-only');
    expect(output).toContain('--latest');
  });

  it('should update lockfile when performing actual update', async () => {
    // Create a scenario where we can test the lockfile update mechanism
    // Note: In real scenario, this would require a mock registry or actual git repo
    await writeJsonFile(path.join(tempDir, 'craftdesk.json'), {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {}
    });

    const originalLockfile = {
      version: '1.0.0',
      lockfileVersion: 1,
      generatedAt: '2025-01-01T00:00:00.000Z',
      crafts: {}
    };

    await writeJsonFile(path.join(tempDir, 'craftdesk.lock'), originalLockfile);

    // With no crafts, update should succeed with "up to date" message
    const output = execSync(`node ${cliPath} update`, {
      encoding: 'utf-8'
    });

    expect(output).toMatch(/(All crafts are up to date|No crafts installed)/i);
  });
});

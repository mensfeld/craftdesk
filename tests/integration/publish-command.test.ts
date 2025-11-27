import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { createTempDir, cleanupTempDir, writeJsonFile } from '../helpers/test-utils';
import path from 'path';
import fs from 'fs-extra';

describe('craftdesk publish command', () => {
  let tempDir: string;
  let originalCwd: string;
  const cliPath = path.join(__dirname, '../../dist/index.js');

  beforeEach(async () => {
    tempDir = await createTempDir('publish-test-');
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTempDir(tempDir);
  });

  it('should error when no craftdesk.json exists', async () => {
    try {
      execSync(`node ${cliPath} publish`, {
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      expect.fail('Should have thrown');
    } catch (error: any) {
      expect(error.stderr || error.stdout).toContain('craftdesk.json');
    }
  });

  it('should validate required fields in craftdesk.json', async () => {
    // Create craftdesk.json without required fields
    await writeJsonFile(path.join(tempDir, 'craftdesk.json'), {
      name: 'test-craft'
      // Missing version and author
    });

    try {
      execSync(`node ${cliPath} publish`, {
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      expect.fail('Should have thrown');
    } catch (error: any) {
      const output = error.stderr || error.stdout || error.message;
      expect(output).toMatch(/(version|author)/i);
    }
  });

  it('should validate version format', async () => {
    await writeJsonFile(path.join(tempDir, 'craftdesk.json'), {
      name: 'test-craft',
      version: 'invalid-version',
      author: 'testuser'
    });

    try {
      execSync(`node ${cliPath} publish`, {
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      expect.fail('Should have thrown');
    } catch (error: any) {
      const output = error.stderr || error.stdout || error.message;
      expect(output).toMatch(/(semver|version)/i);
    }
  });

  it('should require authentication', async () => {
    await writeJsonFile(path.join(tempDir, 'craftdesk.json'), {
      name: 'test-craft',
      version: '1.0.0',
      author: 'testuser',
      registries: {
        default: { url: 'http://localhost:3000' }
      }
    });

    // Create a file to publish
    await fs.writeFile(path.join(tempDir, 'SKILL.md'), '# Test Skill');

    try {
      execSync(`node ${cliPath} publish`, {
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      expect.fail('Should have thrown');
    } catch (error: any) {
      const output = error.stderr || error.stdout || error.message;
      expect(output).toMatch(/(authenticated|login)/i);
    }
  });

  it('should show dry-run preview with --dry-run flag', async () => {
    await writeJsonFile(path.join(tempDir, 'craftdesk.json'), {
      name: 'test-craft',
      version: '1.0.0',
      author: 'testuser',
      type: 'skill',
      registries: {
        default: { url: 'http://localhost:3000' }
      }
    });

    // Create some files
    await fs.writeFile(path.join(tempDir, 'SKILL.md'), '# Test Skill\n\nThis is a test skill.');
    await fs.writeFile(path.join(tempDir, 'README.md'), '# README');

    // Create a fake auth token file
    const configDir = path.join(tempDir, '.craftdesk');
    await fs.ensureDir(configDir);
    await writeJsonFile(path.join(configDir, 'config.json'), {
      registries: {
        'http://localhost:3000': { token: 'fake-token' }
      }
    });

    // Run with --dry-run (will fail at auth check but should show preview first)
    const output = execSync(`node ${cliPath} publish --dry-run 2>&1`, {
      encoding: 'utf-8',
      env: { ...process.env, HOME: tempDir }
    });

    // Should show publishing info and files
    expect(output).toContain('test-craft');
    expect(output).toContain('1.0.0');
  });

  it('should display help with --help flag', async () => {
    const output = execSync(`node ${cliPath} publish --help`, {
      encoding: 'utf-8'
    });

    expect(output).toContain('Publish a craft');
    expect(output).toContain('--access');
    expect(output).toContain('--tag');
    expect(output).toContain('--dry-run');
  });

  it('should accept custom path argument', async () => {
    // Create a subdirectory with craftdesk.json
    const subDir = path.join(tempDir, 'my-craft');
    await fs.ensureDir(subDir);

    await writeJsonFile(path.join(subDir, 'craftdesk.json'), {
      name: 'sub-craft',
      version: '1.0.0',
      author: 'testuser'
    });

    await fs.writeFile(path.join(subDir, 'SKILL.md'), '# Sub Skill');

    // Try to publish from custom path (will fail at auth but should find craftdesk.json)
    try {
      execSync(`node ${cliPath} publish ./my-craft`, {
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      expect.fail('Should have thrown');
    } catch (error: any) {
      const output = error.stderr || error.stdout || error.message;
      // Should fail at registry/auth step, not at finding craftdesk.json
      expect(output).toMatch(/(registry|authenticated|login)/i);
    }
  });

  it('should validate craft type if provided', async () => {
    await writeJsonFile(path.join(tempDir, 'craftdesk.json'), {
      name: 'test-craft',
      version: '1.0.0',
      author: 'testuser',
      type: 'invalid-type'
    });

    try {
      execSync(`node ${cliPath} publish`, {
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      expect.fail('Should have thrown');
    } catch (error: any) {
      const output = error.stderr || error.stdout || error.message;
      expect(output).toMatch(/(type|invalid)/i);
    }
  });

  it('should collect craft files correctly', async () => {
    await writeJsonFile(path.join(tempDir, 'craftdesk.json'), {
      name: 'multi-file-craft',
      version: '1.0.0',
      author: 'testuser',
      type: 'skill',
      registries: {
        default: { url: 'http://localhost:3000' }
      }
    });

    // Create multiple files of different types
    await fs.writeFile(path.join(tempDir, 'SKILL.md'), '# Main Skill');
    await fs.writeFile(path.join(tempDir, 'helper.ts'), 'export function helper() {}');
    await fs.writeFile(path.join(tempDir, 'config.yaml'), 'key: value');

    // Create a directory with more files
    await fs.ensureDir(path.join(tempDir, 'examples'));
    await fs.writeFile(path.join(tempDir, 'examples', 'example1.ts'), 'console.log("example")');

    // Run with --dry-run to see what files would be published
    const output = execSync(`node ${cliPath} publish --dry-run 2>&1`, {
      encoding: 'utf-8'
    });

    // Should list files to publish
    expect(output).toContain('SKILL.md');
    expect(output).toContain('helper.ts');
  });
});

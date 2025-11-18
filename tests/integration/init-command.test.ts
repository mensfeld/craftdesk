import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { createTempDir, cleanupTempDir, readJsonFile } from '../helpers/test-utils';
import path from 'path';
import fs from 'fs-extra';

describe('craftdesk init command', () => {
  let tempDir: string;
  let originalCwd: string;
  const cliPath = path.join(__dirname, '../../dist/index.js');

  beforeEach(async () => {
    tempDir = await createTempDir('init-test-');
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTempDir(tempDir);
  });

  it('should create a new craftdesk.json file', async () => {
    // Run init command
    execSync(`node ${cliPath} init --name test-project --version 1.0.0 --type skill`, {
      stdio: 'pipe'
    });

    const craftdeskPath = path.join(tempDir, 'craftdesk.json');
    const exists = await fs.pathExists(craftdeskPath);
    expect(exists).toBe(true);

    const config = await readJsonFile(craftdeskPath);
    expect(config.name).toBe('test-project');
    expect(config.version).toBe('1.0.0');
    expect(config.type).toBe('skill');
  });

  it('should include default registry configuration', async () => {
    execSync(`node ${cliPath} init --name test --version 1.0.0 --type agent`, {
      stdio: 'pipe'
    });

    const config = await readJsonFile(path.join(tempDir, 'craftdesk.json'));
    expect(config.registries).toBeDefined();
    expect(config.registries.default).toBeDefined();
    expect(config.registries.default.url).toBe('https://craftdesk.ai');
  });

  it('should not overwrite existing craftdesk.json', async () => {
    // Create existing file
    await fs.writeJson(path.join(tempDir, 'craftdesk.json'), {
      name: 'existing',
      version: '2.0.0'
    });

    // Try to init again
    try {
      execSync(`node ${cliPath} init --name test --version 1.0.0 --type skill`, {
        stdio: 'pipe'
      });
    } catch (error) {
      // Expected to fail
    }

    const config = await readJsonFile(path.join(tempDir, 'craftdesk.json'));
    expect(config.name).toBe('existing');
    expect(config.version).toBe('2.0.0');
  });
});

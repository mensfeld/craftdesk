import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { createTempDir, cleanupTempDir, writeJsonFile } from '../helpers/test-utils';
import path from 'path';
import fs from 'fs-extra';

describe('craftdesk list command', () => {
  let tempDir: string;
  let originalCwd: string;
  const cliPath = path.join(__dirname, '../../dist/index.js');

  beforeEach(async () => {
    tempDir = await createTempDir('list-test-');
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTempDir(tempDir);
  });

  it('should list installed crafts', async () => {
    // Create craftdesk.json
    await writeJsonFile(path.join(tempDir, 'craftdesk.json'), {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        'ruby-on-rails': '^7.0.0',
        'postgres-expert': '^1.0.0'
      }
    });

    // Create mock installed crafts
    const skillDir = path.join(tempDir, '.claude', 'skills', 'ruby-on-rails');
    await fs.ensureDir(skillDir);
    await writeJsonFile(path.join(skillDir, '.craftdesk-metadata.json'), {
      name: 'ruby-on-rails',
      version: '7.1.0',
      type: 'skill',
      installedAt: new Date().toISOString()
    });

    const agentDir = path.join(tempDir, '.claude', 'agents', 'postgres-expert');
    await fs.ensureDir(agentDir);
    await writeJsonFile(path.join(agentDir, '.craftdesk-metadata.json'), {
      name: 'postgres-expert',
      version: '1.2.0',
      type: 'agent',
      installedAt: new Date().toISOString()
    });

    const output = execSync(`node ${cliPath} list`, {
      encoding: 'utf-8'
    });

    expect(output).toContain('ruby-on-rails');
    expect(output).toContain('7.1.0');
    expect(output).toContain('postgres-expert');
    expect(output).toContain('1.2.0');
  });

  it('should handle no installed crafts', async () => {
    // Create craftdesk.json first
    await writeJsonFile(path.join(tempDir, 'craftdesk.json'), {
      name: 'empty-project',
      version: '1.0.0',
      dependencies: {}
    });

    const output = execSync(`node ${cliPath} list`, {
      encoding: 'utf-8'
    });

    expect(output).toContain('No crafts installed');
  });
});

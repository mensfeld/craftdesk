import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { createUnembedCommand } from '../../src/commands/unembed';
import type { CraftDeskJson } from '../../src/types/craftdesk-json';

// Mock services
vi.mock('../../src/services/config-manager', () => ({
  configManager: {
    getCraftDeskJson: vi.fn(),
    getInstallPath: vi.fn(() => '.claude')
  }
}));

vi.mock('../../src/services/gitignore-manager', () => ({
  gitIgnoreManager: {
    autoUpdate: vi.fn()
  }
}));

import { configManager } from '../../src/services/config-manager';
import { gitIgnoreManager } from '../../src/services/gitignore-manager';

describe('unembed command', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(await fs.realpath('/tmp'), 'craftdesk-test-'));
    process.chdir(tempDir);

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.remove(tempDir);
  });

  it('should unembed a skill successfully', async () => {
    const config: CraftDeskJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {},
      embedded: ['test-skill']
    };
    await fs.writeJson(path.join(tempDir, 'craftdesk.json'), config, { spaces: 2 });

    const skillDir = path.join(tempDir, '.claude', 'skills', 'test-skill');
    await fs.ensureDir(skillDir);
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# Test Skill');

    vi.mocked(configManager.getCraftDeskJson).mockResolvedValue(config);

    const command = createUnembedCommand();
    await command.parseAsync(['node', 'test', 'test-skill']);

    const updatedConfig = await fs.readJson(path.join(tempDir, 'craftdesk.json'));
    expect(updatedConfig.embedded).toBeUndefined();
    expect(gitIgnoreManager.autoUpdate).toHaveBeenCalled();

    // Skill files should still exist
    expect(await fs.pathExists(skillDir)).toBe(true);
  });

  it('should remove skill files with --remove flag', async () => {
    const config: CraftDeskJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {},
      embedded: ['test-skill']
    };
    await fs.writeJson(path.join(tempDir, 'craftdesk.json'), config, { spaces: 2 });

    const skillDir = path.join(tempDir, '.claude', 'skills', 'test-skill');
    await fs.ensureDir(skillDir);
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# Test Skill');

    vi.mocked(configManager.getCraftDeskJson).mockResolvedValue(config);

    const command = createUnembedCommand();
    await command.parseAsync(['node', 'test', 'test-skill', '--remove']);

    const updatedConfig = await fs.readJson(path.join(tempDir, 'craftdesk.json'));
    expect(updatedConfig.embedded).toBeUndefined();

    // Skill files should be removed
    expect(await fs.pathExists(skillDir)).toBe(false);
  });

  it('should fail if craftdesk.json does not exist', async () => {
    vi.mocked(configManager.getCraftDeskJson).mockResolvedValue(null);

    const command = createUnembedCommand();
    await expect(
      command.parseAsync(['node', 'test', 'test-skill'])
    ).rejects.toThrow();
  });

  it('should fail if skill is not embedded', async () => {
    const config: CraftDeskJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {},
      embedded: ['other-skill']
    };
    await fs.writeJson(path.join(tempDir, 'craftdesk.json'), config, { spaces: 2 });
    vi.mocked(configManager.getCraftDeskJson).mockResolvedValue(config);

    const command = createUnembedCommand();
    await expect(
      command.parseAsync(['node', 'test', 'test-skill'])
    ).rejects.toThrow();
  });

  it('should fail if embedded array is empty', async () => {
    const config: CraftDeskJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {},
      embedded: []
    };
    await fs.writeJson(path.join(tempDir, 'craftdesk.json'), config, { spaces: 2 });
    vi.mocked(configManager.getCraftDeskJson).mockResolvedValue(config);

    const command = createUnembedCommand();
    await expect(
      command.parseAsync(['node', 'test', 'test-skill'])
    ).rejects.toThrow();
  });

  it('should fail if embedded field does not exist', async () => {
    const config: CraftDeskJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {}
    };
    await fs.writeJson(path.join(tempDir, 'craftdesk.json'), config, { spaces: 2 });
    vi.mocked(configManager.getCraftDeskJson).mockResolvedValue(config);

    const command = createUnembedCommand();
    await expect(
      command.parseAsync(['node', 'test', 'test-skill'])
    ).rejects.toThrow();
  });

  it('should preserve other embedded skills', async () => {
    const config: CraftDeskJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {},
      embedded: ['skill-1', 'skill-2', 'skill-3']
    };
    await fs.writeJson(path.join(tempDir, 'craftdesk.json'), config, { spaces: 2 });
    vi.mocked(configManager.getCraftDeskJson).mockResolvedValue(config);

    const command = createUnembedCommand();
    await command.parseAsync(['node', 'test', 'skill-2']);

    const updatedConfig = await fs.readJson(path.join(tempDir, 'craftdesk.json'));
    expect(updatedConfig.embedded).toEqual(['skill-1', 'skill-3']);
  });

  it('should remove embedded field when last skill is unembedded', async () => {
    const config: CraftDeskJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {},
      embedded: ['only-skill']
    };
    await fs.writeJson(path.join(tempDir, 'craftdesk.json'), config, { spaces: 2 });
    vi.mocked(configManager.getCraftDeskJson).mockResolvedValue(config);

    const command = createUnembedCommand();
    await command.parseAsync(['node', 'test', 'only-skill']);

    const updatedConfig = await fs.readJson(path.join(tempDir, 'craftdesk.json'));
    expect(updatedConfig.embedded).toBeUndefined();
  });

  it('should handle --remove flag when skill directory does not exist', async () => {
    const config: CraftDeskJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {},
      embedded: ['test-skill']
    };
    await fs.writeJson(path.join(tempDir, 'craftdesk.json'), config, { spaces: 2 });
    vi.mocked(configManager.getCraftDeskJson).mockResolvedValue(config);

    const command = createUnembedCommand();
    // Should not throw even if directory doesn't exist
    await expect(
      command.parseAsync(['node', 'test', 'test-skill', '--remove'])
    ).resolves.not.toThrow();

    const updatedConfig = await fs.readJson(path.join(tempDir, 'craftdesk.json'));
    expect(updatedConfig.embedded).toBeUndefined();
  });

  it('should maintain JSON formatting when updating config', async () => {
    const config: CraftDeskJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {},
      embedded: ['skill-1', 'skill-2']
    };
    await fs.writeJson(path.join(tempDir, 'craftdesk.json'), config, { spaces: 2 });
    vi.mocked(configManager.getCraftDeskJson).mockResolvedValue(config);

    const command = createUnembedCommand();
    await command.parseAsync(['node', 'test', 'skill-1']);

    const content = await fs.readFile(path.join(tempDir, 'craftdesk.json'), 'utf-8');
    // Check that it's properly formatted JSON with 2-space indentation
    expect(content).toMatch(/^{\n  "name":/);
    expect(content).toMatch(/\n  "embedded": \[\n    "skill-2"\n  \]/);
  });
});

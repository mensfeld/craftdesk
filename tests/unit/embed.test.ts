import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { createEmbedCommand } from '../../src/commands/embed';
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

vi.mock('../../src/services/multi-agent-sync', () => ({
  multiAgentSync: {
    syncCraft: vi.fn(() => ({
      synced: [{ path: '.claude/skills/test-skill' }],
      failed: []
    }))
  }
}));

import { configManager } from '../../src/services/config-manager';
import { gitIgnoreManager } from '../../src/services/gitignore-manager';
import { multiAgentSync } from '../../src/services/multi-agent-sync';

describe('embed command', () => {
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

  it('should embed a skill successfully', async () => {
    // Setup
    const config: CraftDeskJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {}
    };
    await fs.writeJson(path.join(tempDir, 'craftdesk.json'), config, { spaces: 2 });

    const skillDir = path.join(tempDir, '.claude', 'skills', 'test-skill');
    await fs.ensureDir(skillDir);
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# Test Skill');

    vi.mocked(configManager.getCraftDeskJson).mockResolvedValue(config);

    // Execute
    const command = createEmbedCommand();
    await command.parseAsync(['node', 'test', 'test-skill']);

    // Verify
    const updatedConfig = await fs.readJson(path.join(tempDir, 'craftdesk.json'));
    expect(updatedConfig.embedded).toEqual(['test-skill']);
    expect(gitIgnoreManager.autoUpdate).toHaveBeenCalled();
  });

  it('should fail if craftdesk.json does not exist', async () => {
    vi.mocked(configManager.getCraftDeskJson).mockResolvedValue(null);

    const command = createEmbedCommand();
    await expect(
      command.parseAsync(['node', 'test', 'test-skill'])
    ).rejects.toThrow();
  });

  it('should fail if skill directory does not exist', async () => {
    const config: CraftDeskJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {}
    };
    await fs.writeJson(path.join(tempDir, 'craftdesk.json'), config, { spaces: 2 });
    vi.mocked(configManager.getCraftDeskJson).mockResolvedValue(config);

    const command = createEmbedCommand();
    await expect(
      command.parseAsync(['node', 'test', 'nonexistent-skill'])
    ).rejects.toThrow();
  });

  it('should fail if skill is already embedded', async () => {
    const config: CraftDeskJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {},
      embedded: ['test-skill']
    };
    await fs.writeJson(path.join(tempDir, 'craftdesk.json'), config, { spaces: 2 });

    const skillDir = path.join(tempDir, '.claude', 'skills', 'test-skill');
    await fs.ensureDir(skillDir);

    vi.mocked(configManager.getCraftDeskJson).mockResolvedValue(config);

    const command = createEmbedCommand();
    await expect(
      command.parseAsync(['node', 'test', 'test-skill'])
    ).rejects.toThrow();
  });

  it('should fail if skill is a managed dependency', async () => {
    const config: CraftDeskJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        'test-skill': '1.0.0'
      }
    };
    await fs.writeJson(path.join(tempDir, 'craftdesk.json'), config, { spaces: 2 });

    const skillDir = path.join(tempDir, '.claude', 'skills', 'test-skill');
    await fs.ensureDir(skillDir);

    vi.mocked(configManager.getCraftDeskJson).mockResolvedValue(config);

    const command = createEmbedCommand();
    await expect(
      command.parseAsync(['node', 'test', 'test-skill'])
    ).rejects.toThrow();
  });

  it('should sync to other agents if multi-agent is enabled', async () => {
    const config: CraftDeskJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {},
      multiAgent: {
        enabled: true,
        autoSync: true,
        canonicalLocation: 'claude-code',
        locations: []
      }
    };
    await fs.writeJson(path.join(tempDir, 'craftdesk.json'), config, { spaces: 2 });

    const skillDir = path.join(tempDir, '.claude', 'skills', 'test-skill');
    await fs.ensureDir(skillDir);
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# Test Skill');

    vi.mocked(configManager.getCraftDeskJson).mockResolvedValue(config);

    const command = createEmbedCommand();
    await command.parseAsync(['node', 'test', 'test-skill']);

    expect(multiAgentSync.syncCraft).toHaveBeenCalledWith('test-skill', skillDir);
  });

  it('should skip sync if --skip-sync flag is provided', async () => {
    const config: CraftDeskJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {},
      multiAgent: {
        enabled: true,
        autoSync: true,
        canonicalLocation: 'claude-code',
        locations: []
      }
    };
    await fs.writeJson(path.join(tempDir, 'craftdesk.json'), config, { spaces: 2 });

    const skillDir = path.join(tempDir, '.claude', 'skills', 'test-skill');
    await fs.ensureDir(skillDir);
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# Test Skill');

    vi.mocked(configManager.getCraftDeskJson).mockResolvedValue(config);

    const command = createEmbedCommand();
    await command.parseAsync(['node', 'test', 'test-skill', '--skip-sync']);

    expect(multiAgentSync.syncCraft).not.toHaveBeenCalled();
  });

  it('should handle different craft types', async () => {
    const config: CraftDeskJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {}
    };
    await fs.writeJson(path.join(tempDir, 'craftdesk.json'), config, { spaces: 2 });

    const agentDir = path.join(tempDir, '.claude', 'agents', 'test-agent');
    await fs.ensureDir(agentDir);
    await fs.writeFile(path.join(agentDir, 'AGENT.md'), '# Test Agent');

    vi.mocked(configManager.getCraftDeskJson).mockResolvedValue(config);

    const command = createEmbedCommand();
    await command.parseAsync(['node', 'test', 'test-agent', '--type', 'agent']);

    const updatedConfig = await fs.readJson(path.join(tempDir, 'craftdesk.json'));
    expect(updatedConfig.embedded).toEqual(['test-agent']);
  });

  it('should preserve existing embedded skills', async () => {
    const config: CraftDeskJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {},
      embedded: ['existing-skill']
    };
    await fs.writeJson(path.join(tempDir, 'craftdesk.json'), config, { spaces: 2 });

    const skillDir = path.join(tempDir, '.claude', 'skills', 'new-skill');
    await fs.ensureDir(skillDir);
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# New Skill');

    vi.mocked(configManager.getCraftDeskJson).mockResolvedValue(config);

    const command = createEmbedCommand();
    await command.parseAsync(['node', 'test', 'new-skill']);

    const updatedConfig = await fs.readJson(path.join(tempDir, 'craftdesk.json'));
    expect(updatedConfig.embedded).toEqual(['existing-skill', 'new-skill']);
  });

  it('should handle sync failures gracefully', async () => {
    const config: CraftDeskJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {},
      multiAgent: {
        enabled: true,
        autoSync: true,
        canonicalLocation: 'claude-code',
        locations: []
      }
    };
    await fs.writeJson(path.join(tempDir, 'craftdesk.json'), config, { spaces: 2 });

    const skillDir = path.join(tempDir, '.claude', 'skills', 'test-skill');
    await fs.ensureDir(skillDir);
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# Test Skill');

    vi.mocked(configManager.getCraftDeskJson).mockResolvedValue(config);
    vi.mocked(multiAgentSync.syncCraft).mockRejectedValue(new Error('Sync failed'));

    const command = createEmbedCommand();
    // Should not throw, just warn
    await expect(
      command.parseAsync(['node', 'test', 'test-skill'])
    ).resolves.not.toThrow();

    // Skill should still be embedded
    const updatedConfig = await fs.readJson(path.join(tempDir, 'craftdesk.json'));
    expect(updatedConfig.embedded).toEqual(['test-skill']);
  });
});

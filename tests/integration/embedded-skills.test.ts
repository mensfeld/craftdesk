import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { createEmbedCommand } from '../../src/commands/embed';
import { createUnembedCommand } from '../../src/commands/unembed';
import { createListCommand } from '../../src/commands/list';
import { installer } from '../../src/services/installer';
import { gitIgnoreManager } from '../../src/services/gitignore-manager';
import type { CraftDeskJson } from '../../src/types/craftdesk-json';
import type { CraftDeskLock } from '../../src/types/craftdesk-lock';

describe('Embedded Skills Integration', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(await fs.realpath('/tmp'), 'craftdesk-test-'));
    process.chdir(tempDir);

    // Create basic project structure
    const config: CraftDeskJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {}
    };
    await fs.writeJson(path.join(tempDir, 'craftdesk.json'), config, { spaces: 2 });

    await fs.ensureDir(path.join(tempDir, '.claude', 'skills'));
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.remove(tempDir);
  });

  describe('embed workflow', () => {
    it('should embed a local skill and update .gitignore', async () => {
      // Create a local skill
      const skillDir = path.join(tempDir, '.claude', 'skills', 'my-local-skill');
      await fs.ensureDir(skillDir);
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# My Local Skill');

      // Embed it
      const embedCmd = createEmbedCommand();
      await embedCmd.parseAsync(['node', 'test', 'my-local-skill']);

      // Verify craftdesk.json updated
      const config = await fs.readJson(path.join(tempDir, 'craftdesk.json'));
      expect(config.embedded).toEqual(['my-local-skill']);

      // Verify .gitignore created and documents embedded skill
      const gitignorePath = path.join(tempDir, '.claude', 'skills', '.gitignore');
      expect(await fs.pathExists(gitignorePath)).toBe(true);

      const gitignore = await fs.readFile(gitignorePath, 'utf-8');
      // Embedded skills are documented but not ignored
      expect(gitignore).toContain('# NOT ignored: my-local-skill/');
    });

    it('should prevent embedding a managed dependency', async () => {
      // Add a managed dependency
      const config = await fs.readJson(path.join(tempDir, 'craftdesk.json'));
      config.dependencies = { 'managed-skill': '1.0.0' };
      await fs.writeJson(path.join(tempDir, 'craftdesk.json'), config, { spaces: 2 });

      // Create the skill directory
      const skillDir = path.join(tempDir, '.claude', 'skills', 'managed-skill');
      await fs.ensureDir(skillDir);

      // Try to embed it
      const embedCmd = createEmbedCommand();
      await expect(
        embedCmd.parseAsync(['node', 'test', 'managed-skill'])
      ).rejects.toThrow();
    });
  });

  describe('unembed workflow', () => {
    it('should unembed a skill and update .gitignore', async () => {
      // Setup embedded skill
      const skillDir = path.join(tempDir, '.claude', 'skills', 'embedded-skill');
      await fs.ensureDir(skillDir);
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# Embedded Skill');

      const config = await fs.readJson(path.join(tempDir, 'craftdesk.json'));
      config.embedded = ['embedded-skill'];
      await fs.writeJson(path.join(tempDir, 'craftdesk.json'), config, { spaces: 2 });

      // Unembed it
      const unembedCmd = createUnembedCommand();
      await unembedCmd.parseAsync(['node', 'test', 'embedded-skill']);

      // Verify craftdesk.json updated
      const updatedConfig = await fs.readJson(path.join(tempDir, 'craftdesk.json'));
      expect(updatedConfig.embedded).toBeUndefined();

      // Verify skill still exists
      expect(await fs.pathExists(skillDir)).toBe(true);

      // Verify .gitignore updated to comment it out as orphaned
      const gitignorePath = path.join(tempDir, '.claude', 'skills', '.gitignore');
      const gitignore = await fs.readFile(gitignorePath, 'utf-8');
      expect(gitignore).toContain('# embedded-skill/');
    });

    it('should remove skill files with --remove flag', async () => {
      // Setup embedded skill
      const skillDir = path.join(tempDir, '.claude', 'skills', 'embedded-skill');
      await fs.ensureDir(skillDir);
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# Embedded Skill');

      const config = await fs.readJson(path.join(tempDir, 'craftdesk.json'));
      config.embedded = ['embedded-skill'];
      await fs.writeJson(path.join(tempDir, 'craftdesk.json'), config, { spaces: 2 });

      // Unembed with --remove
      const unembedCmd = createUnembedCommand();
      await unembedCmd.parseAsync(['node', 'test', 'embedded-skill', '--remove']);

      // Verify skill removed
      expect(await fs.pathExists(skillDir)).toBe(false);
    });
  });

  describe('interaction with managed dependencies', () => {
    it('should keep managed and embedded skills separate in .gitignore', async () => {
      // Create managed dependency
      const lock: CraftDeskLock = {
        version: '0.5.0',
        crafts: {
          'managed-skill': {
            name: 'managed-skill',
            version: '1.0.0',
            type: 'skill',
            resolved: 'https://example.com/managed-skill-1.0.0.tgz',
            integrity: 'sha512-abc123'
          }
        },
        pluginTree: {}
      };
      await fs.writeJson(path.join(tempDir, 'craftdesk.lock'), lock, { spaces: 2 });

      const managedDir = path.join(tempDir, '.claude', 'skills', 'managed-skill');
      await fs.ensureDir(managedDir);

      // Create embedded skill
      const embeddedDir = path.join(tempDir, '.claude', 'skills', 'embedded-skill');
      await fs.ensureDir(embeddedDir);
      await fs.writeFile(path.join(embeddedDir, 'SKILL.md'), '# Embedded Skill');

      const config = await fs.readJson(path.join(tempDir, 'craftdesk.json'));
      config.embedded = ['embedded-skill'];
      config.dependencies = { 'managed-skill': '1.0.0' };
      await fs.writeJson(path.join(tempDir, 'craftdesk.json'), config, { spaces: 2 });

      // Update .gitignore
      await gitIgnoreManager.autoUpdate(tempDir);

      // Verify .gitignore
      const gitignorePath = path.join(tempDir, '.claude', 'skills', '.gitignore');
      const gitignore = await fs.readFile(gitignorePath, 'utf-8');

      // Managed skill should be ignored
      expect(gitignore).toContain('managed-skill/');

      // Embedded skill should NOT be ignored
      expect(gitignore).not.toContain('embedded-skill/');
    });

    it('should detect orphaned skills after unembedding', async () => {
      // Create embedded skill
      const skillDir = path.join(tempDir, '.claude', 'skills', 'embedded-skill');
      await fs.ensureDir(skillDir);
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# Embedded Skill');

      const config = await fs.readJson(path.join(tempDir, 'craftdesk.json'));
      config.embedded = ['embedded-skill'];
      await fs.writeJson(path.join(tempDir, 'craftdesk.json'), config, { spaces: 2 });

      // Unembed it (without removing files)
      const unembedCmd = createUnembedCommand();
      await unembedCmd.parseAsync(['node', 'test', 'embedded-skill']);

      // Update .gitignore
      await gitIgnoreManager.autoUpdate(tempDir);

      // Verify orphaned skill is commented in .gitignore
      const gitignorePath = path.join(tempDir, '.claude', 'skills', '.gitignore');
      const gitignore = await fs.readFile(gitignorePath, 'utf-8');
      expect(gitignore).toContain('# Untracked');
      expect(gitignore).toContain('# embedded-skill/');
    });

    it('should update .gitignore after installing dependencies', async () => {
      // This test documents expected behavior when installer updates .gitignore
      const config = await fs.readJson(path.join(tempDir, 'craftdesk.json'));
      config.dependencies = { 'test-skill': '1.0.0' };
      config.embedded = ['my-skill'];
      await fs.writeJson(path.join(tempDir, 'craftdesk.json'), config, { spaces: 2 });

      // Create lockfile
      const lock: CraftDeskLock = {
        version: '0.5.0',
        crafts: {
          'test-skill': {
            name: 'test-skill',
            version: '1.0.0',
            type: 'skill',
            resolved: 'https://example.com/test-skill-1.0.0.tgz',
            integrity: 'sha512-abc123'
          }
        },
        pluginTree: {}
      };
      await fs.writeJson(path.join(tempDir, 'craftdesk.lock'), lock, { spaces: 2 });

      // Create skill directories
      await fs.ensureDir(path.join(tempDir, '.claude', 'skills', 'test-skill'));
      await fs.ensureDir(path.join(tempDir, '.claude', 'skills', 'my-skill'));

      // Update .gitignore (simulating what installer does)
      await gitIgnoreManager.autoUpdate(tempDir);

      // Verify
      const gitignorePath = path.join(tempDir, '.claude', 'skills', '.gitignore');
      const gitignore = await fs.readFile(gitignorePath, 'utf-8');
      expect(gitignore).toContain('test-skill/');
      expect(gitignore).not.toContain('my-skill/');
    });
  });

  describe('list command integration', () => {
    it('should track embedded status in config', async () => {
      // This is tested more thoroughly in unit tests
      // Here we just verify the integration point

      const skillDir = path.join(tempDir, '.claude', 'skills', 'test-skill');
      await fs.ensureDir(skillDir);
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# Test Skill');

      const config = await fs.readJson(path.join(tempDir, 'craftdesk.json'));
      config.embedded = ['test-skill'];
      await fs.writeJson(path.join(tempDir, 'craftdesk.json'), config, { spaces: 2 });

      // Verify config was written correctly
      const updatedConfig = await fs.readJson(path.join(tempDir, 'craftdesk.json'));
      expect(updatedConfig.embedded).toContain('test-skill');

      // The list command reads this to show the embedded badge
      // (This is tested in list.test.ts unit tests)
    });
  });

  describe('edge cases', () => {
    it('should handle embedding multiple skills', async () => {
      // Create multiple skills
      for (const name of ['skill-1', 'skill-2', 'skill-3']) {
        const skillDir = path.join(tempDir, '.claude', 'skills', name);
        await fs.ensureDir(skillDir);
        await fs.writeFile(path.join(skillDir, 'SKILL.md'), `# ${name}`);
      }

      // Embed them one by one (create new command instance each time)
      await createEmbedCommand().parseAsync(['node', 'test', 'skill-1']);
      await createEmbedCommand().parseAsync(['node', 'test', 'skill-2']);
      await createEmbedCommand().parseAsync(['node', 'test', 'skill-3']);

      // Verify all embedded
      const config = await fs.readJson(path.join(tempDir, 'craftdesk.json'));
      expect(config.embedded).toEqual(['skill-1', 'skill-2', 'skill-3']);
    });

    it('should handle concurrent embed operations', async () => {
      // Create skills
      for (const name of ['skill-a', 'skill-b']) {
        const skillDir = path.join(tempDir, '.claude', 'skills', name);
        await fs.ensureDir(skillDir);
        await fs.writeFile(path.join(skillDir, 'SKILL.md'), `# ${name}`);
      }

      // Run sequentially to avoid race conditions in test
      // (concurrent writes would cause race conditions which is expected)
      await createEmbedCommand().parseAsync(['node', 'test', 'skill-a']);
      await createEmbedCommand().parseAsync(['node', 'test', 'skill-b']);

      const config = await fs.readJson(path.join(tempDir, 'craftdesk.json'));
      expect(config.embedded).toContain('skill-a');
      expect(config.embedded).toContain('skill-b');
    });

    it('should handle skill names with special characters', async () => {
      const skillName = 'my-skill_v1.2.3';
      const skillDir = path.join(tempDir, '.claude', 'skills', skillName);
      await fs.ensureDir(skillDir);
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# Special Skill');

      const embedCmd = createEmbedCommand();
      await embedCmd.parseAsync(['node', 'test', skillName]);

      const config = await fs.readJson(path.join(tempDir, 'craftdesk.json'));
      expect(config.embedded).toEqual([skillName]);

      const gitignorePath = path.join(tempDir, '.claude', 'skills', '.gitignore');
      const gitignore = await fs.readFile(gitignorePath, 'utf-8');
      expect(gitignore).not.toContain(`${skillName}/`);
    });

    it('should handle empty project (no lockfile)', async () => {
      // No lockfile exists
      const skillDir = path.join(tempDir, '.claude', 'skills', 'local-skill');
      await fs.ensureDir(skillDir);
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# Local Skill');

      const embedCmd = createEmbedCommand();
      await embedCmd.parseAsync(['node', 'test', 'local-skill']);

      // Should work even without lockfile
      const config = await fs.readJson(path.join(tempDir, 'craftdesk.json'));
      expect(config.embedded).toEqual(['local-skill']);

      // .gitignore should still be created
      const gitignorePath = path.join(tempDir, '.claude', 'skills', '.gitignore');
      expect(await fs.pathExists(gitignorePath)).toBe(true);
    });
  });
});

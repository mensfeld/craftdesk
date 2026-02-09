import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentDetector } from '../../src/services/agent-detector';
import { MultiAgentSync } from '../../src/services/multi-agent-sync';
import { createTempDir, cleanupTempDir, writeJsonFile } from '../helpers/test-utils';
import fs from 'fs-extra';
import path from 'path';
import type { CraftDeskJson } from '../../src/types/craftdesk-json';

// Mock config manager to read from test directory
vi.mock('../../src/services/config-manager', () => {
  let testConfig: CraftDeskJson | null = null;

  return {
    configManager: {
      getCraftDeskJson: vi.fn(async () => testConfig),
      setTestConfig: (config: CraftDeskJson | null) => {
        testConfig = config;
      },
      getInstallPath: vi.fn(() => '.claude')
    }
  };
});

import { configManager } from '../../src/services/config-manager';

describe('Multi-Agent Integration', () => {
  let tempDir: string;
  let detector: AgentDetector;
  let sync: MultiAgentSync;

  beforeEach(async () => {
    tempDir = await createTempDir('multi-agent-integration-test-');
    detector = new AgentDetector();
    sync = new MultiAgentSync();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
    (configManager as any).setTestConfig(null);
  });

  describe('Complete multi-agent workflow', () => {
    it('should detect, configure, sync, and verify crafts across multiple agents', async () => {
      // 1. Setup: Create agent directories
      await fs.ensureDir(path.join(tempDir, '.claude'));
      await fs.ensureDir(path.join(tempDir, '.cursor'));
      await fs.ensureDir(path.join(tempDir, '.windsurf'));

      // 2. Create craftdesk.json
      const config: CraftDeskJson = {
        name: 'test-project',
        version: '1.0.0',
        multiAgent: {
          enabled: true,
          canonical: '.claude',
          targets: ['.claude/skills', '.cursor/skills', '.windsurf/skills'],
          autoSync: true
        }
      };

      await writeJsonFile(path.join(tempDir, 'craftdesk.json'), config);
      (configManager as any).setTestConfig(config);

      // 3. Detection: Verify agents are detected
      const detection = await detector.detectAgents(tempDir);

      expect(detection.detected.filter(a => a.detected).length).toBeGreaterThanOrEqual(3);

      const claude = detection.detected.find(a => a.name === 'claude');
      const cursor = detection.detected.find(a => a.name === 'cursor');
      const windsurf = detection.detected.find(a => a.name === 'windsurf');

      expect(claude?.detected).toBe(true);
      expect(cursor?.detected).toBe(true);
      expect(windsurf?.detected).toBe(true);

      // 4. Create test skills
      const skill1Dir = path.join(tempDir, 'temp-skill-1');
      await fs.ensureDir(skill1Dir);
      await fs.writeFile(
        path.join(skill1Dir, 'SKILL.md'),
        '# Ruby Expert\n\nExpert knowledge about Ruby programming.'
      );
      await fs.writeFile(
        path.join(skill1Dir, 'README.md'),
        '# README\n\nInstallation and usage instructions.'
      );

      const skill2Dir = path.join(tempDir, 'temp-skill-2');
      await fs.ensureDir(skill2Dir);
      await fs.writeFile(
        path.join(skill2Dir, 'SKILL.md'),
        '# Python Expert\n\nExpert knowledge about Python programming.'
      );

      // 5. Sync: Sync skills to all agents
      const syncResult1 = await sync.syncCraft('ruby-expert', skill1Dir, tempDir);
      const syncResult2 = await sync.syncCraft('python-expert', skill2Dir, tempDir);

      expect(syncResult1.synced.length).toBeGreaterThan(0);
      expect(syncResult1.failed).toHaveLength(0);
      expect(syncResult2.synced.length).toBeGreaterThan(0);
      expect(syncResult2.failed).toHaveLength(0);

      // 6. Verify: Check that skills exist in all agent directories
      const expectedLocations = [
        '.claude/skills/ruby-expert/SKILL.md',
        '.claude/skills/ruby-expert/README.md',
        '.cursor/skills/ruby-expert/SKILL.md',
        '.windsurf/skills/ruby-expert/SKILL.md',
        '.claude/skills/python-expert/SKILL.md',
        '.cursor/skills/python-expert/SKILL.md',
        '.windsurf/skills/python-expert/SKILL.md'
      ];

      for (const location of expectedLocations) {
        const fullPath = path.join(tempDir, location);
        expect(
          await fs.pathExists(fullPath),
          `Expected ${location} to exist`
        ).toBe(true);
      }

      // 7. Verify checksums match
      const status1 = await sync.verifySync('ruby-expert', tempDir);
      const status2 = await sync.verifySync('python-expert', tempDir);

      expect(status1.inSync).toBe(true);
      expect(status1.outOfSync).toHaveLength(0);
      expect(status2.inSync).toBe(true);
      expect(status2.outOfSync).toHaveLength(0);

      // 8. Test drift detection: Modify a copy
      const cursorSkillPath = path.join(tempDir, '.cursor/skills/ruby-expert/SKILL.md');
      await fs.writeFile(cursorSkillPath, '# Ruby Expert MODIFIED\n\nModified content.');

      const statusAfterModify = await sync.verifySync('ruby-expert', tempDir);

      expect(statusAfterModify.inSync).toBe(false);
      expect(statusAfterModify.outOfSync.length).toBeGreaterThan(0);

      const cursorOutOfSync = statusAfterModify.outOfSync.find(l =>
        l.path.includes('.cursor')
      );
      expect(cursorOutOfSync?.reason).toBe('checksum-mismatch');

      // 9. Re-sync to fix drift
      const canonicalPath = path.join(tempDir, '.claude/skills/ruby-expert');
      const resyncResult = await sync.syncCraft('ruby-expert', canonicalPath, tempDir);

      expect(resyncResult.synced.length).toBeGreaterThan(0);
      expect(resyncResult.failed).toHaveLength(0);

      // 10. Verify sync is restored
      const statusAfterResync = await sync.verifySync('ruby-expert', tempDir);

      expect(statusAfterResync.inSync).toBe(true);
      expect(statusAfterResync.outOfSync).toHaveLength(0);
    });

    it('should handle missing targets gracefully', async () => {
      // Setup with targets that don't exist yet
      await fs.ensureDir(path.join(tempDir, '.claude'));

      const config: CraftDeskJson = {
        name: 'test-project',
        version: '1.0.0',
        multiAgent: {
          enabled: true,
          canonical: '.claude',
          targets: ['.claude/skills', '.cursor/skills', '.nonexistent/skills']
        }
      };

      await writeJsonFile(path.join(tempDir, 'craftdesk.json'), config);
      (configManager as any).setTestConfig(config);

      // Create skill
      const skillDir = path.join(tempDir, 'temp-skill');
      await fs.ensureDir(skillDir);
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), '# Test Skill');

      // Sync should create missing directories
      const result = await sync.syncCraft('test-skill', skillDir, tempDir);

      // Should succeed even if some directories didn't exist
      expect(result.synced.length).toBeGreaterThan(0);

      // Verify directories were created
      expect(await fs.pathExists(path.join(tempDir, '.cursor/skills/test-skill'))).toBe(true);
      expect(await fs.pathExists(path.join(tempDir, '.nonexistent/skills/test-skill'))).toBe(true);
    });

    it('should sync all crafts at once', async () => {
      await fs.ensureDir(path.join(tempDir, '.claude'));
      await fs.ensureDir(path.join(tempDir, '.cursor'));

      const config: CraftDeskJson = {
        name: 'test-project',
        version: '1.0.0',
        multiAgent: {
          enabled: true,
          canonical: '.claude',
          targets: ['.claude/skills', '.cursor/skills']
        }
      };

      await writeJsonFile(path.join(tempDir, 'craftdesk.json'), config);
      (configManager as any).setTestConfig(config);

      // Create multiple skills directly in canonical location
      for (let i = 1; i <= 5; i++) {
        const skillPath = path.join(tempDir, '.claude/skills', `skill-${i}`);
        await fs.ensureDir(skillPath);
        await fs.writeFile(
          path.join(skillPath, 'SKILL.md'),
          `# Skill ${i}\n\nSkill number ${i} content.`
        );
      }

      // Sync all at once
      const results = await sync.syncAllCrafts(tempDir);

      expect(results).toHaveLength(5);
      expect(results.every(r => r.failed.length === 0)).toBe(true);

      // Verify all skills exist in cursor
      for (let i = 1; i <= 5; i++) {
        const skillPath = path.join(tempDir, '.cursor/skills', `skill-${i}/SKILL.md`);
        expect(await fs.pathExists(skillPath)).toBe(true);
      }

      // Verify all
      const statuses = await sync.verifyAllCrafts(tempDir);

      expect(statuses).toHaveLength(5);
      expect(statuses.every(s => s.inSync)).toBe(true);
    });

    it('should validate all configured targets', async () => {
      const validTargets = [
        '.claude/skills',
        '.cursor/skills',
        '.windsurf/skills',
        '.continue/skills'
      ];

      const invalidTargets = detector.validateTargets(validTargets);
      expect(invalidTargets).toHaveLength(0);

      const mixedTargets = [
        '.claude/skills',
        '.unknown-agent/skills',
        '.cursor/skills',
        '.invalid/skills'
      ];

      const invalidMixed = detector.validateTargets(mixedTargets);
      expect(invalidMixed).toHaveLength(2);
      expect(invalidMixed).toContain('.unknown-agent/skills');
      expect(invalidMixed).toContain('.invalid/skills');
    });
  });

  describe('Performance and edge cases', () => {
    it('should handle large skill files efficiently', async () => {
      await fs.ensureDir(path.join(tempDir, '.claude'));
      await fs.ensureDir(path.join(tempDir, '.cursor'));

      const config: CraftDeskJson = {
        name: 'test-project',
        version: '1.0.0',
        multiAgent: {
          enabled: true,
          canonical: '.claude',
          targets: ['.claude/skills', '.cursor/skills']
        }
      };

      await writeJsonFile(path.join(tempDir, 'craftdesk.json'), config);
      (configManager as any).setTestConfig(config);

      // Create large skill file (1MB)
      const largeContent = '# Large Skill\n\n' + 'x'.repeat(1024 * 1024);
      const skillDir = path.join(tempDir, 'temp-skill');
      await fs.ensureDir(skillDir);
      await fs.writeFile(path.join(skillDir, 'SKILL.md'), largeContent);

      const startTime = Date.now();
      const result = await sync.syncCraft('large-skill', skillDir, tempDir);
      const duration = Date.now() - startTime;

      expect(result.synced.length).toBeGreaterThan(0);
      expect(result.failed).toHaveLength(0);

      // Should complete in reasonable time (< 5 seconds)
      expect(duration).toBeLessThan(5000);
    });

    it('should handle empty skill directories', async () => {
      await fs.ensureDir(path.join(tempDir, '.claude'));

      const config: CraftDeskJson = {
        name: 'test-project',
        version: '1.0.0',
        multiAgent: {
          enabled: true,
          canonical: '.claude',
          targets: ['.claude/skills', '.cursor/skills']
        }
      };

      await writeJsonFile(path.join(tempDir, 'craftdesk.json'), config);
      (configManager as any).setTestConfig(config);

      // Create empty skill directory
      const skillDir = path.join(tempDir, 'temp-skill');
      await fs.ensureDir(skillDir);

      const result = await sync.syncCraft('empty-skill', skillDir, tempDir);

      expect(result.synced.length).toBeGreaterThan(0);

      // Verify empty directory was created
      const cursorSkillPath = path.join(tempDir, '.cursor/skills/empty-skill');
      expect(await fs.pathExists(cursorSkillPath)).toBe(true);
    });
  });
});

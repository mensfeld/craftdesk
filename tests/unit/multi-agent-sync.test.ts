import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MultiAgentSync } from '../../src/services/multi-agent-sync';
import { createTempDir, cleanupTempDir, writeJsonFile } from '../helpers/test-utils';
import fs from 'fs-extra';
import path from 'path';

// Mock config manager
vi.mock('../../src/services/config-manager', () => ({
  configManager: {
    getCraftDeskJson: vi.fn()
  }
}));

import { configManager } from '../../src/services/config-manager';

describe('MultiAgentSync', () => {
  let sync: MultiAgentSync;
  let tempDir: string;

  beforeEach(async () => {
    sync = new MultiAgentSync();
    tempDir = await createTempDir('multi-agent-sync-test-');
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe('syncCraft', () => {
    it('should skip sync when multi-agent is disabled', async () => {
      vi.mocked(configManager.getCraftDeskJson).mockResolvedValue({
        name: 'test-project',
        version: '1.0.0'
      });

      const sourceDir = path.join(tempDir, 'source');
      await fs.ensureDir(sourceDir);
      await fs.writeFile(path.join(sourceDir, 'SKILL.md'), '# Test Skill');

      const result = await sync.syncCraft('test-skill', sourceDir, tempDir);

      expect(result.synced).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
    });

    it('should sync craft to canonical and targets', async () => {
      vi.mocked(configManager.getCraftDeskJson).mockResolvedValue({
        name: 'test-project',
        version: '1.0.0',
        multiAgent: {
          enabled: true,
          canonical: '.claude',
          targets: ['.claude/skills', '.cursor/skills', '.windsurf/skills']
        }
      });

      const sourceDir = path.join(tempDir, 'source');
      await fs.ensureDir(sourceDir);
      await fs.writeFile(path.join(sourceDir, 'SKILL.md'), '# Test Skill');
      await fs.writeFile(path.join(sourceDir, 'README.md'), '# README');

      const result = await sync.syncCraft('test-skill', sourceDir, tempDir);

      // Should sync to canonical + 2 targets (cursor, windsurf)
      expect(result.synced.length).toBeGreaterThanOrEqual(1);
      expect(result.failed).toHaveLength(0);

      // Verify canonical copy
      const canonicalPath = path.join(tempDir, '.claude/skills/test-skill');
      expect(await fs.pathExists(path.join(canonicalPath, 'SKILL.md'))).toBe(true);
      expect(await fs.pathExists(path.join(canonicalPath, 'README.md'))).toBe(true);
      expect(await fs.pathExists(path.join(canonicalPath, '.craftdesk-checksum'))).toBe(true);

      // Verify target copies
      const cursorPath = path.join(tempDir, '.cursor/skills/test-skill');
      expect(await fs.pathExists(path.join(cursorPath, 'SKILL.md'))).toBe(true);

      const windsurfPath = path.join(tempDir, '.windsurf/skills/test-skill');
      expect(await fs.pathExists(path.join(windsurfPath, 'SKILL.md'))).toBe(true);
    });

    it('should calculate and store checksum', async () => {
      vi.mocked(configManager.getCraftDeskJson).mockResolvedValue({
        name: 'test-project',
        version: '1.0.0',
        multiAgent: {
          enabled: true,
          canonical: '.claude',
          targets: ['.claude/skills']
        }
      });

      const sourceDir = path.join(tempDir, 'source');
      await fs.ensureDir(sourceDir);
      await fs.writeFile(path.join(sourceDir, 'SKILL.md'), '# Test Skill');

      await sync.syncCraft('test-skill', sourceDir, tempDir);

      const checksumPath = path.join(tempDir, '.claude/skills/test-skill/.craftdesk-checksum');
      expect(await fs.pathExists(checksumPath)).toBe(true);

      const checksum = await fs.readFile(checksumPath, 'utf-8');
      expect(checksum).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
    });

    it('should handle sync failures gracefully', async () => {
      vi.mocked(configManager.getCraftDeskJson).mockResolvedValue({
        name: 'test-project',
        version: '1.0.0',
        multiAgent: {
          enabled: true,
          canonical: '.claude',
          targets: ['.claude/skills', '/invalid/readonly/path/skills']
        }
      });

      const sourceDir = path.join(tempDir, 'source');
      await fs.ensureDir(sourceDir);
      await fs.writeFile(path.join(sourceDir, 'SKILL.md'), '# Test Skill');

      const result = await sync.syncCraft('test-skill', sourceDir, tempDir);

      // Canonical should succeed
      expect(result.synced.length).toBeGreaterThan(0);

      // Invalid path might fail (depending on permissions)
      // This test verifies that failures don't crash the sync
      expect(result).toHaveProperty('failed');
    });
  });

  describe('verifySync', () => {
    it('should return in sync when multiagent is disabled', async () => {
      vi.mocked(configManager.getCraftDeskJson).mockResolvedValue({
        name: 'test-project',
        version: '1.0.0'
      });

      const status = await sync.verifySync('test-skill', tempDir);

      expect(status.inSync).toBe(true);
      expect(status.outOfSync).toHaveLength(0);
    });

    it('should detect missing canonical', async () => {
      vi.mocked(configManager.getCraftDeskJson).mockResolvedValue({
        name: 'test-project',
        version: '1.0.0',
        multiAgent: {
          enabled: true,
          canonical: '.claude',
          targets: ['.claude/skills']
        }
      });

      const status = await sync.verifySync('test-skill', tempDir);

      expect(status.inSync).toBe(false);
      expect(status.outOfSync.length).toBeGreaterThan(0);
      expect(status.outOfSync[0].reason).toBe('missing');
    });

    it('should detect missing targets', async () => {
      vi.mocked(configManager.getCraftDeskJson).mockResolvedValue({
        name: 'test-project',
        version: '1.0.0',
        multiAgent: {
          enabled: true,
          canonical: '.claude',
          targets: ['.claude/skills', '.cursor/skills', '.windsurf/skills']
        }
      });

      // Create canonical
      const canonicalPath = path.join(tempDir, '.claude/skills/test-skill');
      await fs.ensureDir(canonicalPath);
      await fs.writeFile(path.join(canonicalPath, 'SKILL.md'), '# Test Skill');

      const status = await sync.verifySync('test-skill', tempDir);

      expect(status.inSync).toBe(false);
      expect(status.outOfSync.length).toBe(2); // cursor and windsurf missing

      const missingLocations = status.outOfSync.filter(l => l.reason === 'missing');
      expect(missingLocations.length).toBe(2);
    });

    it('should detect checksum mismatches', async () => {
      vi.mocked(configManager.getCraftDeskJson).mockResolvedValue({
        name: 'test-project',
        version: '1.0.0',
        multiAgent: {
          enabled: true,
          canonical: '.claude',
          targets: ['.claude/skills', '.cursor/skills']
        }
      });

      // Create canonical
      const canonicalPath = path.join(tempDir, '.claude/skills/test-skill');
      await fs.ensureDir(canonicalPath);
      await fs.writeFile(path.join(canonicalPath, 'SKILL.md'), '# Test Skill Original');

      // Create modified target
      const cursorPath = path.join(tempDir, '.cursor/skills/test-skill');
      await fs.ensureDir(cursorPath);
      await fs.writeFile(path.join(cursorPath, 'SKILL.md'), '# Test Skill Modified');

      const status = await sync.verifySync('test-skill', tempDir);

      expect(status.inSync).toBe(false);
      expect(status.outOfSync.length).toBe(1);
      expect(status.outOfSync[0].reason).toBe('checksum-mismatch');
      expect(status.outOfSync[0].expectedChecksum).toBeDefined();
      expect(status.outOfSync[0].actualChecksum).toBeDefined();
    });

    it('should report in sync when checksums match', async () => {
      vi.mocked(configManager.getCraftDeskJson).mockResolvedValue({
        name: 'test-project',
        version: '1.0.0',
        multiAgent: {
          enabled: true,
          canonical: '.claude',
          targets: ['.claude/skills', '.cursor/skills']
        }
      });

      // Create identical copies
      const canonicalPath = path.join(tempDir, '.claude/skills/test-skill');
      await fs.ensureDir(canonicalPath);
      await fs.writeFile(path.join(canonicalPath, 'SKILL.md'), '# Test Skill');
      await fs.writeFile(path.join(canonicalPath, 'README.md'), '# README');

      const cursorPath = path.join(tempDir, '.cursor/skills/test-skill');
      await fs.copy(canonicalPath, cursorPath);

      const status = await sync.verifySync('test-skill', tempDir);

      expect(status.inSync).toBe(true);
      expect(status.outOfSync).toHaveLength(0);
      expect(status.inSyncLocations.length).toBeGreaterThan(0);
    });
  });

  describe('syncAllCrafts', () => {
    it('should return empty array when multiagent is disabled', async () => {
      vi.mocked(configManager.getCraftDeskJson).mockResolvedValue({
        name: 'test-project',
        version: '1.0.0'
      });

      const results = await sync.syncAllCrafts(tempDir);
      expect(results).toHaveLength(0);
    });

    it('should return empty array when no skills exist', async () => {
      vi.mocked(configManager.getCraftDeskJson).mockResolvedValue({
        name: 'test-project',
        version: '1.0.0',
        multiAgent: {
          enabled: true,
          canonical: '.claude',
          targets: ['.claude/skills']
        }
      });

      const results = await sync.syncAllCrafts(tempDir);
      expect(results).toHaveLength(0);
    });

    it('should sync all crafts in skills directory', async () => {
      vi.mocked(configManager.getCraftDeskJson).mockResolvedValue({
        name: 'test-project',
        version: '1.0.0',
        multiAgent: {
          enabled: true,
          canonical: '.claude',
          targets: ['.claude/skills', '.cursor/skills']
        }
      });

      // Create multiple skills
      const skill1 = path.join(tempDir, '.claude/skills/skill-1');
      await fs.ensureDir(skill1);
      await fs.writeFile(path.join(skill1, 'SKILL.md'), '# Skill 1');

      const skill2 = path.join(tempDir, '.claude/skills/skill-2');
      await fs.ensureDir(skill2);
      await fs.writeFile(path.join(skill2, 'SKILL.md'), '# Skill 2');

      const results = await sync.syncAllCrafts(tempDir);

      expect(results).toHaveLength(2);
      expect(results.map(r => r.craftName)).toContain('skill-1');
      expect(results.map(r => r.craftName)).toContain('skill-2');

      // Verify both skills were synced to cursor
      expect(await fs.pathExists(path.join(tempDir, '.cursor/skills/skill-1/SKILL.md'))).toBe(true);
      expect(await fs.pathExists(path.join(tempDir, '.cursor/skills/skill-2/SKILL.md'))).toBe(true);
    });
  });

  describe('verifyAllCrafts', () => {
    it('should return empty array when multiagent is disabled', async () => {
      vi.mocked(configManager.getCraftDeskJson).mockResolvedValue({
        name: 'test-project',
        version: '1.0.0'
      });

      const statuses = await sync.verifyAllCrafts(tempDir);
      expect(statuses).toHaveLength(0);
    });

    it('should verify all crafts in skills directory', async () => {
      vi.mocked(configManager.getCraftDeskJson).mockResolvedValue({
        name: 'test-project',
        version: '1.0.0',
        multiAgent: {
          enabled: true,
          canonical: '.claude',
          targets: ['.claude/skills', '.cursor/skills']
        }
      });

      // Create skills
      const skill1 = path.join(tempDir, '.claude/skills/skill-1');
      await fs.ensureDir(skill1);
      await fs.writeFile(path.join(skill1, 'SKILL.md'), '# Skill 1');

      const skill2 = path.join(tempDir, '.claude/skills/skill-2');
      await fs.ensureDir(skill2);
      await fs.writeFile(path.join(skill2, 'SKILL.md'), '# Skill 2');

      // Copy skill-1 to cursor (in sync)
      await fs.copy(skill1, path.join(tempDir, '.cursor/skills/skill-1'));

      // Don't copy skill-2 (out of sync)

      const statuses = await sync.verifyAllCrafts(tempDir);

      expect(statuses).toHaveLength(2);

      const status1 = statuses.find(s => s.craftName === 'skill-1');
      const status2 = statuses.find(s => s.craftName === 'skill-2');

      expect(status1?.inSync).toBe(true);
      expect(status2?.inSync).toBe(false);
    });
  });

  describe('calculateDirChecksum', () => {
    it('should produce consistent checksums for identical directories', async () => {
      const dir1 = path.join(tempDir, 'dir1');
      await fs.ensureDir(dir1);
      await fs.writeFile(path.join(dir1, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(dir1, 'file2.txt'), 'content2');

      const dir2 = path.join(tempDir, 'dir2');
      await fs.ensureDir(dir2);
      await fs.writeFile(path.join(dir2, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(dir2, 'file2.txt'), 'content2');

      const checksum1 = await sync.calculateDirChecksum(dir1);
      const checksum2 = await sync.calculateDirChecksum(dir2);

      expect(checksum1).toBe(checksum2);
    });

    it('should produce different checksums for different content', async () => {
      const dir1 = path.join(tempDir, 'dir1');
      await fs.ensureDir(dir1);
      await fs.writeFile(path.join(dir1, 'file.txt'), 'content1');

      const dir2 = path.join(tempDir, 'dir2');
      await fs.ensureDir(dir2);
      await fs.writeFile(path.join(dir2, 'file.txt'), 'content2');

      const checksum1 = await sync.calculateDirChecksum(dir1);
      const checksum2 = await sync.calculateDirChecksum(dir2);

      expect(checksum1).not.toBe(checksum2);
    });

    it('should ignore metadata files', async () => {
      const dir1 = path.join(tempDir, 'dir1');
      await fs.ensureDir(dir1);
      await fs.writeFile(path.join(dir1, 'file.txt'), 'content');

      const checksum1 = await sync.calculateDirChecksum(dir1);

      // Add metadata file
      await fs.writeFile(path.join(dir1, '.craftdesk-metadata.json'), '{}');
      await fs.writeFile(path.join(dir1, '.craftdesk-checksum'), 'abc123');

      const checksum2 = await sync.calculateDirChecksum(dir1);

      // Checksums should be the same (metadata ignored)
      expect(checksum1).toBe(checksum2);
    });

    it('should return consistent checksum for nested directories', async () => {
      const dir = path.join(tempDir, 'nested');
      await fs.ensureDir(path.join(dir, 'sub1/sub2'));
      await fs.writeFile(path.join(dir, 'sub1/file1.txt'), 'content1');
      await fs.writeFile(path.join(dir, 'sub1/sub2/file2.txt'), 'content2');

      const checksum = await sync.calculateDirChecksum(dir);

      expect(checksum).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});

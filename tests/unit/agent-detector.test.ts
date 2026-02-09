import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentDetector } from '../../src/services/agent-detector';
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

describe('AgentDetector', () => {
  let detector: AgentDetector;
  let tempDir: string;

  beforeEach(async () => {
    detector = new AgentDetector();
    tempDir = await createTempDir('agent-detector-test-');
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe('detectAgents', () => {
    it('should detect Claude when .claude directory exists', async () => {
      await fs.ensureDir(path.join(tempDir, '.claude'));

      vi.mocked(configManager.getCraftDeskJson).mockResolvedValue({
        name: 'test-project',
        version: '1.0.0',
        multiAgent: {
          enabled: true,
          canonical: '.claude',
          targets: ['.claude/skills']
        }
      });

      const result = await detector.detectAgents(tempDir);

      expect(result.detected.length).toBeGreaterThan(0);

      const claude = result.detected.find(a => a.name === 'claude');
      expect(claude).toBeDefined();
      expect(claude?.detected).toBe(true);
      expect(claude?.enabled).toBe(true);
    });

    it('should detect Cursor when .cursor directory exists', async () => {
      await fs.ensureDir(path.join(tempDir, '.cursor'));

      vi.mocked(configManager.getCraftDeskJson).mockResolvedValue({
        name: 'test-project',
        version: '1.0.0'
      });

      const result = await detector.detectAgents(tempDir);

      const cursor = result.detected.find(a => a.name === 'cursor');
      expect(cursor).toBeDefined();
      expect(cursor?.detected).toBe(true);
      expect(cursor?.enabled).toBe(false);
    });

    it('should detect multiple agents', async () => {
      await fs.ensureDir(path.join(tempDir, '.claude'));
      await fs.ensureDir(path.join(tempDir, '.cursor'));
      await fs.ensureDir(path.join(tempDir, '.windsurf'));

      vi.mocked(configManager.getCraftDeskJson).mockResolvedValue({
        name: 'test-project',
        version: '1.0.0',
        multiAgent: {
          enabled: true,
          canonical: '.claude',
          targets: ['.claude/skills', '.cursor/skills']
        }
      });

      const result = await detector.detectAgents(tempDir);

      expect(result.detected.filter(a => a.detected).length).toBe(3);

      const claude = result.detected.find(a => a.name === 'claude');
      const cursor = result.detected.find(a => a.name === 'cursor');
      const windsurf = result.detected.find(a => a.name === 'windsurf');

      expect(claude?.enabled).toBe(true);
      expect(cursor?.enabled).toBe(true);
      expect(windsurf?.enabled).toBe(false);
    });

    it('should mark agents as suggested when detected but not enabled', async () => {
      await fs.ensureDir(path.join(tempDir, '.cursor'));
      await fs.ensureDir(path.join(tempDir, '.windsurf'));

      vi.mocked(configManager.getCraftDeskJson).mockResolvedValue({
        name: 'test-project',
        version: '1.0.0',
        multiAgent: {
          enabled: true,
          canonical: '.claude',
          targets: ['.claude/skills']
        }
      });

      const result = await detector.detectAgents(tempDir);

      expect(result.suggested.length).toBe(2);
      expect(result.suggested.map(a => a.name)).toContain('cursor');
      expect(result.suggested.map(a => a.name)).toContain('windsurf');
    });

    it('should always include Claude even if directory does not exist', async () => {
      vi.mocked(configManager.getCraftDeskJson).mockResolvedValue({
        name: 'test-project',
        version: '1.0.0'
      });

      const result = await detector.detectAgents(tempDir);

      const claude = result.detected.find(a => a.name === 'claude');
      expect(claude).toBeDefined();
      expect(claude?.detected).toBe(false);
    });
  });

  describe('getAgentConfig', () => {
    it('should return config for known agent', () => {
      const config = detector.getAgentConfig('cursor');

      expect(config).toBeDefined();
      expect(config?.name).toBe('cursor');
      expect(config?.displayName).toBe('Cursor');
      expect(config?.skillsDir).toBe('.cursor/skills');
    });

    it('should return null for unknown agent', () => {
      const config = detector.getAgentConfig('unknown-agent');
      expect(config).toBeNull();
    });
  });

  describe('identifyAgentByDirectory', () => {
    it('should identify agent by directory path', () => {
      expect(detector.identifyAgentByDirectory('.cursor')).toBe('cursor');
      expect(detector.identifyAgentByDirectory('.windsurf')).toBe('windsurf');
      expect(detector.identifyAgentByDirectory('.claude')).toBe('claude');
    });

    it('should handle directory paths with trailing slash', () => {
      expect(detector.identifyAgentByDirectory('.cursor/')).toBe('cursor');
    });

    it('should handle directory paths with leading ./', () => {
      expect(detector.identifyAgentByDirectory('./.cursor')).toBe('cursor');
    });

    it('should return null for unknown directory', () => {
      expect(detector.identifyAgentByDirectory('.unknown')).toBeNull();
    });
  });

  describe('getKnownAgentNames', () => {
    it('should return all known agent names', () => {
      const names = detector.getKnownAgentNames();

      expect(names).toContain('claude');
      expect(names).toContain('cursor');
      expect(names).toContain('windsurf');
      expect(names).toContain('continue');
      expect(names).toContain('agents');
    });
  });

  describe('validateTargets', () => {
    it('should return empty array for valid targets', () => {
      const targets = ['.claude/skills', '.cursor/skills', '.windsurf/skills'];
      const invalid = detector.validateTargets(targets);

      expect(invalid).toEqual([]);
    });

    it('should return invalid targets', () => {
      const targets = [
        '.claude/skills',
        '.unknown/skills',
        '.another-unknown/skills'
      ];
      const invalid = detector.validateTargets(targets);

      expect(invalid).toHaveLength(2);
      expect(invalid).toContain('.unknown/skills');
      expect(invalid).toContain('.another-unknown/skills');
    });
  });
});

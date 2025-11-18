import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Installer } from '../../src/services/installer';
import { createTempDir, cleanupTempDir } from '../helpers/test-utils';
import path from 'path';

describe('Installer', () => {
  let installer: Installer;
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    installer = new Installer();
    tempDir = await createTempDir('installer-test-');
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTempDir(tempDir);
  });

  describe('getTypeDirectory', () => {
    it('should return correct directory for skill type', () => {
      const result = (installer as any).getTypeDirectory('skill');
      expect(result).toBe('skills');
    });

    it('should return correct directory for agent type', () => {
      const result = (installer as any).getTypeDirectory('agent');
      expect(result).toBe('agents');
    });

    it('should return correct directory for command type', () => {
      const result = (installer as any).getTypeDirectory('command');
      expect(result).toBe('commands');
    });

    it('should return correct directory for hook type', () => {
      const result = (installer as any).getTypeDirectory('hook');
      expect(result).toBe('hooks');
    });

    it('should default to crafts for unknown type', () => {
      const result = (installer as any).getTypeDirectory('unknown' as any);
      expect(result).toBe('crafts');
    });
  });

  describe('createMetadata', () => {
    it('should create craftdesk-metadata.json file', async () => {
      const fs = await import('fs-extra');
      const craftDir = path.join(tempDir, '.claude', 'skills', 'test-craft');
      await fs.ensureDir(craftDir);

      const entry = {
        version: '1.0.0',
        resolved: 'https://craftdesk.ai/download',
        integrity: 'sha256-test',
        type: 'skill' as const,
        author: 'test-author',
        dependencies: {}
      };

      await (installer as any).createMetadata(craftDir, 'test-craft', entry);

      const metadataPath = path.join(craftDir, '.craftdesk-metadata.json');
      const exists = await fs.pathExists(metadataPath);
      expect(exists).toBe(true);

      const metadata = await fs.readJson(metadataPath);
      expect(metadata.name).toBe('test-craft');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.type).toBe('skill');
      expect(metadata.installedAt).toBeDefined();
    });
  });

  describe('installFromLockfile', () => {
    it('should handle empty lockfile', async () => {
      const lockfile = {
        version: '1.0.0',
        lockfileVersion: 1,
        crafts: {}
      };

      await expect(installer.installFromLockfile(lockfile)).resolves.not.toThrow();
    });

    it('should create install directory structure', async () => {
      const fs = await import('fs-extra');
      const lockfile = {
        version: '1.0.0',
        lockfileVersion: 1,
        crafts: {}
      };

      await installer.installFromLockfile(lockfile);

      const installDir = path.join(tempDir, '.claude');
      const exists = await fs.pathExists(installDir);
      expect(exists).toBe(true);
    });
  });
});

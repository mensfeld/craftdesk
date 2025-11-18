import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigManager } from '../../src/services/config-manager';
import { createTempDir, cleanupTempDir, writeJsonFile } from '../helpers/test-utils';
import path from 'path';

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    configManager = new ConfigManager();
    tempDir = await createTempDir('config-test-');
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTempDir(tempDir);
  });

  describe('getRegistryForPackage', () => {
    it('should return default registry when no craftdesk.json exists', async () => {
      const registry = await configManager.getRegistryForPackage('test-package');
      expect(registry).toBe('https://craftdesk.ai');
    });

    it('should return default registry from craftdesk.json', async () => {
      await writeJsonFile(path.join(tempDir, 'craftdesk.json'), {
        name: 'test',
        version: '1.0.0',
        registries: {
          default: {
            url: 'https://custom-registry.com'
          }
        }
      });

      const registry = await configManager.getRegistryForPackage('test-package');
      expect(registry).toBe('https://custom-registry.com');
    });

    it('should return scoped registry for scoped package', async () => {
      await writeJsonFile(path.join(tempDir, 'craftdesk.json'), {
        name: 'test',
        version: '1.0.0',
        registries: {
          default: {
            url: 'https://craftdesk.ai'
          },
          'company-private': {
            url: 'https://company.internal',
            scope: '@company'
          }
        }
      });

      const registry = await configManager.getRegistryForPackage('@company/auth');
      expect(registry).toBe('https://company.internal');
    });

    it('should fallback to default registry for unmatched scoped package', async () => {
      await writeJsonFile(path.join(tempDir, 'craftdesk.json'), {
        name: 'test',
        version: '1.0.0',
        registries: {
          default: {
            url: 'https://craftdesk.ai'
          },
          'company-private': {
            url: 'https://company.internal',
            scope: '@company'
          }
        }
      });

      const registry = await configManager.getRegistryForPackage('@other/package');
      expect(registry).toBe('https://craftdesk.ai');
    });

    it('should use final fallback when no registries configured', async () => {
      await writeJsonFile(path.join(tempDir, 'craftdesk.json'), {
        name: 'test',
        version: '1.0.0'
      });

      const registry = await configManager.getRegistryForPackage('test-package');
      expect(registry).toBe('https://craftdesk.ai');
    });
  });

  describe('getAuthToken', () => {
    it('should return null when no craftdesk.json exists', async () => {
      const token = await configManager.getAuthToken('default');
      expect(token).toBeNull();
    });

    it('should return null when registry not configured', async () => {
      await writeJsonFile(path.join(tempDir, 'craftdesk.json'), {
        name: 'test',
        version: '1.0.0',
        registries: {
          default: {
            url: 'https://craftdesk.ai'
          }
        }
      });

      const token = await configManager.getAuthToken('nonexistent');
      expect(token).toBeNull();
    });

    it('should return token from environment variable', async () => {
      await writeJsonFile(path.join(tempDir, 'craftdesk.json'), {
        name: 'test',
        version: '1.0.0',
        registries: {
          'company-private': {
            url: 'https://company.internal',
            scope: '@company'
          }
        }
      });

      process.env.CRAFTDESK_AUTH_COMPANY_PRIVATE = 'test-token-123';

      const token = await configManager.getAuthToken('company-private');
      expect(token).toBe('test-token-123');

      delete process.env.CRAFTDESK_AUTH_COMPANY_PRIVATE;
    });

    it('should handle registry names with hyphens', async () => {
      await writeJsonFile(path.join(tempDir, 'craftdesk.json'), {
        name: 'test',
        version: '1.0.0',
        registries: {
          'my-custom-registry': {
            url: 'https://custom.com'
          }
        }
      });

      process.env.CRAFTDESK_AUTH_MY_CUSTOM_REGISTRY = 'custom-token';

      const token = await configManager.getAuthToken('my-custom-registry');
      expect(token).toBe('custom-token');

      delete process.env.CRAFTDESK_AUTH_MY_CUSTOM_REGISTRY;
    });

    it('should return null when environment variable not set', async () => {
      await writeJsonFile(path.join(tempDir, 'craftdesk.json'), {
        name: 'test',
        version: '1.0.0',
        registries: {
          private: {
            url: 'https://private.com'
          }
        }
      });

      const token = await configManager.getAuthToken('private');
      expect(token).toBeNull();
    });
  });

  describe('getInstallPath', () => {
    it('should return .claude directory', () => {
      const installPath = configManager.getInstallPath();
      expect(installPath).toBe('.claude');
    });
  });

  describe('getCraftDeskJson', () => {
    it('should return null when craftdesk.json does not exist', async () => {
      const result = await configManager.getCraftDeskJson();
      expect(result).toBeNull();
    });

    it('should return parsed craftdesk.json', async () => {
      const craftDeskData = {
        name: 'test-project',
        version: '1.0.0',
        type: 'skill',
        description: 'Test project'
      };

      await writeJsonFile(path.join(tempDir, 'craftdesk.json'), craftDeskData);

      const result = await configManager.getCraftDeskJson();
      expect(result).toEqual(craftDeskData);
    });

    it('should cache craftdesk.json after first read', async () => {
      const craftDeskData = {
        name: 'test-project',
        version: '1.0.0'
      };

      await writeJsonFile(path.join(tempDir, 'craftdesk.json'), craftDeskData);

      // First call
      const result1 = await configManager.getCraftDeskJson();

      // Modify file on disk
      await writeJsonFile(path.join(tempDir, 'craftdesk.json'), {
        name: 'modified',
        version: '2.0.0'
      });

      // Second call should return cached value
      const result2 = await configManager.getCraftDeskJson();

      expect(result1).toEqual(craftDeskData);
      expect(result2).toEqual(craftDeskData);
    });

    it('should return null for malformed JSON', async () => {
      const fs = await import('fs-extra');
      await fs.writeFile(path.join(tempDir, 'craftdesk.json'), 'not valid json', 'utf-8');

      const result = await configManager.getCraftDeskJson();
      expect(result).toBeNull();
    });
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  readCraftDeskJson,
  writeCraftDeskJson,
  readCraftDeskLock,
  writeCraftDeskLock,
  ensureDir
} from '../../src/utils/file-system';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import type { CraftDeskJson } from '../../src/types/craftdesk-json';
import type { CraftDeskLock } from '../../src/types/craftdesk-lock';

describe('File System Utils', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fs-test-'));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.remove(tempDir);
  });

  describe('readCraftDeskJson', () => {
    it('should read and parse craftdesk.json', async () => {
      const testData: CraftDeskJson = {
        name: 'test-project',
        version: '1.0.0',
        type: 'skill',
        dependencies: {
          'test/craft': '^1.0.0'
        }
      };

      await fs.writeJSON('craftdesk.json', testData);

      const result = await readCraftDeskJson();

      expect(result).toEqual(testData);
    });

    it('should return null when file missing', async () => {
      const result = await readCraftDeskJson();

      expect(result).toBeNull();
    });

    it('should return null for malformed JSON', async () => {
      await fs.writeFile('craftdesk.json', '{ invalid json }');

      const result = await readCraftDeskJson();

      expect(result).toBeNull();
    });

    it('should read from custom directory', async () => {
      const customDir = path.join(tempDir, 'custom');
      await fs.ensureDir(customDir);

      const testData: CraftDeskJson = {
        name: 'custom-project',
        version: '2.0.0'
      };

      await fs.writeJSON(path.join(customDir, 'craftdesk.json'), testData);

      const result = await readCraftDeskJson(customDir);

      expect(result).toEqual(testData);
    });

    it('should handle craftdesk.json with all optional fields', async () => {
      const fullData: CraftDeskJson = {
        name: 'full-project',
        version: '1.0.0',
        type: 'agent',
        description: 'A full project',
        author: 'Test Author',
        license: 'MIT',
        homepage: 'https://example.com',
        repository: {
          type: 'git',
          url: 'https://github.com/user/repo.git'
        },
        keywords: ['ai', 'craft'],
        dependencies: {
          'author/craft': '1.0.0'
        },
        devDependencies: {
          'author/dev-craft': '2.0.0'
        },
        registries: {
          default: {
            url: 'https://registry.example.com'
          }
        }
      };

      await fs.writeJSON('craftdesk.json', fullData);

      const result = await readCraftDeskJson();

      expect(result).toEqual(fullData);
    });

    it('should handle empty dependencies object', async () => {
      const testData: CraftDeskJson = {
        name: 'empty-deps',
        version: '1.0.0',
        dependencies: {}
      };

      await fs.writeJSON('craftdesk.json', testData);

      const result = await readCraftDeskJson();

      expect(result).toEqual(testData);
    });
  });

  describe('writeCraftDeskJson', () => {
    it('should write formatted JSON', async () => {
      const testData: CraftDeskJson = {
        name: 'write-test',
        version: '1.0.0',
        dependencies: {
          'test/craft': '1.0.0'
        }
      };

      await writeCraftDeskJson(testData);

      const fileContent = await fs.readFile('craftdesk.json', 'utf-8');
      const parsed = JSON.parse(fileContent);

      expect(parsed).toEqual(testData);
      // Check formatting (should have indentation)
      expect(fileContent).toContain('  '); // Contains spaces (2-space indent)
    });

    it('should write to custom directory', async () => {
      const nestedDir = path.join(tempDir, 'custom');
      await fs.ensureDir(nestedDir); // Create directory first
      const testData: CraftDeskJson = {
        name: 'nested',
        version: '1.0.0'
      };

      await writeCraftDeskJson(testData, nestedDir);

      const exists = await fs.pathExists(path.join(nestedDir, 'craftdesk.json'));
      expect(exists).toBe(true);
    });

    it('should overwrite existing file', async () => {
      const originalData: CraftDeskJson = {
        name: 'original',
        version: '1.0.0'
      };

      const updatedData: CraftDeskJson = {
        name: 'updated',
        version: '2.0.0'
      };

      await writeCraftDeskJson(originalData);
      await writeCraftDeskJson(updatedData);

      const result = await readCraftDeskJson();

      expect(result).toEqual(updatedData);
    });

    it('should preserve all fields', async () => {
      const complexData: CraftDeskJson = {
        name: 'complex',
        version: '1.0.0',
        type: 'command',
        description: 'Complex craft',
        dependencies: {
          'a/b': '1.0.0',
          'c/d': { git: 'https://github.com/c/d.git', branch: 'main' }
        },
        devDependencies: {
          'e/f': '2.0.0'
        },
        registries: {
          default: { url: 'https://registry.com' },
          custom: { url: 'https://custom.com', scope: '@custom' }
        }
      };

      await writeCraftDeskJson(complexData);
      const result = await readCraftDeskJson();

      expect(result).toEqual(complexData);
    });
  });

  describe('readCraftDeskLock', () => {
    it('should read and parse lockfile', async () => {
      const testLock: CraftDeskLock = {
        version: '1.0.0',
        lockfileVersion: 1,
        generatedAt: '2025-01-01T00:00:00.000Z',
        crafts: {
          'test/craft': {
            version: '1.0.0',
            resolved: 'https://registry.com/test/craft/1.0.0',
            integrity: 'sha256-abc123',
            type: 'skill',
            author: 'test',
            dependencies: {}
          }
        }
      };

      await fs.writeJSON('craftdesk.lock', testLock);

      const result = await readCraftDeskLock();

      expect(result).toEqual(testLock);
    });

    it('should return null when missing', async () => {
      const result = await readCraftDeskLock();

      expect(result).toBeNull();
    });

    it('should return null for malformed JSON', async () => {
      await fs.writeFile('craftdesk.lock', 'invalid');

      const result = await readCraftDeskLock();

      expect(result).toBeNull();
    });

    it('should read from custom directory', async () => {
      const customDir = path.join(tempDir, 'custom');
      await fs.ensureDir(customDir);

      const testLock: CraftDeskLock = {
        version: '1.0.0',
        lockfileVersion: 1,
        crafts: {}
      };

      await fs.writeJSON(path.join(customDir, 'craftdesk.lock'), testLock);

      const result = await readCraftDeskLock(customDir);

      expect(result).toEqual(testLock);
    });

    it('should handle lockfile with multiple crafts', async () => {
      const testLock: CraftDeskLock = {
        version: '1.0.0',
        lockfileVersion: 1,
        crafts: {
          'author1/craft1': {
            version: '1.0.0',
            resolved: 'https://registry.com/download1',
            integrity: 'sha256-abc',
            type: 'skill',
            author: 'author1',
            dependencies: {}
          },
          'author2/craft2': {
            version: '2.0.0',
            resolved: 'https://registry.com/download2',
            integrity: 'sha256-def',
            type: 'agent',
            author: 'author2',
            dependencies: {
              'author1/craft1': '^1.0.0'
            }
          }
        }
      };

      await fs.writeJSON('craftdesk.lock', testLock);

      const result = await readCraftDeskLock();

      expect(result).toEqual(testLock);
    });

    it('should handle git dependencies in lockfile', async () => {
      const testLock: CraftDeskLock = {
        version: '1.0.0',
        lockfileVersion: 1,
        crafts: {
          'author/craft': {
            version: 'main',
            resolved: 'https://github.com/author/craft.git',
            integrity: 'abc123def456',
            type: 'skill',
            author: 'git',
            git: 'https://github.com/author/craft.git',
            branch: 'main',
            commit: 'abc123def456',
            dependencies: {}
          }
        }
      };

      await fs.writeJSON('craftdesk.lock', testLock);

      const result = await readCraftDeskLock();

      expect(result).toEqual(testLock);
    });
  });

  describe('writeCraftDeskLock', () => {
    it('should write formatted lockfile', async () => {
      const testLock: CraftDeskLock = {
        version: '1.0.0',
        lockfileVersion: 1,
        generatedAt: '2025-01-01T00:00:00.000Z',
        crafts: {
          'test/craft': {
            version: '1.0.0',
            resolved: 'https://registry.com/test',
            integrity: 'sha256-test',
            type: 'skill',
            author: 'test',
            dependencies: {}
          }
        }
      };

      await writeCraftDeskLock(testLock);

      const fileContent = await fs.readFile('craftdesk.lock', 'utf-8');
      const parsed = JSON.parse(fileContent);

      expect(parsed).toEqual(testLock);
      expect(fileContent).toContain('  '); // Check formatting
    });

    it('should preserve lockfile structure', async () => {
      const testLock: CraftDeskLock = {
        version: '1.0.0',
        lockfileVersion: 1,
        generatedAt: '2025-01-01T00:00:00.000Z',
        crafts: {
          'a/b': {
            version: '1.0.0',
            resolved: 'url1',
            integrity: 'hash1',
            type: 'skill',
            author: 'a',
            dependencies: { 'c/d': '1.0.0' }
          },
          'c/d': {
            version: '1.0.0',
            resolved: 'url2',
            integrity: 'hash2',
            type: 'agent',
            author: 'c',
            dependencies: {}
          }
        }
      };

      await writeCraftDeskLock(testLock);
      const result = await readCraftDeskLock();

      expect(result).toEqual(testLock);
    });

    it('should overwrite existing lockfile', async () => {
      const lock1: CraftDeskLock = {
        version: '1.0.0',
        lockfileVersion: 1,
        crafts: { 'a/b': { version: '1.0.0', resolved: '', integrity: '', type: 'skill', author: 'a', dependencies: {} } }
      };

      const lock2: CraftDeskLock = {
        version: '2.0.0',
        lockfileVersion: 1,
        crafts: { 'c/d': { version: '2.0.0', resolved: '', integrity: '', type: 'agent', author: 'c', dependencies: {} } }
      };

      await writeCraftDeskLock(lock1);
      await writeCraftDeskLock(lock2);

      const result = await readCraftDeskLock();

      expect(result).toEqual(lock2);
    });
  });

  describe('ensureDir', () => {
    it('should create directory recursively', async () => {
      const nestedPath = path.join(tempDir, 'a', 'b', 'c', 'd');

      await ensureDir(nestedPath);

      const exists = await fs.pathExists(nestedPath);
      expect(exists).toBe(true);
    });

    it('should not fail if directory exists', async () => {
      const dirPath = path.join(tempDir, 'existing');
      await fs.ensureDir(dirPath);

      // Should not throw
      await ensureDir(dirPath);

      const exists = await fs.pathExists(dirPath);
      expect(exists).toBe(true);
    });

    it('should create multiple levels', async () => {
      const path1 = path.join(tempDir, 'level1');
      const path2 = path.join(path1, 'level2');
      const path3 = path.join(path2, 'level3');

      await ensureDir(path3);

      expect(await fs.pathExists(path1)).toBe(true);
      expect(await fs.pathExists(path2)).toBe(true);
      expect(await fs.pathExists(path3)).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete workflow: write craftdesk.json -> read -> write lock -> read', async () => {
      // Write craftdesk.json
      const craftDesk: CraftDeskJson = {
        name: 'workflow-test',
        version: '1.0.0',
        dependencies: {
          'author/craft': '^1.0.0'
        }
      };

      await writeCraftDeskJson(craftDesk);

      // Read it back
      const readCraftDesk = await readCraftDeskJson();
      expect(readCraftDesk).toEqual(craftDesk);

      // Write lockfile
      const lock: CraftDeskLock = {
        version: '1.0.0',
        lockfileVersion: 1,
        crafts: {
          'author/craft': {
            version: '1.2.0',
            resolved: 'https://registry.com/download',
            integrity: 'sha256-abc',
            type: 'skill',
            author: 'author',
            dependencies: {}
          }
        }
      };

      await writeCraftDeskLock(lock);

      // Read lockfile back
      const readLock = await readCraftDeskLock();
      expect(readLock).toEqual(lock);
    });

    it('should handle updating dependencies', async () => {
      // Initial state
      const initial: CraftDeskJson = {
        name: 'update-test',
        version: '1.0.0',
        dependencies: {
          'a/b': '1.0.0'
        }
      };

      await writeCraftDeskJson(initial);

      // Read and modify
      const current = await readCraftDeskJson();
      if (current) {
        current.dependencies = {
          ...current.dependencies,
          'c/d': '2.0.0'
        };
        await writeCraftDeskJson(current);
      }

      // Verify update
      const updated = await readCraftDeskJson();
      expect(updated?.dependencies).toEqual({
        'a/b': '1.0.0',
        'c/d': '2.0.0'
      });
    });
  });
});

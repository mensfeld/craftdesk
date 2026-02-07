import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GitResolver } from '../../src/services/git-resolver';
import { createTempDir, cleanupTempDir, writeJsonFile } from '../helpers/test-utils';
import path from 'path';
import fs from 'fs-extra';
import { execFileSync } from 'child_process';

// Mock execFileSync for these tests
vi.mock('child_process', () => ({
  execFileSync: vi.fn()
}));

describe('GitResolver', () => {
  let gitResolver: GitResolver;
  let tempDir: string;

  beforeEach(async () => {
    gitResolver = new GitResolver();
    tempDir = await createTempDir('git-test-');
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe('inferCraftType', () => {
    it('should infer skill type from SKILL.md marker file', async () => {
      const testDir = await createTempDir('type-test-');
      await fs.writeFile(path.join(testDir, 'SKILL.md'), '# Skill');

      // Access private method via type assertion
      const type = await (gitResolver as any).inferCraftType(testDir);

      expect(type).toBe('skill');
      await cleanupTempDir(testDir);
    });

    it('should infer agent type from AGENT.md marker file', async () => {
      const testDir = await createTempDir('type-test-');
      await fs.writeFile(path.join(testDir, 'AGENT.md'), '# Agent');

      const type = await (gitResolver as any).inferCraftType(testDir);

      expect(type).toBe('agent');
      await cleanupTempDir(testDir);
    });

    it('should infer command type from COMMAND.md marker file', async () => {
      const testDir = await createTempDir('type-test-');
      await fs.writeFile(path.join(testDir, 'COMMAND.md'), '# Command');

      const type = await (gitResolver as any).inferCraftType(testDir);

      expect(type).toBe('command');
      await cleanupTempDir(testDir);
    });

    it('should infer hook type from HOOK.md marker file', async () => {
      const testDir = await createTempDir('type-test-');
      await fs.writeFile(path.join(testDir, 'HOOK.md'), '# Hook');

      const type = await (gitResolver as any).inferCraftType(testDir);

      expect(type).toBe('hook');
      await cleanupTempDir(testDir);
    });

    it('should infer collection type from COLLECTION.md marker file', async () => {
      const testDir = await createTempDir('type-test-');
      await fs.writeFile(path.join(testDir, 'COLLECTION.md'), '# Collection');

      const type = await (gitResolver as any).inferCraftType(testDir);

      expect(type).toBe('collection');
      await cleanupTempDir(testDir);
    });

    it('should infer type from directory name containing "skill"', async () => {
      const testDir = await createTempDir('my-skill-');

      const type = await (gitResolver as any).inferCraftType(testDir);

      expect(type).toBe('skill');
      await cleanupTempDir(testDir);
    });

    it('should infer type from directory name containing "agent"', async () => {
      const testDir = path.join(tempDir, 'my-agent');
      await fs.ensureDir(testDir);

      const type = await (gitResolver as any).inferCraftType(testDir);

      expect(type).toBe('agent');
    });

    it('should infer type from directory name containing "collection"', async () => {
      const testDir = path.join(tempDir, 'my-collection');
      await fs.ensureDir(testDir);

      const type = await (gitResolver as any).inferCraftType(testDir);

      expect(type).toBe('collection');
    });

    it('should default to skill when no indicators found', async () => {
      const testDir = await createTempDir('random-name-');

      const type = await (gitResolver as any).inferCraftType(testDir);

      expect(type).toBe('skill');
      await cleanupTempDir(testDir);
    });
  });

  describe('inferCraftTypeFromFilename', () => {
    it('should infer collection type from filename containing "collection"', () => {
      const type = (gitResolver as any).inferCraftTypeFromFilename('rails-collection.md');
      expect(type).toBe('collection');
    });

    it('should infer agent type from filename containing "agent"', () => {
      const type = (gitResolver as any).inferCraftTypeFromFilename('rspec-dry-agent.md');
      expect(type).toBe('agent');
    });

    it('should infer skill type from filename containing "skill"', () => {
      const type = (gitResolver as any).inferCraftTypeFromFilename('ruby-skill.md');
      expect(type).toBe('skill');
    });

    it('should default to skill when no type indicators found', () => {
      const type = (gitResolver as any).inferCraftTypeFromFilename('random-file.md');
      expect(type).toBe('skill');
    });

    it('should be case insensitive', () => {
      const type = (gitResolver as any).inferCraftTypeFromFilename('Rails-COLLECTION.md');
      expect(type).toBe('collection');
    });
  });

  describe('resolveGitDependency', () => {
    it('should resolve git dependency with craftdesk.json', async () => {
      const mockRepoPath = path.join(tempDir, 'mock-repo');
      await fs.ensureDir(mockRepoPath);

      const craftDeskJson = {
        name: 'test-skill',
        version: '1.0.0',
        type: 'skill',
        description: 'Test skill',
        dependencies: {
          'helper-lib': '^1.0.0'
        }
      };

      await writeJsonFile(path.join(mockRepoPath, 'craftdesk.json'), craftDeskJson);

      // Mock git commands
      const mockExecFileSync = vi.mocked(execFileSync);
      mockExecFileSync.mockImplementation((_cmd: any, args?: any, options?: any) => {
        const argsArr = args as string[];
        if (argsArr[0] === 'clone') {
          // Simulate successful clone by copying our mock repo
          // Last arg is the target directory
          const targetDir = argsArr[argsArr.length - 1];
          fs.copySync(mockRepoPath, targetDir);
          return Buffer.from('');
        } else if (argsArr[0] === 'rev-parse' && argsArr[1] === 'HEAD') {
          const output = 'abc123def456789012345678901234567890abcd\n';
          return options?.encoding === 'utf8' ? output : Buffer.from(output);
        }
        return Buffer.from('');
      });

      const result = await gitResolver.resolveGitDependency({
        url: 'https://github.com/test/repo.git',
        branch: 'main'
      });

      expect(result.craftDeskJson).toEqual(craftDeskJson);
      expect(result.resolvedCommit).toBe('abc123def456789012345678901234567890abcd');
    });

    it('should generate minimal metadata when craftdesk.json is missing', async () => {
      const mockRepoPath = path.join(tempDir, 'mock-repo-no-json');
      await fs.ensureDir(mockRepoPath);
      await fs.writeFile(path.join(mockRepoPath, 'SKILL.md'), '# Skill');

      const mockExecFileSync = vi.mocked(execFileSync);
      mockExecFileSync.mockImplementation((_cmd: any, args?: any, options?: any) => {
        const argsArr = args as string[];
        if (argsArr[0] === 'clone') {
          const targetDir = argsArr[argsArr.length - 1];
          fs.copySync(mockRepoPath, targetDir);
          return Buffer.from('');
        } else if (argsArr[0] === 'rev-parse' && argsArr[1] === 'HEAD') {
          const output = 'abc123def456789012345678901234567890abcd\n';
          return options?.encoding === 'utf8' ? output : Buffer.from(output);
        }
        return Buffer.from('');
      });

      const result = await gitResolver.resolveGitDependency({
        url: 'https://github.com/test/repo.git',
        branch: 'main'
      });

      expect(result.craftDeskJson).toBeDefined();
      expect(result.craftDeskJson!.name).toBe('repo');
      expect(result.craftDeskJson!.version).toBe('main');
      expect(result.craftDeskJson!.type).toBe('skill');
      expect(result.craftDeskJson!.dependencies).toEqual({});
    });

    it('should handle subdirectory path for monorepos', async () => {
      const mockRepoPath = path.join(tempDir, 'mock-monorepo');
      const skillPath = path.join(mockRepoPath, 'packages', 'auth');
      await fs.ensureDir(skillPath);

      const craftDeskJson = {
        name: 'auth-skill',
        version: '2.0.0',
        type: 'skill',
        dependencies: {}
      };

      await writeJsonFile(path.join(skillPath, 'craftdesk.json'), craftDeskJson);

      const mockExecFileSync = vi.mocked(execFileSync);
      mockExecFileSync.mockImplementation((_cmd: any, args?: any, options?: any) => {
        const argsArr = args as string[];
        if (argsArr[0] === 'clone') {
          const targetDir = argsArr[argsArr.length - 1];
          fs.copySync(mockRepoPath, targetDir);
          return Buffer.from('');
        } else if (argsArr[0] === 'rev-parse' && argsArr[1] === 'HEAD') {
          const output = 'def456789012345678901234567890abcdef123\n';
          return options?.encoding === 'utf8' ? output : Buffer.from(output);
        }
        return Buffer.from('');
      });

      const result = await gitResolver.resolveGitDependency({
        url: 'https://github.com/test/monorepo.git',
        tag: 'v2.0.0',
        path: 'packages/auth'
      });

      expect(result.craftDeskJson).toEqual(craftDeskJson);
      expect(result.path).toBe('packages/auth');
    });
  });

  describe('resolveAllDependencies', () => {
    it('should resolve registry dependencies', async () => {
      const dependencies = {
        'ruby-on-rails': '^7.0.0',
        'postgres-expert': '^1.0.0'
      };

      const result = await gitResolver.resolveAllDependencies(dependencies);

      expect(result.resolved['ruby-on-rails']).toEqual({
        version: '^7.0.0',
        resolved: 'registry',
        integrity: 'pending',
        type: 'skill'
      });

      expect(result.resolved['postgres-expert']).toEqual({
        version: '^1.0.0',
        resolved: 'registry',
        integrity: 'pending',
        type: 'skill'
      });
    });

    it('should resolve mixed git and registry dependencies', async () => {
      const mockRepoPath = path.join(tempDir, 'mock-git-dep');
      await fs.ensureDir(mockRepoPath);

      const craftDeskJson = {
        name: 'custom-auth',
        version: '1.0.0',
        type: 'agent',
        dependencies: {
          'jwt-helper': '^2.0.0'
        }
      };

      await writeJsonFile(path.join(mockRepoPath, 'craftdesk.json'), craftDeskJson);

      const mockExecFileSync = vi.mocked(execFileSync);
      mockExecFileSync.mockImplementation((_cmd: any, args?: any, options?: any) => {
        const argsArr = args as string[];
        if (argsArr[0] === 'clone') {
          const targetDir = argsArr[argsArr.length - 1];
          fs.copySync(mockRepoPath, targetDir);
          return Buffer.from('');
        } else if (argsArr[0] === 'rev-parse' && argsArr[1] === 'HEAD') {
          const output = 'abc123def456789012345678901234567890abcd\n';
          return options?.encoding === 'utf8' ? output : Buffer.from(output);
        }
        return Buffer.from('');
      });

      const dependencies = {
        'ruby-on-rails': '^7.0.0',
        'custom-auth': {
          git: 'https://github.com/company/auth.git',
          branch: 'main'
        }
      };

      const result = await gitResolver.resolveAllDependencies(dependencies);

      // Check registry dependency
      expect(result.resolved['ruby-on-rails'].resolved).toBe('registry');
      expect(result.resolved['ruby-on-rails'].integrity).toBe('pending');

      // Check git dependency
      expect(result.resolved['custom-auth'].git).toBe('https://github.com/company/auth.git');
      expect(result.resolved['custom-auth'].branch).toBe('main');
      expect(result.resolved['custom-auth'].type).toBe('agent');

      // Check transitive dependency from git
      expect(result.resolved['jwt-helper']).toBeDefined();
      expect(result.resolved['jwt-helper'].version).toBe('^2.0.0');
    });

    it('should avoid circular dependencies', async () => {
      const dependencies = {
        'package-a': '^1.0.0'
      };

      // The algorithm marks visited packages to avoid infinite loops
      const result = await gitResolver.resolveAllDependencies(dependencies);

      expect(result.resolved['package-a']).toBeDefined();
      expect(result.lockfile.crafts).toBeDefined();
    });
  });
});

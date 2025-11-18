import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GitResolver } from '../../src/services/git-resolver';
import { createTempDir, cleanupTempDir, writeJsonFile } from '../helpers/test-utils';
import path from 'path';
import fs from 'fs-extra';
import { execSync } from 'child_process';

// Mock execSync for these tests
vi.mock('child_process', () => ({
  execSync: vi.fn()
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

    it('should default to skill when no indicators found', async () => {
      const testDir = await createTempDir('random-name-');

      const type = await (gitResolver as any).inferCraftType(testDir);

      expect(type).toBe('skill');
      await cleanupTempDir(testDir);
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
      const mockExecSync = vi.mocked(execSync);
      mockExecSync.mockImplementation((cmd: any, options?: any) => {
        const cmdStr = cmd.toString();
        if (cmdStr.includes('git clone')) {
          // Simulate successful clone by copying our mock repo
          const targetMatch = cmdStr.match(/git clone.*\s+(.+)$/);
          if (targetMatch) {
            fs.copySync(mockRepoPath, targetMatch[1]);
          }
          return Buffer.from('');
        } else if (cmdStr.includes('git rev-parse HEAD')) {
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

      const mockExecSync = vi.mocked(execSync);
      mockExecSync.mockImplementation((cmd: any, options?: any) => {
        const cmdStr = cmd.toString();
        if (cmdStr.includes('git clone')) {
          const targetMatch = cmdStr.match(/git clone.*\s+(.+)$/);
          if (targetMatch) {
            fs.copySync(mockRepoPath, targetMatch[1]);
          }
          return Buffer.from('');
        } else if (cmdStr.includes('git rev-parse HEAD')) {
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

      const mockExecSync = vi.mocked(execSync);
      mockExecSync.mockImplementation((cmd: any, options?: any) => {
        const cmdStr = cmd.toString();
        if (cmdStr.includes('git clone')) {
          const targetMatch = cmdStr.match(/git clone.*\s+(.+)$/);
          if (targetMatch) {
            fs.copySync(mockRepoPath, targetMatch[1]);
          }
          return Buffer.from('');
        } else if (cmdStr.includes('git rev-parse HEAD')) {
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
        needsResolution: true,
        version: '^7.0.0',
        registry: undefined
      });

      expect(result.resolved['postgres-expert']).toEqual({
        needsResolution: true,
        version: '^1.0.0',
        registry: undefined
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

      const mockExecSync = vi.mocked(execSync);
      mockExecSync.mockImplementation((cmd: any, options?: any) => {
        const cmdStr = cmd.toString();
        if (cmdStr.includes('git clone')) {
          const targetMatch = cmdStr.match(/git clone.*\s+(.+)$/);
          if (targetMatch) {
            fs.copySync(mockRepoPath, targetMatch[1]);
          }
          return Buffer.from('');
        } else if (cmdStr.includes('git rev-parse HEAD')) {
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
      expect(result.resolved['ruby-on-rails'].needsResolution).toBe(true);

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

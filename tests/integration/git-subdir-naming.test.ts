/**
 * Integration tests for git subdirectory skill naming
 *
 * Tests that when installing a skill from a git subdirectory (monorepo),
 * the skill name is derived from the subdirectory path, not the repo name.
 *
 * Bug: https://github.com/mensfeld/craftdesk/issues/47
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { execFileSync, execSync } from 'child_process';
import { GitResolver } from '../../src/services/git-resolver';
import { installer } from '../../src/services/installer';

const CLI_PATH = path.join(__dirname, '../../dist/index.js');

const TEST_DIR = path.join(__dirname, '../fixtures/git-subdir-naming-test');
const INSTALL_DIR = path.join(TEST_DIR, '.claude');

describe('Git Subdirectory Skill Naming (Issue #47)', () => {
  let gitResolver: GitResolver;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    await fs.remove(TEST_DIR);
    await fs.ensureDir(TEST_DIR);
    await fs.ensureDir(INSTALL_DIR);
    process.chdir(TEST_DIR);

    // Create craftdesk.json so commands work
    await fs.writeJson(path.join(TEST_DIR, 'craftdesk.json'), {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {}
    });

    gitResolver = new GitResolver();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.remove(TEST_DIR);
  });

  describe('Monorepo with skills in subdirectory', () => {
    it('should use subdirectory name as skill name, not repo name', async () => {
      // Create a monorepo-style git repo (like anthropics/skills)
      // Repo name: "skills" (generic)
      // Subdirectory: "skills/webapp-testing" (specific skill)
      const repoPath = path.join(TEST_DIR, 'skills-monorepo');
      await createMonorepoWithSkills(repoPath, {
        repoName: 'skills',
        skills: ['webapp-testing', 'database-admin', 'api-design']
      });

      // Resolve with path to specific skill subdirectory
      const gitInfo = {
        url: repoPath,
        branch: 'main',
        path: 'skills/webapp-testing'
      };

      const resolved = await gitResolver.resolveGitDependency(gitInfo);

      // The resolved craftdesk.json might not have a name field
      // In this case, the name should be derived from the path
      const expectedName = 'webapp-testing';

      // Install the skill
      const lockEntry = {
        version: resolved.craftDeskJson?.version || '1.0.0',
        git: resolved.url,
        commit: resolved.resolvedCommit,
        integrity: `sha256-git:${resolved.resolvedCommit}`,
        type: 'skill' as const,
        author: 'test',
        path: 'skills/webapp-testing',
        dependencies: {}
      };

      // This is where the bug manifests - the name passed to installCraft
      // should be 'webapp-testing', not 'skills'
      await installer.installCraft(expectedName, lockEntry);

      // Verify skill is installed with correct name
      const skillDir = path.join(INSTALL_DIR, 'skills', expectedName);
      expect(await fs.pathExists(skillDir)).toBe(true);
      expect(await fs.pathExists(path.join(skillDir, 'SKILL.md'))).toBe(true);

      // Verify it's NOT installed with repo name
      const wrongDir = path.join(INSTALL_DIR, 'skills', 'skills');
      expect(await fs.pathExists(wrongDir)).toBe(false);
    });

    it('should use deeply nested path last segment as name', async () => {
      const repoPath = path.join(TEST_DIR, 'deep-monorepo');
      await createDeepMonorepo(repoPath, {
        repoName: 'company-tools',
        skillPath: 'packages/claude/skills/auth-helper'
      });

      const gitInfo = {
        url: repoPath,
        branch: 'main',
        path: 'packages/claude/skills/auth-helper'
      };

      const resolved = await gitResolver.resolveGitDependency(gitInfo);

      const lockEntry = {
        version: '1.0.0',
        git: resolved.url,
        commit: resolved.resolvedCommit,
        integrity: `sha256-git:${resolved.resolvedCommit}`,
        type: 'skill' as const,
        author: 'test',
        path: 'packages/claude/skills/auth-helper',
        dependencies: {}
      };

      // Name should be 'auth-helper', not 'company-tools'
      await installer.installCraft('auth-helper', lockEntry);

      const skillDir = path.join(INSTALL_DIR, 'skills', 'auth-helper');
      expect(await fs.pathExists(skillDir)).toBe(true);
    });

    it('should prefer craftdesk.json name over path-derived name', async () => {
      const repoPath = path.join(TEST_DIR, 'named-skill-repo');
      await createMonorepoWithNamedSkill(repoPath, {
        repoName: 'skills',
        skillPath: 'skills/webapp-testing',
        skillName: 'webapp-e2e-testing' // Explicit name in craftdesk.json
      });

      const gitInfo = {
        url: repoPath,
        branch: 'main',
        path: 'skills/webapp-testing'
      };

      const resolved = await gitResolver.resolveGitDependency(gitInfo);

      // When craftdesk.json has a name, it should be used
      expect(resolved.craftDeskJson?.name).toBe('webapp-e2e-testing');
    });
  });

  describe('Single file skill from subdirectory', () => {
    it('should use filename without extension as skill name', async () => {
      const repoPath = path.join(TEST_DIR, 'file-skills-repo');
      await createRepoWithFileSkills(repoPath, {
        repoName: 'skill-collection',
        files: ['database/postgres-admin.md', 'api/rest-design.md']
      });

      const gitInfo = {
        url: repoPath,
        branch: 'main',
        file: 'database/postgres-admin.md'
      };

      const resolved = await gitResolver.resolveGitDependency(gitInfo);

      // Name should be 'postgres-admin', not 'skill-collection'
      const lockEntry = {
        version: '1.0.0',
        git: resolved.url,
        commit: resolved.resolvedCommit,
        integrity: `sha256-git:${resolved.resolvedCommit}`,
        type: 'skill' as const,
        author: 'test',
        file: 'database/postgres-admin.md',
        dependencies: {}
      };

      await installer.installCraft('postgres-admin', lockEntry);

      const skillDir = path.join(INSTALL_DIR, 'skills', 'postgres-admin');
      expect(await fs.pathExists(skillDir)).toBe(true);
    });
  });

  describe('Repo without subdirectory', () => {
    it('should use repo name when no path specified', async () => {
      const repoPath = path.join(TEST_DIR, 'single-skill-repo');
      await createSingleSkillRepo(repoPath, {
        repoName: 'my-awesome-skill'
      });

      const gitInfo = {
        url: repoPath,
        branch: 'main'
        // No path - entire repo is the skill
      };

      const resolved = await gitResolver.resolveGitDependency(gitInfo);

      const lockEntry = {
        version: '1.0.0',
        git: resolved.url,
        commit: resolved.resolvedCommit,
        integrity: `sha256-git:${resolved.resolvedCommit}`,
        type: 'skill' as const,
        author: 'test',
        dependencies: {}
      };

      // Name should be 'my-awesome-skill' (repo name)
      await installer.installCraft('my-awesome-skill', lockEntry);

      const skillDir = path.join(INSTALL_DIR, 'skills', 'my-awesome-skill');
      expect(await fs.pathExists(skillDir)).toBe(true);
    });
  });

  describe('CLI add command with git subdirectory URL', () => {
    it('should install skill with subdirectory name via CLI add command', async () => {
      // Create a monorepo-style git repo
      const repoPath = path.join(TEST_DIR, 'cli-test-monorepo');
      await createMonorepoWithSkills(repoPath, {
        repoName: 'skills',
        skills: ['webapp-testing', 'database-admin']
      });

      // Build the git URL with path (simulating what normalizeGitHubUrl produces)
      const gitUrl = `git+${repoPath}#main#path:skills/webapp-testing`;

      // Run craftdesk add via CLI
      const output = execSync(`node ${CLI_PATH} add "${gitUrl}"`, {
        encoding: 'utf-8',
        cwd: TEST_DIR
      });

      // Verify output mentions the correct skill name
      expect(output).toContain('webapp-testing');

      // Verify skill is installed with correct name (webapp-testing, NOT skills)
      const correctDir = path.join(INSTALL_DIR, 'skills', 'webapp-testing');
      const wrongDir = path.join(INSTALL_DIR, 'skills', 'skills');

      expect(await fs.pathExists(correctDir)).toBe(true);
      expect(await fs.pathExists(wrongDir)).toBe(false);

      // Verify craftdesk.json has the correct dependency name
      const craftdeskJson = await fs.readJson(path.join(TEST_DIR, 'craftdesk.json'));
      expect(craftdeskJson.dependencies['webapp-testing']).toBeDefined();
      expect(craftdeskJson.dependencies['skills']).toBeUndefined();

      // Verify lockfile has the correct craft name
      const lockfile = await fs.readJson(path.join(TEST_DIR, 'craftdesk.lock'));
      expect(lockfile.crafts['webapp-testing']).toBeDefined();
      expect(lockfile.crafts['skills']).toBeUndefined();
    });

    it('should install skill with file-derived name via CLI add command', async () => {
      const repoPath = path.join(TEST_DIR, 'cli-test-file-repo');
      await createRepoWithFileSkills(repoPath, {
        repoName: 'skill-collection',
        files: ['skills/postgres-admin.md']
      });

      const gitUrl = `git+${repoPath}#main#file:skills/postgres-admin.md`;

      const output = execSync(`node ${CLI_PATH} add "${gitUrl}"`, {
        encoding: 'utf-8',
        cwd: TEST_DIR
      });

      expect(output).toContain('postgres-admin');

      // Verify skill is installed with filename-derived name
      const correctDir = path.join(INSTALL_DIR, 'skills', 'postgres-admin');
      expect(await fs.pathExists(correctDir)).toBe(true);

      // Verify craftdesk.json
      const craftdeskJson = await fs.readJson(path.join(TEST_DIR, 'craftdesk.json'));
      expect(craftdeskJson.dependencies['postgres-admin']).toBeDefined();
      expect(craftdeskJson.dependencies['skill-collection']).toBeUndefined();
    });
  });
});

/**
 * Helper: Create a monorepo with multiple skills in subdirectories
 */
async function createMonorepoWithSkills(repoPath: string, options: {
  repoName: string;
  skills: string[];
}) {
  await fs.ensureDir(repoPath);

  // Initialize git
  execFileSync('git', ['init'], { cwd: repoPath, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repoPath, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: repoPath, stdio: 'pipe' });

  // Create root README (no craftdesk.json at root - it's a monorepo)
  await fs.writeFile(
    path.join(repoPath, 'README.md'),
    `# ${options.repoName}\n\nA collection of skills.`
  );

  // Create each skill in its own subdirectory
  for (const skillName of options.skills) {
    const skillDir = path.join(repoPath, 'skills', skillName);
    await fs.ensureDir(skillDir);

    // Each skill has its own SKILL.md
    await fs.writeFile(
      path.join(skillDir, 'SKILL.md'),
      `# ${skillName}\n\nSkill for ${skillName}.`
    );

    // NO craftdesk.json - name should be derived from directory
  }

  // Commit
  execFileSync('git', ['add', '.'], { cwd: repoPath, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'Initial commit'], { cwd: repoPath, stdio: 'pipe' });
  execFileSync('git', ['branch', '-M', 'main'], { cwd: repoPath, stdio: 'pipe' });
}

/**
 * Helper: Create a deeply nested monorepo
 */
async function createDeepMonorepo(repoPath: string, options: {
  repoName: string;
  skillPath: string;
}) {
  await fs.ensureDir(repoPath);

  execFileSync('git', ['init'], { cwd: repoPath, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repoPath, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: repoPath, stdio: 'pipe' });

  await fs.writeFile(
    path.join(repoPath, 'README.md'),
    `# ${options.repoName}\n\nCompany tools monorepo.`
  );

  // Create deeply nested skill
  const skillDir = path.join(repoPath, options.skillPath);
  await fs.ensureDir(skillDir);

  await fs.writeFile(
    path.join(skillDir, 'SKILL.md'),
    `# ${path.basename(options.skillPath)}\n\nA deeply nested skill.`
  );

  execFileSync('git', ['add', '.'], { cwd: repoPath, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'Initial commit'], { cwd: repoPath, stdio: 'pipe' });
  execFileSync('git', ['branch', '-M', 'main'], { cwd: repoPath, stdio: 'pipe' });
}

/**
 * Helper: Create monorepo with skill that has explicit name in craftdesk.json
 */
async function createMonorepoWithNamedSkill(repoPath: string, options: {
  repoName: string;
  skillPath: string;
  skillName: string;
}) {
  await fs.ensureDir(repoPath);

  execFileSync('git', ['init'], { cwd: repoPath, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repoPath, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: repoPath, stdio: 'pipe' });

  await fs.writeFile(
    path.join(repoPath, 'README.md'),
    `# ${options.repoName}`
  );

  const skillDir = path.join(repoPath, options.skillPath);
  await fs.ensureDir(skillDir);

  await fs.writeFile(
    path.join(skillDir, 'SKILL.md'),
    `# ${options.skillName}\n\nSkill content.`
  );

  // This skill HAS a craftdesk.json with explicit name
  await fs.writeJson(path.join(skillDir, 'craftdesk.json'), {
    name: options.skillName,
    version: '1.0.0',
    type: 'skill'
  });

  execFileSync('git', ['add', '.'], { cwd: repoPath, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'Initial commit'], { cwd: repoPath, stdio: 'pipe' });
  execFileSync('git', ['branch', '-M', 'main'], { cwd: repoPath, stdio: 'pipe' });
}

/**
 * Helper: Create repo with file-based skills
 */
async function createRepoWithFileSkills(repoPath: string, options: {
  repoName: string;
  files: string[];
}) {
  await fs.ensureDir(repoPath);

  execFileSync('git', ['init'], { cwd: repoPath, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repoPath, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: repoPath, stdio: 'pipe' });

  await fs.writeFile(
    path.join(repoPath, 'README.md'),
    `# ${options.repoName}`
  );

  for (const filePath of options.files) {
    const fullPath = path.join(repoPath, filePath);
    await fs.ensureDir(path.dirname(fullPath));
    const name = path.basename(filePath, '.md');
    await fs.writeFile(fullPath, `# ${name}\n\nSkill content for ${name}.`);
  }

  execFileSync('git', ['add', '.'], { cwd: repoPath, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'Initial commit'], { cwd: repoPath, stdio: 'pipe' });
  execFileSync('git', ['branch', '-M', 'main'], { cwd: repoPath, stdio: 'pipe' });
}

/**
 * Helper: Create single-skill repo (entire repo is one skill)
 */
async function createSingleSkillRepo(repoPath: string, options: {
  repoName: string;
}) {
  await fs.ensureDir(repoPath);

  execFileSync('git', ['init'], { cwd: repoPath, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repoPath, stdio: 'pipe' });
  execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: repoPath, stdio: 'pipe' });

  await fs.writeFile(
    path.join(repoPath, 'README.md'),
    `# ${options.repoName}`
  );

  await fs.writeFile(
    path.join(repoPath, 'SKILL.md'),
    `# ${options.repoName}\n\nThis is the skill.`
  );

  execFileSync('git', ['add', '.'], { cwd: repoPath, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', 'Initial commit'], { cwd: repoPath, stdio: 'pipe' });
  execFileSync('git', ['branch', '-M', 'main'], { cwd: repoPath, stdio: 'pipe' });
}

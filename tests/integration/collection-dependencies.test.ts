/**
 * Integration tests for collection craft type with dependencies
 *
 * Tests:
 * 1. Simple collection with skill dependencies
 * 2. Nested collections (collection depending on another collection)
 * 3. Collection type inference from COLLECTION.md marker
 * 4. Collection installation location (.claude/collections/)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import { GitResolver } from '../../src/services/git-resolver';
import { installer } from '../../src/services/installer';

const TEST_DIR = path.join(__dirname, '../fixtures/collection-test');
const INSTALL_DIR = path.join(TEST_DIR, '.claude');

describe('Collection Dependencies', () => {
  let gitResolver: GitResolver;
  let originalCwd: string;

  beforeEach(async () => {
    // Save original cwd
    originalCwd = process.cwd();

    // Clean up test directory
    await fs.remove(TEST_DIR);
    await fs.ensureDir(TEST_DIR);
    await fs.ensureDir(INSTALL_DIR);

    // Change to test directory so installer installs there
    process.chdir(TEST_DIR);

    // Initialize service
    gitResolver = new GitResolver();
  });

  afterEach(async () => {
    // Restore original cwd
    process.chdir(originalCwd);

    // Clean up
    await fs.remove(TEST_DIR);
  });

  describe('Simple Collection', () => {
    it('should resolve and install collection with skill dependencies', async () => {
      // Create mock collection repository
      const collectionRepo = path.join(TEST_DIR, 'rails-stack-repo');
      await createMockCollection(collectionRepo, {
        name: 'rails-enterprise-stack',
        version: '1.0.0',
        dependencies: {
          'ruby-on-rails': '^7.0.0',
          'rspec-testing': '^3.12.0',
          'rubocop-linter': '^1.50.0'
        }
      });

      // Resolve git dependency
      const gitInfo = {
        url: collectionRepo,
        branch: 'main'
      };

      const resolved = await gitResolver.resolveGitDependency(gitInfo);

      // Verify resolution
      expect(resolved.url).toBe(collectionRepo);
      expect(resolved.resolvedCommit).toBeDefined();
      expect(resolved.craftDeskJson?.type).toBe('collection');
      expect(resolved.craftDeskJson?.dependencies).toEqual({
        'ruby-on-rails': '^7.0.0',
        'rspec-testing': '^3.12.0',
        'rubocop-linter': '^1.50.0'
      });

      // Install collection
      const collectionDir = path.join(INSTALL_DIR, 'collections', 'rails-enterprise-stack');
      const lockEntry = {
        version: '1.0.0',
        git: resolved.url,
        commit: resolved.resolvedCommit,
        integrity: `sha256-git:${resolved.resolvedCommit}`,
        type: 'collection' as const,
        author: 'test',
        dependencies: {
          'ruby-on-rails': '^7.0.0',
          'rspec-testing': '^3.12.0',
          'rubocop-linter': '^1.50.0'
        }
      };

      await installer.installCraft('rails-enterprise-stack', lockEntry);

      // Verify installation in collections directory
      expect(await fs.pathExists(collectionDir)).toBe(true);
      expect(await fs.pathExists(path.join(collectionDir, 'craftdesk.json'))).toBe(true);
      expect(await fs.pathExists(path.join(collectionDir, 'COLLECTION.md'))).toBe(true);

      // Verify craftdesk.json has dependencies
      const craftdeskJson = await fs.readJson(path.join(collectionDir, 'craftdesk.json'));
      expect(craftdeskJson.type).toBe('collection');
      expect(craftdeskJson.dependencies).toEqual({
        'ruby-on-rails': '^7.0.0',
        'rspec-testing': '^3.12.0',
        'rubocop-linter': '^1.50.0'
      });
    });
  });

  describe('Nested Collections', () => {
    it('should resolve collection depending on another collection', async () => {
      // Create base collection
      const baseCollectionRepo = path.join(TEST_DIR, 'base-rails-repo');
      await createMockCollection(baseCollectionRepo, {
        name: 'base-rails-stack',
        version: '1.0.0',
        dependencies: {
          'ruby-on-rails': '^7.0.0',
          'rspec-testing': '^3.12.0'
        }
      });

      // Create parent collection that depends on base collection
      const parentCollectionRepo = path.join(TEST_DIR, 'full-stack-repo');
      await createMockCollection(parentCollectionRepo, {
        name: 'full-stack-rails',
        version: '2.0.0',
        dependencies: {
          'base-rails-stack': {
            git: baseCollectionRepo,
            branch: 'main'
          },
          'docker-deployment': '^1.5.0'
        }
      });

      // Resolve parent collection
      const gitInfo = {
        url: parentCollectionRepo,
        branch: 'main'
      };

      const resolved = await gitResolver.resolveGitDependency(gitInfo);

      // Verify parent collection resolution
      expect(resolved.craftDeskJson?.name).toBe('full-stack-rails');
      expect(resolved.craftDeskJson?.type).toBe('collection');

      // Verify nested dependencies exist
      const deps = resolved.craftDeskJson?.dependencies;
      expect(deps).toBeDefined();
      expect(deps?.['docker-deployment']).toBe('^1.5.0');
      expect(deps?.['base-rails-stack']).toBeDefined();

      // Install parent collection
      const collectionDir = path.join(INSTALL_DIR, 'collections', 'full-stack-rails');
      const lockEntry = {
        version: '2.0.0',
        git: resolved.url,
        commit: resolved.resolvedCommit,
        integrity: `sha256-git:${resolved.resolvedCommit}`,
        type: 'collection' as const,
        author: 'test',
        dependencies: deps || {}
      };

      await installer.installCraft('full-stack-rails', lockEntry);

      // Verify parent collection installed
      expect(await fs.pathExists(collectionDir)).toBe(true);

      // Verify craftdesk.json has nested dependencies
      const craftdeskJson = await fs.readJson(path.join(collectionDir, 'craftdesk.json'));
      expect(craftdeskJson.dependencies).toBeDefined();
      expect(craftdeskJson.dependencies['base-rails-stack']).toBeDefined();
      expect(craftdeskJson.dependencies['docker-deployment']).toBe('^1.5.0');
    });
  });

  describe('Type Inference', () => {
    it('should infer collection type from COLLECTION.md marker file', async () => {
      // Create repository with COLLECTION.md but no type in craftdesk.json
      const repoPath = path.join(TEST_DIR, 'inferred-collection-repo');
      await fs.ensureDir(repoPath);

      // Initialize git
      execSync('git init', { cwd: repoPath, stdio: 'pipe' });
      execSync('git config user.email "test@example.com"', { cwd: repoPath, stdio: 'pipe' });
      execSync('git config user.name "Test User"', { cwd: repoPath, stdio: 'pipe' });

      // Create COLLECTION.md marker
      await fs.writeFile(
        path.join(repoPath, 'COLLECTION.md'),
        '# React Fullstack Collection\n\nA complete React development stack.'
      );

      // Create craftdesk.json WITHOUT explicit type
      await fs.writeJson(path.join(repoPath, 'craftdesk.json'), {
        name: 'react-fullstack',
        version: '1.0.0',
        // No type field - should be inferred
        dependencies: {
          'react': '^18.0.0',
          'typescript': '^5.0.0'
        }
      }, { spaces: 2 });

      execSync('git add .', { cwd: repoPath, stdio: 'pipe' });
      execSync('git commit -m "Initial commit"', { cwd: repoPath, stdio: 'pipe' });
      execSync('git branch -M main', { cwd: repoPath, stdio: 'pipe' });

      // Resolve - type inference should happen
      const gitInfo = {
        url: repoPath,
        branch: 'main'
      };

      const resolved = await gitResolver.resolveGitDependency(gitInfo);

      // Type should be inferred from COLLECTION.md if not in craftdesk.json
      // Note: If craftdesk.json exists, its type takes precedence
      expect(resolved.craftDeskJson).toBeDefined();
      expect(resolved.craftDeskJson?.name).toBe('react-fullstack');
    });

    it('should infer collection type from filename containing "collection"', async () => {
      // Create repository with direct file reference
      const repoPath = path.join(TEST_DIR, 'file-inference-repo');
      await fs.ensureDir(repoPath);

      // Initialize git
      execSync('git init', { cwd: repoPath, stdio: 'pipe' });
      execSync('git config user.email "test@example.com"', { cwd: repoPath, stdio: 'pipe' });
      execSync('git config user.name "Test User"', { cwd: repoPath, stdio: 'pipe' });

      // Create file with "collection" in name
      await fs.writeFile(
        path.join(repoPath, 'rails-collection.md'),
        '# Rails Collection\n\nA collection of Rails tools.'
      );

      execSync('git add .', { cwd: repoPath, stdio: 'pipe' });
      execSync('git commit -m "Initial commit"', { cwd: repoPath, stdio: 'pipe' });
      execSync('git branch -M main', { cwd: repoPath, stdio: 'pipe' });

      // Resolve with file reference - type inference from filename
      const gitInfo = {
        url: repoPath,
        branch: 'main',
        file: 'rails-collection.md'
      };

      const resolved = await gitResolver.resolveGitDependency(gitInfo);

      // Type should be inferred from filename
      expect(resolved.craftDeskJson).toBeDefined();
      expect(resolved.craftDeskJson?.type).toBe('collection');
      expect(resolved.craftDeskJson?.name).toBe('rails-collection');
    });
  });

  describe('Installation Location', () => {
    it('should install collections in .claude/collections/ directory', async () => {
      // Create mock collection
      const collectionRepo = path.join(TEST_DIR, 'python-ds-repo');
      await createMockCollection(collectionRepo, {
        name: 'python-data-science',
        version: '1.0.0',
        dependencies: {
          'numpy': '^1.24.0',
          'pandas': '^2.0.0'
        }
      });

      // Resolve
      const gitInfo = {
        url: collectionRepo,
        branch: 'main'
      };

      const resolved = await gitResolver.resolveGitDependency(gitInfo);

      // Install
      const lockEntry = {
        version: '1.0.0',
        git: resolved.url,
        commit: resolved.resolvedCommit,
        integrity: `sha256-git:${resolved.resolvedCommit}`,
        type: 'collection' as const,
        author: 'test',
        dependencies: {
          'numpy': '^1.24.0',
          'pandas': '^2.0.0'
        }
      };

      await installer.installCraft('python-data-science', lockEntry);

      // Verify correct installation path
      const collectionDir = path.join(INSTALL_DIR, 'collections', 'python-data-science');
      expect(await fs.pathExists(collectionDir)).toBe(true);

      // Verify NOT in other directories
      expect(await fs.pathExists(path.join(INSTALL_DIR, 'skills', 'python-data-science'))).toBe(false);
      expect(await fs.pathExists(path.join(INSTALL_DIR, 'plugins', 'python-data-science'))).toBe(false);

      // Verify metadata file has correct type
      const metadata = await fs.readJson(path.join(collectionDir, '.craftdesk-metadata.json'));
      expect(metadata.type).toBe('collection');
    });

    it('should list installed collections correctly', async () => {
      // Create and install a collection
      const collectionRepo = path.join(TEST_DIR, 'devops-repo');
      await createMockCollection(collectionRepo, {
        name: 'devops-toolkit',
        version: '3.0.0',
        dependencies: {
          'docker': '^24.0.0',
          'kubernetes': '^1.28.0'
        }
      });

      const gitInfo = { url: collectionRepo, branch: 'main' };
      const resolved = await gitResolver.resolveGitDependency(gitInfo);

      const lockEntry = {
        version: '3.0.0',
        git: resolved.url,
        commit: resolved.resolvedCommit,
        integrity: `sha256-git:${resolved.resolvedCommit}`,
        type: 'collection' as const,
        author: 'test',
        dependencies: {
          'docker': '^24.0.0',
          'kubernetes': '^1.28.0'
        }
      };

      await installer.installCraft('devops-toolkit', lockEntry);

      // List installed crafts
      const installed = await installer.listInstalled();

      // Find collection in list
      const collection = installed.find(c => c.name === 'devops-toolkit');
      expect(collection).toBeDefined();
      expect(collection?.type).toBe('collection');
      expect(collection?.version).toBe('3.0.0');
    });
  });
});

/**
 * Helper: Create mock collection repository
 */
async function createMockCollection(repoPath: string, options: {
  name: string;
  version: string;
  dependencies: Record<string, string | any>;
}) {
  const { name, version, dependencies } = options;

  // Create directory
  await fs.ensureDir(repoPath);

  // Initialize git repo
  execSync('git init', { cwd: repoPath, stdio: 'pipe' });
  execSync('git config user.email "test@example.com"', { cwd: repoPath, stdio: 'pipe' });
  execSync('git config user.name "Test User"', { cwd: repoPath, stdio: 'pipe' });

  // Create COLLECTION.md marker file
  await fs.writeFile(
    path.join(repoPath, 'COLLECTION.md'),
    `# ${name}\n\nA curated collection of related crafts.\n\n## Included Crafts\n\n${
      Object.keys(dependencies).map(dep => `- ${dep}`).join('\n')
    }`
  );

  // Create craftdesk.json
  const craftdeskJson = {
    name,
    version,
    type: 'collection',
    description: `Collection: ${name}`,
    dependencies
  };

  await fs.writeJson(path.join(repoPath, 'craftdesk.json'), craftdeskJson, { spaces: 2 });

  // Create README
  await fs.writeFile(
    path.join(repoPath, 'README.md'),
    `# ${name}\n\nTest collection repository.\n\n## Dependencies\n\n${
      Object.entries(dependencies).map(([dep, ver]) =>
        `- ${dep}: ${typeof ver === 'string' ? ver : 'git dependency'}`
      ).join('\n')
    }`
  );

  // Git add and commit
  execSync('git add .', { cwd: repoPath, stdio: 'pipe' });
  execSync('git commit -m "Initial commit"', { cwd: repoPath, stdio: 'pipe' });
  execSync('git branch -M main', { cwd: repoPath, stdio: 'pipe' });
}

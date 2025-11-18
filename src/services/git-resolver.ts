import path from 'path';
import fs from 'fs-extra';
import { execSync } from 'child_process';
import { logger } from '../utils/logger';
import { CraftDeskJson, DependencyConfig } from '../types/craftdesk-json';

/**
 * Information about a git dependency
 */
export interface GitDependencyInfo {
  /** Git repository URL */
  url: string;
  /** Optional branch name */
  branch?: string;
  /** Optional tag name */
  tag?: string;
  /** Optional commit hash */
  commit?: string;
  /** Optional subdirectory path for monorepos */
  path?: string;
  /** Optional direct file path (e.g., skill.md, agent.md) */
  file?: string;
  /** Parsed craftdesk.json from the repository */
  craftDeskJson?: CraftDeskJson;
  /** Resolved full commit hash */
  resolvedCommit?: string;
}

/**
 * Resolves git dependencies and extracts their metadata
 *
 * Handles cloning git repositories, reading craftdesk.json, inferring craft types
 * when metadata is missing, and supporting monorepo structures with subdirectory paths.
 *
 * @example
 * ```typescript
 * const resolver = new GitResolver();
 *
 * // Resolve a git dependency
 * const info = await resolver.resolveGitDependency({
 *   url: 'https://github.com/company/auth.git',
 *   branch: 'main'
 * });
 *
 * console.log(info.craftDeskJson.name); // 'auth-skill'
 * console.log(info.resolvedCommit); // Full commit hash
 * ```
 */
export class GitResolver {
  private tempDir: string;

  constructor() {
    this.tempDir = path.join(process.cwd(), '.craftdesk', 'tmp');
  }

  /**
   * Resolves a git dependency by cloning and reading its craftdesk.json
   *
   * Process:
   * 1. Clones the repository (shallow clone for efficiency)
   * 2. Checks out specified branch/tag/commit
   * 3. Reads craftdesk.json from repository, subdirectory, or infers from direct file
   * 4. Generates minimal metadata if craftdesk.json is missing
   * 5. Infers craft type from marker files, direct file extension, or directory structure
   *
   * @param gitInfo - Git dependency information
   * @returns Enhanced git info with craftdesk.json and resolved commit
   *
   * @example
   * ```typescript
   * // With craftdesk.json in repository
   * const info = await resolver.resolveGitDependency({
   *   url: 'https://github.com/user/skill.git',
   *   tag: 'v1.0.0'
   * });
   *
   * // Monorepo with subdirectory
   * const info = await resolver.resolveGitDependency({
   *   url: 'https://github.com/company/monorepo.git',
   *   tag: 'v3.0.0',
   *   path: 'crafts/auth'
   * });
   *
   * // Direct file reference
   * const info = await resolver.resolveGitDependency({
   *   url: 'https://github.com/user/repo.git',
   *   branch: 'main',
   *   file: 'rspec-dry-agent.md'
   * });
   * ```
   */
  async resolveGitDependency(gitInfo: GitDependencyInfo): Promise<GitDependencyInfo> {
    const repoTempDir = path.join(this.tempDir, `git-${Date.now()}`);

    try {
      await fs.ensureDir(repoTempDir);

      // Clone the repository
      logger.debug(`Cloning ${gitInfo.url} to analyze dependencies...`);

      let cloneCmd = `git clone --depth 1`;
      if (gitInfo.branch) {
        cloneCmd += ` -b ${gitInfo.branch}`;
      } else if (gitInfo.tag) {
        cloneCmd += ` -b ${gitInfo.tag}`;
      }
      cloneCmd += ` ${gitInfo.url} ${repoTempDir}`;

      execSync(cloneCmd, { stdio: 'pipe' });

      // If specific commit, checkout that commit
      if (gitInfo.commit) {
        execSync(`cd ${repoTempDir} && git fetch --unshallow && git checkout ${gitInfo.commit}`, { stdio: 'pipe' });
      }

      // Get the actual commit hash for lockfile
      const resolvedCommit = execSync(`cd ${repoTempDir} && git rev-parse HEAD`, { encoding: 'utf8' }).trim();
      gitInfo.resolvedCommit = resolvedCommit;

      // Handle direct file reference
      if (gitInfo.file) {
        const filePath = path.join(repoTempDir, gitInfo.file);

        if (await fs.pathExists(filePath)) {
          logger.debug(`Found direct file reference: ${gitInfo.file}`);

          // Try to find craftdesk.json to get type and metadata
          let craftType: 'skill' | 'agent' | 'command' | 'hook' | undefined;
          let craftName: string | undefined;
          let craftVersion: string | undefined;
          let craftDeps: Record<string, any> | undefined;

          // Check for craftdesk.json in same directory as file
          const fileDir = path.dirname(gitInfo.file);
          const fileDirCraftPath = path.join(repoTempDir, fileDir, 'craftdesk.json');

          // Check for craftdesk.json in repo root
          const rootCraftPath = path.join(repoTempDir, 'craftdesk.json');

          if (await fs.pathExists(fileDirCraftPath)) {
            const content = await fs.readFile(fileDirCraftPath, 'utf-8');
            const craftJson = JSON.parse(content);
            logger.debug(`Found craftdesk.json in file directory: ${craftJson.name}@${craftJson.version}`);
            craftType = craftJson.type;
            craftName = craftJson.name;
            craftVersion = craftJson.version;
            craftDeps = craftJson.dependencies;
          } else if (await fs.pathExists(rootCraftPath)) {
            const content = await fs.readFile(rootCraftPath, 'utf-8');
            const craftJson = JSON.parse(content);
            logger.debug(`Found craftdesk.json in repo root: ${craftJson.name}@${craftJson.version}`);
            craftType = craftJson.type;
            craftName = craftJson.name;
            craftVersion = craftJson.version;
            craftDeps = craftJson.dependencies;
          }

          // If no craftdesk.json found, infer from filename
          if (!craftType) {
            craftType = this.inferCraftTypeFromFilename(gitInfo.file);
          }

          // Create minimal craftdesk.json from file
          gitInfo.craftDeskJson = {
            name: craftName || path.basename(gitInfo.file, path.extname(gitInfo.file)),
            version: craftVersion || gitInfo.tag || gitInfo.branch || resolvedCommit.substring(0, 7),
            type: craftType,
            description: `Git file dependency from ${gitInfo.url}/${gitInfo.file}`,
            dependencies: craftDeps || {}
          };
        } else {
          throw new Error(`File not found: ${gitInfo.file} in ${gitInfo.url}`);
        }
      } else {
        // Look for craftdesk.json in the specified path or root
        const craftPath = gitInfo.path
          ? path.join(repoTempDir, gitInfo.path, 'craftdesk.json')
          : path.join(repoTempDir, 'craftdesk.json');

        if (await fs.pathExists(craftPath)) {
          const content = await fs.readFile(craftPath, 'utf-8');
          gitInfo.craftDeskJson = JSON.parse(content);
          logger.debug(`Found craftdesk.json in git repository: ${gitInfo.craftDeskJson!.name}@${gitInfo.craftDeskJson!.version}`);
        } else {
          // No craftdesk.json found - create a minimal one
          logger.warn(`No craftdesk.json found in ${gitInfo.url}${gitInfo.path ? `#path:${gitInfo.path}` : ''}`);

          // Try to infer the type from directory structure
          const type = await this.inferCraftType(repoTempDir, gitInfo.path);

          gitInfo.craftDeskJson = {
            name: path.basename(gitInfo.url, '.git'),
            version: gitInfo.tag || gitInfo.branch || resolvedCommit.substring(0, 7),
            type: type,
            description: `Git dependency from ${gitInfo.url}`,
            dependencies: {}
          };
        }
      }

      return gitInfo;

    } finally {
      // Clean up temp directory
      await fs.remove(repoTempDir);
    }
  }

  /**
   * Infers the craft type from a filename
   *
   * Type inference strategy:
   * 1. Check filename for type indicators: agent, skill, command, hook
   * 2. Check file extension patterns
   * 3. Default to 'skill' if no indicators found
   *
   * @param filename - The filename to analyze
   * @returns The inferred craft type
   * @private
   */
  private inferCraftTypeFromFilename(filename: string): 'skill' | 'agent' | 'command' | 'hook' {
    const lower = filename.toLowerCase();

    // Check filename for type indicators
    if (lower.includes('agent')) return 'agent';
    if (lower.includes('command')) return 'command';
    if (lower.includes('hook')) return 'hook';
    if (lower.includes('skill')) return 'skill';

    // Default to skill
    return 'skill';
  }

  /**
   * Infers the craft type from the repository structure
   *
   * Type inference strategy:
   * 1. Check for marker files: SKILL.md, AGENT.md, COMMAND.md, HOOK.md
   * 2. Check directory name for type indicators
   * 3. Default to 'skill' if no indicators found
   *
   * @param repoPath - Path to the cloned repository
   * @param subPath - Optional subdirectory to check
   * @returns The inferred craft type
   * @private
   */
  private async inferCraftType(repoPath: string, subPath?: string): Promise<'skill' | 'agent' | 'command' | 'hook'> {
    const checkPath = subPath ? path.join(repoPath, subPath) : repoPath;

    // Check for type-indicating files
    const files = await fs.readdir(checkPath);

    // Look for SKILL.md, AGENT.md, COMMAND.md, HOOK.md
    if (files.includes('SKILL.md')) return 'skill';
    if (files.includes('AGENT.md')) return 'agent';
    if (files.includes('COMMAND.md')) return 'command';
    if (files.includes('HOOK.md')) return 'hook';

    // Check directory name hints
    const dirName = subPath ? path.basename(subPath) : path.basename(repoPath);
    if (dirName.includes('skill')) return 'skill';
    if (dirName.includes('agent')) return 'agent';
    if (dirName.includes('command')) return 'command';
    if (dirName.includes('hook')) return 'hook';

    // Default to skill
    return 'skill';
  }

  /**
   * Resolves all dependencies including transitive dependencies from git sources
   *
   * Uses a breadth-first traversal algorithm to resolve dependencies recursively.
   * Tracks visited packages to avoid circular dependencies.
   *
   * @param dependencies - Map of dependency names to version strings or config objects
   * @returns Object containing resolved dependencies and generated lockfile
   *
   * @example
   * ```typescript
   * const result = await resolver.resolveAllDependencies({
   *   'ruby-on-rails': '^7.0.0',
   *   'custom-auth': {
   *     git: 'https://github.com/company/auth.git',
   *     branch: 'main'
   *   }
   * });
   *
   * console.log(result.resolved); // All dependencies including transitive
   * console.log(result.lockfile); // Generated lockfile structure
   * ```
   */
  async resolveAllDependencies(dependencies: Record<string, string | DependencyConfig>): Promise<{
    resolved: Record<string, any>;
    lockfile: any;
  }> {
    const resolved: Record<string, any> = {};
    // Queue of dependencies to resolve (breadth-first traversal)
    const toResolve: Array<[string, string | DependencyConfig]> = Object.entries(dependencies);
    // Track visited packages to prevent infinite loops from circular dependencies
    const visited = new Set<string>();

    // Process queue until all dependencies are resolved
    while (toResolve.length > 0) {
      const [name, dep] = toResolve.shift()!;

      // Skip if already resolved (handles duplicates and circular deps)
      if (visited.has(name)) continue;
      visited.add(name);

      // Determine if this is a git or registry dependency
      if (typeof dep === 'object' && dep.git) {
        // Git dependency - clone repository and extract metadata
        const gitInfo = await this.resolveGitDependency({
          url: dep.git,
          branch: dep.branch,
          tag: dep.tag,
          commit: dep.commit,
          path: dep.path,
          file: dep.file
        });

        resolved[name] = {
          version: gitInfo.craftDeskJson?.version || '0.0.0',
          resolved: gitInfo.url,
          integrity: gitInfo.resolvedCommit || 'git',
          type: gitInfo.craftDeskJson?.type || 'skill',
          author: gitInfo.craftDeskJson?.author || 'git',
          git: gitInfo.url,
          ...(gitInfo.branch && { branch: gitInfo.branch }),
          ...(gitInfo.tag && { tag: gitInfo.tag }),
          ...(gitInfo.commit && { commit: gitInfo.resolvedCommit }),
          ...(gitInfo.path && { path: gitInfo.path }),
          ...(gitInfo.file && { file: gitInfo.file }),
          dependencies: gitInfo.craftDeskJson?.dependencies || {}
        };

        // Add transitive dependencies to the resolution queue
        // This enables recursive dependency resolution
        if (gitInfo.craftDeskJson?.dependencies) {
          for (const [depName, depVersion] of Object.entries(gitInfo.craftDeskJson.dependencies)) {
            // Only add if not already visited (avoids redundant resolution)
            if (!visited.has(depName)) {
              toResolve.push([depName, depVersion]);
            }
          }
        }
      } else {
        // Registry dependency - mark for resolution by registry client
        // The actual version resolution happens via the registry API
        resolved[name] = {
          needsResolution: true,
          version: typeof dep === 'string' ? dep : dep.version,
          registry: typeof dep === 'object' ? dep.registry : undefined
        };
      }
    }

    return {
      resolved,
      lockfile: {
        version: '1.0.0',
        lockfileVersion: 1,
        crafts: resolved
      }
    };
  }
}

export const gitResolver = new GitResolver();
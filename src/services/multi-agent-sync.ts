/**
 * Multi-Agent Sync - Sync crafts across multiple AI agents
 *
 * Handles:
 * - Installing crafts to multiple agent directories
 * - Verifying sync status with checksums
 * - Detecting and fixing drift between copies
 */

import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { configManager } from './config-manager';
import { ensureDir } from '../utils/file-system';
import type { SyncStatus, SyncResult, SyncLocation } from '../types/multi-agent';

/**
 * Service for syncing crafts across multiple AI agent directories
 */
export class MultiAgentSync {
  /**
   * Install craft to all configured agent directories
   *
   * @param craftName - Name of the craft to sync
   * @param sourceDir - Source directory containing the craft files
   * @param cwd - Current working directory (defaults to process.cwd())
   * @returns Sync result with success/failure details
   *
   * @example
   * ```typescript
   * const sync = new MultiAgentSync();
   * const result = await sync.syncCraft('ruby-expert', '/tmp/ruby-expert-source');
   *
   * console.log(`Synced to: ${result.synced.join(', ')}`);
   * if (result.failed.length > 0) {
   *   console.error(`Failed: ${result.failed.map(f => f.path).join(', ')}`);
   * }
   * ```
   */
  async syncCraft(
    craftName: string,
    sourceDir: string,
    cwd: string = process.cwd()
  ): Promise<SyncResult> {
    const config = await configManager.getCraftDeskJson();

    // Check if multi-agent sync is enabled
    if (!config?.multiAgent?.enabled) {
      logger.debug('Multi-agent sync disabled, skipping');
      return {
        craftName,
        synced: [],
        failed: []
      };
    }

    const canonical = config.multiAgent.canonical || '.claude';
    const targets = config.multiAgent.targets || ['.claude/skills'];

    const synced: string[] = [];
    const failed: Array<{ path: string; error: string }> = [];

    // Install to canonical location first
    const canonicalPath = path.join(cwd, canonical, 'skills', craftName);

    // Normalize paths for comparison
    const normalizedSource = path.resolve(sourceDir);
    const normalizedCanonical = path.resolve(canonicalPath);

    try {
      await ensureDir(path.dirname(canonicalPath));

      // Only copy if source is different from canonical
      if (normalizedSource !== normalizedCanonical) {
        await fs.copy(sourceDir, canonicalPath, { overwrite: true });
        logger.debug(`Installed to canonical location: ${canonicalPath}`);
      } else {
        logger.debug(`Source is already canonical: ${canonicalPath}`);
      }

      // Calculate and store checksum
      const checksum = await this.calculateDirChecksum(canonicalPath);
      const checksumFile = path.join(canonicalPath, '.craftdesk-checksum');
      await fs.writeFile(checksumFile, checksum, 'utf-8');

      synced.push(canonicalPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failed.push({ path: canonicalPath, error: message });
      logger.error(`Failed to install to canonical location: ${message}`);
      // If canonical install fails, don't proceed with targets
      return { craftName, synced, failed };
    }

    // Copy to all target locations
    for (const target of targets) {
      // Skip if target is the canonical location
      if (target === `${canonical}/skills`) {
        continue;
      }

      const targetPath = path.join(cwd, target, craftName);

      try {
        await ensureDir(path.dirname(targetPath));
        await fs.copy(canonicalPath, targetPath, { overwrite: true });
        synced.push(targetPath);
        logger.debug(`Synced ${craftName} to ${target}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failed.push({ path: targetPath, error: message });
        logger.warn(`Failed to sync to ${target}: ${message}`);
      }
    }

    logger.info(`Synced ${craftName} to ${synced.length} location(s)`);

    return { craftName, synced, failed };
  }

  /**
   * Verify sync status for a craft
   *
   * Checks if all copies match the canonical version using checksums
   *
   * @param craftName - Name of the craft to verify
   * @param cwd - Current working directory (defaults to process.cwd())
   * @returns Sync status with details about each location
   *
   * @example
   * ```typescript
   * const sync = new MultiAgentSync();
   * const status = await sync.verifySync('ruby-expert');
   *
   * if (!status.inSync) {
   *   console.log(`Out of sync: ${status.outOfSync.map(l => l.path).join(', ')}`);
   * }
   * ```
   */
  async verifySync(craftName: string, cwd: string = process.cwd()): Promise<SyncStatus> {
    const config = await configManager.getCraftDeskJson();

    if (!config?.multiAgent?.enabled) {
      // If multi-agent not enabled, consider everything in sync
      return {
        craftName,
        inSync: true,
        canonicalChecksum: '',
        outOfSync: [],
        inSyncLocations: []
      };
    }

    const canonical = config.multiAgent.canonical || '.claude';
    const targets = config.multiAgent.targets || [];

    const canonicalPath = path.join(cwd, canonical, 'skills', craftName);

    // Check if canonical exists
    if (!await fs.pathExists(canonicalPath)) {
      return {
        craftName,
        inSync: false,
        canonicalChecksum: '',
        outOfSync: [{ path: canonicalPath, reason: 'missing' }],
        inSyncLocations: []
      };
    }

    const canonicalChecksum = await this.calculateDirChecksum(canonicalPath);
    const outOfSync: SyncLocation[] = [];
    const inSyncLocations: string[] = [];

    // Check each target
    for (const target of targets) {
      // Skip canonical location
      if (target === `${canonical}/skills`) {
        continue;
      }

      const targetPath = path.join(cwd, target, craftName);

      // Check if target exists
      if (!await fs.pathExists(targetPath)) {
        outOfSync.push({
          path: targetPath,
          reason: 'missing',
          expectedChecksum: canonicalChecksum
        });
        continue;
      }

      // Calculate target checksum
      const targetChecksum = await this.calculateDirChecksum(targetPath);

      if (targetChecksum !== canonicalChecksum) {
        outOfSync.push({
          path: targetPath,
          reason: 'checksum-mismatch',
          expectedChecksum: canonicalChecksum,
          actualChecksum: targetChecksum
        });
      } else {
        inSyncLocations.push(targetPath);
      }
    }

    return {
      craftName,
      inSync: outOfSync.length === 0,
      canonicalChecksum,
      outOfSync,
      inSyncLocations
    };
  }

  /**
   * Sync all installed crafts to configured targets
   *
   * @param cwd - Current working directory (defaults to process.cwd())
   * @returns Array of sync results for each craft
   */
  async syncAllCrafts(cwd: string = process.cwd()): Promise<SyncResult[]> {
    const config = await configManager.getCraftDeskJson();

    if (!config?.multiAgent?.enabled) {
      logger.info('Multi-agent sync is disabled');
      return [];
    }

    const canonical = config.multiAgent.canonical || '.claude';
    const skillsDir = path.join(cwd, canonical, 'skills');

    // Check if skills directory exists
    if (!await fs.pathExists(skillsDir)) {
      logger.info('No skills directory found, nothing to sync');
      return [];
    }

    // Get all craft directories
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    const craftDirs = entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);

    if (craftDirs.length === 0) {
      logger.info('No crafts found to sync');
      return [];
    }

    logger.info(`Syncing ${craftDirs.length} craft(s)...`);

    const results: SyncResult[] = [];

    for (const craftName of craftDirs) {
      const craftPath = path.join(skillsDir, craftName);
      const result = await this.syncCraft(craftName, craftPath, cwd);
      results.push(result);
    }

    return results;
  }

  /**
   * Verify sync status for all installed crafts
   *
   * @param cwd - Current working directory (defaults to process.cwd())
   * @returns Array of sync statuses for each craft
   */
  async verifyAllCrafts(cwd: string = process.cwd()): Promise<SyncStatus[]> {
    const config = await configManager.getCraftDeskJson();

    if (!config?.multiAgent?.enabled) {
      return [];
    }

    const canonical = config.multiAgent.canonical || '.claude';
    const skillsDir = path.join(cwd, canonical, 'skills');

    if (!await fs.pathExists(skillsDir)) {
      return [];
    }

    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    const craftDirs = entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);

    const statuses: SyncStatus[] = [];

    for (const craftName of craftDirs) {
      const status = await this.verifySync(craftName, cwd);
      statuses.push(status);
    }

    return statuses;
  }

  /**
   * Calculate checksum for entire directory
   *
   * Creates a consistent hash of all files in a directory (excluding metadata)
   *
   * @param dirPath - Directory to checksum
   * @returns SHA256 checksum hex string
   * @private
   */
  async calculateDirChecksum(dirPath: string): Promise<string> {
    const files = await this.getAllFiles(dirPath);

    // Sort for consistency
    files.sort();

    const hash = crypto.createHash('sha256');

    for (const file of files) {
      // Skip metadata files
      const basename = path.basename(file);
      if (basename === '.craftdesk-checksum' || basename === '.craftdesk-metadata.json') {
        continue;
      }

      // Add relative path to hash
      const relativePath = path.relative(dirPath, file);
      hash.update(relativePath);

      // Add file content to hash
      const content = await fs.readFile(file);
      hash.update(content);
    }

    return hash.digest('hex');
  }

  /**
   * Recursively get all files in a directory
   *
   * @param dirPath - Directory to scan
   * @returns Array of absolute file paths
   * @private
   */
  private async getAllFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];

    if (!await fs.pathExists(dirPath)) {
      return files;
    }

    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const subFiles = await this.getAllFiles(fullPath);
        files.push(...subFiles);
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }
}

// Export singleton instance
export const multiAgentSync = new MultiAgentSync();

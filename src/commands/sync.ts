/**
 * sync command - Sync crafts across AI agents
 *
 * Copies crafts from the canonical location to all configured
 * agent directories, ensuring consistency across agents.
 */

import { Command } from 'commander';
import { logger } from '../utils/logger';
import { multiAgentSync } from '../services/multi-agent-sync';
import { configManager } from '../services/config-manager';

/**
 * Command options for sync command
 *
 * @interface
 */
interface SyncOptions {
  /** Sync specific craft by name */
  craft?: string;
  /** Force sync even if up to date */
  force?: boolean;
  /** Dry run - show what would be synced */
  dryRun?: boolean;
}

/**
 * Creates the 'sync' command for syncing crafts across AI agents
 *
 * @returns Commander command instance configured for multi-agent sync
 */
export function createSyncCommand(): Command {
  return new Command('sync')
  .description('Sync crafts across all configured AI agents')
  .option('-c, --craft <name>', 'Sync specific craft by name')
  .option('-f, --force', 'Force sync even if checksums match')
  .option('--dry-run', 'Show what would be synced without making changes')
  .action(async (options: SyncOptions) => {
    try {
      // Check if multi-agent sync is enabled
      const config = await configManager.getCraftDeskJson();

      if (!config?.multiAgent?.enabled) {
        logger.error('Multi-agent sync is not enabled');
        console.log('\nTo enable multi-agent sync, run:');
        console.log('  craftdesk setup-multi-agent\n');
        process.exit(1);
      }

      if (options.dryRun) {
        logger.info('Dry run mode - no changes will be made');
      }

      if (options.craft) {
        // Sync specific craft
        logger.startSpinner(`Syncing ${options.craft}...`);

        if (options.dryRun) {
          logger.stopSpinner();
          const status = await multiAgentSync.verifySync(options.craft);

          console.log(`\n📋 Dry Run: ${options.craft}\n`);
          console.log(`Canonical: ${config.multiAgent.canonical}/skills/${options.craft}`);
          console.log(`Checksum: ${status.canonicalChecksum.substring(0, 8)}...\n`);

          console.log('Would sync to:');
          for (const target of config.multiAgent.targets) {
            if (target === `${config.multiAgent.canonical}/skills`) continue;
            const outOfSync = status.outOfSync.find(l => l.path.includes(target));
            if (outOfSync) {
              console.log(`  ⚠️  ${target}/${options.craft} (${outOfSync.reason})`);
            } else {
              console.log(`  ✓  ${target}/${options.craft} (already in sync)`);
            }
          }
          console.log('');
          return;
        }

        const craftPath = `${config.multiAgent.canonical}/skills/${options.craft}`;
        const result = await multiAgentSync.syncCraft(options.craft, craftPath);

        logger.stopSpinner();

        console.log(`\n✅ Synced ${options.craft}\n`);
        console.log(`Synced to ${result.synced.length} location(s):`);
        for (const location of result.synced) {
          console.log(`  ✓ ${location}`);
        }

        if (result.failed.length > 0) {
          console.log(`\n❌ Failed to sync to ${result.failed.length} location(s):`);
          for (const failure of result.failed) {
            console.log(`  ✗ ${failure.path}: ${failure.error}`);
          }
        }
        console.log('');

      } else {
        // Sync all crafts
        logger.startSpinner('Syncing all crafts...');

        if (options.dryRun) {
          logger.stopSpinner();
          const statuses = await multiAgentSync.verifyAllCrafts();

          console.log(`\n📋 Dry Run: All Crafts\n`);

          if (statuses.length === 0) {
            console.log('No crafts found to sync\n');
            return;
          }

          for (const status of statuses) {
            const needsSync = status.outOfSync.length > 0;
            const icon = needsSync ? '⚠️' : '✓';

            console.log(`${icon} ${status.craftName}`);
            if (needsSync) {
              console.log(`  Out of sync: ${status.outOfSync.length} location(s)`);
              for (const loc of status.outOfSync) {
                console.log(`    - ${loc.path} (${loc.reason})`);
              }
            } else {
              console.log(`  In sync: ${status.inSyncLocations.length} location(s)`);
            }
          }
          console.log('');
          return;
        }

        const results = await multiAgentSync.syncAllCrafts();

        logger.stopSpinner();

        if (results.length === 0) {
          console.log('\nℹ️  No crafts found to sync\n');
          return;
        }

        console.log(`\n✅ Synced ${results.length} craft(s)\n`);

        let totalSynced = 0;
        let totalFailed = 0;

        for (const result of results) {
          const syncedCount = result.synced.length;
          const failedCount = result.failed.length;

          totalSynced += syncedCount;
          totalFailed += failedCount;

          const icon = failedCount > 0 ? '⚠️' : '✓';
          console.log(`${icon} ${result.craftName}: ${syncedCount} location(s)`);

          if (failedCount > 0) {
            for (const failure of result.failed) {
              console.log(`  ✗ ${failure.path}: ${failure.error}`);
            }
          }
        }

        console.log(`\nSummary:`);
        console.log(`  Total synced: ${totalSynced} location(s)`);
        if (totalFailed > 0) {
          console.log(`  Total failed: ${totalFailed} location(s)`);
        }
        console.log('');
      }

    } catch (error) {
      logger.failSpinner('Failed to sync crafts');
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Error: ${message}`);
      process.exit(1);
    }
  });
}

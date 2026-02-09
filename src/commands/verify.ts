/**
 * verify command - Verify sync status across AI agents
 *
 * Checks if crafts are in sync across all configured agent directories
 * by comparing checksums. Reports any drift or missing copies.
 */

import { Command } from 'commander';
import { logger } from '../utils/logger';
import { multiAgentSync } from '../services/multi-agent-sync';
import { configManager } from '../services/config-manager';

/**
 * Command options for verify
 */
interface VerifyOptions {
  /** Verify specific craft by name */
  craft?: string;
  /** Show detailed checksum information */
  verbose?: boolean;
  /** Output format (text or json) */
  format?: 'text' | 'json';
}

export function createVerifyCommand(): Command {
  return new Command('verify')
  .description('Verify sync status of crafts across AI agents')
  .option('-c, --craft <name>', 'Verify specific craft by name')
  .option('-v, --verbose', 'Show detailed checksum information')
  .option('-f, --format <format>', 'Output format (text or json)', 'text')
  .action(async (options: VerifyOptions) => {
    try {
      // Check if multi-agent sync is enabled
      const config = await configManager.getCraftDeskJson();

      if (!config?.multiAgent?.enabled) {
        logger.error('Multi-agent sync is not enabled');
        console.log('\nTo enable multi-agent sync, run:');
        console.log('  craftdesk setup-multi-agent\n');
        process.exit(1);
      }

      logger.startSpinner('Verifying sync status...');

      if (options.craft) {
        // Verify specific craft
        const status = await multiAgentSync.verifySync(options.craft);
        logger.stopSpinner();

        if (options.format === 'json') {
          console.log(JSON.stringify(status, null, 2));
          return;
        }

        console.log(`\n🔍 Sync Status: ${options.craft}\n`);

        console.log(`Canonical: ${config.multiAgent.canonical}/skills/${options.craft}`);
        if (options.verbose) {
          console.log(`Checksum: ${status.canonicalChecksum}`);
        } else {
          console.log(`Checksum: ${status.canonicalChecksum.substring(0, 16)}...`);
        }
        console.log('');

        if (status.inSync) {
          console.log(`✅ All copies are in sync`);
          console.log(`\nSynced locations (${status.inSyncLocations.length}):`);
          for (const location of status.inSyncLocations) {
            console.log(`  ✓ ${location}`);
          }
        } else {
          console.log(`❌ Some copies are out of sync`);

          if (status.inSyncLocations.length > 0) {
            console.log(`\nIn sync (${status.inSyncLocations.length}):`);
            for (const location of status.inSyncLocations) {
              console.log(`  ✓ ${location}`);
            }
          }

          console.log(`\nOut of sync (${status.outOfSync.length}):`);
          for (const location of status.outOfSync) {
            const reasonIcon = location.reason === 'missing' ? '❌' : '⚠️';
            console.log(`  ${reasonIcon} ${location.path}`);
            console.log(`     Reason: ${location.reason}`);

            if (options.verbose && location.actualChecksum) {
              console.log(`     Expected: ${location.expectedChecksum}`);
              console.log(`     Actual: ${location.actualChecksum}`);
            }
          }

          console.log(`\n💡 Run \`craftdesk sync --craft ${options.craft}\` to fix`);
        }
        console.log('');

      } else {
        // Verify all crafts
        const statuses = await multiAgentSync.verifyAllCrafts();
        logger.stopSpinner();

        if (options.format === 'json') {
          console.log(JSON.stringify(statuses, null, 2));
          return;
        }

        if (statuses.length === 0) {
          console.log('\nℹ️  No crafts found to verify\n');
          return;
        }

        console.log(`\n🔍 Sync Status: All Crafts\n`);

        const inSync = statuses.filter(s => s.inSync);
        const outOfSync = statuses.filter(s => !s.inSync);

        // Show summary first
        console.log(`Summary:`);
        console.log(`  Total crafts: ${statuses.length}`);
        console.log(`  In sync: ${inSync.length}`);
        console.log(`  Out of sync: ${outOfSync.length}`);
        console.log('');

        // Show out of sync crafts
        if (outOfSync.length > 0) {
          console.log(`❌ Out of Sync (${outOfSync.length}):\n`);

          for (const status of outOfSync) {
            console.log(`  ${status.craftName}`);
            for (const location of status.outOfSync) {
              const reasonIcon = location.reason === 'missing' ? '❌' : '⚠️';
              console.log(`    ${reasonIcon} ${location.path} (${location.reason})`);

              if (options.verbose && location.actualChecksum) {
                console.log(`       Expected: ${location.expectedChecksum?.substring(0, 16)}...`);
                console.log(`       Actual: ${location.actualChecksum.substring(0, 16)}...`);
              }
            }
            console.log('');
          }

          console.log(`💡 Run \`craftdesk sync\` to fix all issues\n`);
        }

        // Show in sync crafts if verbose
        if (options.verbose && inSync.length > 0) {
          console.log(`✅ In Sync (${inSync.length}):\n`);

          for (const status of inSync) {
            console.log(`  ✓ ${status.craftName}`);
            console.log(`    Checksum: ${status.canonicalChecksum.substring(0, 16)}...`);
            console.log(`    Locations: ${status.inSyncLocations.length}`);
            console.log('');
          }
        } else if (outOfSync.length === 0) {
          console.log(`✅ All ${inSync.length} craft(s) are in sync!\n`);
        }
      }

    } catch (error) {
      logger.failSpinner('Failed to verify sync status');
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Error: ${message}`);
      process.exit(1);
    }
  });
}

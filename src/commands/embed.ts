/**
 * embed command - Register a local/embedded skill
 *
 * Marks a skill as embedded (project-specific, committed to git)
 * instead of managed (installed via craftdesk install).
 */

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger';
import { configManager } from '../services/config-manager';
import { gitIgnoreManager } from '../services/gitignore-manager';
import { multiAgentSync } from '../services/multi-agent-sync';
import type { CraftDeskJson } from '../types/craftdesk-json';

/**
 * Command options for embed
 *
 * @interface
 */
interface EmbedOptions {
  /** Craft type (skill, agent, command, hook) */
  type?: 'skill' | 'agent' | 'command' | 'hook';
  /** Skip multi-agent sync */
  skipSync?: boolean;
}

/**
 * Creates the 'embed' command for registering embedded skills
 *
 * @returns Commander command instance configured for embedding skills
 */
export function createEmbedCommand(): Command {
  return new Command('embed')
    .description('Register a local/embedded skill (committed to git)')
    .argument('<name>', 'Name of the skill to embed')
    .option('-t, --type <type>', 'Craft type (skill, agent, command, hook)', 'skill')
    .option('--skip-sync', 'Skip multi-agent sync after embedding')
    .action(async (name: string, options: EmbedOptions) => {
      try {
        logger.startSpinner(`Embedding ${name}...`);

        const craftDeskPath = path.join(process.cwd(), 'craftdesk.json');

        // Check if craftdesk.json exists
        if (!await fs.pathExists(craftDeskPath)) {
          logger.failSpinner('No craftdesk.json found');
          logger.error('Run `craftdesk init` first to create craftdesk.json');
          process.exit(1);
        }

        // Read current config directly from file (don't use cache)
        const config: CraftDeskJson = await fs.readJson(craftDeskPath);

        if (!config) {
          logger.failSpinner('Failed to read craftdesk.json');
          process.exit(1);
        }

        // Check if skill directory exists
        const installPath = configManager.getInstallPath();
        const typeDir = getTypeDirectory(options.type || 'skill');
        const craftDir = path.join(process.cwd(), installPath, typeDir, name);

        if (!await fs.pathExists(craftDir)) {
          logger.failSpinner(`${name} not found`);
          logger.error(`Directory not found: ${craftDir}`);
          logger.info(`Create the ${options.type || 'skill'} first or use --type to specify correct type`);
          process.exit(1);
        }

        // Check if already embedded
        const embedded = config.embedded || [];
        if (embedded.includes(name)) {
          logger.failSpinner(`${name} is already embedded`);
          logger.info('Use `craftdesk unembed` to remove it from embedded list');
          process.exit(1);
        }

        // Check if it's a managed dependency
        if (config.dependencies && name in config.dependencies) {
          logger.failSpinner(`${name} is a managed dependency`);
          logger.error(`Cannot embed a managed dependency. Remove it from dependencies first with:`);
          logger.info(`  craftdesk remove ${name}`);
          process.exit(1);
        }

        // Add to embedded list
        const updatedConfig = {
          ...config,
          embedded: [...embedded, name]
        };

        // Write updated config
        await fs.writeFile(
          craftDeskPath,
          JSON.stringify(updatedConfig, null, 2) + '\n',
          'utf-8'
        );

        logger.succeedSpinner(`Embedded ${name}`);

        // Update .gitignore
        logger.startSpinner('Updating .gitignore...');
        await gitIgnoreManager.autoUpdate();
        logger.succeedSpinner('Updated .gitignore');

        // Sync to other agents if multi-agent enabled
        if (!options.skipSync) {
          const multiAgentConfig = updatedConfig.multiAgent;
          if (multiAgentConfig?.enabled && multiAgentConfig?.autoSync) {
            logger.startSpinner('Syncing to other agents...');

            try {
              const result = await multiAgentSync.syncCraft(name, craftDir);

              if (result.synced.length > 1) {
                logger.succeedSpinner(`Synced to ${result.synced.length - 1} agent(s)`);
              } else {
                logger.succeedSpinner('Sync complete');
              }

              if (result.failed.length > 0) {
                logger.warn(`Failed to sync to ${result.failed.length} location(s)`);
                for (const failure of result.failed) {
                  logger.warn(`  ${failure.path}: ${failure.error}`);
                }
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              logger.warn(`Failed to sync: ${message}`);
            }
          }
        }

        console.log('');
        console.log(`✅ ${name} is now embedded (committed to git)`);
        console.log('');
        console.log('Next steps:');
        console.log(`  • Edit the ${options.type || 'skill'} in: ${craftDir}`);
        console.log(`  • Commit to git: git add ${craftDir}`);
        console.log(`  • Team members will get it via git clone (not craftdesk install)`);
        console.log('');

      } catch (error) {
        logger.failSpinner('Failed to embed skill');
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Error: ${message}`);
        process.exit(1);
      }
    });
}

/**
 * Get type directory name
 *
 * @param type - The craft type
 * @returns Directory name for the craft type
 * @private
 */
function getTypeDirectory(type: 'skill' | 'agent' | 'command' | 'hook'): string {
  switch (type) {
    case 'skill':
      return 'skills';
    case 'agent':
      return 'agents';
    case 'command':
      return 'commands';
    case 'hook':
      return 'hooks';
    default:
      return 'skills';
  }
}

/**
 * unembed command - Unregister an embedded skill
 *
 * Removes a skill from the embedded list in craftdesk.json.
 * The skill files remain on disk.
 */

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger';
import { configManager } from '../services/config-manager';
import { gitIgnoreManager } from '../services/gitignore-manager';
import type { CraftDeskJson } from '../types/craftdesk-json';

/**
 * Command options for unembed
 *
 * @interface
 */
interface UnembedOptions {
  /** Also remove the files from disk */
  remove?: boolean;
}

/**
 * Creates the 'unembed' command for unregistering embedded skills
 *
 * @returns Commander command instance configured for unembedding skills
 */
export function createUnembedCommand(): Command {
  return new Command('unembed')
    .description('Unregister an embedded skill')
    .argument('<name>', 'Name of the skill to unembed')
    .option('--remove', 'Also remove the skill files from disk')
    .action(async (name: string, options: UnembedOptions) => {
      try {
        logger.startSpinner(`Unembedding ${name}...`);

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

        // Check if skill is embedded
        const embedded = config.embedded || [];
        if (!embedded.includes(name)) {
          logger.failSpinner(`${name} is not embedded`);
          logger.error('Skill is not in the embedded list');
          logger.info('Use `craftdesk list` to see all installed crafts');
          process.exit(1);
        }

        // Remove from embedded list
        const filteredEmbedded = embedded.filter(skill => skill !== name);
        const updatedConfig = filteredEmbedded.length === 0
          ? { ...config, embedded: undefined }
          : { ...config, embedded: filteredEmbedded };

        // Write updated config
        await fs.writeFile(
          craftDeskPath,
          JSON.stringify(updatedConfig, null, 2) + '\n',
          'utf-8'
        );

        logger.succeedSpinner(`Unembedded ${name}`);

        // Update .gitignore
        logger.startSpinner('Updating .gitignore...');
        await gitIgnoreManager.autoUpdate();
        logger.succeedSpinner('Updated .gitignore');

        // Optionally remove files
        if (options.remove) {
          const installPath = configManager.getInstallPath();
          const craftDir = path.join(process.cwd(), installPath, 'skills', name);

          if (await fs.pathExists(craftDir)) {
            logger.startSpinner('Removing skill files...');
            await fs.remove(craftDir);
            logger.succeedSpinner('Removed skill files');
          }
        }

        console.log('');
        console.log(`✅ ${name} is no longer embedded`);
        console.log('');

        if (options.remove) {
          console.log('Skill files have been removed from disk.');
        } else {
          console.log('Note: Skill files still exist on disk.');
          console.log(`  To remove them: craftdesk unembed ${name} --remove`);
          console.log(`  Or manually: rm -rf ${configManager.getInstallPath()}/skills/${name}`);
        }

        console.log('');

      } catch (error) {
        logger.failSpinner('Failed to unembed skill');
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Error: ${message}`);
        process.exit(1);
      }
    });
}

import { Command } from 'commander';
import path from 'path';
import { CraftDeskJson } from '../types/craftdesk-json';
import { writeCraftDeskJson, exists } from '../utils/file-system';
import { logger } from '../utils/logger';

/**
 * Creates the 'init' command for initializing a new craftdesk.json file
 *
 * @returns Commander command instance configured for project initialization
 */
export function createInitCommand(): Command {
  return new Command('init')
    .description('Initialize a new craftdesk.json file')
    .option('-y, --yes', 'Skip prompts and use defaults')
    .option('-n, --name <name>', 'Project name')
    .option('--project-version <version>', 'Project version', '1.0.0')
    .option('-t, --type <type>', 'Project type (skill, agent, command, hook, plugin)', 'skill')
    .option('-d, --description <desc>', 'Project description')
    .option('-a, --author <author>', 'Author name')
    .option('-l, --license <license>', 'License', 'MIT')
    .action(async (options) => {
      await initCommand(options);
    });
}

async function initCommand(options: any): Promise<void> {
  try {
    // Check if craftdesk.json already exists
    if (await exists('craftdesk.json')) {
      logger.error('craftdesk.json already exists in this directory');
      process.exit(1);
    }

    const config: CraftDeskJson = {
      name: options.name || path.basename(process.cwd()),
      version: options.projectVersion,
      type: options.type,
      description: options.description || undefined,
      author: options.author || undefined,
      license: options.license || undefined,
      dependencies: {},
      registries: {
        default: {
          url: 'https://craftdesk.ai'
        }
      }
    };

    // Write craftdesk.json
    await writeCraftDeskJson(config);

    logger.success('Created craftdesk.json');
    logger.info('Run "craftdesk install" to install dependencies');
    logger.info('Run "craftdesk add <craft>" to add dependencies');
  } catch (error: any) {
    logger.error(`Failed to initialize: ${error.message}`);
    process.exit(1);
  }
}
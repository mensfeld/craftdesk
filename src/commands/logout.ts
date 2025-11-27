import { Command } from 'commander';
import { configManager } from '../services/config-manager';
import { logger } from '../utils/logger';

interface LogoutOptions {
  registry?: string;
}

export function createLogoutCommand(): Command {
  return new Command('logout')
    .description('Remove authentication for a registry')
    .option('--registry <url>', 'Registry URL to logout from')
    .action(async (options: LogoutOptions) => {
      await logoutCommand(options);
    });
}

async function logoutCommand(options: LogoutOptions): Promise<void> {
  try {
    // 1. Get registry URL
    const registryUrl = options.registry || await configManager.getDefaultRegistry();

    if (!registryUrl) {
      logger.error('No registry specified.');
      logger.info('Either specify --registry <url> or add a default registry to craftdesk.json');
      process.exit(1);
    }

    // 2. Get stored username before removing (for display)
    const username = await configManager.getStoredUsername(registryUrl);

    // 3. Remove token from config
    const removed = await configManager.removeAuthToken(registryUrl);

    if (removed) {
      if (username) {
        logger.success(`Logged out ${username} from ${registryUrl}`);
      } else {
        logger.success(`Logged out from ${registryUrl}`);
      }
    } else {
      logger.info(`Not logged in to ${registryUrl}`);
    }

  } catch (error: any) {
    logger.error(error.message);
    process.exit(1);
  }
}

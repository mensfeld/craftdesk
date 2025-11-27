import { Command } from 'commander';
import { configManager } from '../services/config-manager';
import { registryClient } from '../services/registry-client';
import { logger } from '../utils/logger';

interface WhoamiOptions {
  registry?: string;
}

export function createWhoamiCommand(): Command {
  return new Command('whoami')
    .description('Display the currently logged in user')
    .option('--registry <url>', 'Registry URL to check')
    .action(async (options: WhoamiOptions) => {
      await whoamiCommand(options);
    });
}

async function whoamiCommand(options: WhoamiOptions): Promise<void> {
  try {
    // 1. Get registry URL
    const registryUrl = options.registry || await configManager.getDefaultRegistry();

    if (!registryUrl) {
      logger.error('No registry configured.');
      logger.info('Either specify --registry <url> or add a default registry to craftdesk.json');
      process.exit(1);
    }

    // 2. Get token from config
    const token = await configManager.getAuthToken(registryUrl);

    if (!token) {
      logger.info('Not logged in');
      logger.info(`Run "craftdesk login --registry ${registryUrl}" to authenticate`);
      process.exit(1);
    }

    // 3. Verify token and get user info
    const userInfo = await registryClient.verifyToken(registryUrl, token);

    // 4. Display user info
    logger.log(userInfo.username);

    if (userInfo.organization) {
      logger.info(`Organization: ${userInfo.organization}`);
    }

    logger.info(`Registry: ${registryUrl}`);

  } catch (error: any) {
    if (error.message.includes('Invalid') || error.message.includes('expired')) {
      logger.error('Token is invalid or expired');
      logger.info('Run "craftdesk login" to re-authenticate');
    } else {
      logger.error(error.message);
    }
    process.exit(1);
  }
}

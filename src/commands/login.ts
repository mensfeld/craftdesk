import { Command } from 'commander';
import * as readline from 'readline';
import { configManager } from '../services/config-manager';
import { registryClient } from '../services/registry-client';
import { logger } from '../utils/logger';

interface LoginOptions {
  registry?: string;
}

/**
 * Creates the 'login' command for authenticating with a CraftDesk registry
 *
 * @returns Commander command instance configured for registry authentication
 */
export function createLoginCommand(): Command {
  return new Command('login')
    .description('Authenticate with a CraftDesk registry')
    .option('--registry <url>', 'Registry URL to authenticate with')
    .action(async (options: LoginOptions) => {
      await loginCommand(options);
    });
}

async function loginCommand(options: LoginOptions): Promise<void> {
  try {
    // 1. Get registry URL
    const registryUrl = options.registry || await configManager.getDefaultRegistry();

    if (!registryUrl) {
      logger.error('No registry configured.');
      logger.info('Either specify --registry <url> or add a default registry to craftdesk.json:');
      logger.info('  "registries": { "default": { "url": "https://your-registry.com" } }');
      process.exit(1);
    }

    // 2. Check if already logged in
    const existingToken = await configManager.getAuthToken(registryUrl);
    if (existingToken) {
      const existingUser = await configManager.getStoredUsername(registryUrl);
      logger.info(`Already logged in to ${registryUrl} as ${existingUser || 'unknown'}`);
      logger.info('Run "craftdesk logout" first to log out, or provide a new token.');
    }

    // 3. Prompt for token
    logger.info(`\nAuthenticating with ${registryUrl}`);
    logger.info('Get your API token from your profile page on the registry website.\n');

    const token = await promptForToken();

    if (!token || token.trim() === '') {
      logger.error('No token provided');
      process.exit(1);
    }

    // 4. Validate token
    logger.startSpinner('Verifying token...');

    const userInfo = await registryClient.verifyToken(registryUrl, token.trim());

    // 5. Save to config
    await configManager.setAuthToken(registryUrl, token.trim(), userInfo.username);

    logger.succeedSpinner(`Logged in as ${userInfo.username}`);

    if (userInfo.organization) {
      logger.info(`Organization: ${userInfo.organization}`);
    }

    logger.info(`\nToken saved to ${configManager.getGlobalConfigPath()}`);

  } catch (error: any) {
    logger.failSpinner('Authentication failed');
    logger.error(error.message);
    process.exit(1);
  }
}

/**
 * Prompt for API token with hidden input
 *
 * @returns The API token entered by the user
 */
async function promptForToken(): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // Try to hide input if terminal supports it
    if (process.stdin.isTTY) {
      process.stdout.write('Token: ');

      let token = '';

      // Use raw mode for hidden input
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      const onData = (char: string) => {
        // Ctrl+C
        if (char === '\u0003') {
          process.stdin.setRawMode(false);
          process.stdout.write('\n');
          rl.close();
          process.exit(0);
        }

        // Enter key
        if (char === '\r' || char === '\n') {
          process.stdin.setRawMode(false);
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          rl.close();
          resolve(token);
          return;
        }

        // Backspace
        if (char === '\u007F' || char === '\b') {
          if (token.length > 0) {
            token = token.slice(0, -1);
            // Move cursor back, write space, move back again
            process.stdout.write('\b \b');
          }
          return;
        }

        // Regular character - add to token, display asterisk
        token += char;
        process.stdout.write('*');
      };

      process.stdin.on('data', onData);
    } else {
      // Non-interactive mode - just read the line
      rl.question('Token: ', (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}

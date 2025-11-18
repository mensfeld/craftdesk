import { Command } from 'commander';
import { readCraftDeskJson, readCraftDeskLock } from '../utils/file-system';
import { logger } from '../utils/logger';
import { installer } from '../services/installer';

export function createListCommand(): Command {
  return new Command('list')
    .description('List installed crafts')
    .option('--tree', 'Show dependency tree')
    .option('--depth <n>', 'Limit tree depth', parseInt)
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      await listCommand(options);
    });
}

async function listCommand(options: any): Promise<void> {
  try {
    // Read craftdesk.json for project info
    const craftDeskJson = await readCraftDeskJson();
    if (!craftDeskJson) {
      logger.error('No craftdesk.json found in current directory');
      process.exit(1);
    }

    // Get installed crafts
    const installedCrafts = await installer.listInstalled();

    if (options.json) {
      // JSON output
      console.log(JSON.stringify({
        name: craftDeskJson.name,
        version: craftDeskJson.version,
        installedCrafts
      }, null, 2));
      return;
    }

    // Display project info
    logger.log(`${craftDeskJson.name}@${craftDeskJson.version}`);

    if (installedCrafts.length === 0) {
      logger.info('No crafts installed');
      logger.info('Run "craftdesk install" to install dependencies');
      return;
    }

    if (options.tree) {
      // Show dependency tree
      const lockfile = await readCraftDeskLock();
      if (!lockfile) {
        logger.warn('No craftdesk.lock found. Cannot show dependency tree.');
        logger.info('Run "craftdesk install" to generate lockfile');
      } else {
        displayDependencyTree(lockfile, options.depth);
      }
    } else {
      // Simple list
      logger.log('\nInstalled crafts:');
      for (const craft of installedCrafts) {
        const typeIcon = getTypeIcon(craft.type);
        logger.log(`  ${typeIcon} ${craft.name}@${craft.version} (${craft.type})`);
      }

      logger.log('');
      logger.info(`Total: ${installedCrafts.length} crafts installed`);
    }
  } catch (error: any) {
    logger.error(`Failed to list crafts: ${error.message}`);
    process.exit(1);
  }
}

function getTypeIcon(type: string): string {
  switch (type) {
    case 'skill':
      return '📚';
    case 'agent':
      return '🤖';
    case 'command':
      return '⚡';
    case 'hook':
      return '🔗';
    default:
      return '📦';
  }
}

function displayDependencyTree(lockfile: any, maxDepth?: number): void {
  logger.log('\nDependency tree:');

  if (!lockfile.tree) {
    logger.warn('No dependency tree information in lockfile');
    return;
  }

  const tree = lockfile.tree;
  const depth = 0;
  const prefix = '';

  for (const [key, value] of Object.entries(tree)) {
    displayTreeNode(key, value, depth, maxDepth || Infinity, prefix, Object.keys(tree).indexOf(key) === Object.keys(tree).length - 1);
  }
}

function displayTreeNode(key: string, node: any, depth: number, maxDepth: number, prefix: string, isLast: boolean): void {
  if (depth > maxDepth) return;

  const connector = isLast ? '└── ' : '├── ';
  const [name, version] = key.split('@');

  logger.log(`${prefix}${connector}${name}@${version}`);

  if (typeof node === 'object' && node.dependencies && depth < maxDepth) {
    const newPrefix = prefix + (isLast ? '    ' : '│   ');
    const deps = Object.entries(node.dependencies);

    deps.forEach(([depKey, depValue], index) => {
      const isLastDep = index === deps.length - 1;
      displayTreeNode(depKey, depValue, depth + 1, maxDepth, newPrefix, isLastDep);
    });
  } else if (typeof node === 'string' && node === '(shared)') {
    // Shared dependency indicator
    logger.log(' (shared)');
  }
}
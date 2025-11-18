import { Command } from 'commander';
import { readCraftDeskJson, writeCraftDeskJson, readCraftDeskLock, writeCraftDeskLock } from '../utils/file-system';
import { logger } from '../utils/logger';
import { installer } from '../services/installer';

export function createRemoveCommand(): Command {
  return new Command('remove')
    .description('Remove a dependency')
    .argument('<craft>', 'Craft name to remove')
    .action(async (craftName: string) => {
      await removeCommand(craftName);
    });
}

async function removeCommand(craftName: string): Promise<void> {
  try {
    // Read craftdesk.json
    const craftDeskJson = await readCraftDeskJson();
    if (!craftDeskJson) {
      logger.error('No craftdesk.json found in current directory');
      process.exit(1);
    }

    // Check if craft exists in any dependency field
    let found = false;
    let foundInField: string | null = null;

    const depFields = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];

    for (const field of depFields) {
      if (craftDeskJson[field] && craftDeskJson[field][craftName]) {
        found = true;
        foundInField = field;
        delete craftDeskJson[field][craftName];

        // Remove empty objects
        if (Object.keys(craftDeskJson[field]).length === 0) {
          delete craftDeskJson[field];
        }
        break;
      }
    }

    if (!found) {
      logger.error(`Craft '${craftName}' is not in craftdesk.json`);
      process.exit(1);
    }

    // Save updated craftdesk.json
    await writeCraftDeskJson(craftDeskJson);
    logger.success(`Removed ${craftName} from ${foundInField}`);

    // Read lockfile to get craft type
    const lockfile = await readCraftDeskLock();
    if (lockfile && lockfile.crafts[craftName]) {
      const craftEntry = lockfile.crafts[craftName];

      // Remove from file system
      await installer.removeCraft(craftName, craftEntry.type);

      // Remove from lockfile
      delete lockfile.crafts[craftName];

      // TODO: Clean up dependency tree in lockfile

      // Save updated lockfile
      await writeCraftDeskLock(lockfile);
      logger.success('Updated craftdesk.lock');
    } else {
      // Try to remove from file system anyway (best effort)
      const typesToTry = ['skill', 'agent', 'command', 'hook'];
      for (const type of typesToTry) {
        await installer.removeCraft(craftName, type);
      }
    }

    logger.success('Craft removed successfully!');
  } catch (error: any) {
    logger.error(`Failed to remove craft: ${error.message}`);
    process.exit(1);
  }
}
/**
 * setup-multi-agent command - Interactive multi-agent setup
 *
 * Guides users through enabling multi-agent sync by:
 * - Detecting available AI agents
 * - Allowing selection of agents to sync
 * - Configuring craftdesk.json
 * - Optionally performing initial sync
 */

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger';
import { agentDetector } from '../services/agent-detector';
import { multiAgentSync } from '../services/multi-agent-sync';
import { configManager } from '../services/config-manager';

/**
 * Command options for setup-multi-agent command
 *
 * @interface
 */
interface SetupOptions {
  /** Auto-sync on install/update */
  autoSync?: boolean;
  /** Skip initial sync */
  skipSync?: boolean;
}

/**
 * Prompt user for yes/no input
 * (Simplified for now - in production would use inquirer or prompts)
 *
 * @param _question - The question to ask the user
 * @returns User's yes/no response
 */
function promptYesNo(_question: string): boolean {
  // TODO: Implement actual prompting with inquirer
  // For now, return default values
  return true;
}

/**
 * Prompt user to select from multiple options
 * (Simplified for now - in production would use inquirer or prompts)
 *
 * @param _question - The question to ask the user
 * @param _choices - Available choices to select from
 * @returns Selected choices
 */
function promptMultiSelect(_question: string, _choices: string[]): string[] {
  // TODO: Implement actual prompting with inquirer
  // For now, return all choices
  return _choices;
}

/**
 * Creates the 'setup-multi-agent' command for interactive multi-agent configuration
 *
 * @returns Commander command instance configured for multi-agent setup
 */
export function createSetupMultiAgentCommand(): Command {
  return new Command('setup-multi-agent')
  .description('Interactive setup for multi-agent sync')
  .option('--auto-sync', 'Enable auto-sync on install/update')
  .option('--skip-sync', 'Skip initial sync after setup')
  .action(async (options: SetupOptions) => {
    try {
      console.log('\n🔧 Multi-Agent Sync Setup\n');
      console.log('This will configure CraftDesk to sync skills across multiple AI coding assistants.\n');

      // Detect agents
      logger.startSpinner('Detecting AI coding assistants...');
      const detection = await agentDetector.detectAgents();
      logger.stopSpinner();

      if (detection.detected.filter(a => a.detected).length === 0) {
        console.log('❌ No AI coding assistants detected\n');
        console.log('Detected agents will be automatically configured.');
        console.log('You can create directories manually:\n');
        console.log('  mkdir -p .cursor/skills');
        console.log('  mkdir -p .windsurf/skills');
        console.log('  mkdir -p .continue/skills\n');
        return;
      }

      console.log('Detected AI Assistants:\n');

      const detectedAgents = detection.detected.filter(a => a.detected || a.name === 'claude');

      for (const agent of detectedAgents) {
        const status = agent.detected ? '✅ Found' : '⚫ Not found';
        console.log(`  ${agent.displayName}: ${status}`);
        console.log(`    Directory: ${agent.skillsDir}`);
        console.log('');
      }

      // Get current config
      const currentConfig = await configManager.getCraftDeskJson();
      const craftDeskPath = path.join(process.cwd(), 'craftdesk.json');

      if (!currentConfig) {
        console.log('❌ No craftdesk.json found\n');
        console.log('Please initialize a project first with `craftdesk init`\n');
        return;
      }

      // Check if already enabled
      if (currentConfig.multiAgent?.enabled) {
        console.log('ℹ️  Multi-agent sync is already enabled\n');
        console.log('Current configuration:');
        console.log(`  Canonical: ${currentConfig.multiAgent.canonical}`);
        console.log(`  Targets: ${currentConfig.multiAgent.targets.length}`);
        for (const target of currentConfig.multiAgent.targets) {
          console.log(`    - ${target}`);
        }
        console.log('');

        const shouldReconfigure = promptYesNo('Do you want to reconfigure?');
        if (!shouldReconfigure) {
          console.log('Setup cancelled\n');
          return;
        }
      }

      // Select agents to enable
      console.log('Select agents to sync skills to:\n');

      const availableAgents = detectedAgents.filter(a => a.name !== 'claude');
      const choices = availableAgents.map(a => a.skillsDir);

      const selectedTargets = promptMultiSelect(
        'Select target agents (space to toggle, enter to confirm):',
        choices
      );

      // Always include Claude as canonical
      const targets = ['.claude/skills', ...selectedTargets];

      // Build configuration
      const multiAgentConfig = {
        enabled: true,
        canonical: '.claude',
        targets,
        autoSync: options.autoSync || false
      };

      // Update craftdesk.json
      logger.startSpinner('Updating craftdesk.json...');

      const updatedConfig = {
        ...currentConfig,
        multiAgent: multiAgentConfig
      };

      await fs.writeFile(
        craftDeskPath,
        JSON.stringify(updatedConfig, null, 2) + '\n',
        'utf-8'
      );

      logger.succeedSpinner('Configuration updated');

      console.log('\n✅ Multi-agent sync configured!\n');
      console.log('Configuration:');
      console.log(`  Canonical: ${multiAgentConfig.canonical}`);
      console.log(`  Targets (${targets.length}):`);
      for (const target of targets) {
        console.log(`    - ${target}`);
      }
      console.log(`  Auto-sync: ${multiAgentConfig.autoSync ? 'enabled' : 'disabled'}`);
      console.log('');

      // Offer to perform initial sync
      if (!options.skipSync) {
        const shouldSync = promptYesNo('Perform initial sync now?');

        if (shouldSync) {
          console.log('');
          logger.startSpinner('Syncing existing crafts...');

          // Clear config cache to pick up new settings
          configManager['craftDeskJson'] = null;

          const results = await multiAgentSync.syncAllCrafts();

          logger.stopSpinner();

          if (results.length === 0) {
            console.log('ℹ️  No crafts found to sync\n');
          } else {
            console.log(`✅ Synced ${results.length} craft(s)\n`);

            let totalSynced = 0;
            let totalFailed = 0;

            for (const result of results) {
              totalSynced += result.synced.length;
              totalFailed += result.failed.length;

              if (result.failed.length > 0) {
                console.log(`⚠️  ${result.craftName}: ${result.failed.length} location(s) failed`);
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
        }
      }

      console.log('Next steps:\n');
      console.log('  • Install crafts: `craftdesk install`');
      console.log('  • Verify sync: `craftdesk verify`');
      console.log('  • Manual sync: `craftdesk sync`');
      console.log('  • Detect agents: `craftdesk detect-agents`\n');

    } catch (error) {
      logger.failSpinner('Setup failed');
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Error: ${message}`);
      process.exit(1);
    }
  });
}

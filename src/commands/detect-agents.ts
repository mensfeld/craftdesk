/**
 * detect-agents command - Detect AI coding assistants
 *
 * Scans the project directory for known AI agent configuration directories
 * and displays which agents are detected and enabled.
 */

import { Command } from 'commander';
import { logger } from '../utils/logger';
import { agentDetector } from '../services/agent-detector';

/**
 * Command options for detect-agents command
 *
 * @interface
 */
interface DetectAgentsOptions {
  /** Show additional debug information */
  verbose?: boolean;
  /** Output format (text or json) */
  format?: 'text' | 'json';
}

/**
 * Creates the 'detect-agents' command for detecting AI coding assistants
 *
 * @returns Commander command instance configured for agent detection
 */
export function createDetectAgentsCommand(): Command {
  return new Command('detect-agents')
  .description('Detect AI coding assistants in the project')
  .option('-v, --verbose', 'Show detailed detection information')
  .option('-f, --format <format>', 'Output format (text or json)', 'text')
  .action(async (options: DetectAgentsOptions) => {
    try {
      logger.startSpinner('Detecting AI coding assistants...');

      const result = await agentDetector.detectAgents();

      logger.stopSpinner();

      if (options.format === 'json') {
        // JSON output
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      // Text output
      console.log('\n🔍 AI Coding Assistant Detection\n');

      if (result.detected.length === 0) {
        console.log('❌ No AI coding assistants detected\n');
        console.log('Tip: Initialize a .claude/ directory with `craftdesk init`');
        return;
      }

      // Show detected agents
      console.log('Detected Agents:');
      for (const agent of result.detected) {
        const status = agent.enabled ? '✅ Enabled' : agent.detected ? '⚪ Available' : '⚫ Not found';
        const marker = agent.enabled ? '✓' : agent.detected ? '○' : '·';

        console.log(`  ${marker} ${agent.displayName}`);
        console.log(`    Directory: ${agent.skillsDir}`);
        if (agent.detected) {
          console.log(`    Status: ${status}`);
        }

        if (options.verbose) {
          console.log(`    Name: ${agent.name}`);
          console.log(`    Detected: ${agent.detected}`);
          console.log(`    Enabled: ${agent.enabled}`);
        }
        console.log('');
      }

      // Show summary
      const enabledCount = result.enabled.length;
      const detectedCount = result.detected.filter(a => a.detected).length;

      console.log(`Summary:`);
      console.log(`  Detected: ${detectedCount} agent(s)`);
      console.log(`  Enabled: ${enabledCount} agent(s)`);

      if (result.suggested.length > 0) {
        console.log(`\n💡 Suggested Actions:`);
        console.log(`  ${result.suggested.length} agent(s) available but not enabled for sync`);
        console.log(`  Run \`craftdesk setup-multi-agent\` to enable multi-agent sync\n`);
      } else if (enabledCount === 1 && detectedCount > 1) {
        console.log(`\n💡 Tip:`);
        console.log(`  You have multiple agents but sync is only enabled for one.`);
        console.log(`  Run \`craftdesk setup-multi-agent\` to sync across all agents.\n`);
      } else if (enabledCount > 1) {
        console.log(`\n✨ Multi-agent sync is active!`);
        console.log(`  Skills will be synced across all enabled agents.\n`);
      }

    } catch (error) {
      logger.failSpinner('Failed to detect agents');
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Error: ${message}`);
      process.exit(1);
    }
  });
}

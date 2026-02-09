/**
 * Agent Detector - Auto-detect AI coding assistants
 *
 * Detects which AI coding assistants are in use by checking for
 * their configuration directories (.claude/, .cursor/, etc.)
 */

import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger';
import type { AgentConfig, AgentDetectionResult } from '../types/multi-agent';
import { configManager } from './config-manager';

/**
 * Known AI coding assistants and their directory structures
 */
const KNOWN_AGENTS: Omit<AgentConfig, 'enabled' | 'detected'>[] = [
  {
    name: 'claude',
    displayName: 'Claude Code',
    skillsDir: '.claude/skills'
  },
  {
    name: 'cursor',
    displayName: 'Cursor',
    skillsDir: '.cursor/skills'
  },
  {
    name: 'windsurf',
    displayName: 'Windsurf',
    skillsDir: '.windsurf/skills'
  },
  {
    name: 'continue',
    displayName: 'Continue.dev',
    skillsDir: '.continue/skills'
  },
  {
    name: 'agents',
    displayName: 'Generic .agents',
    skillsDir: '.agents/skills'
  }
];

/**
 * Service for detecting AI coding assistants
 */
export class AgentDetector {
  /**
   * Detect which AI coding assistants are in use
   *
   * @param cwd - Current working directory (defaults to process.cwd())
   * @returns Detection result with detected, enabled, and suggested agents
   *
   * @example
   * ```typescript
   * const detector = new AgentDetector();
   * const result = await detector.detectAgents();
   *
   * console.log(`Found ${result.detected.length} agents`);
   * console.log(`Enabled: ${result.enabled.map(a => a.displayName).join(', ')}`);
   * ```
   */
  async detectAgents(cwd: string = process.cwd()): Promise<AgentDetectionResult> {
    const detected: AgentConfig[] = [];
    const config = await configManager.getCraftDeskJson();
    const enabledTargets = config?.multiAgent?.targets || [];

    // Check each known agent
    for (const agent of KNOWN_AGENTS) {
      const agentDir = path.dirname(agent.skillsDir);
      const fullPath = path.join(cwd, agentDir);

      // Check if agent directory exists
      const exists = await fs.pathExists(fullPath);

      if (exists) {
        const isEnabled = enabledTargets.includes(agent.skillsDir);

        detected.push({
          ...agent,
          enabled: isEnabled,
          detected: true
        });

        logger.debug(`Detected ${agent.displayName} at ${agentDir}`);
      }
    }

    // Always ensure Claude is in the list (canonical for CraftDesk)
    const claudeExists = detected.some(a => a.name === 'claude');
    if (!claudeExists) {
      detected.push({
        name: 'claude',
        displayName: 'Claude Code',
        skillsDir: '.claude/skills',
        enabled: true, // Always enabled as canonical
        detected: false
      });
    }

    const enabled = detected.filter(a => a.enabled);
    const suggested = detected.filter(a => !a.enabled && a.detected);

    return { detected, enabled, suggested };
  }

  /**
   * Get configuration for a specific agent by name
   *
   * @param agentName - Name of the agent (e.g., 'cursor', 'windsurf')
   * @returns Agent configuration if found, null otherwise
   */
  getAgentConfig(agentName: string): Omit<AgentConfig, 'enabled' | 'detected'> | null {
    return KNOWN_AGENTS.find(a => a.name === agentName) || null;
  }

  /**
   * Check if a directory belongs to a known AI agent
   *
   * @param dirPath - Directory path to check (e.g., '.cursor')
   * @returns Agent name if recognized, null otherwise
   */
  identifyAgentByDirectory(dirPath: string): string | null {
    const normalized = dirPath.replace(/^\.\//, '').replace(/\/$/, '');
    const agent = KNOWN_AGENTS.find(a => {
      const agentDir = path.dirname(a.skillsDir);
      return agentDir === normalized || agentDir === `.${normalized}`;
    });

    return agent?.name || null;
  }

  /**
   * Get all known agent names
   *
   * @returns Array of agent names
   */
  getKnownAgentNames(): string[] {
    return KNOWN_AGENTS.map(a => a.name);
  }

  /**
   * Validate that all configured targets correspond to known agents
   *
   * @param targets - Array of target paths from config
   * @returns Array of unknown/invalid targets
   */
  validateTargets(targets: string[]): string[] {
    const knownDirs = KNOWN_AGENTS.map(a => a.skillsDir);
    return targets.filter(t => !knownDirs.includes(t));
  }
}

// Export singleton instance
export const agentDetector = new AgentDetector();

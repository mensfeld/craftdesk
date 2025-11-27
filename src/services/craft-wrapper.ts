/**
 * CraftWrapper - Wraps individual crafts as plugins
 *
 * Handles:
 * - Creating plugin structure for individual skills/agents/commands/hooks
 * - Generating .claude-plugin/plugin.json manifest
 * - Generating PLUGIN.md documentation
 * - Copying craft files into plugin structure
 */

import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger';
import { ensureDir } from '../utils/file-system';
import type { PluginManifest } from '../types/claude-settings';

export interface WrapOptions {
  /** Original craft name */
  craftName: string;

  /** Original craft type */
  craftType: 'skill' | 'agent' | 'command' | 'hook';

  /** Original craft path */
  craftPath: string;

  /** Version for wrapped plugin */
  version: string;

  /** Author name */
  author?: string;

  /** Description */
  description?: string;

  /** Expose as tools */
  exposeAsTools?: boolean;

  /** Expose via MCP */
  exposeAsMCP?: boolean;
}

export class CraftWrapper {
  /**
   * Wrap an individual craft as a plugin
   *
   * @param options - Wrapping configuration
   * @param installDir - Installation directory (.claude)
   * @returns Path to created plugin
   */
  async wrapCraft(options: WrapOptions, installDir: string = '.claude'): Promise<string> {
    const {
      craftName,
      craftType,
      craftPath,
      version,
      author,
      description,
      exposeAsTools,
      exposeAsMCP
    } = options;

    // Create plugin directory
    const pluginName = `${craftName}-plugin`;
    const pluginDir = path.join(installDir, 'plugins', pluginName);

    await ensureDir(pluginDir);

    // Create plugin structure based on craft type
    const typeDir = this.getTypeDirectory(craftType);
    const craftDestDir = path.join(pluginDir, typeDir, craftName);

    await ensureDir(craftDestDir);

    // Copy craft files
    await this.copyCraftFiles(craftPath, craftDestDir);

    // Create .claude-plugin directory and plugin.json manifest
    const claudePluginDir = path.join(pluginDir, '.claude-plugin');
    await ensureDir(claudePluginDir);

    const manifest = this.createPluginManifest({
      name: pluginName,
      version,
      author,
      description: description || `Plugin wrapper for ${craftName} ${craftType}`,
      craftName,
      craftType,
      exposeAsTools,
      exposeAsMCP
    });

    await fs.writeFile(
      path.join(claudePluginDir, 'plugin.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    );

    // Create PLUGIN.md documentation
    const pluginDoc = this.generatePluginDoc({
      pluginName,
      craftName,
      craftType,
      description: description || `Plugin wrapper for ${craftName}`,
      version
    });

    await fs.writeFile(
      path.join(pluginDir, 'PLUGIN.md'),
      pluginDoc,
      'utf-8'
    );

    logger.info(`Wrapped ${craftType} '${craftName}' as plugin: ${pluginName}`);
    return pluginDir;
  }

  /**
   * Copy craft files to plugin directory
   */
  private async copyCraftFiles(sourcePath: string, destPath: string): Promise<void> {
    try {
      // Copy all files from source craft directory
      await fs.copy(sourcePath, destPath, {
        overwrite: true,
        filter: (src) => {
          // Skip metadata files
          const basename = path.basename(src);
          return basename !== '.craftdesk-metadata.json';
        }
      });

      logger.debug(`Copied craft files from ${sourcePath} to ${destPath}`);
    } catch (error: any) {
      throw new Error(`Failed to copy craft files: ${error.message}`);
    }
  }

  /**
   * Create plugin manifest
   */
  private createPluginManifest(options: {
    name: string;
    version: string;
    author?: string;
    description: string;
    craftName: string;
    craftType: 'skill' | 'agent' | 'command' | 'hook';
    exposeAsTools?: boolean;
    exposeAsMCP?: boolean;
  }): PluginManifest {
    const {
      name,
      version,
      author,
      description,
      craftName,
      craftType,
      exposeAsTools,
      exposeAsMCP
    } = options;

    const components: PluginManifest['components'] = {};

    // Add craft to appropriate component list
    switch (craftType) {
      case 'skill':
        components.skills = [craftName];
        break;
      case 'agent':
        components.agents = [craftName];
        break;
      case 'command':
        components.commands = [craftName];
        break;
      case 'hook':
        components.hooks = [craftName];
        break;
    }

    // Create official Claude Code compliant manifest
    const manifest: PluginManifest = {
      name,  // Required field
      version,
      description,
      ...(author && { author }),
      // CraftDesk-specific: component listing (not part of official spec)
      components,
      // CraftDesk-specific: Metadata for wrapped craft
      wrapped: {
        craftName,
        craftType,
        wrappedAt: new Date().toISOString(),
        exposeAsTools,
        exposeAsMCP
      }
    };

    return manifest;
  }

  /**
   * Generate PLUGIN.md documentation
   */
  private generatePluginDoc(options: {
    pluginName: string;
    craftName: string;
    craftType: string;
    description: string;
    version: string;
  }): string {
    const { pluginName, craftName, craftType, description, version } = options;

    return `# ${pluginName}

**Version**: ${version}
**Type**: Plugin (Wrapped ${craftType})

## Description

${description}

## Contents

This plugin wraps the \`${craftName}\` ${craftType} as a standalone plugin.

### Components

- **${craftType.charAt(0).toUpperCase() + craftType.slice(1)}**: \`${craftName}\`

## Installation

This plugin was automatically generated by CraftDesk CLI when wrapping an individual ${craftType}.

## Usage

The wrapped ${craftType} is available as part of this plugin and can be used like any other ${craftType} in Claude Code.

### ${craftType === 'skill' ? 'Skill' : craftType === 'agent' ? 'Agent' : craftType === 'command' ? 'Command' : 'Hook'} Reference

See the original ${craftType} documentation in the \`${this.getTypeDirectory(craftType as any)}/${craftName}/\` directory.

## Metadata

- **Plugin Name**: ${pluginName}
- **Original ${craftType.charAt(0).toUpperCase() + craftType.slice(1)}**: ${craftName}
- **Wrapped At**: ${new Date().toISOString()}
- **CraftDesk Version**: 0.3.0

---

*This is an auto-generated plugin wrapper created by CraftDesk CLI.*
`;
  }

  /**
   * Get type directory name
   */
  private getTypeDirectory(type: 'skill' | 'agent' | 'command' | 'hook'): string {
    switch (type) {
      case 'skill':
        return 'skills';
      case 'agent':
        return 'agents';
      case 'command':
        return 'commands';
      case 'hook':
        return 'hooks';
      default:
        return 'crafts';
    }
  }

  /**
   * Check if a craft is already wrapped
   */
  async isWrapped(craftName: string, installDir: string = '.claude'): Promise<boolean> {
    const pluginName = `${craftName}-plugin`;
    const pluginDir = path.join(installDir, 'plugins', pluginName);

    return fs.pathExists(pluginDir);
  }

  /**
   * Unwrap a plugin (convert back to standalone craft)
   */
  async unwrapPlugin(pluginName: string, installDir: string = '.claude'): Promise<void> {
    const pluginDir = path.join(installDir, 'plugins', pluginName);

    // Read plugin manifest to get wrapped craft info
    const manifestPath = path.join(pluginDir, '.claude-plugin', 'plugin.json');

    if (!await fs.pathExists(manifestPath)) {
      throw new Error(`Plugin manifest not found: ${pluginName}`);
    }

    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8')) as PluginManifest;

    if (!manifest.wrapped) {
      throw new Error(`Plugin ${pluginName} is not a wrapped craft`);
    }

    const { craftName, craftType } = manifest.wrapped;

    // Copy craft back to original location
    const typeDir = this.getTypeDirectory(craftType);
    const craftSourceDir = path.join(pluginDir, typeDir, craftName);
    const craftDestDir = path.join(installDir, typeDir, craftName);

    await fs.copy(craftSourceDir, craftDestDir, { overwrite: true });

    // Remove plugin directory
    await fs.remove(pluginDir);

    logger.info(`Unwrapped plugin ${pluginName} back to ${craftType}: ${craftName}`);
  }
}

// Export singleton instance
export const craftWrapper = new CraftWrapper();

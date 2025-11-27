/**
 * PluginResolver - Resolves plugin dependencies
 *
 * Handles:
 * - Reading plugin craftdesk.json files
 * - Flattening nested dependencies
 * - Building plugin dependency tree
 * - Detecting circular dependencies
 */

import fs from 'fs-extra';
import path from 'path';
import { logger } from '../utils/logger';
import type { CraftDeskJson } from '../types/craftdesk-json';
import type { PluginDependencyTree } from '../types/craftdesk-lock';

export interface ResolvedPlugin {
  name: string;
  version: string;
  dependencies: Record<string, string | import('../types/craftdesk-json').DependencyConfig>;
  isDependency: boolean;
  requiredBy: string[];
}

export class PluginResolver {
  private resolvedPlugins: Map<string, ResolvedPlugin> = new Map();
  private resolutionStack: string[] = [];

  /**
   * Resolve plugin dependencies recursively
   *
   * @param pluginPath - Path to plugin directory
   * @param parentName - Name of parent plugin (for tracking requiredBy)
   * @returns Flattened dependency map
   */
  async resolvePluginDependencies(
    pluginPath: string,
    parentName?: string
  ): Promise<Record<string, ResolvedPlugin>> {
    // Read plugin's craftdesk.json
    const manifest = await this.readPluginManifest(pluginPath);

    if (!manifest) {
      throw new Error(`No craftdesk.json found in plugin: ${pluginPath}`);
    }

    const pluginName = manifest.name;

    // Check for circular dependencies
    if (this.resolutionStack.includes(pluginName)) {
      const cycle = [...this.resolutionStack, pluginName].join(' → ');
      throw new Error(`Circular dependency detected: ${cycle}`);
    }

    // Add to resolution stack
    this.resolutionStack.push(pluginName);

    try {
      // If already resolved, just add requiredBy
      if (this.resolvedPlugins.has(pluginName)) {
        const existing = this.resolvedPlugins.get(pluginName)!;
        if (parentName && !existing.requiredBy.includes(parentName)) {
          existing.requiredBy.push(parentName);
        }
        return Object.fromEntries(this.resolvedPlugins);
      }

      // Create resolved entry
      const resolved: ResolvedPlugin = {
        name: pluginName,
        version: manifest.version,
        dependencies: manifest.dependencies || {},
        isDependency: !!parentName,
        requiredBy: parentName ? [parentName] : []
      };

      this.resolvedPlugins.set(pluginName, resolved);

      // Recursively resolve dependencies
      if (manifest.dependencies) {
        for (const [depName, depVersion] of Object.entries(manifest.dependencies)) {
          // Skip if dependency is a string (version) - these are resolved by registry
          if (typeof depVersion === 'string') {
            logger.debug(`Dependency ${depName} will be resolved by registry`);
            continue;
          }

          // Handle git dependencies with subdirectories
          if (depVersion.git && depVersion.path) {
            // Dependency is in a subdirectory of git repo - we'll need to clone and resolve
            logger.debug(`Dependency ${depName} requires git clone for resolution`);
            continue;
          }
        }
      }

      return Object.fromEntries(this.resolvedPlugins);
    } finally {
      // Remove from resolution stack
      this.resolutionStack.pop();
    }
  }

  /**
   * Build plugin dependency tree for lockfile
   */
  buildPluginTree(): PluginDependencyTree {
    const tree: PluginDependencyTree = {};

    for (const [name, plugin] of this.resolvedPlugins) {
      tree[name] = {
        version: plugin.version,
        dependencies: Object.keys(plugin.dependencies),
        isDependency: plugin.isDependency,
        requiredBy: plugin.requiredBy
      };
    }

    return tree;
  }

  /**
   * Get flattened dependencies
   * This is what goes into craftdesk.json
   */
  getFlattenedDependencies(): Record<string, string | import('../types/craftdesk-json').DependencyConfig> {
    const flattened: Record<string, string | import('../types/craftdesk-json').DependencyConfig> = {};

    for (const [name, plugin] of this.resolvedPlugins) {
      flattened[name] = plugin.version;

      // Add plugin's dependencies
      for (const [depName, depVersion] of Object.entries(plugin.dependencies)) {
        if (typeof depVersion === 'string') {
          flattened[depName] = depVersion;
        } else {
          // Complex dependency config - we'll add it as-is
          flattened[depName] = depVersion;
        }
      }
    }

    return flattened;
  }

  /**
   * Get only directly installed plugins (not dependencies)
   */
  getDirectPlugins(): ResolvedPlugin[] {
    return Array.from(this.resolvedPlugins.values()).filter(p => !p.isDependency);
  }

  /**
   * Get only dependency plugins (not directly installed)
   */
  getDependencyPlugins(): ResolvedPlugin[] {
    return Array.from(this.resolvedPlugins.values()).filter(p => p.isDependency);
  }

  /**
   * Read plugin manifest (craftdesk.json)
   */
  private async readPluginManifest(pluginPath: string): Promise<CraftDeskJson | null> {
    const manifestPath = path.join(pluginPath, 'craftdesk.json');

    try {
      if (await fs.pathExists(manifestPath)) {
        const content = await fs.readFile(manifestPath, 'utf-8');
        return JSON.parse(content) as CraftDeskJson;
      }
      return null;
    } catch (error: any) {
      logger.debug(`Failed to read plugin manifest at ${manifestPath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Reset resolver state
   */
  reset(): void {
    this.resolvedPlugins.clear();
    this.resolutionStack = [];
  }
}

// Export singleton instance
export const pluginResolver = new PluginResolver();

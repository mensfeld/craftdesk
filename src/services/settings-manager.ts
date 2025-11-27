/**
 * SettingsManager - Manages .claude/settings.json file
 *
 * Handles:
 * - Reading and writing Claude Code settings
 * - Plugin registration and lifecycle
 * - MCP server configuration
 * - Wrapped craft tracking
 */

import fs from 'fs-extra';
import path from 'path';
import type {
  ClaudeSettings,
  PluginConfig,
  MCPServerConfig,
  WrappedCraftConfig
} from '../types/claude-settings';
import { logger } from '../utils/logger';

/**
 * Service for managing Claude Code settings.json file
 *
 * Handles plugin registration, MCP server configuration, and settings validation
 */
export class SettingsManager {
  private settingsPath: string;

  /**
   * Creates a new SettingsManager instance
   *
   * @param installDir - Installation directory (default: '.claude')
   */
  constructor(private installDir: string = '.claude') {
    this.settingsPath = path.join(installDir, 'settings.json');
  }

  /**
   * Read the settings file
   *
   * Returns default settings if file doesn't exist
   *
   * @returns The Claude settings object
   */
  async readSettings(): Promise<ClaudeSettings> {
    try {
      if (await fs.pathExists(this.settingsPath)) {
        const content = await fs.readFile(this.settingsPath, 'utf-8');
        const settings = JSON.parse(content) as ClaudeSettings;
        return settings;
      }

      // Return default settings if file doesn't exist
      return this.createDefaultSettings();
    } catch (error: any) {
      logger.warn(`Failed to read settings file: ${error.message}`);
      logger.debug('Returning default settings');
      return this.createDefaultSettings();
    }
  }

  /**
   * Write settings to file
   *
   * @param settings - The settings object to write
   */
  async writeSettings(settings: ClaudeSettings): Promise<void> {
    try {
      // Ensure .claude directory exists
      await fs.ensureDir(this.installDir);

      // Update timestamp
      settings.updatedAt = new Date().toISOString();

      // Write with pretty formatting
      await fs.writeFile(
        this.settingsPath,
        JSON.stringify(settings, null, 2) + '\n',
        'utf-8'
      );

      logger.debug(`Updated settings file: ${this.settingsPath}`);
    } catch (error: any) {
      logger.error(`Failed to write settings file: ${error.message}`);
      throw error;
    }
  }

  /**
   * Register a plugin in settings
   *
   * @param config - Plugin configuration to register
   */
  async registerPlugin(config: PluginConfig): Promise<void> {
    const settings = await this.readSettings();

    // Add or update plugin
    settings.plugins[config.name] = {
      ...config,
      installedAt: config.installedAt || new Date().toISOString()
    };

    await this.writeSettings(settings);
    logger.info(`Registered plugin: ${config.name}@${config.version}`);
  }

  /**
   * Unregister a plugin from settings
   *
   * @param pluginName - Name of the plugin to unregister
   */
  async unregisterPlugin(pluginName: string): Promise<void> {
    const settings = await this.readSettings();

    if (!settings.plugins[pluginName]) {
      logger.warn(`Plugin not found in settings: ${pluginName}`);
      return;
    }

    delete settings.plugins[pluginName];
    await this.writeSettings(settings);
    logger.info(`Unregistered plugin: ${pluginName}`);
  }

  /**
   * Get plugin configuration
   *
   * @param pluginName - Name of the plugin
   * @returns Plugin configuration or null if not found
   */
  async getPlugin(pluginName: string): Promise<PluginConfig | null> {
    const settings = await this.readSettings();
    return settings.plugins[pluginName] || null;
  }

  /**
   * List all registered plugins
   *
   * @returns Array of plugin configurations
   */
  async listPlugins(): Promise<PluginConfig[]> {
    const settings = await this.readSettings();
    return Object.values(settings.plugins);
  }

  /**
   * Enable a plugin
   *
   * @param pluginName - Name of the plugin to enable
   * @throws Error if plugin not found
   */
  async enablePlugin(pluginName: string): Promise<void> {
    const settings = await this.readSettings();

    if (!settings.plugins[pluginName]) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }

    settings.plugins[pluginName].enabled = true;
    await this.writeSettings(settings);
    logger.info(`Enabled plugin: ${pluginName}`);
  }

  /**
   * Disable a plugin
   *
   * @param pluginName - Name of the plugin to disable
   * @throws Error if plugin not found
   */
  async disablePlugin(pluginName: string): Promise<void> {
    const settings = await this.readSettings();

    if (!settings.plugins[pluginName]) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }

    settings.plugins[pluginName].enabled = false;
    await this.writeSettings(settings);
    logger.info(`Disabled plugin: ${pluginName}`);
  }

  /**
   * Register an MCP server
   *
   * @param serverName - Name of the MCP server
   * @param config - MCP server configuration
   */
  async registerMCPServer(
    serverName: string,
    config: MCPServerConfig
  ): Promise<void> {
    const settings = await this.readSettings();

    if (!settings.mcpServers) {
      settings.mcpServers = {};
    }

    settings.mcpServers[serverName] = config;
    await this.writeSettings(settings);
    logger.info(`Registered MCP server: ${serverName}`);
  }

  /**
   * Unregister an MCP server
   *
   * @param serverName - Name of the MCP server to unregister
   */
  async unregisterMCPServer(serverName: string): Promise<void> {
    const settings = await this.readSettings();

    if (!settings.mcpServers || !settings.mcpServers[serverName]) {
      logger.warn(`MCP server not found: ${serverName}`);
      return;
    }

    delete settings.mcpServers[serverName];
    await this.writeSettings(settings);
    logger.info(`Unregistered MCP server: ${serverName}`);
  }

  /**
   * Track a wrapped craft
   *
   * @param pluginName - Name of the plugin
   * @param wrappedConfig - Wrapped craft configuration
   * @throws Error if plugin not found
   */
  async registerWrappedCraft(
    pluginName: string,
    wrappedConfig: WrappedCraftConfig
  ): Promise<void> {
    const settings = await this.readSettings();

    if (!settings.plugins[pluginName]) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }

    settings.plugins[pluginName].wrappedCraft = {
      ...wrappedConfig,
      wrappedAt: new Date().toISOString()
    };

    await this.writeSettings(settings);
    logger.info(`Registered wrapped craft for plugin: ${pluginName}`);
  }

  /**
   * Update plugin dependencies tracking
   *
   * @param pluginName - Name of the plugin
   * @param dependencies - Array of dependency names
   * @throws Error if plugin not found
   */
  async updatePluginDependencies(
    pluginName: string,
    dependencies: string[]
  ): Promise<void> {
    const settings = await this.readSettings();

    if (!settings.plugins[pluginName]) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }

    settings.plugins[pluginName].dependencies = dependencies;
    await this.writeSettings(settings);
  }

  /**
   * Mark plugin as dependency of another plugin
   *
   * @param pluginName - Name of the plugin
   * @param isDependency - Whether to mark as dependency (default: true)
   * @throws Error if plugin not found
   */
  async markAsDependency(pluginName: string, isDependency: boolean = true): Promise<void> {
    const settings = await this.readSettings();

    if (!settings.plugins[pluginName]) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }

    settings.plugins[pluginName].isDependency = isDependency;
    await this.writeSettings(settings);
  }

  /**
   * Get all plugins that are dependencies (not directly installed)
   *
   * @returns Array of dependency plugin configurations
   */
  async getDependencyPlugins(): Promise<PluginConfig[]> {
    const settings = await this.readSettings();
    return Object.values(settings.plugins).filter(p => p.isDependency);
  }

  /**
   * Get all directly installed plugins (not dependencies)
   *
   * @returns Array of directly installed plugin configurations
   */
  async getDirectPlugins(): Promise<PluginConfig[]> {
    const settings = await this.readSettings();
    return Object.values(settings.plugins).filter(p => !p.isDependency);
  }

  /**
   * Check if settings file exists
   *
   * @returns True if settings file exists
   */
  async exists(): Promise<boolean> {
    return fs.pathExists(this.settingsPath);
  }

  /**
   * Create default settings structure
   *
   * @returns Default Claude settings object
   * @private
   */
  private createDefaultSettings(): ClaudeSettings {
    return {
      version: '1.0.0',
      installPath: this.installDir,
      updatedAt: new Date().toISOString(),
      plugins: {}
    };
  }

  /**
   * Validate settings structure
   *
   * @returns Validation result with valid flag and error messages
   */
  async validateSettings(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      const settings = await this.readSettings();

      // Check version
      if (!settings.version) {
        errors.push('Missing version field');
      }

      // Check plugins
      if (!settings.plugins || typeof settings.plugins !== 'object') {
        errors.push('Invalid plugins structure');
      } else {
        // Validate each plugin
        for (const [name, config] of Object.entries(settings.plugins)) {
          if (!config.name || !config.version || !config.type || !config.installPath) {
            errors.push(`Invalid plugin config for: ${name}`);
          }
        }
      }

      // Check MCP servers if present
      if (settings.mcpServers) {
        for (const [name, server] of Object.entries(settings.mcpServers)) {
          if (!server.type) {
            errors.push(`Invalid MCP server config for: ${name}`);
          }
          if (server.type === 'stdio' && !server.command) {
            errors.push(`Missing command for stdio MCP server: ${name}`);
          }
          if (server.type === 'sse' && !server.url) {
            errors.push(`Missing URL for sse MCP server: ${name}`);
          }
        }
      }

      return {
        valid: errors.length === 0,
        errors
      };
    } catch (error: any) {
      errors.push(`Failed to read settings: ${error.message}`);
      return { valid: false, errors };
    }
  }
}

// Export singleton instance
export const settingsManager = new SettingsManager();

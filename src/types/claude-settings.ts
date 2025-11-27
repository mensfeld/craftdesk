/**
 * Type definitions for .claude/settings.json
 *
 * This file manages Claude Code's plugin system configuration,
 * including MCP server registration and plugin lifecycle.
 */

/**
 * MCP (Model Context Protocol) Server Configuration
 * Used to register external tools and services with Claude
 */
export interface MCPServerConfig {
  /** Server type - stdio for local processes, sse for server-sent events */
  type: 'stdio' | 'sse';

  /** Command to execute (for stdio type) */
  command?: string;

  /** Command arguments */
  args?: string[];

  /** Environment variables */
  env?: Record<string, string>;

  /** Server URL (for sse type) */
  url?: string;
}

/**
 * Configuration for individual crafts wrapped as plugins
 */
export interface WrappedCraftConfig {
  /** Original craft type */
  type: 'skill' | 'agent' | 'command' | 'hook';

  /** Path to original craft relative to .claude/ */
  originalPath: string;

  /** Expose craft capabilities as tools */
  exposeAsTools?: boolean;

  /** Expose craft via MCP server */
  exposeAsMCP?: boolean;

  /** When the craft was wrapped */
  wrappedAt?: string;
}

/**
 * Plugin configuration in Claude settings
 */
export interface PluginConfig {
  /** Plugin name (author/name format) */
  name: string;

  /** Plugin version */
  version: string;

  /** Plugin type - native plugin or wrapped craft */
  type: 'plugin' | 'wrapped';

  /** Whether plugin is currently enabled */
  enabled: boolean;

  /** Installation path relative to .claude/ */
  installPath: string;

  /** Installation timestamp */
  installedAt: string;

  /** MCP server configuration (if plugin provides MCP tools) */
  mcp?: MCPServerConfig;

  /** Wrapped craft metadata (if type is 'wrapped') */
  wrappedCraft?: WrappedCraftConfig;

  /** Plugin dependencies (for tracking) */
  dependencies?: string[];

  /** Whether this plugin was installed as a dependency */
  isDependency?: boolean;
}

/**
 * Complete .claude/settings.json structure
 */
export interface ClaudeSettings {
  /** Settings file format version */
  version: string;

  /** Path to .claude directory */
  installPath: string;

  /** Last updated timestamp */
  updatedAt: string;

  /** Registered plugins */
  plugins: Record<string, PluginConfig>;

  /** MCP server registry (global servers not tied to specific plugins) */
  mcpServers?: Record<string, MCPServerConfig>;

  /** Plugin lifecycle hooks */
  hooks?: {
    /** Run after plugin installation */
    postInstall?: string[];

    /** Run before plugin removal */
    preRemove?: string[];
  };
}

/**
 * Plugin manifest structure (.claude-plugin/plugin.json)
 * Based on official Claude Code plugin specification
 */
export interface PluginManifest {
  /** Plugin name (required) - kebab-case, unique identifier */
  name: string;

  /** Plugin version - semantic versioning (e.g., "1.0.0") */
  version?: string;

  /** Plugin description */
  description?: string;

  /** Plugin author - can be string or object */
  author?: string | {
    name: string;
    email?: string;
    url?: string;
  };

  /** Homepage URL */
  homepage?: string;

  /** Repository URL */
  repository?: string;

  /** License */
  license?: string;

  /** Keywords for discovery/categorization */
  keywords?: string[];

  /** Commands directory path (default: "commands/") */
  commands?: string | string[];

  /** Agents directory path (default: "agents/") */
  agents?: string | string[];

  /** Hooks configuration path (default: "hooks/hooks.json") */
  hooks?: string | object;

  /** MCP servers configuration (default: ".mcp.json") */
  mcpServers?: string | Record<string, MCPServerConfig>;

  /** CraftDesk-specific: Components listing (not part of official spec) */
  components?: {
    skills?: string[];
    agents?: string[];
    commands?: string[];
    hooks?: string[];
  };

  /** CraftDesk-specific: Plugin dependencies (not part of official spec) */
  dependencies?: Record<string, string>;

  /** CraftDesk-specific: Peer dependencies (not part of official spec) */
  peerDependencies?: Record<string, string>;

  /** CraftDesk-specific: Lifecycle scripts (not part of official spec) */
  scripts?: {
    postInstall?: string;
    preRemove?: string;
  };

  /** Additional metadata */
  [key: string]: any;
}

/**
 * Default settings structure
 */
export const DEFAULT_CLAUDE_SETTINGS: ClaudeSettings = {
  version: '1.0.0',
  installPath: '.claude',
  updatedAt: new Date().toISOString(),
  plugins: {}
};

/**
 * Main configuration file for CraftDesk projects (craftdesk.json)
 * Similar to package.json but for Claude skills, agents, commands, and plugins
 */
export interface CraftDeskJson {
  /** Project name in author/name format */
  name: string;

  /** Semantic version of the project */
  version: string;

  /** Type of craft being defined */
  type?: 'skill' | 'agent' | 'command' | 'hook' | 'plugin';

  /** Human-readable description of the project */
  description?: string;

  /** Author name or identifier */
  author?: string;

  /** Software license (e.g., MIT, Apache-2.0) */
  license?: string;

  /** Homepage URL for the project */
  homepage?: string;

  /** Repository information */
  repository?: {
    /** Version control type (e.g., git) */
    type: string;
    /** Repository URL */
    url: string;
  };

  /** Keywords for discovery and categorization */
  keywords?: string[];

  /** Production dependencies - can be simple version strings or detailed configuration objects */
  dependencies?: Record<string, string | DependencyConfig>;

  /** Development-only dependencies */
  devDependencies?: Record<string, string | DependencyConfig>;

  /** Dependencies that must be manually installed by the user */
  peerDependencies?: Record<string, string | DependencyConfig>;

  /** Dependencies that are not required for core functionality */
  optionalDependencies?: Record<string, string | DependencyConfig>;

  /** Registry configuration for dependency resolution */
  registries?: Record<string, RegistryConfig>;

  /** Command definitions */
  commands?: Record<string, string | CommandConfig>;

  /** Hook definitions mapping events to command arrays */
  hooks?: Record<string, string[]>;

  /** Index signature to allow dynamic property access for future extensibility */
  [key: string]: unknown;
}

/**
 * Configuration for a dependency with various resolution strategies
 * Supports version ranges, git repositories, and registry-based resolution
 */
export interface DependencyConfig {
  /** Semantic version or version range (optional for git dependencies) */
  version?: string;

  /** Registry name (from registries section) or direct URL */
  registry?: string;

  /** Git repository URL for git-based dependencies */
  git?: string;

  /** Git branch to use (defaults to main/master) */
  branch?: string;

  /** Git tag to checkout */
  tag?: string;

  /** Specific git commit hash */
  commit?: string;

  /** Subdirectory path within the repository */
  path?: string;

  /** Direct file path within the repository */
  file?: string;
}

/**
 * Plugin-specific dependency configuration
 * Extends DependencyConfig with plugin-specific options
 */
export interface PluginDependencyConfig extends DependencyConfig {
  /** Expose plugin capabilities as tools */
  exposeAsTools?: boolean;

  /** Expose plugin via MCP server */
  exposeAsMCP?: boolean;

  /** Auto-wrap individual craft as plugin */
  wrapAsPlugin?: boolean;
}

/**
 * Configuration for a dependency registry
 * Defines how to resolve dependencies from a specific source
 */
export interface RegistryConfig {
  /** Base URL of the registry */
  url: string;

  /** Optional scope like "@company" for scoped packages */
  scope?: string;

  /** Optional auth token (should prefer ~/.craftrc for security) */
  auth?: string;
}

/**
 * Configuration for a command
 * Associates a command with a specific version and optional settings
 */
export interface CommandConfig {
  /** Command version */
  version: string;

  /** Command-specific configuration options */
  config?: Record<string, unknown>;
}
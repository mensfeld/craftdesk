export interface CraftDeskJson {
  name: string;
  version: string;
  type?: 'skill' | 'agent' | 'command' | 'hook';
  description?: string;
  author?: string;
  license?: string;
  homepage?: string;
  repository?: {
    type: string;
    url: string;
  };
  keywords?: string[];

  // Dependencies - type-agnostic (skills, agents, commands, hooks can all depend on each other)
  // Can be simple string versions or objects with version and registry
  dependencies?: Record<string, string | DependencyConfig>;
  devDependencies?: Record<string, string | DependencyConfig>;
  peerDependencies?: Record<string, string | DependencyConfig>;
  optionalDependencies?: Record<string, string | DependencyConfig>;

  // Registry configuration (optional, in-file configuration)
  registries?: Record<string, RegistryConfig>;

  // Commands and hooks
  commands?: Record<string, string | CommandConfig>;
  hooks?: Record<string, string[]>;

  // Index signature to allow dynamic property access
  [key: string]: any;
}

export interface DependencyConfig {
  version?: string;  // Optional for git dependencies
  registry?: string;  // Can be a registry name (from registries section) or direct URL
  git?: string;       // Git repository URL
  branch?: string;    // Git branch (default: main/master)
  tag?: string;       // Git tag
  commit?: string;    // Git commit hash
  path?: string;      // Subdirectory path within the repository
  file?: string;      // Direct file path within the repository
}

export interface RegistryConfig {
  url: string;
  scope?: string;  // Optional scope like "@company"
  auth?: string;   // Optional auth token (though better in ~/.craftrc for security)
}

export interface CommandConfig {
  version: string;
  config?: Record<string, any>;
}
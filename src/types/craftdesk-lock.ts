/**
 * Lockfile format for CraftDesk (craftdesk.lock)
 * Ensures reproducible installations by recording exact resolved versions
 */
export interface CraftDeskLock {
  /** CraftDesk project version */
  version: string;

  /** Lockfile format version */
  lockfileVersion: number;

  /** ISO timestamp of when the lockfile was generated */
  generatedAt: string;

  /** Map of craft names to their resolved lock entries */
  crafts: Record<string, LockEntry>;

  /** Dependency tree showing parent-child relationships */
  tree?: DependencyTree;

  /** Plugin dependency tree showing plugin-specific relationships */
  pluginTree?: PluginDependencyTree;

  /** Installation metadata and statistics */
  metadata?: {
    /** Total number of crafts installed */
    totalCrafts: number;
    /** Total number of plugins installed */
    totalPlugins?: number;
    /** Total installation size as a human-readable string */
    totalSize: string;
    /** Path where crafts are installed */
    installPath: string;
  };
}

/**
 * Lockfile entry for a single craft
 * Records the exact resolved version and source information
 */
export interface LockEntry {
  /** Resolved semantic version */
  version: string;

  /** Download URL or git repository URL */
  resolved: string;

  /** SHA-256 hash for registry downloads or git commit hash */
  integrity: string;

  /** Type of craft */
  type: 'skill' | 'agent' | 'command' | 'hook' | 'plugin';

  /** Author identifier */
  author?: string;

  /** Registry URL where the craft was resolved */
  registry?: string;

  /** Scope if the craft is scoped */
  scope?: string;

  /** Dependencies of this craft mapped to their versions */
  dependencies?: Record<string, string>;

  /** Installation method */
  installedAs?: 'plugin' | 'dependency' | 'direct' | 'wrapped';

  /** Plugin that wraps this craft (if installedAs is 'wrapped') */
  wrappedBy?: string;

  /** Git repository URL for git-based installations */
  git?: string;

  /** Git branch used */
  branch?: string;

  /** Git tag used */
  tag?: string;

  /** Resolved git commit hash */
  commit?: string;

  /** Subdirectory path within repository */
  path?: string;

  /** Direct file path within repository */
  file?: string;
}

/**
 * Recursive dependency tree structure
 * Shows hierarchical relationships between crafts
 */
export interface DependencyTree {
  /** Maps craft names to their dependencies or a "(shared)" marker */
  [key: string]: {
    /** Nested dependencies of this craft */
    dependencies?: DependencyTree;
  } | string;
}

/**
 * Plugin dependency tree
 * Tracks which dependencies belong to which plugins
 */
export interface PluginDependencyTree {
  [pluginName: string]: {
    /** Plugin version */
    version: string;

    /** Dependencies of this plugin */
    dependencies?: string[];

    /** Whether this plugin was installed as a dependency of another plugin */
    isDependency?: boolean;

    /** Parent plugin (if this is a transitive dependency) */
    requiredBy?: string[];
  };
}
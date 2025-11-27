export interface CraftDeskLock {
  version: string;
  lockfileVersion: number;
  generatedAt: string;

  crafts: Record<string, LockEntry>;
  tree?: DependencyTree;

  /** Plugin dependency tree (shows plugin → dependencies relationships) */
  pluginTree?: PluginDependencyTree;

  metadata?: {
    totalCrafts: number;
    totalPlugins?: number;
    totalSize: string;
    installPath: string;
  };
}

export interface LockEntry {
  version: string;
  resolved: string;  // Download URL or git URL
  integrity: string; // SHA-256 hash (or commit hash for git)
  type: 'skill' | 'agent' | 'command' | 'hook' | 'plugin';
  author?: string;
  registry?: string;
  scope?: string;
  dependencies?: Record<string, string>;

  /** How this craft was installed */
  installedAs?: 'plugin' | 'dependency' | 'direct' | 'wrapped';

  /** If this is a wrapped craft, reference to the plugin wrapper */
  wrappedBy?: string;

  // Git source fields
  git?: string;       // Git repository URL
  branch?: string;    // Git branch
  tag?: string;       // Git tag
  commit?: string;    // Git commit hash (resolved)
  path?: string;      // Subdirectory path within repository
  file?: string;      // Direct file path within repository
}

export interface DependencyTree {
  [key: string]: {
    dependencies?: DependencyTree;
  } | string; // String for "(shared)" marker
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
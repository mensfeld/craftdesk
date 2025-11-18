export interface CraftDeskLock {
  version: string;
  lockfileVersion: number;
  generatedAt: string;

  crafts: Record<string, LockEntry>;
  tree?: DependencyTree;
  metadata?: {
    totalCrafts: number;
    totalSize: string;
    installPath: string;
  };
}

export interface LockEntry {
  version: string;
  resolved: string;  // Download URL or git URL
  integrity: string; // SHA-256 hash (or commit hash for git)
  type: 'skill' | 'agent' | 'command' | 'hook';
  author?: string;
  registry?: string;
  scope?: string;
  dependencies?: Record<string, string>;

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
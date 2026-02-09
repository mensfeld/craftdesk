/**
 * Type definitions for multi-agent sync functionality
 */

/**
 * Configuration for multi-agent sync in craftdesk.json
 */
export interface MultiAgentConfig {
  /** Enable multi-agent sync */
  enabled: boolean;

  /** Canonical location for source of truth */
  canonical: string;

  /** Target directories to sync to */
  targets: string[];

  /** Auto-sync on install/update */
  autoSync?: boolean;
}

/**
 * Detected AI coding assistant configuration
 */
export interface AgentConfig {
  /** Agent identifier (e.g., 'claude', 'cursor') */
  name: string;

  /** Display name for user-facing messages */
  displayName: string;

  /** Directory where this agent stores crafts */
  skillsDir: string;

  /** Whether this agent is enabled for sync */
  enabled: boolean;

  /** Whether this agent directory was auto-detected */
  detected: boolean;
}

/**
 * Sync status for a craft across multiple agent directories
 */
export interface SyncStatus {
  /** Craft name */
  craftName: string;

  /** Whether all copies are in sync */
  inSync: boolean;

  /** Canonical location checksum */
  canonicalChecksum: string;

  /** Locations that are out of sync */
  outOfSync: SyncLocation[];

  /** Locations that are in sync */
  inSyncLocations: string[];
}

/**
 * Location that is out of sync
 */
export interface SyncLocation {
  /** Path to the location */
  path: string;

  /** Reason for being out of sync */
  reason: 'missing' | 'modified' | 'checksum-mismatch';

  /** Expected checksum */
  expectedChecksum?: string;

  /** Actual checksum */
  actualChecksum?: string;
}

/**
 * Result of a sync operation
 */
export interface SyncResult {
  /** Craft name that was synced */
  craftName: string;

  /** Locations successfully synced to */
  synced: string[];

  /** Locations that failed to sync */
  failed: Array<{
    path: string;
    error: string;
  }>;
}

/**
 * Agent detection result
 */
export interface AgentDetectionResult {
  /** All detected agents */
  detected: AgentConfig[];

  /** Currently enabled agents */
  enabled: AgentConfig[];

  /** Suggested agents to enable */
  suggested: AgentConfig[];
}

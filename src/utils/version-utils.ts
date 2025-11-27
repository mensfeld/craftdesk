/**
 * Utilities for version comparison and semantic versioning operations
 * Supports parsing, comparing, and sorting semver version strings
 */

/**
 * Parses a semantic version string into its components
 *
 * @param version - Version string to parse (e.g., "1.2.3" or "v1.2.3")
 * @returns Object with major, minor, and patch numbers, or null if invalid
 */
export function parseSemver(version: string): { major: number; minor: number; patch: number } | null {
  const match = version.match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10)
  };
}

/**
 * Compares two semantic version strings
 *
 * @param a - First version to compare
 * @param b - Second version to compare
 * @returns -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareSemver(a: string, b: string): number {
  const aParsed = parseSemver(a);
  const bParsed = parseSemver(b);

  if (!aParsed || !bParsed) {
    // Fall back to string comparison
    return a.localeCompare(b);
  }

  if (aParsed.major !== bParsed.major) {
    return aParsed.major - bParsed.major;
  }
  if (aParsed.minor !== bParsed.minor) {
    return aParsed.minor - bParsed.minor;
  }
  return aParsed.patch - bParsed.patch;
}

/**
 * Checks if the latest version is newer than the current version
 *
 * @param current - Current version string
 * @param latest - Latest version string
 * @returns True if latest is newer than current
 */
export function isNewerVersion(current: string, latest: string): boolean {
  return compareSemver(latest, current) > 0;
}

/**
 * Sorts an array of version tags by semantic version (newest first)
 *
 * @param tags - Array of version tag strings to sort
 * @returns New array sorted in descending order (newest to oldest)
 */
export function sortTagsBySemver(tags: string[]): string[] {
  return [...tags].sort((a, b) => {
    const aParsed = parseSemver(a);
    const bParsed = parseSemver(b);

    if (aParsed && bParsed) {
      // Both are valid semver - sort descending (newest first)
      if (aParsed.major !== bParsed.major) return bParsed.major - aParsed.major;
      if (aParsed.minor !== bParsed.minor) return bParsed.minor - aParsed.minor;
      return bParsed.patch - aParsed.patch;
    }

    // Fall back to string comparison (reverse for newest first)
    return b.localeCompare(a);
  });
}

/**
 * Determines the type of update between two versions
 *
 * @param current - Current version string
 * @param latest - Latest version string
 * @returns Update type ('major', 'minor', or 'patch') or undefined if not parseable
 */
export function getUpdateType(current: string, latest: string): 'major' | 'minor' | 'patch' | undefined {
  const currentParsed = parseSemver(current);
  const latestParsed = parseSemver(latest);

  if (!currentParsed || !latestParsed) return undefined;

  if (latestParsed.major > currentParsed.major) return 'major';
  if (latestParsed.minor > currentParsed.minor) return 'minor';
  if (latestParsed.patch > currentParsed.patch) return 'patch';

  return undefined;
}

/**
 * Pads a string to the right with spaces
 *
 * @param str - String to pad
 * @param len - Desired total length
 * @returns Padded string
 */
export function padRight(str: string, len: number): string {
  return str.padEnd(len);
}

/**
 * Wraps text with ANSI color codes for terminal output
 *
 * @param text - Text to colorize
 * @param color - Color to apply
 * @returns Text wrapped with ANSI color codes
 */
export function colorize(text: string, color: 'red' | 'yellow' | 'green' | 'reset'): string {
  const colors = {
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    reset: '\x1b[0m'
  };

  return `${colors[color]}${text}${colors.reset}`;
}

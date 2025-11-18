import fs from 'fs-extra';
import path from 'path';
import { CraftDeskJson } from '../types/craftdesk-json';
import { logger } from '../utils/logger';

/**
 * Manages configuration for the CraftDesk CLI
 *
 * Handles reading craftdesk.json, resolving registry URLs for crafts,
 * managing authentication tokens, and determining installation paths.
 *
 * @example
 * ```typescript
 * const configManager = new ConfigManager();
 * const registry = await configManager.getRegistryForCraft('@company/auth');
 * const token = await configManager.getAuthToken('company-private');
 * ```
 */
export class ConfigManager {
  private craftDeskJson: CraftDeskJson | null = null;

  /**
   * Gets the appropriate registry URL for a given craft
   *
   * Resolution order:
   * 1. Scoped registry matching the craft scope (e.g., @company/craft -> company registry)
   * 2. Default registry from craftdesk.json
   * 3. Global fallback (https://craftdesk.ai)
   *
   * @param craftName - The name of the craft to resolve
   * @returns The registry URL to use for this craft
   *
   * @example
   * ```typescript
   * // Scoped craft with configured registry
   * const url = await configManager.getRegistryForCraft('@company/auth');
   * // Returns: 'https://company.internal'
   *
   * // Regular craft
   * const url = await configManager.getRegistryForCraft('ruby-on-rails');
   * // Returns: 'https://craftdesk.ai' (or default from config)
   * ```
   */
  async getRegistryForCraft(craftName: string): Promise<string> {
    const craftDesk = await this.getCraftDeskJson();

    if (!craftDesk) {
      // Default registry if no craftdesk.json exists
      return 'https://craftdesk.ai';
    }

    // Check if it's a scoped craft and has a configured registry
    if (craftName.startsWith('@') && craftDesk.registries) {
      const scope = craftName.split('/')[0];

      // Look for a registry with matching scope
      for (const [name, registry] of Object.entries(craftDesk.registries)) {
        if (registry.scope === scope) {
          return registry.url;
        }
      }
    }

    // Check if there's a default registry configured
    if (craftDesk.registries?.default) {
      return craftDesk.registries.default.url;
    }

    // Final fallback
    return 'https://craftdesk.ai';
  }

  /**
   * Retrieves authentication token for a registry from environment variables
   *
   * Looks for tokens in environment variables with the pattern:
   * CRAFTDESK_AUTH_{REGISTRY_NAME_UPPERCASE}
   *
   * Hyphens in registry names are converted to underscores.
   *
   * @param registryName - The name of the registry from craftdesk.json
   * @returns The auth token if found, null otherwise
   *
   * @example
   * ```typescript
   * // For registry named 'company-private', looks for CRAFTDESK_AUTH_COMPANY_PRIVATE
   * const token = await configManager.getAuthToken('company-private');
   *
   * // Usage in shell:
   * // export CRAFTDESK_AUTH_COMPANY_PRIVATE=token_abc123
   * ```
   */
  async getAuthToken(registryName: string): Promise<string | null> {
    const craftDesk = await this.getCraftDeskJson();

    if (!craftDesk?.registries?.[registryName]) {
      return null;
    }

    // Auth tokens should be in environment variables for security
    // e.g., CRAFTDESK_AUTH_COMPANY_PRIVATE
    const envVar = `CRAFTDESK_AUTH_${registryName.toUpperCase().replace(/-/g, '_')}`;
    return process.env[envVar] || null;
  }

  /**
   * Returns the installation path for crafts
   *
   * All crafts are installed to the .claude directory in the project root.
   *
   * @returns The relative path to the installation directory
   */
  getInstallPath(): string {
    // Always use .claude directory in project root
    return '.claude';
  }

  /**
   * Reads and caches the craftdesk.json file from the current working directory
   *
   * The file is cached after the first read for performance. Returns null if
   * the file doesn't exist or contains invalid JSON.
   *
   * @returns The parsed craftdesk.json content, or null if not found/invalid
   *
   * @example
   * ```typescript
   * const config = await configManager.getCraftDeskJson();
   * if (config) {
   *   console.log(`Project: ${config.name}@${config.version}`);
   * }
   * ```
   */
  async getCraftDeskJson(): Promise<CraftDeskJson | null> {
    if (this.craftDeskJson) {
      return this.craftDeskJson;
    }

    try {
      const craftDeskPath = path.join(process.cwd(), 'craftdesk.json');
      const content = await fs.readFile(craftDeskPath, 'utf-8');
      this.craftDeskJson = JSON.parse(content);
      return this.craftDeskJson;
    } catch (error) {
      return null;
    }
  }
}

export const configManager = new ConfigManager();
import fs from 'fs-extra';
import path from 'path';
import { BaseConverter } from '../converters/base-converter';
import { CursorConverter, CursorLegacyConverter } from '../converters/cursor-converter';
import { ContinueConverter } from '../converters/continue-converter';
import type {
  ConversionOptions,
  ConversionResult,
  CraftContent,
  SupportedFormat
} from '../types/converter';
import type { CraftDeskJson } from '../types/craftdesk-json';

/**
 * Service for converting crafts between formats
 */
export class ConverterService {
  /**
   * Create a converter instance for the specified format
   *
   * @param options - Conversion options
   * @returns Converter instance
   * @throws Error if format is not supported
   */
  private createConverter(options: ConversionOptions): BaseConverter {
    switch (options.format) {
      case 'cursor':
        return new CursorConverter(options);

      case 'cursor-legacy':
        return new CursorLegacyConverter(options);

      case 'continue':
        return new ContinueConverter(options);

      default:
        throw new Error(`Unsupported format: ${options.format}`);
    }
  }

  /**
   * Convert a craft from a directory
   *
   * @param craftDir - Directory containing the craft
   * @param options - Conversion options
   * @returns Conversion result
   */
  async convertFromDirectory(
    craftDir: string,
    options: ConversionOptions
  ): Promise<ConversionResult> {
    // Load craft metadata
    const manifestPath = path.join(craftDir, 'craftdesk.json');
    if (!await fs.pathExists(manifestPath)) {
      throw new Error(`No craftdesk.json found in ${craftDir}`);
    }

    const manifest: CraftDeskJson = await fs.readJSON(manifestPath);

    // Load main content file
    const markerFiles = ['SKILL.md', 'AGENT.md', 'COMMAND.md', 'HOOK.md', 'PLUGIN.md', 'COLLECTION.md'];
    let mainContent = '';
    let foundMarker = false;

    for (const markerFile of markerFiles) {
      const markerPath = path.join(craftDir, markerFile);
      if (await fs.pathExists(markerPath)) {
        mainContent = await fs.readFile(markerPath, 'utf-8');
        foundMarker = true;
        break;
      }
    }

    if (!foundMarker) {
      throw new Error(`No marker file (SKILL.md, AGENT.md, etc.) found in ${craftDir}`);
    }

    // Build craft content
    const craftContent: CraftContent = {
      name: manifest.name,
      type: manifest.type || 'skill',
      description: manifest.description,
      mainContent,
      sections: {},
      examples: []
    };

    // Parse sections and examples
    const converter = this.createConverter(options);
    craftContent.sections = (converter as any).extractAllSections(mainContent);
    craftContent.examples = (converter as any).extractExamples(mainContent);

    // Convert
    return await converter.convertWithValidation(craftContent);
  }

  /**
   * Convert and write output files
   * @param craftDir - Directory containing the craft
   * @param options - Conversion options
   * @param outputDir - Optional output directory
   * @returns Conversion result
   */
  async convertAndWrite(
    craftDir: string,
    options: ConversionOptions,
    outputDir?: string
  ): Promise<ConversionResult> {
    const result = await this.convertFromDirectory(craftDir, options);

    if (!result.success) {
      return result;
    }

    // Determine output directory
    const converter = this.createConverter(options);
    const finalOutputDir = outputDir || converter.getDefaultOutputDir();

    // Ensure output directory exists
    await fs.ensureDir(finalOutputDir);

    // Write files
    for (const file of result.files) {
      const filePath = path.join(finalOutputDir, file.filePath);
      await fs.ensureDir(path.dirname(filePath));

      // Handle merge mode
      if (options.mergeMode === 'skip' && await fs.pathExists(filePath)) {
        result.warnings.push(`Skipped existing file: ${file.filePath}`);
        continue;
      }

      if (options.mergeMode === 'append' && await fs.pathExists(filePath)) {
        const existing = await fs.readFile(filePath, 'utf-8');
        await fs.writeFile(filePath, existing + '\n\n' + file.content, 'utf-8');
        result.warnings.push(`Appended to existing file: ${file.filePath}`);
      } else {
        await fs.writeFile(filePath, file.content, 'utf-8');
      }
    }

    return result;
  }

  /**
   * Convert all installed crafts
   * @param claudeDir - Claude directory path
   * @param options - Conversion options
   * @param outputDir - Optional output directory
   * @returns Array of craft names with conversion results
   */
  async convertAllInstalled(
    claudeDir: string,
    options: ConversionOptions,
    outputDir?: string
  ): Promise<Array<{ craft: string; result: ConversionResult }>> {
    const results: Array<{ craft: string; result: ConversionResult }> = [];

    // Find all craft directories
    const craftTypes = ['skills', 'agents', 'commands', 'hooks', 'plugins', 'collections'];

    for (const typeDir of craftTypes) {
      const typePath = path.join(claudeDir, typeDir);
      if (!await fs.pathExists(typePath)) {
        continue;
      }

      const crafts = await fs.readdir(typePath);

      for (const craftName of crafts) {
        const craftDir = path.join(typePath, craftName);
        const stat = await fs.stat(craftDir);

        if (!stat.isDirectory()) {
          continue;
        }

        try {
          const result = await this.convertAndWrite(craftDir, options, outputDir);
          results.push({ craft: craftName, result });
        } catch (error) {
          results.push({
            craft: craftName,
            result: {
              success: false,
              files: [],
              errors: [error instanceof Error ? error.message : String(error)],
              warnings: [],
              sourceFormat: 'claude',
              targetFormat: options.format
            }
          });
        }
      }
    }

    return results;
  }

  /**
   * Get list of supported formats
   * @returns Array of supported formats with descriptions
   */
  getSupportedFormats(): Array<{ format: SupportedFormat; description: string }> {
    return [
      { format: 'cursor', description: 'Cursor .mdc format in .cursor/rules/' },
      { format: 'cursor-legacy', description: 'Legacy .cursorrules plain text format' },
      { format: 'continue', description: 'Continue.dev prompts in .continue/prompts/' }
    ];
  }
}

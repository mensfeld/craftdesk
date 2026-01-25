import type {
  CraftContent,
  ConvertedContent,
  ConversionOptions,
  ConversionResult,
  ConverterMetadata
} from '../types/converter';

/**
 * Base class for format converters
 * Provides common functionality for converting CraftDesk crafts to other formats
 */
export abstract class BaseConverter {
  protected options: ConversionOptions;

  constructor(options: ConversionOptions) {
    this.options = options;
  }

  /**
   * Get metadata about this converter
   */
  abstract getMetadata(): ConverterMetadata;

  /**
   * Convert craft to target format
   * Subclasses must implement this method
   *
   * @param craft - The craft content to convert
   * @returns Array of converted file contents
   */
  abstract convert(craft: CraftContent): Promise<ConvertedContent[]>;

  /**
   * Perform the full conversion with validation and error handling
   */
  async convertWithValidation(craft: CraftContent): Promise<ConversionResult> {
    const metadata = this.getMetadata();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate craft type is supported
      if (!metadata.supportedTypes.includes(craft.type)) {
        errors.push(
          `Craft type '${craft.type}' is not supported for ${metadata.targetFormat} format. ` +
          `Supported types: ${metadata.supportedTypes.join(', ')}`
        );
        return {
          success: false,
          files: [],
          errors,
          warnings,
          sourceFormat: 'claude',
          targetFormat: metadata.targetFormat
        };
      }

      // Perform conversion
      const files = await this.convert(craft);

      // Validate output
      if (files.length === 0) {
        warnings.push('Conversion produced no output files');
      }

      return {
        success: true,
        files,
        errors,
        warnings,
        sourceFormat: 'claude',
        targetFormat: metadata.targetFormat
      };
    } catch (error) {
      errors.push(`Conversion failed: ${error instanceof Error ? error.message : String(error)}`);
      return {
        success: false,
        files: [],
        errors,
        warnings,
        sourceFormat: 'claude',
        targetFormat: metadata.targetFormat
      };
    }
  }

  /**
   * Extract code examples from markdown content
   */
  protected extractExamples(markdown: string): Array<{ language?: string; code: string; description?: string }> {
    const examples: Array<{ language?: string; code: string; description?: string }> = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(markdown)) !== null) {
      examples.push({
        language: match[1] || undefined,
        code: match[2].trim(),
        description: undefined
      });
    }

    return examples;
  }

  /**
   * Extract a section from markdown by heading
   */
  protected extractSection(markdown: string, headingPattern: RegExp): string | undefined {
    const lines = markdown.split('\n');
    let inSection = false;
    let sectionLines: string[] = [];
    let sectionLevel: number | null = null;

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headingMatch) {
        const level = headingMatch[1].length;
        const title = headingMatch[2].trim();

        if (!inSection && headingPattern.test(title)) {
          // Found the target section
          inSection = true;
          sectionLevel = level;
          continue; // Don't include the heading itself
        } else if (inSection && sectionLevel !== null && level <= sectionLevel) {
          // Reached a heading at same or higher level - end of section
          break;
        }
      }

      if (inSection) {
        sectionLines.push(line);
      }
    }

    return sectionLines.length > 0 ? sectionLines.join('\n').trim() : undefined;
  }

  /**
   * Extract all sections from markdown
   */
  protected extractAllSections(markdown: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const lines = markdown.split('\n');
    let currentSection: string | null = null;
    let currentLines: string[] = [];
    let currentLevel: number | null = null;

    // Skip frontmatter if present
    let startIndex = 0;
    if (lines[0] === '---') {
      const endIndex = lines.findIndex((line, i) => i > 0 && line === '---');
      if (endIndex !== -1) {
        startIndex = endIndex + 1;
      }
    }

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headingMatch) {
        const level = headingMatch[1].length;
        const title = headingMatch[2].trim();

        // Save previous section
        if (currentSection && currentLines.length > 0) {
          sections[currentSection] = currentLines.join('\n').trim();
        }

        // Start new section (only for level 2 headings to avoid nesting issues)
        if (level === 2) {
          currentSection = title.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, '-');
          currentLines = [];
          currentLevel = level;
        } else if (currentSection && currentLevel !== null && level > currentLevel) {
          // This is a subsection, include it in current section
          currentLines.push(line);
        }
      } else if (currentSection) {
        currentLines.push(line);
      }
    }

    // Save last section
    if (currentSection && currentLines.length > 0) {
      sections[currentSection] = currentLines.join('\n').trim();
    }

    return sections;
  }

  /**
   * Clean markdown content by removing certain elements
   */
  protected cleanMarkdown(markdown: string, options: { removeFrontmatter?: boolean } = {}): string {
    let cleaned = markdown;

    // Remove frontmatter
    if (options.removeFrontmatter !== false) {
      cleaned = cleaned.replace(/^---\n[\s\S]*?\n---\n/, '');
    }

    // Trim whitespace
    cleaned = cleaned.trim();

    return cleaned;
  }

  /**
   * Extract best practices from content
   */
  protected extractBestPractices(sections: Record<string, string>): string[] {
    const practices: string[] = [];
    const bestPracticesSection = sections['best-practices'] || sections['production-tips'] || '';

    if (bestPracticesSection) {
      // Extract bullet points
      const lines = bestPracticesSection.split('\n');
      for (const line of lines) {
        const match = line.match(/^[\s-]*\*\*(.+?)\*\*:?\s*(.+)$/);
        if (match) {
          practices.push(`${match[1]}: ${match[2]}`);
        } else if (line.trim().startsWith('-') || line.trim().startsWith('*')) {
          const cleaned = line.trim().replace(/^[-*]\s*/, '');
          if (cleaned) {
            practices.push(cleaned);
          }
        }
      }
    }

    return practices;
  }

  /**
   * Extract common pitfalls/mistakes from content
   */
  protected extractPitfalls(sections: Record<string, string>): Array<{ mistake: string; solution: string }> {
    const pitfalls: Array<{ mistake: string; solution: string }> = [];
    const pitfallsSection = sections['common-pitfalls'] || sections['common-mistakes'] || '';

    if (pitfallsSection) {
      // Look for mistake/solution patterns
      const lines = pitfallsSection.split('\n');
      let currentMistake: string | null = null;

      for (const line of lines) {
        if (line.includes('❌') || line.toLowerCase().includes('mistake:')) {
          currentMistake = line.replace(/^[\s-]*[❌*-]\s*/, '').replace(/\*\*/g, '');
        } else if (currentMistake && (line.includes('✓') || line.toLowerCase().includes('instead:'))) {
          const solution = line.replace(/^[\s-]*[✓*-]\s*/, '').replace(/\*\*/g, '');
          pitfalls.push({ mistake: currentMistake, solution });
          currentMistake = null;
        }
      }
    }

    return pitfalls;
  }

  /**
   * Get default output directory for this converter
   */
  getDefaultOutputDir(): string {
    return this.options.outputDir || this.getMetadata().defaultOutputDir;
  }
}

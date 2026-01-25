import { BaseConverter } from './base-converter';
import type { CraftContent, ConvertedContent, ConverterMetadata } from '../types/converter';

/**
 * Converts CraftDesk crafts to Cursor .mdc format
 * https://docs.cursor.com/context/rules
 */
export class CursorConverter extends BaseConverter {
  /**
   * Get converter metadata
   *
   * @returns Converter metadata
   */
  getMetadata(): ConverterMetadata {
    return {
      name: 'Cursor Converter',
      targetFormat: 'cursor',
      description: 'Converts crafts to Cursor .mdc format in .cursor/rules/',
      defaultOutputDir: '.cursor/rules',
      supportedTypes: ['skill', 'agent', 'command']
    };
  }

  /**
   * Convert craft to Cursor .mdc format
   *
   * @param craft - Craft content to convert
   * @returns Array of converted files
   */
  async convert(craft: CraftContent): Promise<ConvertedContent[]> {
    const files: ConvertedContent[] = [];

    // Extract sections
    const sections = this.extractAllSections(craft.mainContent);

    // Convert to Cursor .mdc format
    const mdcContent = this.buildCursorMdc(craft, sections);

    // Create the .mdc file
    const fileName = `${craft.name}.mdc`;
    files.push({
      filePath: fileName,
      content: mdcContent,
      type: 'rule'
    });

    return files;
  }

  /**
   * Build Cursor .mdc file content
   */
  private buildCursorMdc(craft: CraftContent, sections: Record<string, string>): string {
    const lines: string[] = [];

    // YAML frontmatter
    lines.push('---');
    lines.push(`description: ${craft.description || `Rules for ${craft.name}`}`);

    // Add globs based on craft type and content
    const globs = this.inferGlobs(craft, sections);
    if (globs.length > 0) {
      lines.push(`globs:`);
      globs.forEach(glob => lines.push(`  - "${glob}"`));
    }

    // Always apply for skills, manual for commands
    lines.push(`alwaysApply: ${craft.type === 'skill'}`);
    lines.push('---');
    lines.push('');

    // Title
    lines.push(`# ${this.formatTitle(craft.name)}`);
    lines.push('');

    // Instructions/Overview
    if (sections['instructions'] || craft.description) {
      lines.push('## Overview');
      lines.push('');
      lines.push(sections['instructions'] || craft.description || '');
      lines.push('');
    }

    // Code Patterns
    const patterns = sections['common-patterns'] || sections['patterns'];
    if (patterns) {
      lines.push('## Code Patterns');
      lines.push('');
      lines.push(patterns);
      lines.push('');
    }

    // Examples
    const examples = sections['quick-reference'] || sections['examples'];
    if (examples) {
      lines.push('## Examples');
      lines.push('');
      lines.push(examples);
      lines.push('');
    }

    // Best Practices
    const bestPractices = this.extractBestPractices(sections);
    if (bestPractices.length > 0) {
      lines.push('## Best Practices');
      lines.push('');
      bestPractices.forEach(practice => {
        lines.push(`- ${practice}`);
      });
      lines.push('');
    }

    // Common Pitfalls
    const pitfalls = this.extractPitfalls(sections);
    if (pitfalls.length > 0) {
      lines.push('## Common Mistakes to Avoid');
      lines.push('');
      pitfalls.forEach(({ mistake, solution }) => {
        lines.push(`- ❌ **Mistake**: ${mistake}`);
        lines.push(`  - ✅ **Instead**: ${solution}`);
      });
      lines.push('');
    }

    // Workflows
    const workflows = sections['common-workflows'] || sections['workflows'];
    if (workflows) {
      lines.push('## Common Workflows');
      lines.push('');
      lines.push(workflows);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Infer file globs based on craft content
   */
  private inferGlobs(craft: CraftContent, sections: Record<string, string>): string[] {
    const globs: string[] = [];
    const content = craft.mainContent.toLowerCase();

    // Language-specific globs
    const languagePatterns: Record<string, string[]> = {
      ruby: ['**/*.rb', '**/*.rake', '**/Gemfile', '**/Rakefile'],
      rails: ['**/*.rb', '**/*.erb', '**/*.haml', '**/config/**/*'],
      javascript: ['**/*.js', '**/*.jsx'],
      typescript: ['**/*.ts', '**/*.tsx'],
      python: ['**/*.py'],
      java: ['**/*.java'],
      go: ['**/*.go'],
      rust: ['**/*.rs'],
      php: ['**/*.php'],
      'c++': ['**/*.cpp', '**/*.h', '**/*.hpp'],
      'c#': ['**/*.cs'],
      swift: ['**/*.swift'],
      kotlin: ['**/*.kt'],
      react: ['**/*.jsx', '**/*.tsx'],
      vue: ['**/*.vue'],
      angular: ['**/*.ts', '**/*.html'],
      docker: ['**/Dockerfile', '**/*.dockerfile', '**/docker-compose.yml'],
      kubernetes: ['**/*.yaml', '**/*.yml']
    };

    // Check for language indicators
    for (const [language, patterns] of Object.entries(languagePatterns)) {
      if (content.includes(language) || craft.name.toLowerCase().includes(language)) {
        globs.push(...patterns);
        break; // Only use first match
      }
    }

    // Default to all files if no specific language detected
    if (globs.length === 0) {
      globs.push('**/*');
    }

    return [...new Set(globs)]; // Remove duplicates
  }

  /**
   * Format craft name into readable title
   */
  private formatTitle(name: string): string {
    return name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

/**
 * Converts CraftDesk crafts to legacy Cursor .cursorrules format
 */
export class CursorLegacyConverter extends BaseConverter {
  /**
   * Get converter metadata
   *
   * @returns Converter metadata
   */
  getMetadata(): ConverterMetadata {
    return {
      name: 'Cursor Legacy Converter',
      targetFormat: 'cursor-legacy',
      description: 'Converts crafts to legacy .cursorrules plain text format',
      defaultOutputDir: '.',
      supportedTypes: ['skill', 'agent', 'command']
    };
  }

  /**
   * Convert craft to legacy .cursorrules format
   *
   * @param craft - Craft content to convert
   * @returns Array of converted files
   */
  async convert(craft: CraftContent): Promise<ConvertedContent[]> {
    const files: ConvertedContent[] = [];

    // Extract sections
    const sections = this.extractAllSections(craft.mainContent);

    // Build plain text rules
    const lines: string[] = [];

    lines.push(`# ${this.formatTitle(craft.name)}`);
    lines.push('');

    if (craft.description) {
      lines.push(craft.description);
      lines.push('');
    }

    // Instructions
    if (sections['instructions']) {
      lines.push('## Instructions');
      lines.push('');
      lines.push(sections['instructions']);
      lines.push('');
    }

    // Patterns
    const patterns = sections['common-patterns'] || sections['patterns'];
    if (patterns) {
      lines.push('## Code Patterns');
      lines.push('');
      lines.push(patterns);
      lines.push('');
    }

    // Best Practices
    const bestPractices = this.extractBestPractices(sections);
    if (bestPractices.length > 0) {
      lines.push('## Best Practices');
      lines.push('');
      bestPractices.forEach(practice => {
        lines.push(`- ${practice}`);
      });
      lines.push('');
    }

    // Examples
    const examples = sections['quick-reference'] || sections['examples'];
    if (examples) {
      lines.push('## Examples');
      lines.push('');
      lines.push(examples);
      lines.push('');
    }

    files.push({
      filePath: '.cursorrules',
      content: lines.join('\n'),
      type: 'rule'
    });

    return files;
  }

  private formatTitle(name: string): string {
    return name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

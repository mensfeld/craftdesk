import { BaseConverter } from './base-converter';
import type { CraftContent, ConvertedContent, ConverterMetadata } from '../types/converter';

/**
 * Converts CraftDesk crafts to Continue.dev prompt format
 * https://docs.continue.dev/customize/deep-dives/prompts
 */
export class ContinueConverter extends BaseConverter {
  /**
   * Get converter metadata
   *
   * @returns Converter metadata
   */
  getMetadata(): ConverterMetadata {
    return {
      name: 'Continue Converter',
      targetFormat: 'continue',
      description: 'Converts crafts to Continue.dev prompt format in .continue/prompts/',
      defaultOutputDir: '.continue/prompts',
      supportedTypes: ['skill', 'agent', 'command']
    };
  }

  /**
   * Convert craft to Continue.dev format
   *
   * @param craft - Craft content to convert
   * @returns Array of converted files (prompt + rule)
   */
  async convert(craft: CraftContent): Promise<ConvertedContent[]> {
    const files: ConvertedContent[] = [];

    // Extract sections
    const sections = this.extractAllSections(craft.mainContent);

    // Convert to Continue prompt format
    const promptContent = this.buildContinuePrompt(craft, sections);

    // Create the prompt file
    const fileName = `${craft.name}.md`;
    files.push({
      filePath: fileName,
      content: promptContent,
      type: 'prompt'
    });

    // Also create a rule file if applicable
    if (craft.type === 'skill') {
      const ruleContent = this.buildContinueRule(craft, sections);
      files.push({
        filePath: `${craft.name}-rules.md`,
        content: ruleContent,
        type: 'rule'
      });
    }

    return files;
  }

  /**
   * Build Continue.dev prompt file content
   */
  private buildContinuePrompt(craft: CraftContent, sections: Record<string, string>): string {
    const lines: string[] = [];

    // YAML frontmatter
    lines.push('---');
    lines.push(`name: ${this.formatName(craft.name)}`);
    lines.push(`description: ${craft.description || `Provides guidance for ${craft.name}`}`);
    lines.push('invokable: true');
    lines.push('---');
    lines.push('');

    // Main prompt content
    lines.push(`# ${this.formatTitle(craft.name)}`);
    lines.push('');

    // Context
    if (sections['instructions']) {
      lines.push('## Context');
      lines.push('');
      lines.push(sections['instructions']);
      lines.push('');
    }

    // User's request
    lines.push('## Your Task');
    lines.push('');
    lines.push('Based on the following user input:');
    lines.push('');
    lines.push('{{{ input }}}');
    lines.push('');

    // Quick Start Template
    const quickStart = sections['quick-start-template'] || sections['quick-start'];
    if (quickStart) {
      lines.push('## Quick Start Template');
      lines.push('');
      lines.push('If the user is starting a new project, use this template:');
      lines.push('');
      lines.push(quickStart);
      lines.push('');
    }

    // Common Workflows
    const workflows = sections['common-workflows'] || sections['workflows'];
    if (workflows) {
      lines.push('## Step-by-Step Workflows');
      lines.push('');
      lines.push(workflows);
      lines.push('');
    }

    // Code Patterns
    const patterns = sections['common-patterns'] || sections['patterns'];
    if (patterns) {
      lines.push('## Code Patterns to Follow');
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
      lines.push('Make sure to follow these best practices:');
      lines.push('');
      bestPractices.forEach((practice, index) => {
        lines.push(`${index + 1}. ${practice}`);
      });
      lines.push('');
    }

    // Pitfalls to avoid
    const pitfalls = this.extractPitfalls(sections);
    if (pitfalls.length > 0) {
      lines.push('## Common Mistakes to Avoid');
      lines.push('');
      pitfalls.forEach(({ mistake, solution }) => {
        lines.push(`❌ **Avoid**: ${mistake}`);
        lines.push(`✅ **Instead**: ${solution}`);
        lines.push('');
      });
    }

    // Instructions for AI
    lines.push('## Instructions');
    lines.push('');
    lines.push('Please help the user with their task by:');
    lines.push('');
    lines.push('1. Understanding their specific requirements from the input above');
    lines.push('2. Following the patterns and best practices outlined in this guide');
    lines.push('3. Avoiding the common mistakes listed');
    lines.push('4. Providing clear, working code examples');
    lines.push('5. Explaining your reasoning when making architectural decisions');
    lines.push('');

    // Current file context
    lines.push('## Current Context');
    lines.push('');
    lines.push('Current file being edited:');
    lines.push('```');
    lines.push('{{{ currentFile }}}');
    lines.push('```');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Build Continue.dev rule file content
   * Rules are applied automatically, prompts are invoked manually
   */
  private buildContinueRule(craft: CraftContent, sections: Record<string, string>): string {
    const lines: string[] = [];

    // YAML frontmatter (rules don't have invokable)
    lines.push('---');
    lines.push(`name: ${this.formatName(craft.name)} Rules`);
    lines.push(`description: Automatic rules for ${craft.name}`);
    lines.push('---');
    lines.push('');

    // Title
    lines.push(`# ${this.formatTitle(craft.name)} - Automatic Rules`);
    lines.push('');
    lines.push('These rules are automatically applied when working with relevant files.');
    lines.push('');

    // Code Patterns
    const patterns = sections['common-patterns'] || sections['patterns'];
    if (patterns) {
      lines.push('## Code Patterns');
      lines.push('');
      lines.push('Always follow these patterns:');
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

    // Pitfalls
    const pitfalls = this.extractPitfalls(sections);
    if (pitfalls.length > 0) {
      lines.push('## Avoid These Mistakes');
      lines.push('');
      pitfalls.forEach(({ mistake, solution }) => {
        lines.push(`- ❌ ${mistake}`);
        lines.push(`- ✅ ${solution}`);
        lines.push('');
      });
    }

    return lines.join('\n');
  }

  /**
   * Format craft name for Continue (camelCase for name field)
   */
  private formatName(name: string): string {
    const parts = name.split('-');
    return parts[0] + parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
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

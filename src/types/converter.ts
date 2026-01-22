/**
 * Types for format conversion system
 */

export type SupportedFormat = 'claude' | 'cursor' | 'cursor-legacy' | 'continue';

export interface ConversionOptions {
  /** Target format to convert to */
  format: SupportedFormat;

  /** Output directory (optional, defaults based on format) */
  outputDir?: string;

  /** Whether to merge with existing files or overwrite */
  mergeMode?: 'append' | 'overwrite' | 'skip';

  /** Format-specific options */
  formatOptions?: Record<string, any>;
}

export interface ConvertedContent {
  /** Relative file path where content should be written */
  filePath: string;

  /** File content */
  content: string;

  /** File type */
  type: 'rule' | 'prompt' | 'config';
}

export interface CraftContent {
  /** Craft name */
  name: string;

  /** Craft type */
  type: 'skill' | 'agent' | 'command' | 'hook' | 'plugin' | 'collection';

  /** Craft description */
  description?: string;

  /** Main content (SKILL.md, AGENT.md, etc.) */
  mainContent: string;

  /** Parsed sections from markdown */
  sections: {
    title?: string;
    instructions?: string;
    quickStart?: string;
    workflows?: string;
    patterns?: string;
    examples?: string;
    bestPractices?: string;
    pitfalls?: string;
    references?: string;
    [key: string]: string | undefined;
  };

  /** Code examples extracted from content */
  examples: Array<{
    language?: string;
    code: string;
    description?: string;
  }>;

  /** Additional files in craft directory */
  additionalFiles?: string[];
}

export interface ConversionResult {
  /** Whether conversion succeeded */
  success: boolean;

  /** Converted files */
  files: ConvertedContent[];

  /** Errors that occurred */
  errors: string[];

  /** Warnings */
  warnings: string[];

  /** Source format */
  sourceFormat: SupportedFormat;

  /** Target format */
  targetFormat: SupportedFormat;
}

export interface ConverterMetadata {
  /** Converter name */
  name: string;

  /** Target format */
  targetFormat: SupportedFormat;

  /** Description */
  description: string;

  /** Default output directory */
  defaultOutputDir: string;

  /** Supported source types */
  supportedTypes: Array<'skill' | 'agent' | 'command' | 'hook' | 'plugin' | 'collection'>;
}

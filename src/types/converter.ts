/**
 * Types for format conversion system
 */

/**
 * Supported output formats for conversion
 */
export type SupportedFormat = 'claude' | 'cursor' | 'cursor-legacy' | 'continue';

/**
 * Options for format conversion
 */
export interface ConversionOptions {
  /** Target format to convert to */
  format: SupportedFormat;

  /** Output directory (optional, defaults based on format) */
  outputDir?: string;

  /** Whether to merge with existing files or overwrite */
  mergeMode?: 'append' | 'overwrite' | 'skip';

  /** Format-specific options */
  formatOptions?: Record<string, unknown>;
}

/**
 * Represents converted file content
 */
export interface ConvertedContent {
  /** Relative file path where content should be written */
  filePath: string;

  /** File content */
  content: string;

  /** File type */
  type: 'rule' | 'prompt' | 'config';
}

/**
 * Represents craft content to be converted
 */
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

/**
 * Result of a conversion operation
 */
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

/**
 * Metadata about a converter
 */
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

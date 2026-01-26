import { Command } from 'commander';
import path from 'path';
import fs from 'fs-extra';
import { logger } from '../utils/logger';
import { ConverterService } from '../services/converter';
import type { SupportedFormat, ConversionOptions } from '../types/converter';

/**
 * Create the convert command for format conversion
 *
 * @returns The configured convert command
 */
export function createConvertCommand(): Command {
  const command = new Command('convert');

  command
    .description('Convert crafts to other AI editor formats')
    .argument('[craft-path]', 'Path to craft directory to convert (default: current directory)')
    .option('-t, --to <format>', 'Target format: cursor, cursor-legacy, continue')
    .option('-o, --output <dir>', 'Output directory (default: format-specific default)')
    .option('-a, --all', 'Convert all installed crafts from .claude/ directory')
    .option('--claude-dir <dir>', 'Claude directory path (default: .claude)', '.claude')
    .option('-m, --merge-mode <mode>', 'How to handle existing files: overwrite, append, skip', 'overwrite')
    .option('--list-formats', 'List supported output formats')
    .action(async (craftPath: string | undefined, options: {
      to?: string;
      output?: string;
      all?: boolean;
      claudeDir?: string;
      mergeMode?: string;
      listFormats?: boolean;
    }) => {
      try {
        const converterService = new ConverterService();

        // List formats
        if (options.listFormats) {
          logger.info('Supported output formats:');
          const formats = converterService.getSupportedFormats();
          formats.forEach(({ format, description }) => {
            logger.info(`  ${format.padEnd(20)} - ${description}`);
          });
          return;
        }

        // Validate required options
        if (!options.to) {
          logger.error('Error: --to <format> is required');
          logger.info('Use --list-formats to see available formats');
          process.exit(1);
        }

        // Validate format
        const supportedFormats = converterService.getSupportedFormats().map(f => f.format);
        if (!supportedFormats.includes(options.to as SupportedFormat)) {
          logger.error(`Error: Unsupported format '${options.to}'`);
          logger.info(`Supported formats: ${supportedFormats.join(', ')}`);
          process.exit(1);
        }

        // Build conversion options
        const conversionOptions: ConversionOptions = {
          format: options.to as SupportedFormat,
          outputDir: options.output,
          mergeMode: options.mergeMode as 'overwrite' | 'append' | 'skip' | undefined
        };

        // Convert all installed crafts
        if (options.all) {
          logger.info(`Converting all installed crafts to ${options.to} format...`);

          const claudeDir = path.resolve(process.cwd(), options.claudeDir || '.claude');

          if (!await fs.pathExists(claudeDir)) {
            logger.error(`Error: Claude directory not found: ${claudeDir}`);
            logger.info('Make sure you have crafts installed in .claude/ directory');
            process.exit(1);
          }

          const results = await converterService.convertAllInstalled(
            claudeDir,
            conversionOptions,
            options.output
          );

          // Display results
          const successful = results.filter(r => r.result.success).length;
          const failed = results.filter(r => !r.result.success).length;

          logger.info(`\nConversion complete:`);
          logger.info(`  ✓ ${successful} crafts converted successfully`);
          if (failed > 0) {
            logger.error(`  ✗ ${failed} crafts failed`);
          }

          // Show details for failed conversions
          results.forEach(({ craft, result }) => {
            if (!result.success) {
              logger.error(`\n${craft}:`);
              result.errors.forEach(error => logger.error(`  - ${error}`));
            } else if (result.warnings.length > 0) {
              logger.warn(`\n${craft} (warnings):`);
              result.warnings.forEach(warning => logger.warn(`  - ${warning}`));
            }
          });

          // Show output location
          if (successful > 0) {
            const outputDir = options.output || results[0]?.result.files[0] ?
              path.dirname(results[0].result.files[0].filePath) :
              'default location';
            logger.info(`\nConverted files written to: ${outputDir}`);
          }

          if (failed > 0) {
            process.exit(1);
          }

          return;
        }

        // Convert single craft
        const targetPath = craftPath ? path.resolve(process.cwd(), craftPath) : process.cwd();

        if (!await fs.pathExists(targetPath)) {
          logger.error(`Error: Path not found: ${targetPath}`);
          process.exit(1);
        }

        const stat = await fs.stat(targetPath);
        if (!stat.isDirectory()) {
          logger.error(`Error: Path must be a directory: ${targetPath}`);
          process.exit(1);
        }

        logger.info(`Converting craft to ${options.to} format...`);

        const result = await converterService.convertAndWrite(
          targetPath,
          conversionOptions,
          options.output
        );

        // Display result
        if (result.success) {
          logger.success('✓ Conversion successful');
          logger.info(`\nGenerated ${result.files.length} file(s):`);
          result.files.forEach(file => {
            const outputPath = options.output ?
              path.join(options.output, file.filePath) :
              file.filePath;
            logger.info(`  - ${outputPath} (${file.type})`);
          });

          if (result.warnings.length > 0) {
            logger.warn('\nWarnings:');
            result.warnings.forEach(warning => logger.warn(`  - ${warning}`));
          }
        } else {
          logger.error('✗ Conversion failed');
          logger.error('\nErrors:');
          result.errors.forEach(error => logger.error(`  - ${error}`));

          if (result.warnings.length > 0) {
            logger.warn('\nWarnings:');
            result.warnings.forEach(warning => logger.warn(`  - ${warning}`));
          }

          process.exit(1);
        }
      } catch (error) {
        logger.error(`Error during conversion: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    });

  return command;
}

/**
 * Console logging utility with color support and spinner functionality
 * Provides consistent, formatted output for CLI operations
 */

/** ANSI color codes for terminal output styling */
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

/**
 * Logger class for formatted console output
 * Supports success, error, warning, info, debug, and spinner states
 */
export class Logger {
  /** Current spinner text (null if no spinner is active) */
  private spinnerText: string | null = null;

  /**
   * Logs a success message with a green checkmark
   *
   * @param message - Success message to display
   */
  success(message: string): void {
    console.log(`${colors.green}✓${colors.reset}`, message);
  }

  /**
   * Logs an error message with a red X
   *
   * @param message - Error message to display
   */
  error(message: string): void {
    console.error(`${colors.red}✗${colors.reset}`, message);
  }

  /**
   * Logs a warning message with a yellow exclamation mark
   *
   * @param message - Warning message to display
   */
  warn(message: string): void {
    console.log(`${colors.yellow}!${colors.reset}`, message);
  }

  /**
   * Logs an informational message with a blue arrow
   *
   * @param message - Info message to display
   */
  info(message: string): void {
    console.log(`${colors.blue}→${colors.reset}`, message);
  }

  /**
   * Logs a debug message if DEBUG environment variable is set
   *
   * @param message - Debug message to display
   */
  debug(message: string): void {
    if (process.env.DEBUG) {
      console.log(`${colors.gray}[DEBUG]${colors.reset}`, message);
    }
  }

  /**
   * Starts a spinner with the specified text
   *
   * @param text - Text to display with the spinner
   */
  startSpinner(text: string): void {
    this.spinnerText = text;
    console.log(`${colors.cyan}⋯${colors.reset}`, text);
  }

  /**
   * Updates the current spinner with new text
   *
   * @param text - New text to display
   */
  updateSpinner(text: string): void {
    if (this.spinnerText) {
      this.spinnerText = text;
      console.log('  ', text);
    }
  }

  /**
   * Completes the spinner with a success state
   *
   * @param text - Optional override text (defaults to current spinner text)
   */
  succeedSpinner(text?: string): void {
    if (this.spinnerText) {
      console.log(`${colors.green}✓${colors.reset}`, text || this.spinnerText);
      this.spinnerText = null;
    }
  }

  /**
   * Completes the spinner with a failure state
   *
   * @param text - Optional override text (defaults to current spinner text)
   */
  failSpinner(text?: string): void {
    if (this.spinnerText) {
      console.log(`${colors.red}✗${colors.reset}`, text || this.spinnerText);
      this.spinnerText = null;
    }
  }

  /**
   * Stops the current spinner without completing it
   */
  stopSpinner(): void {
    this.spinnerText = null;
  }

  /**
   * Logs a plain message without formatting
   *
   * @param message - Message to display
   */
  log(message: string): void {
    console.log(message);
  }

  /**
   * Wraps text with bold ANSI formatting
   *
   * @param text - Text to make bold
   * @returns Text wrapped with bold ANSI codes
   */
  bold(text: string): string {
    return `${colors.bold}${text}${colors.reset}`;
  }

  /**
   * Wraps text with dim ANSI formatting
   *
   * @param text - Text to make dim
   * @returns Text wrapped with dim ANSI codes
   */
  dim(text: string): string {
    return `${colors.dim}${text}${colors.reset}`;
  }
}

/** Global logger instance for use throughout the application */
export const logger = new Logger();
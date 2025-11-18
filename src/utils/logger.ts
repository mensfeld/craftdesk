export class Logger {
  private spinnerText: string | null = null;

  success(message: string): void {
    console.log('✓', message);
  }

  error(message: string): void {
    console.error('✗', message);
  }

  warn(message: string): void {
    console.log('⚠', message);
  }

  info(message: string): void {
    console.log('ℹ', message);
  }

  debug(message: string): void {
    if (process.env.DEBUG) {
      console.log('[DEBUG]', message);
    }
  }

  startSpinner(text: string): void {
    this.spinnerText = text;
    console.log('⏳', text);
  }

  updateSpinner(text: string): void {
    if (this.spinnerText) {
      this.spinnerText = text;
      console.log('  ', text);
    }
  }

  succeedSpinner(text?: string): void {
    if (this.spinnerText) {
      console.log('✓', text || this.spinnerText);
      this.spinnerText = null;
    }
  }

  failSpinner(text?: string): void {
    if (this.spinnerText) {
      console.log('✗', text || this.spinnerText);
      this.spinnerText = null;
    }
  }

  stopSpinner(): void {
    this.spinnerText = null;
  }

  log(message: string): void {
    console.log(message);
  }

  bold(text: string): string {
    return text;
  }

  dim(text: string): string {
    return text;
  }
}

export const logger = new Logger();
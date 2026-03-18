/**
 * Ghost Text Renderer - Status Bar Approach
 *
 * Reserves the last row of the terminal as a suggestion bar.
 * NO animated elements - only writes to status bar when idle.
 */

const SAVE = '\x1b[s';
const RESTORE = '\x1b[u';

export class GhostTextRenderer {
  private currentSuggestion: string = '';
  private isRendered: boolean = false;
  private cols: number;
  private rows: number;

  constructor() {
    this.cols = process.stdout.columns || 80;
    this.rows = process.stdout.rows || 24;

    process.stdout.on('resize', () => {
      this.cols = process.stdout.columns || 80;
      this.rows = process.stdout.rows || 24;
      if (this.currentSuggestion) {
        this.renderSuggestionBar(this.currentSuggestion);
      }
    });
  }

  getChildRows(): number {
    return (process.stdout.rows || 24) - 1;
  }

  /**
   * Show static loading message (no animation, no intervals)
   */
  showLoading(): void {
    const text = ' ... ';
    const padded = text + ' '.repeat(Math.max(0, this.cols - text.length));

    process.stdout.write(
      SAVE +
      `\x1b[${this.rows};1H` +
      '\x1b[48;5;236m\x1b[38;5;245m' +
      padded +
      '\x1b[0m' +
      RESTORE
    );
  }

  render(suggestion: string): void {
    if (!suggestion || !process.stdout.isTTY) return;
    this.currentSuggestion = suggestion;
    this.renderSuggestionBar(suggestion);
    this.isRendered = true;
  }

  private renderSuggestionBar(suggestion: string): void {
    const prefix = ' TAB \u2192 ';
    const maxLen = this.cols - prefix.length - 1;
    const truncated = suggestion.length > maxLen
      ? suggestion.slice(0, maxLen - 1) + '\u2026'
      : suggestion;

    const padding = ' '.repeat(Math.max(0, this.cols - prefix.length - truncated.length));

    process.stdout.write(
      SAVE +
      `\x1b[${this.rows};1H` +
      '\x1b[48;5;236m' +
      '\x1b[1m\x1b[38;5;75m' +
      prefix +
      '\x1b[22m\x1b[38;5;252m' +
      truncated +
      padding +
      '\x1b[0m' +
      RESTORE
    );
  }

  clear(): void {
    if (!this.isRendered) return;
    process.stdout.write(
      SAVE +
      `\x1b[${this.rows};1H` +
      '\x1b[K' +
      RESTORE
    );
    this.currentSuggestion = '';
    this.isRendered = false;
  }

  accept(): string {
    const suggestion = this.currentSuggestion;
    this.clear();
    return suggestion;
  }

  hasSuggestion(): boolean {
    return this.isRendered && this.currentSuggestion.length > 0;
  }

  getSuggestion(): string {
    return this.currentSuggestion;
  }

  resetScrollRegion(): void {
    this.clear();
  }
}

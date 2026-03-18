/**
 * Ghost Text Renderer - Status Bar (No cursor restore)
 *
 * Writes suggestions to the last terminal row.
 * NEVER uses cursor save/restore - avoids all TUI conflicts.
 * After writing, cursor stays at bar. Claude Code's next
 * output will reposition it correctly.
 */

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
    });
  }

  getChildRows(): number {
    return (process.stdout.rows || 24) - 1;
  }

  showLoading(): void {
    const text = ' ... ';
    const padded = text + ' '.repeat(Math.max(0, this.cols - text.length));
    // Write to last row. No cursor restore.
    process.stdout.write(
      `\x1b[${this.rows};1H` +
      '\x1b[48;5;236m\x1b[38;5;245m' +
      padded +
      '\x1b[0m'
    );
  }

  render(suggestion: string): void {
    if (!suggestion || !process.stdout.isTTY) return;
    this.currentSuggestion = suggestion;
    this.isRendered = true;

    const prefix = ' TAB \u2192 ';
    const maxLen = this.cols - prefix.length - 1;
    const truncated = suggestion.length > maxLen
      ? suggestion.slice(0, maxLen - 1) + '\u2026'
      : suggestion;
    const padding = ' '.repeat(Math.max(0, this.cols - prefix.length - truncated.length));

    process.stdout.write(
      `\x1b[${this.rows};1H` +
      '\x1b[48;5;236m' +
      '\x1b[1m\x1b[38;5;75m' + prefix +
      '\x1b[22m\x1b[38;5;252m' + truncated + padding +
      '\x1b[0m'
    );
  }

  // No terminal writes - just dismiss in memory
  clear(): void {
    this.currentSuggestion = '';
    this.isRendered = false;
  }

  // Actually clear the bar (only on exit)
  clearBar(): void {
    process.stdout.write(`\x1b[${this.rows};1H\x1b[K`);
    this.currentSuggestion = '';
    this.isRendered = false;
  }

  accept(): string {
    const suggestion = this.currentSuggestion;
    this.currentSuggestion = '';
    this.isRendered = false;
    return suggestion;
  }

  hasSuggestion(): boolean {
    return this.isRendered && this.currentSuggestion.length > 0;
  }

  getSuggestion(): string {
    return this.currentSuggestion;
  }

  resetScrollRegion(): void {
    this.clearBar();
  }
}

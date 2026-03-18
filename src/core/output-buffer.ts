import { stripAnsi } from './ansi-stripper.js';

export class OutputBuffer {
  private lines: string[] = [];
  private partial: string = '';

  constructor(private maxLines: number = 100) {}

  push(data: string): void {
    const text = this.partial + data;
    const parts = text.split('\n');

    // Last part might be incomplete (no trailing newline)
    this.partial = parts.pop() ?? '';

    for (const line of parts) {
      this.lines.push(line);
      if (this.lines.length > this.maxLines * 1.5) {
        this.lines = this.lines.slice(-this.maxLines);
      }
    }
  }

  getContext(count?: number): string {
    const n = count ?? this.maxLines;
    const contextLines = this.lines.slice(-n);

    // Add partial line if it exists
    if (this.partial) {
      contextLines.push(this.partial);
    }

    return contextLines
      .map(line => stripAnsi(line))
      .join('\n');
  }

  getLastLine(): string {
    const raw = this.partial || (this.lines.length > 0 ? this.lines[this.lines.length - 1] : '');
    const stripped = stripAnsi(raw);
    const segments = stripped.split('\r').filter(s => s.trim().length > 0);
    return segments.join('\n');
  }

  /**
   * Get the last N lines for prompt scanning.
   * TUI apps like Claude Code put the prompt several lines before the end.
   */
  getRecentLines(count: number = 10): string[] {
    const result: string[] = [];
    const source = this.lines.slice(-count);

    if (this.partial) {
      source.push(this.partial);
    }

    for (const line of source) {
      const stripped = stripAnsi(line);
      // Also split by \r for TUI apps
      const segments = stripped.split('\r').filter(s => s.trim().length > 0);
      result.push(...segments);
    }

    return result;
  }

  clear(): void {
    this.lines = [];
    this.partial = '';
  }
}

import { GhostConfig } from '../config/config.js';

export class PromptDetector {
  private promptRegexes: RegExp[];
  private securityPatterns: string[];
  private lastOutputTime: number = 0;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private config: GhostConfig) {
    this.promptRegexes = config.promptPatterns.flatMap(p => {
      try {
        return [new RegExp(p)];
      } catch {
        return [];
      }
    });
    this.securityPatterns = config.securityPatterns;
  }

  /**
   * Check if the last line of output looks like a prompt waiting for input
   */
  isPrompt(lastLine: string): boolean {
    // Security check first - never suggest on password prompts
    if (this.isSecurityPrompt(lastLine)) {
      return false;
    }

    // lastLine may contain multiple segments (split by \r in TUI apps)
    // Check each segment individually
    const segments = lastLine.split('\n');

    for (const segment of segments) {
      const trimmed = segment.trim();
      for (const regex of this.promptRegexes) {
        if (regex.test(trimmed)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Detect if this is a security-sensitive prompt (password, token, etc.)
   */
  isSecurityPrompt(line: string): boolean {
    const lower = line.toLowerCase();
    return this.securityPatterns.some(p => lower.includes(p.toLowerCase()));
  }

  /**
   * Record that output was received (resets timing)
   */
  recordOutput(): void {
    this.lastOutputTime = Date.now();
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /**
   * Start debounce timer. Calls callback after debounceMs if no new output arrives.
   */
  waitForIdle(callback: () => void): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      callback();
    }, this.config.debounceMs);
  }

  /**
   * Cancel any pending debounce timer
   */
  cancel(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  dispose(): void {
    this.cancel();
  }
}

import * as pty from 'node-pty-prebuilt-multiarch';
import { appendFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { OutputBuffer } from './output-buffer.js';
import { PromptDetector } from '../detection/prompt-detector.js';
import { AIEngine } from '../suggestion/ai-engine.js';
import { GhostTextRenderer } from '../renderer/ghost-text.js';
import { GhostConfig } from '../config/config.js';

const TAB = '\t';
const ESC = '\x1b';
const CTRL_C = '\x03';

export class PtyManager {
  private ptyProcess: pty.IPty;
  private buffer: OutputBuffer;
  private detector: PromptDetector;
  private engine: AIEngine;
  private renderer: GhostTextRenderer;
  private isSuggesting: boolean = false;
  private rawMode: boolean = false;
  private debug: boolean;
  private logFile: string;

  constructor(
    private command: string,
    private args: string[],
    private config: GhostConfig,
    debug: boolean = false,
  ) {
    this.debug = debug;
    this.logFile = join(homedir(), '.ghost-suggest', 'debug.log');
    this.buffer = new OutputBuffer(config.contextLines);
    this.detector = new PromptDetector(config);
    this.engine = new AIEngine(config);
    this.renderer = new GhostTextRenderer();

    // Spawn through user's login shell so PATH (nvm, etc.) is loaded
    const shell = process.env.SHELL || '/bin/zsh';
    const fullCommand = [command, ...args].join(' ');

    // Give child PTY one less row - we reserve the last row for suggestions
    this.ptyProcess = pty.spawn(shell, ['-l', '-c', fullCommand], {
      name: 'xterm-256color',
      cols: process.stdout.columns || 80,
      rows: this.renderer.getChildRows(),
      cwd: process.cwd(),
      env: process.env as { [key: string]: string },
    });

    this.setupOutputHandler();
    this.setupInputHandler();
    this.setupResize();
    this.setupExit();
  }

  /**
   * Handle output from child process → user terminal
   */
  private setupOutputHandler(): void {
    this.ptyProcess.onData((data: string) => {
      // Write data to user's terminal
      process.stdout.write(data);

      // Buffer for context
      this.buffer.push(data);

      // Record output and reset debounce
      this.detector.recordOutput();

      // Start idle detection for suggestion
      this.detector.waitForIdle(() => {
        this.tryShowSuggestion();
      });
    });
  }

  /**
   * Handle input from user → child process
   */
  private setupInputHandler(): void {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      this.rawMode = true;
    }
    process.stdin.resume();

    process.stdin.on('data', (data: Buffer) => {
      const key = data.toString();

      // TAB: Accept suggestion if one is displayed
      if (key === TAB && this.renderer.hasSuggestion()) {
        const suggestion = this.renderer.accept();
        // Write the suggestion to the child process as if user typed it
        this.ptyProcess.write(suggestion);
        return;
      }

      // ESC: Dismiss suggestion
      if (key === ESC && this.renderer.hasSuggestion()) {
        this.renderer.clear();
        this.engine.abort();
        return;
      }

      // Any other key: clear ghost text, cancel pending suggestion, forward key
      if (this.renderer.hasSuggestion()) {
        this.renderer.clear();
        this.engine.abort();
      }

      // Cancel any pending suggestion generation
      this.detector.cancel();
      this.engine.abort();
      this.isSuggesting = false;

      // Forward input to child process
      this.ptyProcess.write(key);
    });
  }

  /**
   * Handle terminal resize
   */
  private setupResize(): void {
    process.stdout.on('resize', () => {
      const cols = process.stdout.columns || 80;
      // Give child the resized rows minus our status bar
      this.ptyProcess.resize(cols, this.renderer.getChildRows());
      this.renderer.clear();
    });
  }

  /**
   * Handle child process exit
   */
  private setupExit(): void {
    this.ptyProcess.onExit(({ exitCode }) => {
      this.cleanup();
      process.exit(exitCode);
    });

    // Handle parent signals
    const handleSignal = (signal: NodeJS.Signals) => {
      this.ptyProcess.kill(signal);
    };

    process.on('SIGINT', () => handleSignal('SIGINT'));
    process.on('SIGTERM', () => handleSignal('SIGTERM'));
  }

  private log(msg: string): void {
    if (!this.debug) return;
    const ts = new Date().toISOString().slice(11, 23);
    appendFileSync(this.logFile, `[${ts}] ${msg}\n`);
  }

  /**
   * Try to generate and show a suggestion
   */
  private async tryShowSuggestion(): Promise<void> {
    if (this.isSuggesting) return;

    const recentLines = this.buffer.getRecentLines(15);
    this.log(`IDLE detected. recentLines: ${JSON.stringify(recentLines.slice(-5))}`);

    // Find the prompt line and count lines after it
    let promptIndex = -1;
    for (let i = recentLines.length - 1; i >= 0; i--) {
      if (this.detector.isPrompt(recentLines[i])) {
        promptIndex = i;
        break;
      }
    }

    if (promptIndex === -1) {
      this.log(`NOT a prompt. Skipping.`);
      return;
    }

    const linesAfterPrompt = recentLines.length - 1 - promptIndex;
    this.log(`PROMPT detected at index ${promptIndex}`);

    this.isSuggesting = true;
    this.renderer.showLoading();

    try {
      const context = this.buffer.getContext(this.config.contextLines);
      this.log(`Context length: ${context.length} chars`);

      const suggestion = await this.engine.suggest(context);
      this.log(`Suggestion received: ${JSON.stringify(suggestion)}`);

      if (suggestion && this.isSuggesting) {
        this.log(`Rendering suggestion in status bar...`);
        this.renderer.render(suggestion);
        this.log(`Suggestion rendered!`);
      } else {
        this.log(`Not rendering. suggestion="${suggestion}", isSuggesting=${this.isSuggesting}`);
      }
    } catch (err: unknown) {
      this.log(`ERROR in suggestion: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.isSuggesting = false;
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.detector.dispose();
    this.engine.abort();
    this.renderer.resetScrollRegion();

    if (this.rawMode && process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
  }
}

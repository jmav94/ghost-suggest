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
    command: string,
    args: string[],
    private config: GhostConfig,
    debug: boolean = false,
  ) {
    this.debug = debug;
    this.logFile = join(homedir(), '.ghost-suggest', 'debug.log');
    this.buffer = new OutputBuffer(config.contextLines);
    this.detector = new PromptDetector(config);
    this.engine = new AIEngine(config);
    this.renderer = new GhostTextRenderer();

    const shell = process.env.SHELL || '/bin/zsh';
    const fullCommand = [command, ...args].join(' ');

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

  private setupOutputHandler(): void {
    this.ptyProcess.onData((data: string) => {
      process.stdout.write(data);
      this.buffer.push(data);
      this.detector.recordOutput();
      this.detector.waitForIdle(() => this.tryShowSuggestion());
    });
  }

  private setupInputHandler(): void {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      this.rawMode = true;
    }
    process.stdin.resume();

    process.stdin.on('data', (data: Buffer) => {
      const key = data.toString();

      if (key === TAB && this.renderer.hasSuggestion()) {
        this.ptyProcess.write(this.renderer.accept());
        return;
      }

      if (key === ESC && this.renderer.hasSuggestion()) {
        this.renderer.clear();
        this.engine.abort();
        return;
      }

      if (this.renderer.hasSuggestion()) {
        this.renderer.clear();
        this.engine.abort();
      }

      this.detector.cancel();
      this.engine.abort();
      this.isSuggesting = false;
      this.ptyProcess.write(key);
    });
  }

  private setupResize(): void {
    process.stdout.on('resize', () => {
      this.ptyProcess.resize(
        process.stdout.columns || 80,
        this.renderer.getChildRows(),
      );
      this.renderer.clear();
    });
  }

  private setupExit(): void {
    this.ptyProcess.onExit(({ exitCode }) => {
      this.cleanup();
      process.exit(exitCode);
    });

    process.on('SIGINT', () => this.ptyProcess.kill('SIGINT'));
    process.on('SIGTERM', () => this.ptyProcess.kill('SIGTERM'));
  }

  private log(msg: string): void {
    if (!this.debug) return;
    const ts = new Date().toISOString().slice(11, 23);
    appendFileSync(this.logFile, `[${ts}] ${msg}\n`);
  }

  private async tryShowSuggestion(): Promise<void> {
    if (this.isSuggesting) return;

    const recentLines = this.buffer.getRecentLines(15);
    this.log(`IDLE: ${JSON.stringify(recentLines.slice(-5))}`);

    let hasPrompt = false;
    for (let i = recentLines.length - 1; i >= 0; i--) {
      if (this.detector.isPrompt(recentLines[i])) {
        hasPrompt = true;
        break;
      }
    }

    if (!hasPrompt) {
      this.log('No prompt found');
      return;
    }

    this.log('Prompt detected, generating suggestion...');
    this.isSuggesting = true;
    this.renderer.showLoading();

    try {
      const context = this.buffer.getContext(this.config.contextLines);
      const suggestion = await this.engine.suggest(context);
      this.log(`Suggestion: ${JSON.stringify(suggestion)}`);

      if (suggestion && this.isSuggesting) {
        this.renderer.render(suggestion);
      } else {
        this.renderer.clear();
      }
    } catch (err: unknown) {
      this.log(`Error: ${err instanceof Error ? err.message : String(err)}`);
      this.renderer.clear();
    } finally {
      this.isSuggesting = false;
    }
  }

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

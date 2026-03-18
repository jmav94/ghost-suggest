# ghost-suggest

AI-powered terminal suggestions that watch your session and suggest the next step. Works with Claude Code, bash, and any interactive terminal program.

Uses [Ollama](https://ollama.com) running locally — **zero cost, fully private**, nothing leaves your machine.

## How it works

```
┌─────────────────────────────────────────────┐
│  Claude Code / bash / any program           │
│                                             │
│  > your prompt here                         │
│  ? for shortcuts                            │
├─────────────────────────────────────────────┤
│  TAB → correr los tests para verificar      │  ← ghost-suggest
└─────────────────────────────────────────────┘
```

ghost-suggest wraps your command in a PTY proxy, watches the output, and when the program waits for input, it sends the context to a local LLM and shows a suggestion in a status bar at the bottom.

- **TAB** — accept the suggestion
- **ESC** — dismiss it
- **Any other key** — ignore and keep typing

## Requirements

- Node.js 18+
- macOS or Linux
- [Ollama](https://ollama.com) installed and running

## Install

```bash
# Install Ollama and pull the model
brew install ollama
brew services start ollama
ollama pull llama3.2:3b

# Install ghost-suggest
npm install -g ghost-suggest
```

## Usage

```bash
# Wrap Claude Code
ghost-suggest claude

# Wrap your shell
ghost-suggest bash
ghost-suggest zsh

# Wrap any command
ghost-suggest node
ghost-suggest python3

# Default (wraps your $SHELL)
ghost-suggest

# Short alias
gs claude

# Debug mode (logs to ~/.ghost-suggest/debug.log)
ghost-suggest --debug claude

# Check Ollama status
ghost-suggest --check
```

### Alias for Claude Code

Add to your `~/.zshrc` or `~/.bashrc`:

```bash
alias claude="ghost-suggest npx @anthropic-ai/claude-code"
```

## Configuration

Config file: `~/.ghost-suggest/config.json` (auto-created on first run)

```json
{
  "provider": "ollama",
  "model": "llama3.2:3b",
  "ollamaHost": "http://127.0.0.1:11434",
  "debounceMs": 400,
  "contextLines": 80,
  "promptPatterns": [
    "^❯\\s*$",
    "^> $",
    "^\\$ $",
    "^% $",
    "^>>> $",
    "^\\w+> $"
  ],
  "securityPatterns": [
    "password",
    "passphrase",
    "secret",
    "token",
    "sudo"
  ],
  "language": "es"
}
```

### Options

| Key | Default | Description |
|-----|---------|-------------|
| `provider` | `"ollama"` | LLM provider (`ollama` or `anthropic`) |
| `model` | `"llama3.2:3b"` | Model to use for suggestions |
| `ollamaHost` | `"http://127.0.0.1:11434"` | Ollama server URL |
| `anthropicApiKey` | `""` | Anthropic API key (if using `anthropic` provider) |
| `debounceMs` | `400` | Wait time (ms) after last output before suggesting |
| `contextLines` | `80` | Number of recent output lines to send as context |
| `promptPatterns` | _(see above)_ | Regex patterns to detect when a program waits for input |
| `securityPatterns` | _(see above)_ | Patterns that trigger security filter (never suggest) |
| `language` | `"es"` | Suggestion language (`es` or `en`) |

## How it works (technical)

1. **PTY Proxy** — Spawns your command inside a pseudo-terminal, relaying I/O transparently
2. **Output Buffer** — Keeps a rolling buffer of the last N lines of terminal output
3. **Prompt Detection** — Watches for known prompt patterns (❯, $, %, >>>) using regex + idle timing
4. **AI Engine** — Sends context to Ollama (local) and gets a suggestion
5. **Status Bar** — Renders the suggestion on a reserved row at the bottom of the terminal, avoiding conflicts with TUI apps

The child PTY gets `rows - 1`, so TUI apps like Claude Code never touch the status bar row.

## Resource usage

- **RAM**: ~2GB (llama3.2:3b model loaded in Ollama)
- **CPU**: Minimal — only activates when generating a suggestion (~1-2s)
- **Disk**: ~2GB for the model
- **Network**: None — everything runs locally

## License

MIT

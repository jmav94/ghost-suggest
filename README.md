# ghost-suggest

**AI-powered terminal suggestions that watch your session and suggest the next step.**

Works with Claude Code, bash, zsh, and any interactive terminal program. Uses [Ollama](https://ollama.com) running locally — **zero cost, fully private**, nothing leaves your machine.

[![npm version](https://img.shields.io/npm/v/ghost-suggest)](https://www.npmjs.com/package/ghost-suggest)
[![license](https://img.shields.io/npm/l/ghost-suggest)](LICENSE)
[![node](https://img.shields.io/node/v/ghost-suggest)](package.json)

```
┌─────────────────────────────────────────────────┐
│  Claude Code v2.1.78                            │
│  ~/dev/my-project                               │
│                                                 │
│  Refactored the auth module. Tests passing.     │
│  Want me to commit the changes?                 │
│                                                 │
│  ❯                                              │
│  ? for shortcuts                                │
├─────────────────────────────────────────────────┤
│  TAB → sí, haz commit con mensaje descriptivo   │
└─────────────────────────────────────────────────┘
```

## Why ghost-suggest?

- **100% local** — Ollama runs on your machine. Your terminal data never leaves it.
- **Zero cost** — No API keys, no subscriptions, no usage limits.
- **Non-invasive** — Status bar at the bottom, doesn't interfere with your programs.
- **Smart context** — Understands what happened in your session and suggests the logical next step.
- **Works everywhere** — Any terminal program: Claude Code, bash, node, python, etc.

## Quick start

```bash
# 1. Install Ollama
brew install ollama
brew services start ollama
ollama pull llama3.2:3b

# 2. Install ghost-suggest
npm install -g ghost-suggest

# 3. Run
ghost-suggest claude    # or: gs bash, gs node, gs python3
```

## Usage

```bash
ghost-suggest <command> [args...]   # Wrap any command
ghost-suggest                       # Wrap your default shell
gs claude                           # Short alias

ghost-suggest --check               # Verify Ollama is ready
ghost-suggest --debug <command>     # Debug mode (logs to ~/.ghost-suggest/debug.log)
```

**Keyboard shortcuts:**

| Key | Action |
|-----|--------|
| **TAB** | Accept the suggestion |
| **ESC** | Dismiss it |
| **Any key** | Ignore suggestion, keep typing |

### Set up as default for Claude Code

Add to `~/.zshrc` or `~/.bashrc`:

```bash
alias claude="ghost-suggest npx @anthropic-ai/claude-code"
```

## Security and Privacy

ghost-suggest is designed with privacy as a core principle.

### What happens with your data

- **All processing is local.** Your terminal output is sent only to Ollama running on `localhost`. Nothing goes to the internet.
- **No telemetry.** ghost-suggest collects zero analytics, metrics, or usage data.
- **No data persistence.** The output buffer exists only in memory and is discarded when the session ends. Nothing is written to disk (except debug logs if you explicitly enable `--debug`).
- **Security filter.** Prompts containing passwords, tokens, secrets, or sudo are automatically detected and ghost-suggest will NOT generate suggestions for them.

### When using the Anthropic API provider (optional)

If you configure `"provider": "anthropic"`, your terminal context will be sent to Anthropic's API servers. In this case:
- Only the last ~80 lines of output are sent (configurable).
- Anthropic does not train on API data ([Anthropic's data policy](https://www.anthropic.com/privacy)).
- Your API key is stored in `~/.ghost-suggest/config.json`. Protect this file with appropriate permissions.

### Debug mode

When using `--debug`, terminal output is logged to `~/.ghost-suggest/debug.log`. This file may contain sensitive content from your terminal session. **Delete it after debugging.**

### Reporting vulnerabilities

If you find a security issue, please open a private issue on GitHub or contact the maintainer directly.

## Configuration

Config file: `~/.ghost-suggest/config.json` (auto-created on first run)

```json
{
  "provider": "ollama",
  "model": "llama3.2:3b",
  "ollamaHost": "http://127.0.0.1:11434",
  "debounceMs": 400,
  "contextLines": 80,
  "language": "es"
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `provider` | `"ollama"` | LLM provider: `ollama` (local) or `anthropic` (cloud) |
| `model` | `"llama3.2:3b"` | Model name |
| `ollamaHost` | `"http://127.0.0.1:11434"` | Ollama server URL |
| `anthropicApiKey` | `""` | API key (only if using Anthropic provider) |
| `debounceMs` | `400` | Ms to wait after last output before suggesting |
| `contextLines` | `80` | Lines of recent output sent as context |
| `promptPatterns` | `["^❯\\s*$", "^> $", ...]` | Regex patterns to detect input prompts |
| `securityPatterns` | `["password", "secret", ...]` | Patterns that disable suggestions (security) |
| `language` | `"es"` | Suggestion language: `es` or `en` |

## How it works

```
┌──────────────┐      ┌─────────────────┐      ┌──────────────┐
│  Your        │◄────►│  ghost-suggest   │◄────►│  claude /    │
│  Terminal    │      │  (PTY proxy)     │      │  bash / etc  │
└──────────────┘      └────────┬────────┘      └──────────────┘
                               │
                               ▼
                       ┌──────────────┐
                       │ Ollama (local)│
                       │ llama3.2:3b  │
                       └──────────────┘
```

1. **PTY Proxy** — Spawns your command inside a pseudo-terminal, relaying I/O transparently
2. **Output Buffer** — Rolling buffer of the last N lines (in-memory only)
3. **Prompt Detection** — Watches for prompt patterns (❯, $, %, >>>) with idle timing
4. **AI Suggestion** — Sends context to Ollama and gets a next-step suggestion
5. **Status Bar** — Renders on a reserved row at the bottom, never conflicts with TUI apps

## Resource usage

| Resource | Usage |
|----------|-------|
| **RAM** | ~2GB (model loaded in Ollama) |
| **CPU** | Minimal — only during suggestion generation (~1-2s) |
| **Disk** | ~2GB for the model |
| **Network** | None (localhost only) |

## Supported prompt patterns

Out of the box, ghost-suggest detects prompts from:

- **Claude Code** (`❯`)
- **Bash** (`$`)
- **Zsh** (`%`)
- **Python** (`>>>`)
- **Node.js / MongoDB / etc.** (`>`)

Add custom patterns in the config file.

## License

[MIT](LICENSE)

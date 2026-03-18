# ghost-suggest

**AI-powered terminal suggestions that watch your session and suggest the next step.**

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

## The story behind this

I installed Amazon Q CLI without expecting much. Then I discovered its terminal suggestions — it watched what was happening in my session and suggested the next step based on context. That changed everything for me. Most of the time, I just had to press TAB and the agent kept moving forward. It made my workflow noticeably faster.

Then AWS replaced it with Kiro CLI, and that feature simply disappeared. I uninstalled Kiro the same day.

I looked for alternatives. Warp has AI suggestions but only for shell commands, not for what's happening inside interactive sessions like Claude Code. Nothing else did what Amazon Q did. So I built it myself.

ghost-suggest wraps any terminal program — Claude Code, bash, node, whatever — watches the output, and when the program waits for your input, it suggests the logical next step. The suggestion shows up in a small bar at the bottom. Press TAB to accept, or just ignore it and keep typing.

I'm sharing it because it saves me real time every day and I think it can do the same for others. It runs entirely on your machine using Ollama — no cost, no API keys, no data leaving your computer.

## Quick start

```bash
# 1. Install Ollama (local LLM runtime)
brew install ollama
brew services start ollama
ollama pull llama3.2:3b

# 2. Install ghost-suggest
npm install -g ghost-suggest

# 3. Use it
ghost-suggest claude       # wrap Claude Code
gs bash                    # wrap bash (gs is the short alias)
ghost-suggest              # wrap your default shell
```

### Make it automatic for Claude Code

Add this to your `~/.zshrc` or `~/.bashrc` and forget about it:

```bash
alias claude="ghost-suggest npx @anthropic-ai/claude-code"
```

From then on, every time you type `claude`, ghost-suggest runs in the background.

## How it works

ghost-suggest sits between your terminal and the program you're running. It doesn't modify anything — it just watches the output and, when the program is waiting for your input, it asks a small local LLM: "given what just happened, what should the user do next?"

```
┌──────────────┐      ┌─────────────────┐      ┌──────────────┐
│  Your        │◄────►│  ghost-suggest   │◄────►│  claude /    │
│  Terminal    │      │  (PTY proxy)     │      │  bash / etc  │
└──────────────┘      └────────┬────────┘      └──────────────┘
                               │
                               ▼
                       ┌──────────────┐
                       │ Ollama       │
                       │ (local LLM)  │
                       └──────────────┘
```

1. **PTY Proxy** — Spawns your command inside a pseudo-terminal, relaying I/O transparently.
2. **Output Buffer** — Keeps a rolling buffer of the last N lines of output. In-memory only, nothing written to disk.
3. **Prompt Detection** — Recognizes when programs are waiting for input (❯, $, %, >>>, and custom patterns).
4. **AI Suggestion** — Sends context to Ollama running on localhost and gets a one-line suggestion.
5. **Status Bar** — Renders the suggestion on a reserved row at the bottom that never interferes with TUI apps.

**Keyboard shortcuts:**

| Key | Action |
|-----|--------|
| **TAB** | Accept the suggestion |
| **ESC** | Dismiss it |
| **Any key** | Ignore suggestion and keep typing normally |

## Security and Privacy

This was non-negotiable from day one. If a tool watches everything in my terminal, I need to trust it completely. Here's exactly what ghost-suggest does and doesn't do with your data.

### Your data stays on your machine

- **All processing is local.** Terminal output is sent only to Ollama running on `localhost:11434`. It never touches the internet.
- **No telemetry, no analytics, no tracking.** Zero. ghost-suggest doesn't phone home, doesn't collect usage data, doesn't know you exist.
- **Nothing is written to disk.** The output buffer lives in memory and is discarded when the session ends.

### Active protections

- **Secret redaction.** Before any context is sent to the local LLM, ghost-suggest scans for and redacts API keys, tokens, JWTs, AWS credentials, Bearer tokens, and other common secret patterns. They are replaced with `[REDACTED]`.
- **Password prompt detection.** When the terminal shows a password, passphrase, sudo, or token prompt, ghost-suggest stays silent. No suggestion is generated.
- **Localhost-only validation.** The Ollama host is validated to be `127.0.0.1`, `localhost`, or `::1`. It's impossible to redirect your terminal data to a remote server, even if the config file is tampered with.
- **Restricted file permissions.** Config file (`~/.ghost-suggest/config.json`) is created with `0o600` permissions — only your user can read it. The config directory uses `0o700`.
- **Context size limits.** The context sent to the LLM is capped at 16KB, preventing excessive memory usage.
- **Safe config parsing.** Malformed config files don't crash the tool. Numeric values are clamped to safe ranges. Invalid regex patterns are silently ignored.

### Optional: Anthropic API provider

If you choose to configure `"provider": "anthropic"`, your terminal context will be sent to Anthropic's API servers. In this case:
- Only the last ~80 lines of output are sent, after secret redaction.
- Anthropic does not train on API data ([privacy policy](https://www.anthropic.com/privacy)).
- Your API key is stored locally in the config file with restricted permissions.

This is entirely opt-in. The default configuration uses Ollama and sends nothing to the internet.

### Debug mode

The `--debug` flag logs diagnostic information to `~/.ghost-suggest/debug.log`. This file is created with `0o600` permissions and does **not** log terminal content — only event types and metadata (e.g., "prompt detected", "suggestion received, 45 chars"). Delete it after debugging.

### Reporting vulnerabilities

If you find a security issue, please open a private issue on [GitHub](https://github.com/jmav94/ghost-suggest/issues) or contact the maintainer directly.

## Configuration

Config file: `~/.ghost-suggest/config.json` (auto-created on first run with restricted permissions)

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
| `provider` | `"ollama"` | LLM provider: `ollama` (local) or `anthropic` (cloud, opt-in) |
| `model` | `"llama3.2:3b"` | Model name |
| `ollamaHost` | `"http://127.0.0.1:11434"` | Ollama server URL (localhost only) |
| `anthropicApiKey` | `""` | API key (only needed if using Anthropic provider) |
| `debounceMs` | `400` | Wait time after last output before suggesting (100–5000) |
| `contextLines` | `80` | Lines of recent output sent as context (5–500) |
| `promptPatterns` | `["^❯\\s*$", "^> $", ...]` | Regex patterns to detect input prompts |
| `securityPatterns` | `["password", "secret", ...]` | Patterns that trigger the security filter |
| `language` | `"es"` | Suggestion language: `es` or `en` |

## Resource usage

| Resource | Impact |
|----------|--------|
| **RAM** | ~2GB while Ollama has the model loaded |
| **CPU** | Minimal — only active during suggestion generation (~1-2s) |
| **Disk** | ~2GB for the LLM model |
| **Network** | None. Everything runs on localhost. |

## Supported programs

Works out of the box with:

- **Claude Code** (`❯`)
- **Bash** (`$`)
- **Zsh** (`%`)
- **Python REPL** (`>>>`)
- **Node.js, MongoDB, and others** (`>`)

Add custom prompt patterns in the config file for any interactive program.

## Requirements

- Node.js 18+
- macOS or Linux
- [Ollama](https://ollama.com) installed and running

## License

[MIT](LICENSE)

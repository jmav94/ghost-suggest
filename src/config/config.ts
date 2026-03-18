import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface GhostConfig {
  provider: 'ollama' | 'anthropic';
  model: string;
  ollamaHost: string;
  anthropicApiKey: string;
  debounceMs: number;
  contextLines: number;
  promptPatterns: string[];
  securityPatterns: string[];
  language: string;
}

const CONFIG_DIR = join(homedir(), '.ghost-suggest');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG: GhostConfig = {
  provider: 'ollama',
  model: 'llama3.2:3b',
  ollamaHost: 'http://127.0.0.1:11434',
  anthropicApiKey: '',
  debounceMs: 400,
  contextLines: 80,
  promptPatterns: [
    '^❯\\s*$',        // Claude Code (Unicode prompt)
    '^> $',           // Claude Code (ASCII fallback)
    '^\\$ $',         // Bash
    '^% $',           // Zsh
    '^>>> $',         // Python REPL
    '^\\w+> $',       // Node REPL, mongo, etc.
  ],
  securityPatterns: [
    'password',
    'Password',
    'passphrase',
    'secret',
    'token',
    'sudo',
    'Enter PIN',
  ],
  language: 'es',
};

export function loadConfig(): GhostConfig {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  if (!existsSync(CONFIG_FILE)) {
    writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
    return { ...DEFAULT_CONFIG };
  }

  const raw = readFileSync(CONFIG_FILE, 'utf-8');
  const userConfig = JSON.parse(raw) as Partial<GhostConfig>;
  return { ...DEFAULT_CONFIG, ...userConfig };
}

export function getSystemPrompt(language: string): string {
  if (language === 'es') {
    return `Observas una sesión donde un usuario da instrucciones a un asistente IA (Claude Code) en una terminal. El asistente acaba de responder. Sugiere qué debería ESCRIBIR el usuario como su siguiente instrucción.

IMPORTANTE - tipos de sugerencia según contexto:
1. Si el asistente PREGUNTÓ algo → sugiere una respuesta afirmativa concreta (ej: "sí, enfócate en el servicio de auditoría")
2. Si el asistente COMPLETÓ código → sugiere verificación (ej: "correr los tests", "revisar los cambios")
3. Si el asistente MOSTRÓ información → sugiere una acción sobre esa info (ej: "empecemos con TASK-011", "genera la propuesta comercial")
4. Si el asistente HIZO un cambio → sugiere el siguiente paso del workflow (ej: "hacer commit", "deploy a staging")

Reglas:
- NUNCA repitas lo que el asistente dijo - sugiere la ACCIÓN del usuario
- Escribe como si fueras el usuario dando una instrucción directa
- Máximo 80 caracteres
- Solo la sugerencia, sin explicación ni formato ni comillas
- En español
- Si no hay un siguiente paso claro, responde vacío`;
  }

  return `You observe a terminal session where a user interacts with an AI assistant (Claude Code). The assistant just responded. Suggest what the USER should type next as their next instruction or response.

Rules:
- Respond ONLY with the suggestion, no explanation or formatting
- Don't use quotes or backticks
- If unsure, respond with an empty string
- Keep suggestions concise and direct`;
}

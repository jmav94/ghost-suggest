#!/usr/bin/env node

import { loadConfig } from './config/config.js';
import { AIEngine } from './suggestion/ai-engine.js';
import { PtyManager } from './core/pty-manager.js';

const VERSION = '0.1.0';

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Help
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
ghost-suggest v${VERSION}
AI-powered terminal ghost text suggestions

Uso:
  ghost-suggest <comando> [args...]    Ejecuta un comando con sugerencias IA
  ghost-suggest claude                 Ejecuta Claude Code con sugerencias
  ghost-suggest bash                   Ejecuta bash con sugerencias
  ghost-suggest --check                Verifica que Ollama esté listo
  ghost-suggest --version              Muestra la versión

Atajos dentro de ghost-suggest:
  TAB     Acepta la sugerencia
  ESC     Descarta la sugerencia

Config: ~/.ghost-suggest/config.json
`);
    process.exit(0);
  }

  // Version
  if (args.includes('--version') || args.includes('-v')) {
    console.log(`ghost-suggest v${VERSION}`);
    process.exit(0);
  }

  const config = loadConfig();

  // Health check
  if (args.includes('--check')) {
    console.log('Verificando Ollama...');
    const engine = new AIEngine(config);
    const health = await engine.healthCheck();

    if (health.ok) {
      console.log(`✓ Ollama está corriendo con modelo "${config.model}"`);
    } else {
      console.error(`✗ ${health.error}`);
      process.exit(1);
    }
    process.exit(0);
  }

  // Need a command to wrap
  if (args.length === 0) {
    // Default to user's shell
    const shell = process.env.SHELL || '/bin/zsh';
    console.log(`ghost-suggest v${VERSION} — envolviendo ${shell}`);
    console.log('TAB para aceptar sugerencias, ESC para descartar\n');

    new PtyManager(shell, [], config);
    return;
  }

  // Debug mode
  const debug = args.includes('--debug');
  const filteredArgs = args.filter(a => a !== '--debug');

  // Wrap the provided command
  const [command, ...commandArgs] = filteredArgs;

  // Quick health check before starting
  if (config.provider === 'ollama') {
    const engine = new AIEngine(config);
    const health = await engine.healthCheck();
    if (!health.ok) {
      console.error(`⚠ ${health.error}`);
      console.error('ghost-suggest funcionará pero sin sugerencias.\n');
    }
  }

  console.log(`ghost-suggest v${VERSION} — envolviendo "${command}"`);
  console.log('TAB para aceptar sugerencias, ESC para descartar\n');

  new PtyManager(command, commandArgs, config, debug);
}

main().catch((err) => {
  console.error('Error fatal:', err.message);
  process.exit(1);
});

import { Ollama } from 'ollama';
import { GhostConfig, getSystemPrompt } from '../config/config.js';

export class AIEngine {
  private ollama: Ollama;
  private abortController: AbortController | null = null;

  constructor(private config: GhostConfig) {
    this.ollama = new Ollama({ host: config.ollamaHost });
  }

  /**
   * Generate a suggestion based on terminal context
   */
  async suggest(context: string): Promise<string> {
    // Cancel any previous in-flight request
    this.abort();

    this.abortController = new AbortController();
    const systemPrompt = getSystemPrompt(this.config.language);

    try {
      const response = await this.ollama.chat({
        model: this.config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Sesión de terminal reciente:\n\n${context}\n\nEl asistente terminó de responder y espera la siguiente instrucción del usuario. ¿Qué debería escribir el usuario como siguiente paso?`,
          },
        ],
        options: {
          temperature: 0.3,
          num_predict: 100,  // Short suggestions only
        },
        stream: false,
      });

      const suggestion = response.message.content.trim();

      // Filter out empty or meta-responses
      if (!suggestion || suggestion === '""' || suggestion === "''") {
        return '';
      }

      // Remove quotes if the model wrapped the suggestion
      const cleaned = suggestion.replace(/^["'`]+|["'`]+$/g, '');

      // Only return first line for ghost text
      const firstLine = cleaned.split('\n')[0].trim();

      return firstLine;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return '';
      }
      // Silent failure - don't disrupt the terminal
      return '';
    }
  }

  /**
   * Cancel any in-flight suggestion request
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Check if Ollama is running and model is available
   */
  async healthCheck(): Promise<{ ok: boolean; error?: string }> {
    try {
      const models = await this.ollama.list();
      const hasModel = models.models.some(m => m.name.startsWith(this.config.model.split(':')[0]));

      if (!hasModel) {
        return {
          ok: false,
          error: `Modelo "${this.config.model}" no encontrado. Ejecuta: ollama pull ${this.config.model}`,
        };
      }

      return { ok: true };
    } catch {
      return {
        ok: false,
        error: 'Ollama no está corriendo. Ejecuta: ollama serve',
      };
    }
  }
}

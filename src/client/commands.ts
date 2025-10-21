import type { ChatSocketClient } from "./socket-client.js";
import type { Message } from "../types.js";

export interface Command {
  value: string;
  label: string;
  description: string;
}

export const commands: Command[] = [
  { value: '/help', label: '/help', description: 'Show available commands' },
  { value: '/quit', label: '/quit', description: 'Exit the chat' },
];

export interface CommandHandlerOptions {
  client: ChatSocketClient;
  onMessage: (message: Message) => void;
  onExit: () => void;
}

export class CommandHandler {
  private client: ChatSocketClient;
  private onMessage: (message: Message) => void;
  private onExit: () => void;

  constructor(options: CommandHandlerOptions) {
    this.client = options.client;
    this.onMessage = options.onMessage;
    this.onExit = options.onExit;
  }

  handleCommand(command: string): void {
    const parts = command.split(" ");
    const cmd = parts[0]?.toLowerCase();

    switch (cmd) {
      case "/help":
        this.addSystemMessage('Available commands:\n' + commands.map(c => `${c.label} - ${c.description}`).join('\n'));
        break;
      case "/quit":
        this.onExit();
        break;
      default:
        this.addSystemMessage(`Unknown command: ${cmd}. Type /help for available commands.`);
    }
  }

  getAutocompleteOptions(input: string): Command[] {
    if (!input.startsWith('/')) return [];
    if (input === '/') return commands;
    return commands.filter(cmd =>
      cmd.value.toLowerCase().startsWith(input.toLowerCase())
    );
  }

  private addSystemMessage(content: string, username: string = 'System'): void {
    const message: Message = {
      id: Date.now().toString(),
      type: 'system',
      username,
      content,
      metadata: { timestamp: new Date().toISOString() }
    };
    this.onMessage(message);
  }
}
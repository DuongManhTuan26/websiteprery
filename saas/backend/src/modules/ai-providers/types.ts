export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface GenerateReplyInput {
  systemPrompt: string;
  history: ChatMessage[];
  userMessage: string;
  model?: string | null;
}

// The extension point mentioned in ARCHITECTURE.md: any real LLM backend
// plugs in by implementing this one method. Nothing about the rest of the
// system (chatbots, conversations, the widget) depends on which
// implementation is behind it.
export interface AIProvider {
  generateReply(input: GenerateReplyInput): Promise<string>;
}

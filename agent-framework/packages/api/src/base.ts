/**
 * API Handler interface
 * Simplified from Kilocode's API layer
 */

import type {
  Message,
  ToolDefinition,
  StreamChunk,
  TokenUsage,
  ProviderSettings,
  ModelInfo
} from '@agent-framework/types'

export interface ApiHandlerOptions {
  systemPrompt?: string
  messages: Message[]
  tools?: ToolDefinition[]
  maxTokens?: number
  temperature?: number
}

export interface ApiHandler {
  /**
   * Create a streaming message with the LLM
   */
  createMessage(options: ApiHandlerOptions): AsyncGenerator<StreamChunk, void, unknown>
  
  /**
   * Get the model info
   */
  getModel(): { id: string; info: ModelInfo }
  
  /**
   * Get provider name
   */
  getProvider(): string
}

export abstract class BaseApiHandler implements ApiHandler {
  protected settings: ProviderSettings
  
  constructor(settings: ProviderSettings) {
    this.settings = settings
  }
  
  abstract createMessage(options: ApiHandlerOptions): AsyncGenerator<StreamChunk, void, unknown>
  
  getModel(): { id: string; info: ModelInfo } {
    return {
      id: this.settings.model,
      info: this.settings.modelInfo || {
        contextWindow: 128000,
        supportsImages: false
      }
    }
  }
  
  getProvider(): string {
    return this.settings.provider
  }
  
  /**
   * Helper to convert our Message format to provider-specific format
   */
  protected convertMessages(messages: Message[]): any[] {
    return messages.map(msg => ({
      role: msg.role,
      content: typeof msg.content === 'string' 
        ? msg.content 
        : msg.content.map(block => {
            if (block.type === 'text') {
              return { type: 'text', text: block.text }
            } else if (block.type === 'image') {
              return {
                type: 'image',
                source: block.source
              }
            }
            return block
          })
    }))
  }
  
  /**
   * Helper to convert our ToolDefinition format to provider-specific format
   */
  protected convertTools(tools?: ToolDefinition[]): any[] {
    if (!tools) return []
    
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema
    }))
  }
}

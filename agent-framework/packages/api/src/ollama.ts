/**
 * Ollama Provider
 * Support for local LLM models via Ollama
 */

import type { ProviderSettings, StreamChunk, ModelInfo } from '@agent-framework/types'
import { BaseApiHandler, type ApiHandlerOptions } from './base.js'

interface OllamaMessage {
  role: string
  content: string
}

interface OllamaStreamResponse {
  model: string
  created_at: string
  message?: {
    role: string
    content: string
  }
  done: boolean
}

export class OllamaProvider extends BaseApiHandler {
  private baseURL: string
  
  constructor(settings: ProviderSettings) {
    super(settings)
    this.baseURL = settings.baseURL || 'http://localhost:11434'
  }
  
  async *createMessage(options: ApiHandlerOptions): AsyncGenerator<StreamChunk, void, unknown> {
    const { systemPrompt, messages, maxTokens, temperature = 0 } = options
    
    try {
      // Convert messages to Ollama format
      const ollamaMessages: OllamaMessage[] = []
      
      if (systemPrompt) {
        ollamaMessages.push({
          role: 'system',
          content: systemPrompt
        })
      }
      
      for (const msg of messages) {
        ollamaMessages.push({
          role: msg.role,
          content: typeof msg.content === 'string' 
            ? msg.content 
            : msg.content.map(block => block.type === 'text' ? block.text : '').join('\n')
        })
      }
      
      // Call Ollama API
      const response = await fetch(`${this.baseURL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.settings.model,
          messages: ollamaMessages,
          stream: true,
          options: {
            temperature,
            num_predict: maxTokens
          }
        })
      })
      
      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`)
      }
      
      if (!response.body) {
        throw new Error('No response body from Ollama')
      }
      
      // Process streaming response
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break
        
        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter(line => line.trim())
        
        for (const line of lines) {
          try {
            const data: OllamaStreamResponse = JSON.parse(line)
            
            if (data.message?.content) {
              yield {
                type: 'content',
                content: data.message.content
              }
            }
            
            if (data.done) {
              // Ollama doesn't provide token usage in streaming mode
              // We could estimate or add a separate API call if needed
              yield {
                type: 'usage',
                usage: {
                  inputTokens: 0, // Not available from Ollama
                  outputTokens: 0 // Not available from Ollama
                }
              }
            }
          } catch (parseError) {
            // Skip invalid JSON lines
            continue
          }
        }
      }
    } catch (error) {
      yield {
        type: 'error',
        error: error instanceof Error ? error : new Error(String(error))
      }
    }
  }
  
  getModel(): { id: string; info: ModelInfo } {
    const modelInfo: ModelInfo = {
      contextWindow: 4096, // Default, varies by model
      supportsImages: false, // Most Ollama models don't support images
      inputPrice: 0, // Local models are free
      outputPrice: 0,
      description: 'Local model via Ollama'
    }
    
    return {
      id: this.settings.model,
      info: this.settings.modelInfo || modelInfo
    }
  }
}

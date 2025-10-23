/**
 * LLM Client Package
 * Low-level LLM access without agent framework complexity
 */

import type { Message, StreamChunk, TokenUsage } from '@agent-framework/types'
import type { ApiHandler } from '@agent-framework/api'

export interface CompletionOptions {
  messages: Message[]
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  stopSequences?: string[]
}

export interface CompletionResult {
  content: string
  usage: TokenUsage
  stopReason?: string
}

export interface StreamOptions extends CompletionOptions {
  onChunk?: (content: string) => void
  onComplete?: (result: CompletionResult) => void
  onError?: (error: Error) => void
}

/**
 * LLMClient - Direct access to LLM without agent framework
 * 
 * Use this when you need:
 * - Simple LLM completions
 * - Custom streaming logic
 * - Direct control over API calls
 * - Integration with existing LLM code
 */
export class LLMClient {
  constructor(private provider: ApiHandler) {}
  
  /**
   * Non-streaming completion
   * Returns complete response after LLM finishes
   * 
   * @example
   * const client = new LLMClient(provider)
   * const result = await client.complete({
   *   messages: [{ role: 'user', content: 'Hello!' }]
   * })
   * console.log(result.content)
   */
  async complete(options: CompletionOptions): Promise<CompletionResult> {
    const chunks: StreamChunk[] = []
    let content = ''
    let usage: TokenUsage = {
      inputTokens: 0,
      outputTokens: 0
    }
    
    for await (const chunk of this.provider.createMessage({
      systemPrompt: options.systemPrompt,
      messages: options.messages,
      maxTokens: options.maxTokens,
      temperature: options.temperature
    })) {
      chunks.push(chunk)
      
      if (chunk.type === 'content') {
        content += chunk.content
      } else if (chunk.type === 'usage') {
        usage = chunk.usage || { inputTokens: 0, outputTokens: 0 }
      }
    }
    
    return {
      content,
      usage: usage || { inputTokens: 0, outputTokens: 0 },
      stopReason: 'end_turn'
    }
  }
  
  /**
   * Streaming completion with callbacks
   * Processes chunks as they arrive
   * 
   * @example
   * await client.stream({
   *   messages: [{ role: 'user', content: 'Tell me a story' }],
   *   onChunk: (content) => process.stdout.write(content)
   * })
   */
  async stream(options: StreamOptions): Promise<CompletionResult> {
    let content = ''
    let usage: TokenUsage = {
      inputTokens: 0,
      outputTokens: 0
    }
    
    try {
      for await (const chunk of this.provider.createMessage({
        systemPrompt: options.systemPrompt,
        messages: options.messages,
        maxTokens: options.maxTokens,
        temperature: options.temperature
      })) {
        if (chunk.type === 'content') {
          content += chunk.content
          if (options.onChunk && chunk.content) {
            options.onChunk(chunk.content)
          }
        } else if (chunk.type === 'usage') {
          usage = chunk.usage || { inputTokens: 0, outputTokens: 0 }
        } else if (chunk.type === 'error') {
          const error = chunk.error || new Error('Unknown error')
          if (options.onError) {
            options.onError(error)
          }
          throw error
        }
      }
      
      const result = { content, usage, stopReason: 'end_turn' }
      
      if (options.onComplete) {
        options.onComplete(result)
      }
      
      return result
    } catch (error) {
      if (options.onError && error instanceof Error) {
        options.onError(error)
      }
      throw error
    }
  }
  
  /**
   * Stream as async generator
   * Most flexible streaming option
   * 
   * @example
   * for await (const chunk of client.streamGenerator({...})) {
   *   process.stdout.write(chunk)
   * }
   */
  async *streamGenerator(options: CompletionOptions): AsyncGenerator<string, CompletionResult> {
    let content = ''
    let usage: TokenUsage = {
      inputTokens: 0,
      outputTokens: 0
    }
    
    for await (const chunk of this.provider.createMessage({
      systemPrompt: options.systemPrompt,
      messages: options.messages,
      maxTokens: options.maxTokens,
      temperature: options.temperature
    })) {
      if (chunk.type === 'content') {
        content += chunk.content
        if (chunk.content) {
          yield chunk.content
        }
      } else if (chunk.type === 'usage') {
        usage = chunk.usage || { inputTokens: 0, outputTokens: 0 }
      }
    }
    
    return { content, usage: usage || { inputTokens: 0, outputTokens: 0 }, stopReason: 'end_turn' }
  }
  
  /**
   * Batch multiple completions
   * Processes all in parallel
   * 
   * @example
   * const results = await client.batch([
   *   { messages: [...] },
   *   { messages: [...] }
   * ])
   */
  async batch(requests: CompletionOptions[]): Promise<CompletionResult[]> {
    return Promise.all(requests.map(req => this.complete(req)))
  }
  
  /**
   * Get provider info
   */
  getProvider(): string {
    return this.provider.getProvider()
  }
  
  /**
   * Get model info
   */
  getModel(): { id: string; info: any } {
    return this.provider.getModel()
  }
}

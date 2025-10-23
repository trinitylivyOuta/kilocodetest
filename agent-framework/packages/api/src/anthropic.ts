/**
 * Anthropic (Claude) Provider
 * Extracted and simplified from Kilocode
 */

import Anthropic from '@anthropic-ai/sdk'
import type { ProviderSettings, StreamChunk, ModelInfo } from '@agent-framework/types'
import { BaseApiHandler, type ApiHandlerOptions } from './base.js'

export class AnthropicProvider extends BaseApiHandler {
  private client: Anthropic
  
  constructor(settings: ProviderSettings) {
    super(settings)
    
    if (!settings.apiKey) {
      throw new Error('Anthropic API key is required')
    }
    
    this.client = new Anthropic({
      apiKey: settings.apiKey,
      baseURL: settings.baseURL
    })
  }
  
  async *createMessage(options: ApiHandlerOptions): AsyncGenerator<StreamChunk, void, unknown> {
    const { systemPrompt, messages, tools, maxTokens = 4096, temperature = 0 } = options
    
    try {
      const stream = await this.client.messages.create({
        model: this.settings.model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: this.convertMessages(messages) as Anthropic.MessageParam[],
        tools: this.convertTools(tools) as Anthropic.Tool[],
        stream: true
      })
      
      let currentToolUse: any = null
      let usage: any = {}
      
      for await (const event of stream) {
        switch (event.type) {
          case 'message_start':
            usage = event.message.usage
            break
            
          case 'content_block_start':
            if (event.content_block.type === 'tool_use') {
              currentToolUse = {
                id: event.content_block.id,
                name: event.content_block.name,
                input: ''
              }
            }
            break
            
          case 'content_block_delta':
            if (event.delta.type === 'text_delta') {
              yield {
                type: 'content',
                content: event.delta.text
              }
            } else if (event.delta.type === 'input_json_delta') {
              if (currentToolUse) {
                currentToolUse.input += event.delta.partial_json
              }
            }
            break
            
          case 'content_block_stop':
            if (currentToolUse) {
              yield {
                type: 'tool_use',
                toolUse: {
                  ...currentToolUse,
                  input: JSON.parse(currentToolUse.input)
                }
              }
              currentToolUse = null
            }
            break
            
          case 'message_delta':
            if (event.usage) {
              usage.output_tokens = event.usage.output_tokens
            }
            break
            
          case 'message_stop':
            if (usage.input_tokens || usage.output_tokens) {
              yield {
                type: 'usage',
                usage: {
                  inputTokens: usage.input_tokens || 0,
                  outputTokens: usage.output_tokens || 0,
                  cacheReadTokens: usage.cache_read_input_tokens || 0,
                  cacheWriteTokens: usage.cache_creation_input_tokens || 0
                }
              }
            }
            break
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
      contextWindow: 200000,
      supportsImages: true,
      supportsPromptCache: true,
      inputPrice: 3.00,
      outputPrice: 15.00,
      cacheWritesPrice: 3.75,
      cacheReadsPrice: 0.30,
      description: 'Claude 3.5 Sonnet'
    }
    
    return {
      id: this.settings.model,
      info: this.settings.modelInfo || modelInfo
    }
  }
}

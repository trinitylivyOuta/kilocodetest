/**
 * OpenAI Provider
 * Extracted and simplified from Kilocode
 */

import OpenAI from 'openai'
import type { ProviderSettings, StreamChunk, ModelInfo, ToolUse } from '@agent-framework/types'
import { BaseApiHandler, type ApiHandlerOptions } from './base.js'

export class OpenAIProvider extends BaseApiHandler {
  private client: OpenAI
  
  constructor(settings: ProviderSettings) {
    super(settings)
    
    if (!settings.apiKey) {
      throw new Error('OpenAI API key is required')
    }
    
    this.client = new OpenAI({
      apiKey: settings.apiKey,
      baseURL: settings.baseURL
    })
  }
  
  async *createMessage(options: ApiHandlerOptions): AsyncGenerator<StreamChunk, void, unknown> {
    const { systemPrompt, messages, tools, maxTokens = 4096, temperature = 0 } = options
    
    try {
      // Convert to OpenAI format
      const openaiMessages: OpenAI.ChatCompletionMessageParam[] = []
      
      if (systemPrompt) {
        openaiMessages.push({
          role: 'system',
          content: systemPrompt
        })
      }
      
      for (const msg of messages) {
        openaiMessages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: typeof msg.content === 'string' 
            ? msg.content 
            : msg.content.map(block => {
                if (block.type === 'text') {
                  return { type: 'text', text: block.text }
                } else if (block.type === 'image') {
                  return {
                    type: 'image_url',
                    image_url: {
                      url: `data:${block.source.media_type};base64,${block.source.data}`
                    }
                  }
                }
                return block
              }) as any
        })
      }
      
      const stream = await this.client.chat.completions.create({
        model: this.settings.model,
        max_tokens: maxTokens,
        temperature,
        messages: openaiMessages,
        tools: this.convertToolsToOpenAI(tools),
        stream: true
      })
      
      let currentToolCall: any = null
      let usage: any = {}
      
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta
        
        if (!delta) continue
        
        // Content
        if (delta.content) {
          yield {
            type: 'content',
            content: delta.content
          }
        }
        
        // Tool calls
        if (delta.tool_calls) {
          for (const toolCall of delta.tool_calls) {
            if (toolCall.function) {
              if (!currentToolCall || currentToolCall.id !== toolCall.id) {
                if (currentToolCall) {
                  yield {
                    type: 'tool_use',
                    toolUse: {
                      id: currentToolCall.id,
                      name: currentToolCall.name,
                      input: JSON.parse(currentToolCall.arguments)
                    }
                  }
                }
                currentToolCall = {
                  id: toolCall.id || `tool_${Date.now()}`,
                  name: toolCall.function.name || '',
                  arguments: ''
                }
              }
              
              if (toolCall.function.arguments) {
                currentToolCall.arguments += toolCall.function.arguments
              }
            }
          }
        }
        
        // Usage
        if (chunk.usage) {
          usage = chunk.usage
        }
      }
      
      // Emit final tool call if any
      if (currentToolCall) {
        yield {
          type: 'tool_use',
          toolUse: {
            id: currentToolCall.id,
            name: currentToolCall.name,
            input: JSON.parse(currentToolCall.arguments)
          }
        }
      }
      
      // Emit usage
      if (usage.prompt_tokens || usage.completion_tokens) {
        yield {
          type: 'usage',
          usage: {
            inputTokens: usage.prompt_tokens || 0,
            outputTokens: usage.completion_tokens || 0
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
  
  private convertToolsToOpenAI(tools?: any[]): OpenAI.ChatCompletionTool[] | undefined {
    if (!tools || tools.length === 0) return undefined
    
    return tools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema
      }
    }))
  }
  
  getModel(): { id: string; info: ModelInfo } {
    const modelInfo: ModelInfo = {
      contextWindow: 128000,
      supportsImages: true,
      inputPrice: 2.50,
      outputPrice: 10.00,
      description: 'GPT-4'
    }
    
    return {
      id: this.settings.model,
      info: this.settings.modelInfo || modelInfo
    }
  }
}

import type { ApiHandler, Message, ModelInfo } from '@agent-framework/types'
import { BaseApiHandler } from './base'

/**
 * Gemini Provider
 * 
 * Implements Google's Gemini API for the agent framework.
 * Supports Gemini Pro and other Google AI models.
 * 
 * @example
 * ```typescript
 * import { GeminiProvider } from '@agent-framework/api'
 * 
 * const provider = new GeminiProvider({
 *   provider: 'gemini',
 *   apiKey: process.env.GEMINI_API_KEY!,
 *   model: 'gemini-pro'
 * })
 * ```
 */
export class GeminiProvider extends BaseApiHandler implements ApiHandler {
  private apiUrl: string
  private modelName: string

  constructor(options: {
    provider: 'gemini'
    apiKey?: string
    model: string
    baseURL?: string
  }) {
    super({
      provider: options.provider,
      apiKey: options.apiKey || process.env.GEMINI_API_KEY || '',
      model: options.model,
    })

    if (!this.settings.apiKey) {
      throw new Error('Gemini API key is required')
    }

    this.modelName = options.model
    this.apiUrl = options.baseURL || 'https://generativelanguage.googleapis.com/v1beta'
  }

  /**
   * Create a message using Gemini API
   */
  async createMessage(params: {
    messages: Message[]
    systemPrompt?: string
    tools?: any[]
    maxTokens?: number
  }): Promise<any> {
    const url = `${this.apiUrl}/models/${this.modelName}:generateContent?key=${this.settings.apiKey}`

    // Convert messages to Gemini format
    const contents = this.convertMessagesToGemini(params.messages)

    const requestBody: any = {
      contents,
      generationConfig: {
        maxOutputTokens: params.maxTokens || 4096,
        temperature: 0.7,
      },
    }

    // Add system instruction if provided
    if (params.systemPrompt) {
      requestBody.systemInstruction = {
        parts: [{ text: params.systemPrompt }],
      }
    }

    // Add tools if provided
    if (params.tools && params.tools.length > 0) {
      requestBody.tools = this.convertToolsToGemini(params.tools)
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Gemini API error: ${response.status} - ${error}`)
    }

    const data = await response.json()

    // Convert Gemini response to standard format
    return this.convertGeminiResponse(data)
  }

  /**
   * Stream messages from Gemini API
   */
  async *streamMessage(params: {
    messages: Message[]
    systemPrompt?: string
    tools?: any[]
    maxTokens?: number
  }): AsyncGenerator<any> {
    const url = `${this.apiUrl}/models/${this.modelName}:streamGenerateContent?key=${this.settings.apiKey}&alt=sse`

    const contents = this.convertMessagesToGemini(params.messages)

    const requestBody: any = {
      contents,
      generationConfig: {
        maxOutputTokens: params.maxTokens || 4096,
        temperature: 0.7,
      },
    }

    if (params.systemPrompt) {
      requestBody.systemInstruction = {
        parts: [{ text: params.systemPrompt }],
      }
    }

    if (params.tools && params.tools.length > 0) {
      requestBody.tools = this.convertToolsToGemini(params.tools)
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Gemini API error: ${response.status} - ${error}`)
    }

    if (!response.body) {
      throw new Error('No response body from Gemini API')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6)
            if (jsonStr === '[DONE]') continue

            try {
              const data = JSON.parse(jsonStr)
              
              // Yield text deltas from Gemini
              if (data.candidates?.[0]?.content?.parts) {
                for (const part of data.candidates[0].content.parts) {
                  if (part.text) {
                    yield {
                      type: 'content_block_delta',
                      index: 0,
                      delta: {
                        type: 'text_delta',
                        text: part.text,
                      },
                    }
                  }
                }
              }
            } catch (e) {
              // Ignore parse errors for SSE
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  /**
   * Get model information
   */
  getModel(): ModelInfo {
    return {
      id: this.modelName,
      name: `Google ${this.modelName}`,
      contextWindow: this.getContextWindow(),
      supportsTools: true,
      supportsStreaming: true,
    }
  }

  /**
   * Get context window size for model
   */
  private getContextWindow(): number {
    if (this.modelName.includes('gemini-1.5-pro')) return 1000000 // 1M tokens
    if (this.modelName.includes('gemini-1.5-flash')) return 1000000
    if (this.modelName.includes('gemini-pro')) return 32768
    return 32768
  }

  /**
   * Convert standard messages to Gemini format
   */
  private convertMessagesToGemini(messages: Message[]): any[] {
    return messages.map((msg) => {
      const parts: any[] = []

      if (typeof msg.content === 'string') {
        parts.push({ text: msg.content })
      } else if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === 'text') {
            parts.push({ text: block.text })
          } else if (block.type === 'tool_use') {
            parts.push({
              functionCall: {
                name: block.name,
                args: block.input,
              },
            })
          } else if (block.type === 'tool_result') {
            parts.push({
              functionResponse: {
                name: block.tool_use_id,
                response: block.content,
              },
            })
          }
        }
      }

      return {
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts,
      }
    })
  }

  /**
   * Convert tools to Gemini function calling format
   */
  private convertToolsToGemini(tools: any[]): any[] {
    return [
      {
        functionDeclarations: tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema,
        })),
      },
    ]
  }

  /**
   * Convert Gemini response to standard format
   */
  private convertGeminiResponse(data: any): any {
    const candidate = data.candidates?.[0]
    if (!candidate) {
      throw new Error('No candidates in Gemini response')
    }

    const content: any[] = []
    
    // Process parts
    for (const part of candidate.content?.parts || []) {
      if (part.text) {
        content.push({
          type: 'text',
          text: part.text,
        })
      } else if (part.functionCall) {
        content.push({
          type: 'tool_use',
          id: `tool_${Date.now()}`,
          name: part.functionCall.name,
          input: part.functionCall.args || {},
        })
      }
    }

    return {
      id: data.usageMetadata?.promptTokenCount ? `msg_${Date.now()}` : 'msg_unknown',
      type: 'message',
      role: 'assistant',
      content,
      model: this.modelName,
      stop_reason: candidate.finishReason === 'STOP' ? 'end_turn' : 'tool_use',
      usage: {
        input_tokens: data.usageMetadata?.promptTokenCount || 0,
        output_tokens: data.usageMetadata?.candidatesTokenCount || 0,
      },
    }
  }
}


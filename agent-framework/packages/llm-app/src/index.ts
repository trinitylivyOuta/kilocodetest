/**
 * LLM App Package
 * LLM with tools but without agentic loop - single-shot or manual iteration
 */

import type { Message, ToolUse, ToolResult, RuntimeAdapter, TokenUsage } from '@agent-framework/types'
import type { ApiHandler, ApiHandlerOptions } from '@agent-framework/api'
import { ToolExecutor, type BaseTool } from '@agent-framework/tools'

export interface LLMAppOptions {
  provider: ApiHandler
  adapter: RuntimeAdapter
  tools?: BaseTool[]
  systemPrompt?: string
  autoExecuteTools?: boolean
}

export interface ChatOptions {
  message?: string
  messages?: Message[]
  executeTools?: boolean
  toolResults?: ToolResult[]
  temperature?: number
  maxTokens?: number
}

export interface ChatResponse {
  content: string
  toolCalls?: ToolUse[]
  requiresToolExecution: boolean
  usage: TokenUsage
}

/**
 * LLMApp - LLM application with tools but no agentic loop
 * 
 * Use this when you need:
 * - Function calling without iteration
 * - Manual control over tool execution
 * - Single-shot LLM + tools interaction
 * - Custom decision logic
 * 
 * @example
 * const app = new LLMApp({
 *   provider: new AnthropicProvider({...}),
 *   adapter: new NodeAdapter({...}),
 *   tools: [readFileTool, writeFileTool],
 *   autoExecuteTools: false
 * })
 * 
 * // Single interaction
 * const response = await app.chat({
 *   message: 'Read package.json'
 * })
 * 
 * if (response.requiresToolExecution) {
 *   // Manually approve and execute tools
 *   const results = await app.executeTools(response.toolCalls)
 *   const finalResponse = await app.chat({ toolResults: results })
 * }
 */
export class LLMApp {
  private provider: ApiHandler
  private adapter: RuntimeAdapter
  private toolExecutor: ToolExecutor
  private systemPrompt: string
  private conversationHistory: Message[] = []
  private autoExecuteTools: boolean
  private totalUsage: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0
  }
  
  constructor(options: LLMAppOptions) {
    this.provider = options.provider
    this.adapter = options.adapter
    this.autoExecuteTools = options.autoExecuteTools ?? false
    
    this.systemPrompt = options.systemPrompt || this.buildDefaultSystemPrompt()
    
    // Initialize tool executor
    this.toolExecutor = new ToolExecutor(options.tools || [], {
      adapter: this.adapter,
      taskId: 'llm-app',
      getApproval: this.adapter.getApproval?.bind(this.adapter)
    })
  }
  
  private buildDefaultSystemPrompt(): string {
    const toolDefs = this.toolExecutor.getToolDefinitions()
    if (toolDefs.length === 0) {
      return 'You are a helpful AI assistant.'
    }
    
    return `You are a helpful AI assistant with access to tools.

Available tools:
${toolDefs.map(t => `- ${t.name}: ${t.description}`).join('\n')}

When you need to use a tool, describe what you want to do.`
  }
  
  /**
   * Single chat interaction
   * 
   * @param options Chat options
   * @returns Response with content and optional tool calls
   */
  async chat(options: ChatOptions): Promise<ChatResponse> {
    // Add user message if provided
    if (options.message) {
      this.conversationHistory.push({
        role: 'user',
        content: options.message
      })
    }
    
    // Add custom messages if provided
    if (options.messages) {
      this.conversationHistory.push(...options.messages)
    }
    
    // Add tool results if provided
    if (options.toolResults && options.toolResults.length > 0) {
      // Add tool results as a simple message
      const resultsText = options.toolResults
        .map(r => `Tool ${r.tool_use_id}: ${r.content}`)
        .join('\n')
      
      this.conversationHistory.push({
        role: 'user',
        content: resultsText
      })
    }
    
    // Call LLM
    const response = await this.getLLMResponse(options)
    
    // Add assistant response to history
    this.conversationHistory.push({
      role: 'assistant',
      content: response.textContent
    })
    
    // Check for tool calls
    const toolCalls = this.extractToolCalls(response.textContent)
    
    if (toolCalls.length > 0) {
      const shouldExecute = options.executeTools ?? this.autoExecuteTools
      
      if (shouldExecute) {
        // Auto-execute tools and continue conversation
        const results = await this.executeTools(toolCalls)
        return this.chat({ toolResults: results })
      }
      
      // Return with tool calls for manual execution
      return {
        content: response.textContent,
        toolCalls,
        requiresToolExecution: true,
        usage: response.usage || { inputTokens: 0, outputTokens: 0 }
      }
    }
    
    return {
      content: response.textContent,
      requiresToolExecution: false,
      usage: response.usage || { inputTokens: 0, outputTokens: 0 }
    }
  }
  
  /**
   * Execute specific tools manually
   * 
   * @param toolCalls Tools to execute
   * @returns Tool execution results
   */
  async executeTools(toolCalls: ToolUse[]): Promise<ToolResult[]> {
    const results: ToolResult[] = []
    
    for (const toolCall of toolCalls) {
      try {
        const result = await this.toolExecutor.executeTool(toolCall)
        results.push(result)
      } catch (error) {
        const errorResult: ToolResult = {
          tool_use_id: toolCall.id,
          content: `Error executing tool: ${error instanceof Error ? error.message : String(error)}`,
          is_error: true
        }
        results.push(errorResult)
      }
    }
    
    return results
  }
  
  /**
   * Reset conversation history
   */
  reset(): void {
    this.conversationHistory = []
    this.totalUsage = {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0
    }
  }
  
  /**
   * Get conversation history
   */
  getHistory(): Message[] {
    return [...this.conversationHistory]
  }
  
  /**
   * Get total token usage
   */
  getUsage(): TokenUsage {
    return { ...this.totalUsage }
  }
  
  private async getLLMResponse(options: ChatOptions) {
    const toolDefs = this.toolExecutor.getToolDefinitions()
    
    let textContent = ''
    let usage: TokenUsage = {
      inputTokens: 0,
      outputTokens: 0
    }
    
    const apiOptions: ApiHandlerOptions = {
      systemPrompt: this.systemPrompt,
      messages: this.conversationHistory,
      tools: toolDefs.length > 0 ? toolDefs : undefined,
      maxTokens: options.maxTokens,
      temperature: options.temperature
    }
    
    for await (const chunk of this.provider.createMessage(apiOptions)) {
      if (chunk.type === 'content') {
        textContent += chunk.content
      } else if (chunk.type === 'usage' && chunk.usage) {
        const chunkUsage = chunk.usage
        usage = chunkUsage
        // Accumulate usage
        this.totalUsage.inputTokens += chunkUsage.inputTokens
        this.totalUsage.outputTokens += chunkUsage.outputTokens
        if (chunkUsage.cacheReadTokens) {
          this.totalUsage.cacheReadTokens = (this.totalUsage.cacheReadTokens || 0) + chunkUsage.cacheReadTokens
        }
        if (chunkUsage.cacheWriteTokens) {
          this.totalUsage.cacheWriteTokens = (this.totalUsage.cacheWriteTokens || 0) + chunkUsage.cacheWriteTokens
        }
      }
    }
    
    return { textContent, usage: usage || { inputTokens: 0, outputTokens: 0 } }
  }
  
  private extractToolCalls(_content: string): ToolUse[] {
    // This is a simplified extraction
    // In reality, providers return tool calls in structured format
    // This would need to parse the actual provider response format
    
    // For now, return empty array
    // Real implementation would parse provider-specific tool call format
    return []
  }
}

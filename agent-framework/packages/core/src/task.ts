/**
 * Task - Represents a single agent task execution
 * Simplified extraction from Kilocode's Task.ts (3,236 LOC → ~400 LOC)
 */

import EventEmitter from 'eventemitter3'
import type {
  TaskOptions,
  TaskStatus,
  TaskResult,
  Message,
  ContentBlock,
  ToolUse,
  ToolResult,
  TokenUsage,
  RuntimeAdapter
} from '@agent-framework/types'
import type { ApiHandler } from '@agent-framework/api'
import { ToolExecutor, type BaseTool } from '@agent-framework/tools'

export class Task extends EventEmitter {
  private taskId: string
  private status: TaskStatus = 'pending'
  private apiHandler: ApiHandler
  private toolExecutor: ToolExecutor
  private systemPrompt: string
  private messages: Message[] = []
  private aborted = false
  private result?: TaskResult
  private totalUsage: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0
  }
  
  constructor(
    taskId: string,
    apiHandler: ApiHandler,
    adapter: RuntimeAdapter,
    tools: BaseTool[],
    options: TaskOptions
  ) {
    super()
    this.taskId = taskId
    this.apiHandler = apiHandler
    this.systemPrompt = options.systemPrompt || this.buildDefaultSystemPrompt()
    
    // Initialize tool executor
    this.toolExecutor = new ToolExecutor(tools, {
      adapter,
      taskId,
      getApproval: adapter.getApproval?.bind(adapter)
    })
  }
  
  private buildDefaultSystemPrompt(): string {
    return `You are an AI assistant that helps users complete tasks.

You have access to tools to interact with the file system and execute commands.
Always use tools when you need to read files, write files, list directories, or execute commands.

When you complete the task, use the attempt_completion tool to present your result.

Think step by step and explain your reasoning.`
  }
  
  /**
   * Start the task execution
   */
  async start(prompt: string): Promise<void> {
    if (this.status !== 'pending') {
      throw new Error('Task already started')
    }
    
    this.status = 'running'
    this.emit('start', { type: 'start', timestamp: Date.now() })
    
    // Add initial user message
    this.addUserMessage(prompt)
    
    try {
      await this.executionLoop()
      
      if (!this.aborted) {
        this.status = 'completed'
        this.result = {
          success: true,
          message: 'Task completed successfully'
        }
      }
    } catch (error) {
      this.status = 'error'
      this.result = {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
      this.emit('error', {
        type: 'error',
        timestamp: Date.now(),
        data: { error: this.result.error }
      })
    } finally {
      this.emit('complete', {
        type: 'complete',
        timestamp: Date.now(),
        data: { result: this.result }
      })
    }
  }
  
  /**
   * Main execution loop - simplified from Kilocode
   */
  private async executionLoop(): Promise<void> {
    let iterations = 0
    const maxIterations = 50 // Prevent infinite loops
    
    while (!this.aborted && iterations < maxIterations) {
      iterations++
      
      // Call LLM API
      const stream = this.apiHandler.createMessage({
        systemPrompt: this.systemPrompt,
        messages: this.messages,
        tools: this.toolExecutor.getToolDefinitions()
      })
      
      // Process streaming response
      let assistantContent = ''
      const toolUses: ToolUse[] = []
      
      for await (const chunk of stream) {
        if (this.aborted) break
        
        switch (chunk.type) {
          case 'content':
            if (chunk.content) {
              assistantContent += chunk.content
              this.emit('progress', {
                type: 'progress',
                timestamp: Date.now(),
                data: { content: chunk.content }
              })
            }
            break
            
          case 'tool_use':
            if (chunk.toolUse) {
              toolUses.push(chunk.toolUse)
              this.emit('tool_use', {
                type: 'tool_use',
                timestamp: Date.now(),
                data: { toolUse: chunk.toolUse }
              })
            }
            break
            
          case 'usage':
            if (chunk.usage) {
              this.updateUsage(chunk.usage)
            }
            break
            
          case 'error':
            throw chunk.error || new Error('Unknown API error')
        }
      }
      
      // Add assistant message to history
      const assistantMessage: Message = {
        role: 'assistant',
        content: this.buildAssistantContent(assistantContent, toolUses)
      }
      this.messages.push(assistantMessage)
      
      this.emit('assistant_message', {
        type: 'assistant_message',
        timestamp: Date.now(),
        data: { message: assistantMessage }
      })
      
      // Execute tools if any
      if (toolUses.length > 0) {
        const toolResults = await this.executeTools(toolUses)
        
        // Check for completion tool
        const completionTool = toolUses.find(t => t.name === 'attempt_completion')
        if (completionTool) {
          this.status = 'completed'
          this.result = {
            success: true,
            message: completionTool.input.result as string
          }
          break
        }
        
        // Add tool results as user message
        this.addToolResultsMessage(toolResults)
      } else {
        // No tools used and no completion - done
        break
      }
    }
    
    if (iterations >= maxIterations) {
      throw new Error('Max iterations reached')
    }
  }
  
  /**
   * Execute tools
   */
  private async executeTools(toolUses: ToolUse[]): Promise<ToolResult[]> {
    const results: ToolResult[] = []
    
    for (const toolUse of toolUses) {
      const result = await this.toolExecutor.executeTool(toolUse)
      results.push(result)
      
      this.emit('tool_result', {
        type: 'tool_result',
        timestamp: Date.now(),
        data: { toolUse, result }
      })
    }
    
    return results
  }
  
  /**
   * Build assistant content with text and tool uses
   */
  private buildAssistantContent(text: string, _toolUses: ToolUse[]): ContentBlock[] {
    const content: ContentBlock[] = []
    
    if (text) {
      content.push({ type: 'text', text })
    }
    
    // Note: Tool uses are tracked separately in our simplified format
    // In production, you might want to include them in the content
    
    return content
  }
  
  /**
   * Add user message
   */
  private addUserMessage(text: string): void {
    const message: Message = {
      role: 'user',
      content: text
    }
    this.messages.push(message)
    
    this.emit('user_message', {
      type: 'user_message',
      timestamp: Date.now(),
      data: { message }
    })
  }
  
  /**
   * Add tool results as user message
   */
  private addToolResultsMessage(results: ToolResult[]): void {
    const content: ContentBlock[] = results.map(result => ({
      type: 'text',
      text: `Tool: ${result.tool_use_id}\n${result.is_error ? 'ERROR: ' : ''}${result.content}`
    }))
    
    const message: Message = {
      role: 'user',
      content
    }
    this.messages.push(message)
  }
  
  /**
   * Update token usage
   */
  private updateUsage(usage: TokenUsage): void {
    this.totalUsage.inputTokens += usage.inputTokens
    this.totalUsage.outputTokens += usage.outputTokens
    this.totalUsage.cacheReadTokens = (this.totalUsage.cacheReadTokens || 0) + (usage.cacheReadTokens || 0)
    this.totalUsage.cacheWriteTokens = (this.totalUsage.cacheWriteTokens || 0) + (usage.cacheWriteTokens || 0)
  }
  
  /**
   * Abort the task
   */
  abort(): void {
    this.aborted = true
    this.status = 'aborted'
    this.result = {
      success: false,
      message: 'Task aborted by user'
    }
    this.emit('aborted', {
      type: 'aborted',
      timestamp: Date.now()
    })
  }
  
  /**
   * Wait for task completion
   */
  async waitForCompletion(): Promise<TaskResult> {
    if (this.status === 'completed' || this.status === 'error' || this.status === 'aborted') {
      return this.result || { success: false, error: 'Unknown error' }
    }
    
    return new Promise((resolve) => {
      this.once('complete', () => {
        resolve(this.result || { success: false, error: 'Unknown error' })
      })
    })
  }
  
  /**
   * Get current status
   */
  getStatus(): TaskStatus {
    return this.status
  }
  
  /**
   * Get task ID
   */
  getTaskId(): string {
    return this.taskId
  }
  
  /**
   * Get token usage
   */
  getUsage(): TokenUsage {
    return { ...this.totalUsage }
  }
}

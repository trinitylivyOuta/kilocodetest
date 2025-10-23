/**
 * Agent - Main entry point for the framework
 * Simplified extraction from Kilocode's ClineProvider.ts (3,347 LOC → ~150 LOC)
 */

import { randomUUID } from 'crypto'
import type { RuntimeAdapter, AgentConfig, TaskOptions } from '@agent-framework/types'
import type { ApiHandler } from '@agent-framework/api'
import type { BaseTool } from '@agent-framework/tools'
import { Task } from './task.js'

export interface AgentOptions {
  apiHandler: ApiHandler
  adapter: RuntimeAdapter
  tools: BaseTool[]
  systemPrompt?: string
  autoApprove?: boolean
}

/**
 * Agent class - orchestrates task execution
 */
export class Agent {
  private apiHandler: ApiHandler
  private adapter: RuntimeAdapter
  private tools: BaseTool[]
  private systemPrompt?: string
  private autoApprove: boolean
  private tasks: Map<string, Task> = new Map()
  
  constructor(options: AgentOptions) {
    this.apiHandler = options.apiHandler
    this.adapter = options.adapter
    this.tools = options.tools
    this.systemPrompt = options.systemPrompt
    this.autoApprove = options.autoApprove ?? false
  }
  
  /**
   * Execute a task
   */
  async executeTask(options: TaskOptions): Promise<Task> {
    const taskId = randomUUID()
    
    // Create task
    const task = new Task(
      taskId,
      this.apiHandler,
      this.adapter,
      this.tools,
      {
        ...options,
        systemPrompt: options.systemPrompt || this.systemPrompt,
        autoApprove: this.autoApprove
      }
    )
    
    // Store task
    this.tasks.set(taskId, task)
    
    // Forward task events if handler provided
    if (options.onProgress) {
      task.on('start', options.onProgress)
      task.on('progress', options.onProgress)
      task.on('tool_use', options.onProgress)
      task.on('tool_result', options.onProgress)
      task.on('assistant_message', options.onProgress)
      task.on('user_message', options.onProgress)
      task.on('error', options.onProgress)
      task.on('complete', options.onProgress)
      task.on('aborted', options.onProgress)
    }
    
    // Start task execution (non-blocking)
    task.start(options.prompt).catch(error => {
      console.error('Task execution error:', error)
    })
    
    return task
  }
  
  /**
   * Get a task by ID
   */
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId)
  }
  
  /**
   * Get all tasks
   */
  getTasks(): Task[] {
    return Array.from(this.tasks.values())
  }
  
  /**
   * Get model info
   */
  getModelInfo() {
    return this.apiHandler.getModel()
  }
  
  /**
   * Get provider name
   */
  getProvider(): string {
    return this.apiHandler.getProvider()
  }
}

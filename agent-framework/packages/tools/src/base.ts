/**
 * Base Tool class
 * Extracted from Kilocode tool system
 */

import type { ToolDefinition, ToolUse, ToolResult, RuntimeAdapter } from '@agent-framework/types'

export interface ToolContext {
  adapter: RuntimeAdapter
  taskId: string
  getApproval?: (action: string, details: any) => Promise<boolean>
}

export abstract class BaseTool {
  abstract get definition(): ToolDefinition
  
  abstract execute(input: Record<string, any>, context: ToolContext): Promise<ToolResult>
  
  /**
   * Validate tool input against the schema
   */
  protected validateInput(input: Record<string, any>): void {
    const { required = [] } = this.definition.input_schema
    
    for (const field of required) {
      if (!(field in input)) {
        throw new Error(`Missing required field: ${field}`)
      }
    }
  }
  
  /**
   * Create a successful tool result
   */
  protected success(content: string, toolUseId: string): ToolResult {
    return {
      tool_use_id: toolUseId,
      content
    }
  }
  
  /**
   * Create an error tool result
   */
  protected error(message: string, toolUseId: string): ToolResult {
    return {
      tool_use_id: toolUseId,
      content: message,
      is_error: true
    }
  }
}

/**
 * Tool executor manages tool execution
 */
export class ToolExecutor {
  private tools: Map<string, BaseTool> = new Map()
  private context: ToolContext
  
  constructor(tools: BaseTool[], context: ToolContext) {
    this.context = context
    
    for (const tool of tools) {
      this.tools.set(tool.definition.name, tool)
    }
  }
  
  /**
   * Get all tool definitions
   */
  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(tool => tool.definition)
  }
  
  /**
   * Execute a tool
   */
  async executeTool(toolUse: ToolUse): Promise<ToolResult> {
    const tool = this.tools.get(toolUse.name)
    
    if (!tool) {
      return {
        tool_use_id: toolUse.id,
        content: `Unknown tool: ${toolUse.name}`,
        is_error: true
      }
    }
    
    try {
      return await tool.execute(toolUse.input, this.context)
    } catch (error) {
      return {
        tool_use_id: toolUse.id,
        content: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
        is_error: true
      }
    }
  }
}

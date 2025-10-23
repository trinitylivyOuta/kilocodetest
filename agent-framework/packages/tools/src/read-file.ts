/**
 * Read File Tool
 * Extracted from Kilocode
 */

import { BaseTool, type ToolContext } from './base.js'
import type { ToolDefinition, ToolResult } from '@agent-framework/types'

export class ReadFileTool extends BaseTool {
  get definition(): ToolDefinition {
    return {
      name: 'read_file',
      description: 'Read the contents of a file at the specified path. Use this when you need to examine the contents of an existing file.',
      input_schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The path of the file to read (relative to workspace root)'
          }
        },
        required: ['path']
      }
    }
  }
  
  async execute(input: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    this.validateInput(input)
    
    const { path } = input
    const toolUseId = `read_file_${Date.now()}`
    
    try {
      const exists = await context.adapter.fileSystem.exists(path)
      if (!exists) {
        return this.error(`File not found: ${path}`, toolUseId)
      }
      
      const content = await context.adapter.fileSystem.readFile(path)
      return this.success(content, toolUseId)
    } catch (error) {
      return this.error(
        `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
        toolUseId
      )
    }
  }
}

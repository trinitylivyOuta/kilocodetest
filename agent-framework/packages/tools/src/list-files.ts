/**
 * List Files Tool
 * Extracted from Kilocode
 */

import { BaseTool, type ToolContext } from './base.js'
import type { ToolDefinition, ToolResult } from '@agent-framework/types'

export class ListFilesTool extends BaseTool {
  get definition(): ToolDefinition {
    return {
      name: 'list_files',
      description: 'List all files and directories in the specified directory path.',
      input_schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The directory path to list (relative to workspace root, use "." for workspace root)'
          }
        },
        required: ['path']
      }
    }
  }
  
  async execute(input: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    this.validateInput(input)
    
    const { path } = input
    const toolUseId = `list_files_${Date.now()}`
    
    try {
      const exists = await context.adapter.fileSystem.exists(path)
      if (!exists) {
        return this.error(`Directory not found: ${path}`, toolUseId)
      }
      
      const files = await context.adapter.fileSystem.listFiles(path)
      const output = files.length > 0 ? files.join('\n') : '(empty directory)'
      
      return this.success(output, toolUseId)
    } catch (error) {
      return this.error(
        `Failed to list files: ${error instanceof Error ? error.message : String(error)}`,
        toolUseId
      )
    }
  }
}

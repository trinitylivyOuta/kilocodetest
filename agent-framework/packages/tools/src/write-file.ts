/**
 * Write File Tool
 * Extracted from Kilocode
 */

import { BaseTool, type ToolContext } from './base.js'
import type { ToolDefinition, ToolResult } from '@agent-framework/types'

export class WriteFileTool extends BaseTool {
  get definition(): ToolDefinition {
    return {
      name: 'write_file',
      description: 'Write content to a file at the specified path. This will create the file if it doesn\'t exist, or overwrite it if it does.',
      input_schema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The path where the file should be written (relative to workspace root)'
          },
          content: {
            type: 'string',
            description: 'The content to write to the file'
          }
        },
        required: ['path', 'content']
      }
    }
  }
  
  async execute(input: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    this.validateInput(input)
    
    const { path, content } = input
    const toolUseId = `write_file_${Date.now()}`
    
    // Request approval if handler is available
    if (context.getApproval) {
      const approved = await context.getApproval('write_file', {
        path,
        contentLength: content.length
      })
      
      if (!approved) {
        return this.error('User denied file write operation', toolUseId)
      }
    }
    
    try {
      await context.adapter.fileSystem.writeFile(path, content)
      return this.success(`Successfully wrote to ${path}`, toolUseId)
    } catch (error) {
      return this.error(
        `Failed to write file: ${error instanceof Error ? error.message : String(error)}`,
        toolUseId
      )
    }
  }
}

/**
 * Search Files Tool
 * Search for files matching a pattern in the workspace
 */

import { BaseTool, type ToolContext } from './base.js'
import type { ToolDefinition, ToolResult } from '@agent-framework/types'

export class SearchFilesTool extends BaseTool {
  get definition(): ToolDefinition {
    return {
      name: 'search_files',
      description: 'Search for files in the workspace that match a pattern. Use this to find files by name, extension, or path pattern. Supports glob patterns like *.ts, **/*.json, etc.',
      input_schema: {
        type: 'object',
        properties: {
          pattern: {
            type: 'string',
            description: 'The search pattern (glob pattern). Examples: "*.ts" for all TypeScript files, "**/*.json" for all JSON files recursively, "src/**/*.ts" for TypeScript files in src directory'
          },
          path: {
            type: 'string',
            description: 'Optional: The directory to search in (relative to workspace root). Defaults to "." (workspace root)'
          }
        },
        required: ['pattern']
      }
    }
  }
  
  async execute(input: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    this.validateInput(input)
    
    const { pattern, path = '.' } = input
    const toolUseId = `search_files_${Date.now()}`
    
    try {
      // Use find command to search for files
      // This is a simple implementation - could be enhanced with better glob matching
      const searchPath = path === '.' ? '.' : path
      
      // Convert glob pattern to find command
      // This is a simplified approach - a full implementation would use a proper glob library
      let findCommand: string
      
      if (pattern.includes('*')) {
        // Glob pattern
        findCommand = `find ${searchPath} -name "${pattern}" -type f 2>/dev/null || true`
      } else {
        // Exact match
        findCommand = `find ${searchPath} -name "${pattern}" -type f 2>/dev/null || true`
      }
      
      const result = await context.adapter.commandExecutor.execute(
        findCommand,
        context.adapter.workspaceDir
      )
      
      if (result.exitCode !== 0 && result.stdout.trim() === '') {
        return this.success('No files found matching the pattern', toolUseId)
      }
      
      const files = result.stdout.trim().split('\n').filter(f => f.length > 0)
      
      if (files.length === 0) {
        return this.success('No files found matching the pattern', toolUseId)
      }
      
      const output = `Found ${files.length} file(s):\n${files.join('\n')}`
      return this.success(output, toolUseId)
      
    } catch (error) {
      return this.error(
        `Failed to search files: ${error instanceof Error ? error.message : String(error)}`,
        toolUseId
      )
    }
  }
}

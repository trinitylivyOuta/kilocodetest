/**
 * Execute Command Tool
 * Extracted from Kilocode
 */

import { BaseTool, type ToolContext } from './base.js'
import type { ToolDefinition, ToolResult } from '@agent-framework/types'

export class ExecuteCommandTool extends BaseTool {
  get definition(): ToolDefinition {
    return {
      name: 'execute_command',
      description: 'Execute a command in the terminal. Use this to run build commands, tests, scripts, or any other terminal operations.',
      input_schema: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The command to execute'
          }
        },
        required: ['command']
      }
    }
  }
  
  async execute(input: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    this.validateInput(input)
    
    const { command } = input
    const toolUseId = `execute_command_${Date.now()}`
    
    // Request approval if handler is available
    if (context.getApproval) {
      const approved = await context.getApproval('execute_command', { command })
      
      if (!approved) {
        return this.error('User denied command execution', toolUseId)
      }
    }
    
    try {
      const result = await context.adapter.commandExecutor.execute(
        command,
        context.adapter.workspaceDir
      )
      
      let output = ''
      if (result.stdout) {
        output += `STDOUT:\n${result.stdout}\n`
      }
      if (result.stderr) {
        output += `STDERR:\n${result.stderr}\n`
      }
      output += `Exit Code: ${result.exitCode}`
      
      if (result.exitCode !== 0) {
        return this.error(output, toolUseId)
      }
      
      return this.success(output, toolUseId)
    } catch (error) {
      return this.error(
        `Failed to execute command: ${error instanceof Error ? error.message : String(error)}`,
        toolUseId
      )
    }
  }
}

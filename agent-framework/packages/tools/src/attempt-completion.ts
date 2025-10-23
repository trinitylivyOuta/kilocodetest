/**
 * Attempt Completion Tool
 * Extracted from Kilocode
 */

import { BaseTool, type ToolContext } from './base.js'
import type { ToolDefinition, ToolResult } from '@agent-framework/types'

export class AttemptCompletionTool extends BaseTool {
  get definition(): ToolDefinition {
    return {
      name: 'attempt_completion',
      description: 'After completing the task, use this tool to present the result to the user. The user may respond with feedback if they are not satisfied with the result, which you can use to make improvements.',
      input_schema: {
        type: 'object',
        properties: {
          result: {
            type: 'string',
            description: 'The result of the task. Formulate this result in a way that is final and does not require further input from the user.'
          }
        },
        required: ['result']
      }
    }
  }
  
  async execute(input: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    this.validateInput(input)
    
    const { result } = input
    const toolUseId = `attempt_completion_${Date.now()}`
    
    return this.success(result, toolUseId)
  }
}

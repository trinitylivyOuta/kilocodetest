/**
 * Tools Package Entry Point
 */

export { BaseTool, ToolExecutor, type ToolContext } from './base.js'
export { ReadFileTool } from './read-file.js'
export { WriteFileTool } from './write-file.js'
export { ExecuteCommandTool } from './execute-command.js'
export { ListFilesTool } from './list-files.js'
export { AttemptCompletionTool } from './attempt-completion.js'

// Export convenient tool collections
import { ReadFileTool } from './read-file.js'
import { WriteFileTool } from './write-file.js'
import { ExecuteCommandTool } from './execute-command.js'
import { ListFilesTool } from './list-files.js'
import { AttemptCompletionTool } from './attempt-completion.js'

export const FileTools = [
  new ReadFileTool(),
  new WriteFileTool(),
  new ListFilesTool()
]

export const CommandTools = [
  new ExecuteCommandTool()
]

export const CoreTools = [
  ...FileTools,
  ...CommandTools,
  new AttemptCompletionTool()
]

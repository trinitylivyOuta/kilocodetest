/**
 * Core types for the Agent Framework
 * Extracted and simplified from Kilocode
 */

// ============================================================================
// Provider Types
// ============================================================================

export type ProviderName = 
  | 'anthropic'
  | 'openai'
  | 'ollama'
  | 'openrouter'
  | 'gemini'

export interface ModelInfo {
  maxTokens?: number
  contextWindow: number
  supportsImages?: boolean
  supportsPromptCache?: boolean
  inputPrice?: number
  outputPrice?: number
  cacheWritesPrice?: number
  cacheReadsPrice?: number
  description?: string
}

export interface ProviderSettings {
  provider: ProviderName
  apiKey?: string
  baseURL?: string
  model: string
  modelInfo?: ModelInfo
}

// ============================================================================
// Message Types (Anthropic-compatible)
// ============================================================================

export type MessageRole = 'user' | 'assistant'

export interface TextBlock {
  type: 'text'
  text: string
}

export interface ImageBlock {
  type: 'image'
  source: {
    type: 'base64'
    media_type: string
    data: string
  }
}

export type ContentBlock = TextBlock | ImageBlock

export interface Message {
  role: MessageRole
  content: ContentBlock[] | string
}

// ============================================================================
// Tool Types
// ============================================================================

export interface ToolParameter {
  type: string
  description?: string
  enum?: string[]
  items?: any
  properties?: Record<string, any>
  required?: string[]
}

export interface ToolDefinition {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, ToolParameter>
    required?: string[]
  }
}

export interface ToolUse {
  id: string
  name: string
  input: Record<string, any>
}

export interface ToolResult {
  tool_use_id: string
  content: string | ContentBlock[]
  is_error?: boolean
}

export type ToolName = 
  | 'read_file'
  | 'write_file'
  | 'execute_command'
  | 'search_files'
  | 'list_files'
  | 'attempt_completion'

// ============================================================================
// Agent Types
// ============================================================================

export type TaskStatus = 
  | 'pending'
  | 'running'
  | 'waiting_for_user'
  | 'completed'
  | 'error'
  | 'aborted'

export interface TaskMetadata {
  taskId: string
  createdAt: number
  updatedAt: number
  status: TaskStatus
  mode?: string
}

export interface TaskOptions {
  prompt: string
  systemPrompt?: string
  mode?: string
  workspaceDir?: string
  onProgress?: (event: TaskEvent) => void
  autoApprove?: boolean
}

export interface TaskResult {
  success: boolean
  message?: string
  error?: string
}

// ============================================================================
// Event Types
// ============================================================================

export type TaskEventType = 
  | 'start'
  | 'progress'
  | 'tool_use'
  | 'tool_result'
  | 'assistant_message'
  | 'user_message'
  | 'waiting_for_approval'
  | 'approval_granted'
  | 'approval_denied'
  | 'error'
  | 'complete'
  | 'aborted'

export interface TaskEvent {
  type: TaskEventType
  timestamp: number
  data?: any
}

// ============================================================================
// Adapter Types
// ============================================================================

export interface FileSystem {
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  exists(path: string): Promise<boolean>
  listFiles(dir: string): Promise<string[]>
  deleteFile(path: string): Promise<void>
}

export interface CommandExecutor {
  execute(command: string, cwd?: string): Promise<CommandResult>
}

export interface CommandResult {
  stdout: string
  stderr: string
  exitCode: number
}

export interface RuntimeAdapter {
  name: string
  fileSystem: FileSystem
  commandExecutor: CommandExecutor
  workspaceDir: string
  getApproval?(action: string, details: any): Promise<boolean>
}

// ============================================================================
// Token Usage Types
// ============================================================================

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  totalCost?: number
}

// ============================================================================
// API Stream Types
// ============================================================================

export interface StreamChunk {
  type: 'content' | 'tool_use' | 'usage' | 'error'
  content?: string
  toolUse?: ToolUse
  usage?: TokenUsage
  error?: Error
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface AgentConfig {
  provider: ProviderSettings
  adapter: RuntimeAdapter
  tools?: ToolDefinition[]
  systemPrompt?: string
  autoApprove?: boolean
  maxTokens?: number
  temperature?: number
}

// ============================================================================
// Export all types
// ============================================================================

export type {
  ProviderName,
  ModelInfo,
  ProviderSettings,
  MessageRole,
  TextBlock,
  ImageBlock,
  ContentBlock,
  Message,
  ToolParameter,
  ToolDefinition,
  ToolUse,
  ToolResult,
  ToolName,
  TaskStatus,
  TaskMetadata,
  TaskOptions,
  TaskResult,
  TaskEventType,
  TaskEvent,
  FileSystem,
  CommandExecutor,
  CommandResult,
  RuntimeAdapter,
  TokenUsage,
  StreamChunk,
  AgentConfig
}

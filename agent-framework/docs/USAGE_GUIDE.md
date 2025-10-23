# Agent Framework - Complete Usage Guide

## Table of Contents

1. [Installation](#installation)
2. [Quick Start](#quick-start)
3. [Core Concepts](#core-concepts)
4. [API Reference](#api-reference)
5. [Providers Guide](#providers-guide)
6. [Tools Guide](#tools-guide)
7. [Runtime Adapters](#runtime-adapters)
8. [Advanced Usage](#advanced-usage)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Installation

### From Source (Current)

```bash
git clone <repository>
cd agent-framework
pnpm install
pnpm build
```

### Package Dependencies

```json
{
  "dependencies": {
    "@agent-framework/core": "workspace:*",
    "@agent-framework/api": "workspace:*",
    "@agent-framework/tools": "workspace:*",
    "@agent-framework/runtime": "workspace:*"
  }
}
```

---

## Quick Start

### Minimal Example

```typescript
import { Agent } from '@agent-framework/core'
import { AnthropicProvider } from '@agent-framework/api'
import { NodeAdapter } from '@agent-framework/runtime'
import { CoreTools } from '@agent-framework/tools'

// Create agent
const agent = new Agent({
  apiHandler: new AnthropicProvider({
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: 'claude-3-5-sonnet-20241022'
  }),
  adapter: new NodeAdapter({ 
    workspaceDir: process.cwd() 
  }),
  tools: CoreTools
})

// Execute task
const task = await agent.executeTask({
  prompt: "List all TypeScript files"
})

// Wait for completion
const result = await task.waitForCompletion()
console.log(result.message)
```

---

## Core Concepts

### Agent

The `Agent` class is the main orchestrator. It manages task creation and execution.

**Responsibilities**:
- Creates and manages tasks
- Coordinates between provider, adapter, and tools
- Maintains task history

**Lifecycle**:
```
Create Agent → Execute Task → Task Runs → Task Completes
                     ↓
              (can create multiple tasks)
```

### Task

A `Task` represents a single agent execution with its own conversation history.

**Lifecycle**:
```
Create Task → Start → Execution Loop → Complete/Error
                            ↓
                    (LLM calls + tool execution)
```

**Key Features**:
- Event-driven progress tracking
- Tool execution orchestration
- Conversation history management
- Token usage tracking

### Provider (API Handler)

Abstracts LLM API calls.

**Interface**:
```typescript
interface ApiHandler {
  createMessage(options: ApiHandlerOptions): AsyncGenerator<StreamChunk>
  getModel(): { id: string; info: ModelInfo }
  getProvider(): string
}
```

### Tools

Capabilities the agent can use to interact with the environment.

**Tool Interface**:
```typescript
interface BaseTool {
  definition: ToolDefinition
  execute(input: any, context: ToolContext): Promise<ToolResult>
}
```

### Runtime Adapter

Environment-specific implementations for file system, command execution, etc.

**Interface**:
```typescript
interface RuntimeAdapter {
  name: string
  fileSystem: FileSystem
  commandExecutor: CommandExecutor
  workspaceDir: string
  getApproval?(action: string, details: any): Promise<boolean>
}
```

---

## API Reference

### Agent Class

#### Constructor

```typescript
new Agent(options: AgentOptions)
```

**AgentOptions**:
```typescript
interface AgentOptions {
  apiHandler: ApiHandler      // LLM provider
  adapter: RuntimeAdapter      // Runtime environment
  tools: BaseTool[]           // Available tools
  systemPrompt?: string       // Custom system prompt
  autoApprove?: boolean       // Auto-approve tool usage
}
```

#### Methods

**executeTask(options: TaskOptions): Promise<Task>**

Creates and starts a new task.

```typescript
const task = await agent.executeTask({
  prompt: "Your task description",
  systemPrompt: "Optional custom system prompt",
  onProgress: (event) => {
    // Handle progress events
  }
})
```

**getTask(taskId: string): Task | undefined**

Retrieves a task by ID.

**getTasks(): Task[]**

Gets all tasks created by this agent.

**getModelInfo(): { id: string; info: ModelInfo }**

Gets the current model information.

**getProvider(): string**

Gets the provider name (e.g., "anthropic").

---

### Task Class

#### Events

Tasks emit events for progress tracking:

```typescript
task.on('start', (event) => {
  // Task started
})

task.on('progress', (event) => {
  // Streaming content from LLM
  console.log(event.data.content)
})

task.on('tool_use', (event) => {
  // Agent is using a tool
  console.log('Tool:', event.data.toolUse.name)
})

task.on('tool_result', (event) => {
  // Tool execution completed
  console.log('Result:', event.data.result.content)
})

task.on('complete', (event) => {
  // Task finished
  console.log('Done:', event.data.result)
})

task.on('error', (event) => {
  // Error occurred
  console.error('Error:', event.data.error)
})
```

#### Methods

**start(prompt: string): Promise<void>**

Starts task execution (automatically called by agent.executeTask).

**waitForCompletion(): Promise<TaskResult>**

Waits for the task to complete and returns the result.

```typescript
const result = await task.waitForCompletion()
if (result.success) {
  console.log(result.message)
} else {
  console.error(result.error)
}
```

**abort(): void**

Aborts the task execution.

**getStatus(): TaskStatus**

Returns current status: 'pending' | 'running' | 'waiting_for_user' | 'completed' | 'error' | 'aborted'

**getTaskId(): string**

Returns the task ID.

**getUsage(): TokenUsage**

Returns token usage statistics.

```typescript
const usage = task.getUsage()
console.log(`Input: ${usage.inputTokens}`)
console.log(`Output: ${usage.outputTokens}`)
console.log(`Cache Reads: ${usage.cacheReadTokens || 0}`)
```

---

## Providers Guide

### Anthropic Provider

```typescript
import { AnthropicProvider } from '@agent-framework/api'

const provider = new AnthropicProvider({
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: 'claude-3-5-sonnet-20241022',
  // Optional: custom baseURL
  baseURL: 'https://api.anthropic.com'
})
```

**Supported Models**:
- `claude-3-5-sonnet-20241022` (recommended)
- `claude-3-opus-20240229`
- `claude-3-sonnet-20240229`
- `claude-3-haiku-20240307`

**Features**:
- ✅ Streaming
- ✅ Tool usage
- ✅ Image support
- ✅ Prompt caching

### OpenAI Provider

```typescript
import { OpenAIProvider } from '@agent-framework/api'

const provider = new OpenAIProvider({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4',
  // Optional: custom baseURL for Azure or other compatible APIs
  baseURL: 'https://api.openai.com/v1'
})
```

**Supported Models**:
- `gpt-4` (recommended)
- `gpt-4-turbo`
- `gpt-3.5-turbo`

**Features**:
- ✅ Streaming
- ✅ Tool usage
- ✅ Image support (gpt-4-vision)

### Ollama Provider (NEW!)

```typescript
import { OllamaProvider } from '@agent-framework/api'

const provider = new OllamaProvider({
  provider: 'ollama',
  model: 'llama2',
  // Optional: custom Ollama server URL
  baseURL: 'http://localhost:11434'
})
```

**Supported Models**: Any model available in your local Ollama installation
- `llama2`
- `codellama`
- `mistral`
- `mixtral`
- And many more...

**Features**:
- ✅ Streaming
- ✅ Local execution (no API key needed)
- ✅ Free to use
- ❌ No tool usage (yet)
- ❌ No image support

**Setup Ollama**:
```bash
# Install Ollama (https://ollama.ai)
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a model
ollama pull llama2

# Start Ollama server (usually auto-starts)
ollama serve
```

---

## Tools Guide

### Core Tools (6 tools)

#### read_file

Read contents of a file.

```typescript
{
  name: 'read_file',
  input: {
    path: 'src/index.ts'  // Relative to workspace
  }
}
```

#### write_file

Write content to a file.

```typescript
{
  name: 'write_file',
  input: {
    path: 'output.txt',
    content: 'Hello, World!'
  }
}
```

#### list_files

List files in a directory.

```typescript
{
  name: 'list_files',
  input: {
    path: '.'  // Directory to list
  }
}
```

#### search_files (NEW!)

Search for files matching a pattern.

```typescript
{
  name: 'search_files',
  input: {
    pattern: '*.ts',        // Glob pattern
    path: '.'               // Optional: directory to search
  }
}
```

**Examples**:
- `*.ts` - All TypeScript files in current directory
- `**/*.json` - All JSON files recursively
- `src/**/*.ts` - TypeScript files in src directory

#### execute_command

Execute a shell command.

```typescript
{
  name: 'execute_command',
  input: {
    command: 'npm test'
  }
}
```

#### attempt_completion

Signal task completion.

```typescript
{
  name: 'attempt_completion',
  input: {
    result: 'Task completed successfully. Created 3 files.'
  }
}
```

### Creating Custom Tools

```typescript
import { BaseTool } from '@agent-framework/tools'
import type { ToolDefinition, ToolResult } from '@agent-framework/types'

class MyCustomTool extends BaseTool {
  get definition(): ToolDefinition {
    return {
      name: 'my_tool',
      description: 'Does something useful',
      input_schema: {
        type: 'object',
        properties: {
          param: {
            type: 'string',
            description: 'A parameter'
          }
        },
        required: ['param']
      }
    }
  }
  
  async execute(input: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    this.validateInput(input)
    
    const { param } = input
    const toolUseId = `my_tool_${Date.now()}`
    
    try {
      // Your tool logic here
      const result = `Processed: ${param}`
      return this.success(result, toolUseId)
    } catch (error) {
      return this.error(error.message, toolUseId)
    }
  }
}

// Use it
const agent = new Agent({
  // ...
  tools: [...CoreTools, new MyCustomTool()]
})
```

---

## Runtime Adapters

### Node Adapter

For Node.js applications and CLI tools.

```typescript
import { NodeAdapter } from '@agent-framework/runtime'

const adapter = new NodeAdapter({
  workspaceDir: process.cwd(),
  getApproval: async (action, details) => {
    // Optional: approval logic
    if (action === 'execute_command') {
      console.log(`Execute: ${details.command}?`)
      // Return true to approve, false to deny
      return true
    }
    return true
  }
})
```

**Features**:
- ✅ File system operations (fs/promises)
- ✅ Command execution (child_process)
- ✅ Approval flow support

---

## Advanced Usage

### Multiple Tasks

```typescript
const agent = new Agent({...})

// Run multiple tasks
const task1 = await agent.executeTask({
  prompt: "Analyze package.json"
})

const task2 = await agent.executeTask({
  prompt: "Find all TODO comments"
})

// Wait for both
const [result1, result2] = await Promise.all([
  task1.waitForCompletion(),
  task2.waitForCompletion()
])
```

### Custom System Prompts

```typescript
const agent = new Agent({
  apiHandler: provider,
  adapter: adapter,
  tools: CoreTools,
  systemPrompt: `You are an expert Python developer.

Always write clean, well-documented code.
Follow PEP 8 style guidelines.
Include type hints in all functions.`
})
```

### Progress Tracking

```typescript
const task = await agent.executeTask({
  prompt: "Refactor the codebase",
  onProgress: (event) => {
    switch (event.type) {
      case 'start':
        console.log('Task started')
        break
        
      case 'progress':
        // Stream content in real-time
        process.stdout.write(event.data.content)
        break
        
      case 'tool_use':
        console.log(`\n🔧 Using: ${event.data.toolUse.name}`)
        console.log(`   Input: ${JSON.stringify(event.data.toolUse.input, null, 2)}`)
        break
        
      case 'tool_result':
        const result = event.data.result
        console.log(`   ${result.is_error ? '❌' : '✅'} Result: ${result.content.substring(0, 100)}`)
        break
        
      case 'complete':
        console.log('\n✅ Task complete!')
        break
        
      case 'error':
        console.error(`\n❌ Error: ${event.data.error}`)
        break
    }
  }
})
```

### Approval Flow

```typescript
const adapter = new NodeAdapter({
  workspaceDir: process.cwd(),
  getApproval: async (action, details) => {
    // Auto-approve reads
    if (action === 'read_file') {
      return true
    }
    
    // Ask for confirmation on writes
    if (action === 'write_file') {
      console.log(`\n⚠️  Write to ${details.path}?`)
      console.log(`   Size: ${details.contentLength} bytes`)
      // In real app, prompt user for input
      return true
    }
    
    // Ask for confirmation on commands
    if (action === 'execute_command') {
      console.log(`\n⚠️  Execute: ${details.command}?`)
      return true
    }
    
    return false
  }
})
```

### Error Handling

```typescript
const task = await agent.executeTask({
  prompt: "Complex task",
  onProgress: (event) => {
    if (event.type === 'error') {
      console.error('Task error:', event.data.error)
      // Handle error
    }
  }
})

try {
  const result = await task.waitForCompletion()
  if (!result.success) {
    console.error('Task failed:', result.error)
  }
} catch (error) {
  console.error('Unexpected error:', error)
}
```

---

## Best Practices

### 1. Always Use Environment Variables for API Keys

```typescript
// ✅ Good
const provider = new AnthropicProvider({
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: 'claude-3-5-sonnet-20241022'
})

// ❌ Bad - Never hardcode API keys
const provider = new AnthropicProvider({
  provider: 'anthropic',
  apiKey: 'sk-ant-api03-...',  // Don't do this!
  model: 'claude-3-5-sonnet-20241022'
})
```

### 2. Handle Tool Approvals Carefully

```typescript
// ✅ Good - Selective approval
getApproval: async (action, details) => {
  if (action === 'execute_command') {
    const dangerousCommands = ['rm -rf', 'sudo', 'dd']
    if (dangerousCommands.some(cmd => details.command.includes(cmd))) {
      return false  // Deny dangerous commands
    }
  }
  return true
}

// ❌ Bad - Auto-approve everything without checks
getApproval: async () => true
```

### 3. Provide Clear System Prompts

```typescript
// ✅ Good - Clear instructions
systemPrompt: `You are a code refactoring assistant.

Rules:
- Always preserve existing functionality
- Add comments for complex logic
- Follow the project's coding style
- Run tests after changes

When complete, use attempt_completion with a summary.`

// ❌ Bad - Vague
systemPrompt: "Help with code"
```

### 4. Use Specific Prompts

```typescript
// ✅ Good - Specific and actionable
await agent.executeTask({
  prompt: "Find all TypeScript files in src/ directory that import 'lodash', and replace lodash imports with native JavaScript equivalents where possible. Test after each change."
})

// ❌ Bad - Too vague
await agent.executeTask({
  prompt: "Make the code better"
})
```

### 5. Monitor Token Usage

```typescript
const task = await agent.executeTask({prompt: "..."})
const result = await task.waitForCompletion()

const usage = task.getUsage()
console.log(`Tokens used: ${usage.inputTokens + usage.outputTokens}`)
console.log(`Estimated cost: $${calculateCost(usage)}`)
```

### 6. Use Ollama for Development/Testing

```typescript
// Development/testing - free local models
const devProvider = new OllamaProvider({
  provider: 'ollama',
  model: 'llama2'
})

// Production - more capable models
const prodProvider = new AnthropicProvider({
  provider: 'anthropic',
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: 'claude-3-5-sonnet-20241022'
})

const provider = process.env.NODE_ENV === 'production' ? prodProvider : devProvider
```

---

## Troubleshooting

### Common Issues

#### 1. "API key is required" Error

**Problem**: Missing or invalid API key

**Solution**:
```bash
# Set environment variable
export ANTHROPIC_API_KEY=your-key-here

# Or use .env file
echo "ANTHROPIC_API_KEY=your-key-here" > .env

# Load in code
import 'dotenv/config'
```

#### 2. "Max iterations reached" Error

**Problem**: Task hit the iteration limit (default 50)

**Solution**: Task is too complex or agent is stuck. Break into smaller tasks:
```typescript
// Instead of one big task
await agent.executeTask({
  prompt: "Refactor entire codebase and add tests and documentation"
})

// Do smaller tasks
await agent.executeTask({
  prompt: "Refactor the authentication module"
})
await agent.executeTask({
  prompt: "Add tests for authentication"
})
await agent.executeTask({
  prompt: "Add documentation for authentication"
})
```

#### 3. "File not found" Errors

**Problem**: Incorrect workspace directory

**Solution**: Check workspace path:
```typescript
const adapter = new NodeAdapter({
  workspaceDir: '/absolute/path/to/workspace'  // Use absolute path
})

// Or verify current directory
console.log('Workspace:', process.cwd())
```

#### 4. Ollama Connection Refused

**Problem**: Ollama server not running

**Solution**:
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# If not running, start it
ollama serve

# Or check if different port
ollama serve --port 11435
```

Then update baseURL:
```typescript
const provider = new OllamaProvider({
  provider: 'ollama',
  model: 'llama2',
  baseURL: 'http://localhost:11435'
})
```

#### 5. Tools Not Being Used

**Problem**: Agent not using available tools

**Solution**: Update system prompt to encourage tool usage:
```typescript
systemPrompt: `You are an AI assistant with access to tools.

IMPORTANT: You MUST use the available tools to complete tasks:
- Use read_file to read files
- Use write_file to create/update files
- Use search_files to find files
- Use execute_command to run commands
- Use attempt_completion when done

Do not try to describe actions - actually use the tools!`
```

#### 6. TypeScript Compilation Errors

**Problem**: Type errors when using framework

**Solution**: Ensure TypeScript is configured correctly:
```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "esModuleInterop": true
  }
}
```

#### 7. Import Errors in Node.js

**Problem**: "Cannot find module" errors

**Solution**: Use correct import syntax:
```typescript
// ✅ For ESM (type: "module" in package.json)
import { Agent } from '@agent-framework/core'

// ✅ For CommonJS
const { Agent } = require('@agent-framework/core')
```

### Debug Tips

**Enable verbose logging**:
```typescript
const task = await agent.executeTask({
  prompt: "Task description",
  onProgress: (event) => {
    // Log all events
    console.log(JSON.stringify(event, null, 2))
  }
})
```

**Check task status**:
```typescript
console.log('Status:', task.getStatus())
console.log('Task ID:', task.getTaskId())
```

**Inspect tool execution**:
```typescript
task.on('tool_use', (event) => {
  console.log('Tool:', event.data.toolUse)
})
task.on('tool_result', (event) => {
  console.log('Result:', event.data.result)
})
```

---

## Additional Resources

- [Getting Started Guide](./getting-started.md)
- [Framework Analysis](../FRAMEWORK_ANALYSIS.md)
- [Test Results](../TEST_RESULTS.md)
- [Examples](../examples/)

---

## Support

For issues and questions:
- Check this guide first
- Review the examples
- Check the troubleshooting section
- File an issue on GitHub

## License

MIT License - see LICENSE file for details

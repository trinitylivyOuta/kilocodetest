# Getting Started with Agent Framework

This guide will help you get started with the Agent Framework - a lean, reusable AI agent framework extracted from Kilocode.

## Installation

The framework is organized as a monorepo with several packages. You can use them together or independently.

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 10.8.1 (or npm/yarn)

### Install Packages

```bash
npm install @agent-framework/core @agent-framework/api @agent-framework/runtime @agent-framework/tools
```

Or if working from this repository:

```bash
cd agent-framework
pnpm install
pnpm build
```

## Quick Start

Here's a minimal example to get you started:

```typescript
import { Agent } from '@agent-framework/core'
import { AnthropicProvider } from '@agent-framework/api'
import { NodeAdapter } from '@agent-framework/runtime'
import { CoreTools } from '@agent-framework/tools'

// Create an agent
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

// Execute a task
const task = await agent.executeTask({
  prompt: "List all files in the current directory",
  onProgress: (event) => {
    console.log(event.type, event.data)
  }
})

// Wait for completion
const result = await task.waitForCompletion()
console.log(result)
```

## Core Concepts

### 1. Agent

The `Agent` class is the main entry point. It orchestrates task execution and manages the lifecycle of tasks.

```typescript
const agent = new Agent({
  apiHandler: /* LLM provider */,
  adapter: /* Runtime adapter */,
  tools: /* Available tools */,
  systemPrompt: /* Optional custom system prompt */
})
```

### 2. API Handler (Provider)

API handlers abstract different LLM providers. Currently supported:

- **AnthropicProvider** - Claude models
- **OpenAIProvider** - GPT models

```typescript
import { AnthropicProvider } from '@agent-framework/api'

const provider = new AnthropicProvider({
  provider: 'anthropic',
  apiKey: 'your-api-key',
  model: 'claude-3-5-sonnet-20241022'
})
```

### 3. Runtime Adapter

Runtime adapters provide environment-specific implementations for file system access, command execution, etc.

- **NodeAdapter** - For Node.js CLI applications

```typescript
import { NodeAdapter } from '@agent-framework/runtime'

const adapter = new NodeAdapter({
  workspaceDir: process.cwd(),
  getApproval: async (action, details) => {
    // Return true to approve, false to deny
    return true
  }
})
```

### 4. Tools

Tools are capabilities that the agent can use to interact with the environment.

```typescript
import { 
  CoreTools,      // All core tools
  FileTools,      // Just file operations
  CommandTools,   // Just command execution
} from '@agent-framework/tools'

// Or import individual tools
import { ReadFileTool, WriteFileTool } from '@agent-framework/tools'

const tools = [
  new ReadFileTool(),
  new WriteFileTool()
]
```

**Available Core Tools:**
- `read_file` - Read file contents
- `write_file` - Write to files
- `list_files` - List directory contents
- `execute_command` - Execute shell commands
- `attempt_completion` - Signal task completion

### 5. Task

Tasks represent individual agent executions. They emit events for progress tracking.

```typescript
const task = await agent.executeTask({
  prompt: "Your task description",
  onProgress: (event) => {
    switch (event.type) {
      case 'start':
        console.log('Task started')
        break
      case 'progress':
        console.log('Content:', event.data.content)
        break
      case 'tool_use':
        console.log('Using tool:', event.data.toolUse.name)
        break
      case 'tool_result':
        console.log('Tool result:', event.data.result)
        break
      case 'complete':
        console.log('Task complete')
        break
    }
  }
})

// Wait for completion
const result = await task.waitForCompletion()

// Check result
if (result.success) {
  console.log('Success:', result.message)
} else {
  console.error('Error:', result.error)
}

// Get token usage
const usage = task.getUsage()
console.log('Tokens used:', usage)
```

## Event Types

Tasks emit the following events:

- **start** - Task execution started
- **progress** - Streaming content from LLM
- **tool_use** - Agent is using a tool
- **tool_result** - Tool execution completed
- **assistant_message** - Complete assistant message
- **user_message** - User message added
- **error** - Error occurred
- **complete** - Task finished
- **aborted** - Task was aborted

## Examples

### Example 1: File Operations

```typescript
const task = await agent.executeTask({
  prompt: "Create a file called hello.txt with 'Hello, World!'"
})

await task.waitForCompletion()
```

### Example 2: Command Execution

```typescript
const task = await agent.executeTask({
  prompt: "Run 'npm install' and tell me if it succeeds"
})

const result = await task.waitForCompletion()
console.log(result.message)
```

### Example 3: Code Analysis

```typescript
const task = await agent.executeTask({
  prompt: "Analyze all TypeScript files and create a report of functions and classes"
})

await task.waitForCompletion()
```

### Example 4: Custom Tools

Create your own tools by extending `BaseTool`:

```typescript
import { BaseTool } from '@agent-framework/tools'
import type { ToolDefinition, ToolResult } from '@agent-framework/types'

class CustomTool extends BaseTool {
  get definition(): ToolDefinition {
    return {
      name: 'my_custom_tool',
      description: 'Does something custom',
      input_schema: {
        type: 'object',
        properties: {
          input: {
            type: 'string',
            description: 'Input parameter'
          }
        },
        required: ['input']
      }
    }
  }
  
  async execute(input: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    // Your tool logic here
    return this.success('Tool executed successfully', 'tool_id')
  }
}

// Use it
const agent = new Agent({
  // ...
  tools: [...CoreTools, new CustomTool()]
})
```

## Configuration

### Environment Variables

Create a `.env` file:

```bash
ANTHROPIC_API_KEY=your-anthropic-key
OPENAI_API_KEY=your-openai-key
```

### System Prompts

Customize the agent's behavior with system prompts:

```typescript
const agent = new Agent({
  // ...
  systemPrompt: `You are an expert Python developer.
  
Always write clean, well-documented code.
Follow PEP 8 style guidelines.
Include type hints in all functions.`
})
```

### Approval Flow

Control which operations require approval:

```typescript
const adapter = new NodeAdapter({
  workspaceDir: process.cwd(),
  getApproval: async (action, details) => {
    // Approve file reads automatically
    if (action === 'read_file') {
      return true
    }
    
    // Ask for confirmation on writes
    if (action === 'write_file') {
      console.log(`Write to ${details.path}?`)
      // In real app, prompt user for confirmation
      return true
    }
    
    // Ask for confirmation on commands
    if (action === 'execute_command') {
      console.log(`Execute: ${details.command}?`)
      return true
    }
    
    return false
  }
})
```

## Best Practices

1. **Always use `attempt_completion` tool** - Tell the agent to use this tool when done
2. **Handle errors gracefully** - Wrap task execution in try-catch
3. **Track progress** - Use `onProgress` callback for better UX
4. **Set appropriate limits** - Tasks have a max iteration limit to prevent infinite loops
5. **Approve carefully** - Don't auto-approve destructive operations in production

## Next Steps

- Check out the [examples](../examples/) directory
- Read the [API Reference](./api-reference.md)
- Learn about [Creating Custom Tools](./creating-tools.md)
- Learn about [Creating Custom Adapters](./creating-adapters.md)

## Troubleshooting

### "Missing API key" error
Make sure your API key is set in environment variables or passed directly to the provider.

### "Max iterations reached" error
The task hit the iteration limit (default 50). This usually means the task is too complex or the agent is stuck. Try breaking it into smaller tasks.

### Tools not being used
Make sure your tools are properly registered with the agent and that your system prompt encourages tool usage.

### File not found errors
Check that your workspace directory is set correctly in the adapter.

## Support

For issues and questions:
- Check the [examples](../examples/)
- Review the [API documentation](./api-reference.md)
- File an issue on GitHub

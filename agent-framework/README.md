# Agent Framework

> A lean, reusable AI agent framework extracted from Kilocode

**Agent Framework** is a lightweight, modular framework for building AI agents that can run in multiple environments:
- 🖥️ **Terminal/CLI** applications
- 📝 **VSCode extensions**
- 🌐 **Node.js** applications
- ☁️ **Server** environments

## Features

✨ **Multi-Environment**: Run in VSCode, CLI, or any Node.js application  
🔌 **Pluggable Providers**: Support for Anthropic, OpenAI, Ollama, and more  
🛠️ **Tool System**: Extensible tools for file operations, command execution, etc.  
📦 **Minimal Dependencies**: Lean core with <20 dependencies  
🎯 **Type-Safe**: Full TypeScript support  
⚡ **Fast**: Optimized for performance  

## Quick Start

### Installation

```bash
npm install @agent-framework/core @agent-framework/api @agent-framework/runtime
```

### Basic Usage

```typescript
import { Agent } from '@agent-framework/core'
import { OpenAIProvider } from '@agent-framework/api'
import { NodeAdapter } from '@agent-framework/runtime'
import { FileTools, CommandTools } from '@agent-framework/tools'

// Create an agent
const agent = new Agent({
  provider: new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4'
  }),
  adapter: new NodeAdapter({
    workspaceDir: process.cwd()
  }),
  tools: [
    ...FileTools,
    ...CommandTools
  ]
})

// Execute a task
const task = await agent.executeTask({
  prompt: "List all TypeScript files in the src directory",
  onProgress: (event) => {
    console.log(event.type, event.data)
  }
})

// Wait for completion
await task.waitForCompletion()
console.log(task.result)
```

## Packages

- **[@agent-framework/core](./packages/core)** - Core agent execution engine
- **[@agent-framework/api](./packages/api)** - LLM provider abstraction
- **[@agent-framework/tools](./packages/tools)** - Tool system and built-in tools
- **[@agent-framework/runtime](./packages/runtime)** - Runtime adapters for different environments
- **[@agent-framework/prompts](./packages/prompts)** - Prompt building and templates
- **[@agent-framework/types](./packages/types)** - Shared TypeScript types

## Architecture

```
┌─────────────────────────────────────────┐
│           Your Application              │
└─────────────┬───────────────────────────┘
              │
              ↓
┌─────────────────────────────────────────┐
│      @agent-framework/core              │
│  ┌──────────┐  ┌──────────┐            │
│  │  Agent   │  │   Task   │            │
│  └──────────┘  └──────────┘            │
└────┬────────────────┬──────────────────┘
     │                │
     ↓                ↓
┌─────────────┐  ┌──────────────┐
│  Adapter    │  │   Provider   │
│  (Runtime)  │  │   (API)      │
└─────────────┘  └──────────────┘
     │                │
     ↓                ↓
┌─────────────┐  ┌──────────────┐
│  Tools      │  │  LLM API     │
└─────────────┘  └──────────────┘
```

## Documentation

- [Getting Started](./docs/getting-started.md)
- [API Reference](./docs/api-reference.md)
- [Creating Custom Tools](./docs/creating-tools.md)
- [Creating Custom Adapters](./docs/creating-adapters.md)
- [Examples](./examples)

## Examples

- [Basic CLI](./examples/basic-cli) - Simple command-line agent
- [File Processor](./examples/file-processor) - Process files with AI
- [Code Assistant](./examples/code-assistant) - AI coding assistant

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Development mode (watch)
pnpm dev
```

## Comparison with Kilocode

This framework is extracted from [Kilocode](https://github.com/Kilo-Org/kilocode) with the following changes:

| Aspect | Kilocode | Agent Framework |
|--------|----------|----------------|
| Size | ~100k LOC | ~15k LOC (85% reduction) |
| Environment | VSCode + CLI | Any Node.js environment |
| Dependencies | 100+ | <20 core dependencies |
| UI | VSCode webview + Ink | Adapter-based (bring your own) |
| Focus | Full-featured IDE agent | Reusable agent core |
| Cloud Services | Integrated | Optional plugins |

## License

MIT License - see LICENSE file for details

## Credits

Extracted and adapted from [Kilocode](https://github.com/Kilo-Org/kilocode) by the Kilocode community.

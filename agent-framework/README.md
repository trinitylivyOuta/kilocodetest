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
- **[@agent-framework/api](./packages/api)** - LLM provider abstraction (Anthropic, OpenAI, Ollama)
- **[@agent-framework/tools](./packages/tools)** - Tool system and 6 built-in tools
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
- [Complete Usage Guide](./docs/USAGE_GUIDE.md) - Comprehensive guide with examples (NEW!)
- [API Reference](./docs/api-reference.md)
- [Creating Custom Tools](./docs/creating-tools.md)
- [Creating Custom Adapters](./docs/creating-adapters.md)
- [Examples](./examples)

## Additional Resources

- [Framework Analysis](../FRAMEWORK_ANALYSIS.md) - Detailed architecture analysis
- [Implementation Summary](../IMPLEMENTATION_SUMMARY.md) - Project summary
- [Test Results](./TEST_RESULTS.md) - Comprehensive test report
- [Gaps Analysis](./GAPS_ANALYSIS.md) - Roadmap and next steps (NEW!)

## Examples

- [Basic CLI](./examples/basic-cli) - Simple command-line agent
- [Code Analyzer](./examples/code-analyzer) - Real-world code analysis example (NEW!)
- More examples coming soon...

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

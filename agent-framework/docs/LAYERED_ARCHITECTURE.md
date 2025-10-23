# Layered Architecture Guide

## Overview

The Agent Framework provides **multiple layers of abstraction**, allowing you to choose the right level of control for your use case. From direct LLM calls to complex multi-agent orchestration, you can customize at every level.

## The 5 Layers

```
┌────────────────────────────────────────────────────┐
│ Layer 4: Agent Orchestrator                       │
│ • Multi-task coordination                         │
│ • Task dependencies and flows                     │
│ • Parallel execution                              │
│ • When: Building complex agent systems            │
└────────────────────────────────────────────────────┘
                        ↓
┌────────────────────────────────────────────────────┐
│ Layer 3: Task Executor (Agentic Loop)            │
│ • Tool-calling iteration loop                     │
│ • Custom hooks and strategies                     │
│ • Breakpoints and debugging                       │
│ • When: Need agent behavior with customization   │
└────────────────────────────────────────────────────┘
                        ↓
┌────────────────────────────────────────────────────┐
│ Layer 2: LLM Application (Tools, No Loop)        │
│ • LLM with tools                                  │
│ • Manual tool execution control                   │
│ • Single-shot or custom iteration                │
│ • When: Need tools but want control              │
└────────────────────────────────────────────────────┘
                        ↓
┌────────────────────────────────────────────────────┐
│ Layer 1: Provider Interface                       │
│ • Unified provider abstraction                    │
│ • Streaming support                               │
│ • Multiple LLM providers                          │
│ • When: Building custom LLM logic                │
└────────────────────────────────────────────────────┘
                        ↓
┌────────────────────────────────────────────────────┐
│ Layer 0: Direct LLM Client                        │
│ • Raw LLM access                                  │
│ • Simple completions                              │
│ • No framework overhead                           │
│ • When: Just need LLM calls                       │
└────────────────────────────────────────────────────┘
```

## Layer 0: Direct LLM Client

**Purpose**: Raw LLM access without any framework abstraction

**Package**: `@agent-framework/llm-client`

### When to Use

✅ Simple LLM completions  
✅ Custom streaming implementations  
✅ Minimal framework overhead  
✅ Integration with existing LLM code  

❌ Don't use if you need tools  
❌ Don't use if you need agents  

### Example

```typescript
import { LLMClient } from '@agent-framework/llm-client'
import { AnthropicProvider } from '@agent-framework/api'

const client = new LLMClient(
  new AnthropicProvider({
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: 'claude-3-5-sonnet-20241022'
  })
)

// Simple completion
const result = await client.complete({
  messages: [{ role: 'user', content: 'Explain TypeScript' }],
  maxTokens: 200
})

console.log(result.content)
console.log('Tokens:', result.usage)

// Streaming
for await (const chunk of client.streamGenerator({
  messages: [{ role: 'user', content: 'Tell me a story' }]
})) {
  process.stdout.write(chunk)
}

// Batch processing
const results = await client.batch([
  { messages: [{ role: 'user', content: 'What is Node.js?' }] },
  { messages: [{ role: 'user', content: 'What is TypeScript?' }] }
])
```

### API Reference

**Methods**:
- `complete(options)` - Get complete response
- `stream(options)` - Stream with callbacks
- `streamGenerator(options)` - Stream as async generator
- `batch(requests)` - Process multiple requests

---

## Layer 1: Provider Interface

**Purpose**: Unified provider abstraction with streaming

**Package**: `@agent-framework/api`

### When to Use

✅ Building custom LLM logic  
✅ Need provider abstraction  
✅ Want streaming support  
✅ Switching between providers  

### Providers

- **AnthropicProvider** - Claude models
- **OpenAIProvider** - GPT models
- **OllamaProvider** - Local models

### Example

```typescript
import { AnthropicProvider } from '@agent-framework/api'

const provider = new AnthropicProvider({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: 'claude-3-5-sonnet-20241022'
})

// Stream responses
for await (const chunk of provider.createMessage({
  systemPrompt: 'You are helpful',
  messages: [{
    role: 'user',
    content: 'Hello!'
  }],
  maxTokens: 1000
})) {
  if (chunk.type === 'content') {
    process.stdout.write(chunk.content)
  }
}
```

---

## Layer 2: LLM Application

**Purpose**: LLM with tools but without agentic loop

**Package**: `@agent-framework/llm-app`

### When to Use

✅ Need function calling  
✅ Want manual tool control  
✅ Single-shot interactions  
✅ Custom decision logic  

❌ Don't use if you need automatic iteration  
❌ Don't use if you want full agent behavior  

### Example

```typescript
import { LLMApp } from '@agent-framework/llm-app'
import { AnthropicProvider } from '@agent-framework/api'
import { NodeAdapter } from '@agent-framework/runtime'
import { ReadFileTool, WriteFileTool } from '@agent-framework/tools'

const app = new LLMApp({
  provider: new AnthropicProvider({...}),
  adapter: new NodeAdapter({ workspaceDir: process.cwd() }),
  tools: [new ReadFileTool(), new WriteFileTool()],
  autoExecuteTools: false  // Manual control
})

// Single interaction
const response = await app.chat({
  message: 'Read package.json and tell me the version'
})

if (response.requiresToolExecution) {
  console.log('LLM wants to use:', response.toolCalls)
  
  // Approve specific tools
  const approved = response.toolCalls.filter(t => t.name === 'read_file')
  
  // Execute approved tools
  const results = await app.executeTools(approved)
  
  // Continue conversation
  const finalResponse = await app.chat({ toolResults: results })
  console.log(finalResponse.content)
}

// Reset conversation
app.reset()
```

### API Reference

**Methods**:
- `chat(options)` - Single interaction
- `executeTools(toolCalls)` - Manual tool execution
- `reset()` - Clear conversation
- `getHistory()` - Get messages
- `getUsage()` - Get token usage

---

## Layer 3: Task Executor (Agentic Loop)

**Purpose**: Automatic tool-calling with customization hooks

**Package**: `@agent-framework/core`

### When to Use

✅ Need automatic iteration  
✅ Want agent behavior  
✅ Need customization hooks  
✅ Debugging agent decisions  

### Example: Basic Task

```typescript
import { Agent } from '@agent-framework/core'
import { AnthropicProvider } from '@agent-framework/api'
import { NodeAdapter } from '@agent-framework/runtime'
import { CoreTools } from '@agent-framework/tools'

const agent = new Agent({
  apiHandler: new AnthropicProvider({...}),
  adapter: new NodeAdapter({ workspaceDir: process.cwd() }),
  tools: CoreTools
})

const task = await agent.executeTask({
  prompt: 'Find all TypeScript files and analyze them'
})

const result = await task.waitForCompletion()
console.log(result.message)
```

### Example: Custom Hooks

```typescript
const task = await agent.executeTask({
  prompt: 'Refactor the codebase',
  
  // Custom hooks for fine-grained control
  hooks: {
    beforeLLMCall: async (messages) => {
      // Add context before each LLM call
      console.log(`Making LLM call with ${messages.length} messages`)
      return messages
    },
    
    beforeToolExecution: async (toolUse) => {
      // Approve/deny tools
      console.log(`Tool requested: ${toolUse.name}`)
      
      if (toolUse.name === 'execute_command') {
        const cmd = toolUse.input.command
        if (cmd.includes('rm -rf')) {
          console.log('❌ Blocked dangerous command')
          return null  // Block execution
        }
      }
      
      return toolUse
    },
    
    afterToolExecution: async (result) => {
      // Process results
      console.log(`Tool result: ${result.is_error ? 'ERROR' : 'SUCCESS'}`)
      return result
    },
    
    shouldContinue: async (context) => {
      // Custom stop conditions
      if (context.tokenCount > 50000) {
        console.log('Token limit reached')
        return false
      }
      return true
    },
    
    onIteration: async (iteration, context) => {
      // Called before each iteration
      console.log(`Iteration ${iteration}: ${context.tokenCount} tokens used`)
    }
  },
  
  // Custom iteration strategy
  strategy: {
    maxIterations: 30,
    stopConditions: ['attempt_completion', 'timeout'],
    timeout: 300000  // 5 minutes
  }
})
```

---

## Layer 4: Agent Orchestrator

**Purpose**: Multi-task coordination and workflows

**Package**: `@agent-framework/core`

### When to Use

✅ Multiple related tasks  
✅ Task dependencies  
✅ Parallel execution  
✅ Complex workflows  

### Example: Task Flow

```typescript
import { Agent } from '@agent-framework/core'

const agent = new Agent({...})
const flow = agent.createFlow()

// Sequential tasks
const analysis = await flow.task('Analyze the codebase')
const report = await flow.task('Generate report', {
  dependsOn: [analysis]
})

// Parallel execution
const [tests, docs, lint] = await flow.parallel([
  'Run all tests',
  'Update documentation',
  'Run linter'
])

// Conditional execution
const needsFixes = tests.result.includes('FAILED')
if (needsFixes) {
  await flow.task('Fix failing tests', {
    dependsOn: [tests]
  })
}

// With retry
await flow.retry('Deploy to production', 3)
```

---

## Choosing the Right Layer

### Decision Tree

```
Do you just need LLM completions?
├─ YES → Use Layer 0 (LLMClient)
└─ NO → Do you need tools?
    ├─ NO → Use Layer 1 (Provider)
    └─ YES → Do you want automatic iteration?
        ├─ NO → Use Layer 2 (LLMApp)
        └─ YES → Do you need task orchestration?
            ├─ NO → Use Layer 3 (Task)
            └─ YES → Use Layer 4 (Agent + Flow)
```

### Comparison Table

| Feature | Layer 0 | Layer 1 | Layer 2 | Layer 3 | Layer 4 |
|---------|---------|---------|---------|---------|---------|
| LLM Access | ✅ | ✅ | ✅ | ✅ | ✅ |
| Streaming | ✅ | ✅ | ✅ | ✅ | ✅ |
| Provider Abstraction | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tools | ❌ | ❌ | ✅ | ✅ | ✅ |
| Auto Iteration | ❌ | ❌ | ❌ | ✅ | ✅ |
| Custom Hooks | ❌ | ❌ | ❌ | ✅ | ✅ |
| Task Orchestration | ❌ | ❌ | ❌ | ❌ | ✅ |
| Complexity | Low | Low | Medium | High | Highest |
| Control | Full | Full | High | Medium | Medium |

---

## Migration Between Layers

### From Layer 0 to Layer 2

```typescript
// BEFORE: Layer 0
const client = new LLMClient(provider)
const result = await client.complete({
  messages: [{ role: 'user', content: 'Read file.txt' }]
})

// AFTER: Layer 2 (with tools)
const app = new LLMApp({ provider, adapter, tools: [readFileTool] })
const result = await app.chat({
  message: 'Read file.txt',
  executeTools: true
})
```

### From Layer 2 to Layer 3

```typescript
// BEFORE: Layer 2 (manual)
const app = new LLMApp({...})
const response = await app.chat({ message: '...' })
if (response.requiresToolExecution) {
  const results = await app.executeTools(response.toolCalls)
  await app.chat({ toolResults: results })
}

// AFTER: Layer 3 (automatic)
const agent = new Agent({...})
const task = await agent.executeTask({ prompt: '...' })
await task.waitForCompletion()
```

---

## Best Practices

### Start Simple
Begin with the lowest layer that meets your needs. You can always move up later.

### Layer 0 is Often Enough
Many use cases don't need the full framework. Direct LLM access is simpler and faster.

### Use Layer 2 for Control
When you need tools but want to control execution, Layer 2 is the sweet spot.

### Layer 3 for Automation
Use the full agentic loop when you trust the agent to make good decisions.

### Layer 4 for Workflows
Only use task orchestration when you have multiple related tasks.

---

## Examples

See the `/examples` directory for complete examples:

- `layer0-llm-client/` - Direct LLM access examples
- `layer1-provider/` - Provider usage examples
- `layer2-llm-app/` - Tool usage without loops
- `basic-cli/` - Layer 3 simple agent
- `code-analyzer/` - Layer 3 real-world agent
- More coming soon...

---

## Summary

The layered architecture gives you **flexibility** to choose the right abstraction level:

- **Layer 0**: Simplest - just LLM calls
- **Layer 1**: Provider abstraction
- **Layer 2**: Tools without automation
- **Layer 3**: Full agent with customization
- **Layer 4**: Multi-task orchestration

Choose based on your needs, not complexity for its own sake.

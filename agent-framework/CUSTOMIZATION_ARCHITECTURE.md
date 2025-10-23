# Framework Customization Architecture Analysis

## Executive Summary

This document analyzes the current framework architecture and proposes a comprehensive multi-layer customization system that enables users to customize at any level - from low-level LLM calls to high-level agent orchestration.

## Current Architecture Analysis

### Layer Structure

The framework currently has these layers:

```
┌─────────────────────────────────────────┐
│   Layer 4: Agent (High-Level)          │  ← Task orchestration, history
├─────────────────────────────────────────┤
│   Layer 3: Task (Agentic Loop)         │  ← Tool calling, iteration
├─────────────────────────────────────────┤
│   Layer 2: API Handler (LLM Wrapper)   │  ← Provider abstraction
├─────────────────────────────────────────┤
│   Layer 1: LLM Call (Low-Level)        │  ← Raw API calls
└─────────────────────────────────────────┘
```

### Gaps in Current Design

1. **Monolithic Task**: Task class combines tool execution loop with LLM interaction
2. **Limited LLM Access**: No way to use providers without full agent loop
3. **No Streaming Control**: Users can't customize streaming behavior
4. **Fixed Loop Logic**: Can't modify iteration/decision logic
5. **No Partial Agent**: Can't use agent features without full agentic loop
6. **Limited Hooks**: Few extension points for customization

## Proposed Architecture: 5-Layer Customization Model

### Layer 0: Direct LLM Client (NEW!)

**Purpose**: Raw LLM access without any framework abstraction

**Use Cases**:
- Simple one-off LLM calls
- Custom streaming implementations
- Fine-grained control over requests
- Integration with existing LLM code

**API**:
```typescript
import { LLMClient } from '@agent-framework/api'

// Direct API access
const client = new LLMClient({
  provider: new AnthropicProvider({...})
})

// Simple completion
const response = await client.complete({
  messages: [{ role: 'user', content: 'Hello' }],
  temperature: 0.7
})

// Streaming
for await (const chunk of client.stream({
  messages: [...],
  onChunk: (chunk) => console.log(chunk)
})) {
  process.stdout.write(chunk.content)
}
```

### Layer 1: Provider Interface (Current)

**Purpose**: Unified provider abstraction with streaming

**Enhancements**:
- Add non-streaming methods
- Add batch processing
- Add retry logic configuration
- Add caching strategies

**Enhanced API**:
```typescript
import { AnthropicProvider } from '@agent-framework/api'

const provider = new AnthropicProvider({
  apiKey: '...',
  model: 'claude-3-5-sonnet-20241022',
  // NEW: Customization options
  retry: {
    maxRetries: 3,
    backoff: 'exponential'
  },
  cache: {
    enabled: true,
    strategy: 'prompt-caching'
  },
  rateLimit: {
    requestsPerMinute: 50
  }
})

// NEW: Non-streaming completion
const result = await provider.complete({
  systemPrompt: 'You are helpful',
  messages: [...],
  maxTokens: 1000
})

// NEW: Batch processing
const results = await provider.batch([
  { messages: [...] },
  { messages: [...] }
])
```

### Layer 2: LLM Application (NEW!)

**Purpose**: Use LLM with tools but without agentic loop

**Use Cases**:
- Single-shot tool usage
- Function calling without iteration
- Direct control over when tools execute
- Custom decision logic

**API**:
```typescript
import { LLMApp } from '@agent-framework/core'

const app = new LLMApp({
  provider: new AnthropicProvider({...}),
  tools: [readFileTool, writeFileTool],
  systemPrompt: 'You are a file helper'
})

// Single interaction (no loop)
const response = await app.chat({
  message: 'Read package.json',
  executeTools: true  // Execute tools immediately
})

// Manual tool execution
const response = await app.chat({
  message: 'What files are here?',
  executeTools: false
})

if (response.toolCalls) {
  // Custom logic to decide which tools to execute
  const results = await app.executeTools(
    response.toolCalls.filter(t => t.name !== 'dangerous_tool')
  )
  
  // Continue conversation
  const finalResponse = await app.chat({
    toolResults: results
  })
}
```

### Layer 3: Task Executor (Enhanced)

**Purpose**: Agentic loop with customization hooks

**Enhancements**:
- Pluggable iteration strategy
- Custom stop conditions
- Hook system for each stage
- Breakpoints for debugging

**Enhanced API**:
```typescript
import { Task } from '@agent-framework/core'

const task = new Task({
  apiHandler: provider,
  adapter: nodeAdapter,
  tools: CoreTools,
  
  // NEW: Iteration strategy
  strategy: new IterationStrategy({
    maxIterations: 50,
    stopConditions: [
      'attempt_completion',
      'no_progress',
      (context) => context.tokenCount > 100000
    ]
  }),
  
  // NEW: Hooks for customization
  hooks: {
    beforeLLMCall: async (messages) => {
      // Modify messages, add context, etc.
      return messages
    },
    
    afterLLMCall: async (response) => {
      // Log, modify, filter response
      return response
    },
    
    beforeToolExecution: async (toolUse) => {
      // Approve/deny, modify parameters
      return toolUse
    },
    
    afterToolExecution: async (result) => {
      // Post-process results
      return result
    },
    
    shouldContinue: async (context) => {
      // Custom continuation logic
      return context.iteration < 10
    }
  }
})

await task.start('Analyze the codebase')
```

### Layer 4: Agent Orchestrator (Enhanced)

**Purpose**: Multi-task coordination with patterns

**Enhancements**:
- Task dependencies
- Parallel execution
- Task chaining
- State management

**Enhanced API**:
```typescript
import { Agent, TaskFlow } from '@agent-framework/core'

const agent = new Agent({
  apiHandler: provider,
  adapter: nodeAdapter,
  tools: CoreTools,
  
  // NEW: Agent-level configuration
  config: {
    parallelTasks: 3,
    taskTimeout: 300000,
    stateManagement: 'memory', // or 'disk', 'redis'
  }
})

// Simple execution (existing)
const task = await agent.executeTask({
  prompt: 'Task description'
})

// NEW: Task flow patterns
const flow = agent.createFlow()

// Sequential tasks
const t1 = await flow.task('Analyze codebase')
const t2 = await flow.task('Generate report', { 
  dependsOn: [t1] 
})
const t3 = await flow.task('Create PR', { 
  dependsOn: [t2] 
})

// Parallel tasks
const [analysis, tests, docs] = await flow.parallel([
  'Analyze code',
  'Run tests',
  'Update docs'
])

// Conditional execution
const result = await flow.conditional({
  condition: () => analysis.hasIssues(),
  onTrue: 'Fix issues',
  onFalse: 'Deploy'
})
```

## Detailed Component Design

### 1. LLMClient (New Package)

**Location**: `packages/llm-client/`

**Purpose**: Thin wrapper around providers for direct LLM access

```typescript
// packages/llm-client/src/index.ts

export interface CompletionOptions {
  messages: Message[]
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  stopSequences?: string[]
}

export interface StreamOptions extends CompletionOptions {
  onChunk?: (chunk: StreamChunk) => void
  onComplete?: (result: CompletionResult) => void
}

export class LLMClient {
  constructor(private provider: ApiHandler) {}
  
  /**
   * Non-streaming completion
   */
  async complete(options: CompletionOptions): Promise<CompletionResult> {
    const chunks: StreamChunk[] = []
    
    for await (const chunk of this.provider.createMessage(options)) {
      chunks.push(chunk)
    }
    
    return this.assembleResult(chunks)
  }
  
  /**
   * Streaming completion with callback
   */
  async stream(options: StreamOptions): Promise<void> {
    for await (const chunk of this.provider.createMessage(options)) {
      if (options.onChunk && chunk.type === 'content') {
        options.onChunk(chunk)
      }
    }
    
    if (options.onComplete) {
      // Send final result
    }
  }
  
  /**
   * Stream as async generator
   */
  async *streamGenerator(options: CompletionOptions): AsyncGenerator<string> {
    for await (const chunk of this.provider.createMessage(options)) {
      if (chunk.type === 'content') {
        yield chunk.content
      }
    }
  }
  
  /**
   * Batch completions
   */
  async batch(requests: CompletionOptions[]): Promise<CompletionResult[]> {
    return Promise.all(requests.map(req => this.complete(req)))
  }
}
```

### 2. LLMApp (New Package)

**Location**: `packages/llm-app/`

**Purpose**: LLM with tools but no agentic loop

```typescript
// packages/llm-app/src/index.ts

export interface LLMAppOptions {
  provider: ApiHandler
  tools?: BaseTool[]
  systemPrompt?: string
  autoExecuteTools?: boolean
}

export interface ChatOptions {
  message?: string
  messages?: Message[]
  executeTools?: boolean
  toolResults?: ToolResult[]
}

export class LLMApp {
  private provider: ApiHandler
  private tools: Map<string, BaseTool>
  private conversationHistory: Message[] = []
  
  constructor(private options: LLMAppOptions) {
    this.provider = options.provider
    this.tools = new Map(
      options.tools?.map(t => [t.definition.name, t]) || []
    )
  }
  
  /**
   * Single chat interaction
   */
  async chat(options: ChatOptions): Promise<ChatResponse> {
    // Add message to history
    if (options.message) {
      this.conversationHistory.push({
        role: 'user',
        content: options.message
      })
    }
    
    if (options.messages) {
      this.conversationHistory.push(...options.messages)
    }
    
    // Call LLM
    const response = await this.getLLMResponse()
    
    // Check for tool calls
    if (response.toolCalls && response.toolCalls.length > 0) {
      const shouldExecute = options.executeTools ?? this.options.autoExecuteTools ?? false
      
      if (shouldExecute) {
        // Execute tools and get final response
        const results = await this.executeTools(response.toolCalls)
        return this.chat({ toolResults: results })
      }
      
      // Return response with tool calls for manual execution
      return {
        content: response.content,
        toolCalls: response.toolCalls,
        requiresToolExecution: true
      }
    }
    
    return {
      content: response.content,
      requiresToolExecution: false
    }
  }
  
  /**
   * Execute specific tools
   */
  async executeTools(toolCalls: ToolUse[]): Promise<ToolResult[]> {
    const results: ToolResult[] = []
    
    for (const toolCall of toolCalls) {
      const tool = this.tools.get(toolCall.name)
      if (!tool) {
        results.push({
          type: 'tool_result',
          tool_use_id: toolCall.id,
          content: `Tool ${toolCall.name} not found`,
          is_error: true
        })
        continue
      }
      
      const result = await tool.execute(toolCall.input, {
        /* context */
      })
      results.push(result)
    }
    
    return results
  }
  
  /**
   * Reset conversation
   */
  reset(): void {
    this.conversationHistory = []
  }
  
  /**
   * Get conversation history
   */
  getHistory(): Message[] {
    return [...this.conversationHistory]
  }
}
```

### 3. Enhanced Task with Hooks

**Location**: `packages/core/src/task.ts` (enhanced)

```typescript
// Add to existing Task class

export interface TaskHooks {
  beforeLLMCall?: (messages: Message[]) => Promise<Message[]> | Message[]
  afterLLMCall?: (response: LLMResponse) => Promise<LLMResponse> | LLMResponse
  beforeToolExecution?: (toolUse: ToolUse) => Promise<ToolUse> | ToolUse | null
  afterToolExecution?: (result: ToolResult) => Promise<ToolResult> | ToolResult
  shouldContinue?: (context: TaskContext) => Promise<boolean> | boolean
  onIteration?: (iteration: number, context: TaskContext) => Promise<void> | void
}

export interface IterationStrategy {
  maxIterations: number
  stopConditions: Array<string | ((context: TaskContext) => boolean)>
  timeout?: number
}

// Enhanced TaskOptions
export interface TaskOptions {
  prompt?: string
  systemPrompt?: string
  onProgress?: (event: TaskEvent) => void
  autoApprove?: boolean
  
  // NEW
  hooks?: TaskHooks
  strategy?: IterationStrategy
  breakpoints?: string[]  // Pause at specific events
}

// In Task class, add hook execution
private async executionLoop(): Promise<void> {
  let iteration = 0
  const maxIterations = this.options.strategy?.maxIterations ?? 50
  
  while (iteration < maxIterations && !this.aborted) {
    // Hook: onIteration
    if (this.options.hooks?.onIteration) {
      await this.options.hooks.onIteration(iteration, this.getContext())
    }
    
    // Hook: beforeLLMCall
    let messages = this.messages
    if (this.options.hooks?.beforeLLMCall) {
      messages = await this.options.hooks.beforeLLMCall(messages)
    }
    
    // Make LLM call
    const response = await this.callLLM(messages)
    
    // Hook: afterLLMCall
    let processedResponse = response
    if (this.options.hooks?.afterLLMCall) {
      processedResponse = await this.options.hooks.afterLLMCall(response)
    }
    
    // Process response...
    
    // Hook: shouldContinue
    if (this.options.hooks?.shouldContinue) {
      const shouldContinue = await this.options.hooks.shouldContinue(
        this.getContext()
      )
      if (!shouldContinue) break
    }
    
    iteration++
  }
}
```

### 4. Agent with Task Flow

**Location**: `packages/core/src/flow.ts` (new)

```typescript
// packages/core/src/flow.ts

export interface TaskDependency {
  task: Task
  condition?: (result: TaskResult) => boolean
}

export class TaskFlow {
  private agent: Agent
  private tasks: Map<string, Task> = new Map()
  private dependencies: Map<string, TaskDependency[]> = new Map()
  
  constructor(agent: Agent) {
    this.agent = agent
  }
  
  /**
   * Add task to flow
   */
  async task(
    prompt: string, 
    options?: { dependsOn?: Task[] }
  ): Promise<Task> {
    // Wait for dependencies
    if (options?.dependsOn) {
      await Promise.all(
        options.dependsOn.map(t => t.waitForCompletion())
      )
    }
    
    return this.agent.executeTask({ prompt })
  }
  
  /**
   * Execute tasks in parallel
   */
  async parallel(prompts: string[]): Promise<Task[]> {
    const tasks = await Promise.all(
      prompts.map(p => this.agent.executeTask({ prompt: p }))
    )
    
    await Promise.all(tasks.map(t => t.waitForCompletion()))
    return tasks
  }
  
  /**
   * Conditional execution
   */
  async conditional(options: {
    condition: () => boolean | Promise<boolean>
    onTrue: string
    onFalse: string
  }): Promise<Task> {
    const shouldExecuteTrue = await options.condition()
    const prompt = shouldExecuteTrue ? options.onTrue : options.onFalse
    return this.agent.executeTask({ prompt })
  }
  
  /**
   * Execute with retry
   */
  async retry(
    prompt: string,
    maxRetries: number = 3
  ): Promise<Task> {
    for (let i = 0; i < maxRetries; i++) {
      const task = await this.agent.executeTask({ prompt })
      const result = await task.waitForCompletion()
      
      if (result.success) return task
    }
    
    throw new Error(`Task failed after ${maxRetries} retries`)
  }
}

// Add to Agent class
export class Agent {
  // ... existing code ...
  
  createFlow(): TaskFlow {
    return new TaskFlow(this)
  }
}
```

## Implementation Plan

### Phase 1: Foundation (Week 1)

1. **Create LLMClient package**
   - Basic completion and streaming
   - Non-streaming helpers
   - Batch processing

2. **Create LLMApp package**
   - Single-shot tool usage
   - Manual tool execution
   - Conversation management

3. **Documentation**
   - Usage examples for each layer
   - Migration guide
   - Best practices

### Phase 2: Enhancement (Week 2)

4. **Enhance Task with hooks**
   - Add hook system
   - Iteration strategy
   - Breakpoints

5. **Add TaskFlow**
   - Task dependencies
   - Parallel execution
   - Conditional logic

6. **Provider enhancements**
   - Retry configuration
   - Caching strategies
   - Rate limiting

### Phase 3: Polish (Week 3)

7. **Examples for each layer**
   - Layer 0: Direct LLM client
   - Layer 1: Simple chat bot
   - Layer 2: Function calling app
   - Layer 3: Custom agent loop
   - Layer 4: Multi-task orchestration

8. **Testing**
   - Unit tests for new components
   - Integration tests
   - Documentation tests

9. **Advanced features**
   - State management
   - Persistence
   - Monitoring

## Usage Examples

### Example 1: Layer 0 - Direct LLM Access

```typescript
import { LLMClient, AnthropicProvider } from '@agent-framework/api'

const client = new LLMClient({
  provider: new AnthropicProvider({
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: 'claude-3-5-sonnet-20241022'
  })
})

// Simple one-shot completion
const response = await client.complete({
  messages: [
    { role: 'user', content: 'What is TypeScript?' }
  ],
  maxTokens: 500
})

console.log(response.content)
```

### Example 2: Layer 1 - LLM Application

```typescript
import { LLMApp } from '@agent-framework/llm-app'
import { ReadFileTool, WriteFileTool } from '@agent-framework/tools'

const app = new LLMApp({
  provider: new AnthropicProvider({...}),
  tools: [new ReadFileTool(), new WriteFileTool()],
  autoExecuteTools: false  // Manual control
})

// First interaction
const response1 = await app.chat({
  message: 'Read package.json and tell me the version'
})

if (response1.requiresToolExecution) {
  console.log('LLM wants to use tools:', response1.toolCalls)
  
  // Decide which tools to execute
  const approvedTools = response1.toolCalls.filter(
    t => t.name === 'read_file'
  )
  
  // Execute approved tools
  const results = await app.executeTools(approvedTools)
  
  // Continue conversation with results
  const response2 = await app.chat({ toolResults: results })
  console.log(response2.content)
}
```

### Example 3: Layer 2 - Custom Agent Loop

```typescript
import { Task } from '@agent-framework/core'

const task = new Task({
  apiHandler: provider,
  adapter: nodeAdapter,
  tools: CoreTools,
  
  hooks: {
    beforeLLMCall: async (messages) => {
      // Add custom context to every call
      return [
        ...messages,
        {
          role: 'user',
          content: '[Current time: ' + new Date().toISOString() + ']'
        }
      ]
    },
    
    beforeToolExecution: async (toolUse) => {
      // Log all tool uses
      console.log(`Executing: ${toolUse.name}`)
      
      // Block dangerous operations
      if (toolUse.name === 'execute_command') {
        const cmd = toolUse.input.command
        if (cmd.includes('rm -rf')) {
          console.log('Blocked dangerous command!')
          return null  // Block execution
        }
      }
      
      return toolUse
    },
    
    shouldContinue: async (context) => {
      // Custom stop condition
      if (context.tokenCount > 50000) {
        console.log('Token limit reached')
        return false
      }
      return true
    }
  },
  
  strategy: {
    maxIterations: 30,
    stopConditions: ['attempt_completion', 'timeout']
  }
})

await task.start('Refactor the codebase')
```

### Example 4: Layer 3 - Task Orchestration

```typescript
import { Agent } from '@agent-framework/core'

const agent = new Agent({...})
const flow = agent.createFlow()

// Complex workflow
async function analyzeAndFix() {
  // Step 1: Analyze in parallel
  const [codeAnalysis, testResults, lintResults] = await flow.parallel([
    'Analyze code quality',
    'Run all tests',
    'Run linter'
  ])
  
  // Step 2: Conditional fixing
  const needsFixes = testResults.result.includes('FAILED')
  
  if (needsFixes) {
    const fixTask = await flow.task('Fix failing tests', {
      dependsOn: [testResults]
    })
    
    // Retry if fixes fail
    await flow.retry('Verify all tests pass', 3)
  }
  
  // Step 3: Generate report
  await flow.task('Generate comprehensive report', {
    dependsOn: [codeAnalysis, testResults, lintResults]
  })
}

await analyzeAndFix()
```

## Benefits of This Architecture

### 1. Flexibility
- Use any layer independently
- Mix and match as needed
- Gradual adoption path

### 2. Simplicity
- Start simple (Layer 0)
- Add complexity only when needed
- Clear separation of concerns

### 3. Power
- Full control at any level
- Custom hooks and strategies
- Advanced orchestration patterns

### 4. Compatibility
- Backward compatible
- Existing code continues to work
- Opt-in to new features

## Migration Path

### From Current Code

```typescript
// BEFORE: Only one way to use framework
const agent = new Agent({...})
const task = await agent.executeTask({ prompt: '...' })
await task.waitForCompletion()

// AFTER: Multiple options depending on need

// Option 1: Just need LLM call
const client = new LLMClient({...})
const result = await client.complete({...})

// Option 2: LLM with tools, no loop
const app = new LLMApp({...})
const response = await app.chat({...})

// Option 3: Custom agent loop
const task = new Task({..., hooks: {...}})
await task.start('...')

// Option 4: Multi-task orchestration
const flow = agent.createFlow()
await flow.parallel([...])
```

## Conclusion

This multi-layer architecture provides:

1. **Layer 0**: Direct LLM access for simple use cases
2. **Layer 1**: LLM applications without agentic loops
3. **Layer 2**: Customizable agent execution with hooks
4. **Layer 3**: Multi-task orchestration and workflows

Users can choose the appropriate level of abstraction for their needs, from simple LLM calls to complex multi-agent systems, all within the same framework.

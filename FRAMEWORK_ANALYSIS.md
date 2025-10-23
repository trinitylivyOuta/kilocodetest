# Kilocode Agent Framework - Comprehensive Architecture Analysis

## Executive Summary

This document provides a detailed analysis of the Kilocode codebase architecture, identifying major components, the agent execution flow (especially the CLI standalone tool path), and recommendations for extracting a reusable agent framework that can execute in hybrid environments (VSCode extension and terminal console).

**Project Goal**: Transform the complex Kilocode codebase into a clean, reusable agent framework suitable for building custom LLM applications with minimal complexity and baggage.

---

## 1. Codebase Architecture Overview

### 1.1 Repository Structure

The Kilocode project is a **monorepo** managed with pnpm workspaces and Turbo:

```
kilocodetest/
├── cli/                    # Standalone CLI tool (Terminal UI with Ink)
├── src/                    # VSCode extension source
├── packages/               # Shared packages
│   ├── types/             # Shared TypeScript types
│   ├── cloud/             # Cloud service integration
│   ├── telemetry/         # Telemetry service
│   └── ipc/               # Inter-process communication
├── webview-ui/            # React-based webview UI
├── apps/                  # Additional applications
│   ├── vscode-nightly/    # Nightly VSCode extension
│   ├── web-roo-code/      # Web version
│   └── kilocode-docs/     # Documentation site
└── jetbrains/             # JetBrains IDE plugin
```

### 1.2 Core Technology Stack

- **Runtime**: Node.js 20.19.2
- **Package Manager**: pnpm 10.8.1
- **Build System**: Turbo (monorepo orchestration) + esbuild (bundling)
- **Language**: TypeScript 5.4.5
- **UI Framework (CLI)**: React + Ink (terminal UI)
- **UI Framework (VSCode)**: React (webview)
- **State Management**: Jotai (atoms-based)
- **LLM Integration**: Multiple providers (Anthropic, OpenAI, etc.)
- **VSCode API**: Full VSCode extension APIs

---

## 2. Major Components Identification

### 2.1 Extension Host Layer (`src/`)

**Location**: `/src/extension.ts`, `/src/activate/`

**Purpose**: VSCode extension entry point and lifecycle management

**Key Responsibilities**:
- Extension activation and deactivation
- Command registration
- Webview providers setup
- Context initialization

### 2.2 Core Agent Engine (`src/core/`)

**Location**: `/src/core/`

**Key Components**:

#### 2.2.1 ClineProvider (Main Controller)
- **File**: `src/core/webview/ClineProvider.ts` (3,347 lines)
- **Purpose**: Central controller for the agent system
- **Responsibilities**:
  - Manages task lifecycle
  - Handles webview communication
  - Coordinates services (MCP, telemetry, checkpoints)
  - Manages workspace tracking
  - Handles configuration and modes

#### 2.2.2 Task (Agent Execution)
- **File**: `src/core/task/Task.ts` (3,236 lines)
- **Purpose**: Represents a single agent task execution
- **Responsibilities**:
  - LLM conversation management
  - Tool execution orchestration
  - Context window management
  - Error handling and recovery
  - Checkpoint management
  - Message queue processing

#### 2.2.3 Tool System (`src/core/tools/`)
- **Purpose**: Individual tools the agent can use
- **Key Tools**:
  - `executeCommandTool.ts` - Run terminal commands
  - `readFileTool.ts` - Read file contents
  - `writeToFileTool.ts` - Write files
  - `editFileTool.ts` - Edit files with diff
  - `browserActionTool.ts` - Browser automation
  - `codebaseSearchTool.ts` - Search codebase
  - `listFilesTool.ts` - List directory files
  - `useMcpToolTool.ts` - Use MCP tools
  - `attemptCompletionTool.ts` - Complete task
  - And many more...

#### 2.2.4 Context Management (`src/core/context/`)
- Context tracking and window management
- File context tracking
- Mention processing

#### 2.2.5 Diff System (`src/core/diff/`)
- Multiple diff strategies
- Search and replace
- Multi-file operations

### 2.3 API Layer (`src/api/`)

**Location**: `/src/api/`

**Purpose**: LLM provider abstraction and management

**Key Components**:

#### 2.3.1 Provider System (`src/api/providers/`)
- **Base**: `base-provider.ts`, `base-openai-compatible-provider.ts`
- **Providers**: 40+ providers including:
  - anthropic.ts (Claude)
  - openai.ts, openai-native.ts
  - gemini.ts, gemini-cli.ts
  - ollama.ts, native-ollama.ts
  - openrouter.ts, kilocode-openrouter.ts
  - And many specialized providers

#### 2.3.2 API Handler Factory
- **File**: `src/api/index.ts`
- **Purpose**: Creates appropriate API handlers based on configuration
- **Function**: `buildApiHandler()`

#### 2.3.3 Stream Transformation (`src/api/transform/`)
- **File**: `stream.ts`
- **Purpose**: Unified streaming interface for all providers
- **Class**: `ApiStream`

### 2.4 CLI Standalone Tool (`cli/`)

**Location**: `/cli/`

**Purpose**: Standalone terminal application (independent of VSCode)

**Architecture**:

```
cli/
├── src/
│   ├── index.ts           # Entry point (Commander CLI)
│   ├── cli.ts             # Main CLI class
│   ├── host/              # Extension host for CLI
│   │   ├── ExtensionHost.ts
│   │   └── VSCode.ts      # VSCode API mock
│   ├── services/
│   │   ├── extension.ts   # Extension service wrapper
│   │   ├── telemetry/     # Telemetry service
│   │   └── logs.ts        # Logging service
│   ├── communication/
│   │   └── ipc.ts         # Message bridge
│   ├── state/             # Jotai state management
│   │   └── atoms/
│   ├── ui/                # Ink-based UI components
│   │   └── App.tsx
│   └── config/            # Configuration management
```

**Key Innovation**: The CLI reuses the VSCode extension code by:
1. Creating a mock VSCode API (`VSCode.ts`)
2. Running the extension in an `ExtensionHost` process
3. Using IPC to communicate between CLI UI and extension
4. Providing a terminal-based UI using Ink (React for terminals)

### 2.5 Shared Packages (`packages/`)

#### 2.5.1 `@roo-code/types`
- Shared TypeScript types and interfaces
- Provider settings
- Message types
- Event types

#### 2.5.2 `@roo-code/cloud`
- Cloud service integration
- Authentication
- API communication

#### 2.5.3 `@roo-code/telemetry`
- Telemetry service
- Event tracking
- Analytics

#### 2.5.4 `@roo-code/ipc`
- Inter-process communication
- Message passing

### 2.6 Services Layer (`src/services/`)

**Key Services**:

- **MCP (Model Context Protocol)**: `src/services/mcp/`
  - McpHub.ts - Central MCP management
  - McpServerManager.ts - Server lifecycle
  - MCP server integration for extending agent capabilities

- **Browser Automation**: `src/services/browser/`
  - BrowserSession.ts - Puppeteer integration
  - UrlContentFetcher.ts - Fetch web content

- **Code Index**: `src/services/code-index/`
  - Codebase indexing for search
  - Embedding-based search

- **Checkpoints**: `src/services/checkpoints/`
  - Save/restore task state
  - Version control integration

- **Marketplace**: `src/services/marketplace/`
  - MCP server marketplace
  - Installation and management

### 2.7 Terminal Integration (`src/integrations/terminal/`)

- Terminal process management
- Command execution
- Output capture

### 2.8 Configuration System

- **Provider Settings**: Model and API configuration
- **Modes**: Different agent behaviors (coder, architect, debugger)
- **Custom Instructions**: User-defined system prompts
- **Workspace Config**: `.kilocode/` directory

---

## 3. Agent Execution Flow Analysis

### 3.1 High-Level Flow

```
User Input
    ↓
Task Creation (ClineProvider.createTask)
    ↓
Task Initialization
    ↓
┌─────────────────────────────────────┐
│   Task Execution Loop (Task.ts)    │
│                                     │
│  1. Build System Prompt            │
│  2. Add User Message                │
│  3. Call LLM API                    │
│  4. Parse Response                  │
│  5. Execute Tools                   │
│  6. Add Assistant Response          │
│  7. Repeat until completion         │
└─────────────────────────────────────┘
    ↓
Task Completion
```

### 3.2 Detailed Task Execution Flow

**File**: `src/core/task/Task.ts`

#### Phase 1: Initialization
```typescript
constructor(options: TaskOptions) {
  // 1. Set task ID and metadata
  this.taskId = options.taskId || crypto.randomUUID()
  this.metadata = {...}
  
  // 2. Initialize mode
  this._taskMode = options.historyItem?.mode || undefined
  
  // 3. Setup services
  this.provider = options.provider
  this.apiConfiguration = options.apiConfiguration
  
  // 4. Initialize tools
  this.toolRepetitionDetector = new ToolRepetitionDetector()
  this.fileContextTracker = new FileContextTracker()
  
  // 5. Setup checkpoint service
  this.checkpointService = getCheckpointService(...)
  
  // 6. Initialize message queue
  this.messageQueueService = new MessageQueueService(...)
}
```

#### Phase 2: Start Task
```typescript
async startTask(task?: string) {
  // 1. Initialize environment
  await this.initializeEnvironment()
  
  // 2. Build system prompt
  const systemPrompt = await SYSTEM_PROMPT(...)
  
  // 3. Process user message
  const userContent = await this.processUserMessage(task)
  
  // 4. Add to conversation
  this.clineMessages.push({
    ts: Date.now(),
    type: "say",
    say: "text",
    text: task
  })
  
  // 5. Start execution loop
  await this.initiateTaskLoop()
}
```

#### Phase 3: Execution Loop
```typescript
async initiateTaskLoop() {
  while (true) {
    // 1. Check for user interrupt
    if (this.abort) break
    
    // 2. Build API messages
    const apiMessages = this.buildApiMessages()
    
    // 3. Handle context window
    const { messages, truncated } = await this.handleContextWindow(apiMessages)
    
    // 4. Call LLM API
    const stream = this.apiHandler.createMessage(
      systemPrompt,
      messages,
      metadata
    )
    
    // 5. Process streaming response
    let assistantResponse = ""
    for await (const chunk of stream) {
      assistantResponse += chunk.text
      // Update UI in real-time
    }
    
    // 6. Parse assistant message
    const parsedMessage = AssistantMessageParser.parse(assistantResponse)
    
    // 7. Execute tools
    const toolResults = await this.executeTools(parsedMessage.tools)
    
    // 8. Add results to conversation
    this.addToolResults(toolResults)
    
    // 9. Check for completion
    if (parsedMessage.completion) {
      await this.handleCompletion()
      break
    }
  }
}
```

#### Phase 4: Tool Execution
```typescript
async executeTools(tools: ToolUse[]) {
  for (const tool of tools) {
    switch (tool.name) {
      case "execute_command":
        await this.executeCommandTool(tool.input)
        break
      case "read_file":
        await this.readFileTool(tool.input)
        break
      case "write_to_file":
        await this.writeToFileTool(tool.input)
        break
      // ... many more tools
    }
  }
}
```

### 3.3 CLI Standalone Tool Execution Path

**Entry Point**: `cli/src/index.ts`

```typescript
// 1. Parse CLI arguments
program
  .name("kilocode")
  .option("-m, --mode <mode>")
  .option("-w, --workspace <path>")
  .option("-a, --auto", "autonomous mode")
  .action(async (prompt, options) => {
    // 2. Create CLI instance
    cli = new CLI({
      mode: options.mode,
      workspace: options.workspace,
      ci: options.auto,
      prompt: finalPrompt
    })
    
    // 3. Start CLI
    await cli.start()
    await cli.dispose()
  })
```

**CLI Initialization**: `cli/src/cli.ts`

```typescript
class CLI {
  async initialize() {
    // 1. Create Jotai store
    this.store = createStore()
    
    // 2. Initialize telemetry
    await telemetryService.initialize(config)
    
    // 3. Create ExtensionService (wraps ExtensionHost)
    this.service = createExtensionService({
      workspace: this.options.workspace,
      mode: this.options.mode,
      identity: identity
    })
    
    // 4. Set service in store
    this.store.set(extensionServiceAtom, this.service)
    
    // 5. Initialize service through effects
    await this.store.set(initializeServiceEffectAtom)
  }
  
  async render() {
    // 6. Render Ink UI
    this.ui = render(
      <App store={this.store} />,
      { stdout: process.stdout }
    )
  }
}
```

**Extension Host**: `cli/src/host/ExtensionHost.ts`

```typescript
class ExtensionHost {
  async activate() {
    // 1. Create mock VSCode API
    this.vscodeAPI = createVSCodeAPIMock({
      workspacePath: this.options.workspacePath,
      identity: this.options.identity
    })
    
    // 2. Setup global mocks
    global.vscode = this.vscodeAPI
    
    // 3. Load extension module
    this.extensionModule = await import(this.options.extensionBundlePath)
    
    // 4. Activate extension
    this.extensionAPI = await this.extensionModule.activate(context)
    
    // 5. Setup message routing
    this.setupMessageRouting()
    
    // 6. Emit activated event
    this.emit("activated", this.extensionAPI)
  }
  
  async sendWebviewMessage(message: WebviewMessage) {
    // Route messages from CLI UI to extension
    await this.webviewProvider.handleMessage(message)
  }
}
```

**Message Flow in CLI**:

```
User Input (Ink UI)
    ↓
UI Component emits action
    ↓
Jotai atom updates
    ↓
Effect atom triggers
    ↓
ExtensionService.sendWebviewMessage()
    ↓
ExtensionHost.sendWebviewMessage()
    ↓
ClineProvider.handleMessage()
    ↓
Task execution (same as VSCode)
    ↓
Extension emits state changes
    ↓
ExtensionHost forwards to MessageBridge
    ↓
ExtensionService emits events
    ↓
Jotai atoms update
    ↓
Ink UI re-renders
```

---

## 4. Framework Extraction Recommendations

### 4.1 Core Framework Components to Extract

Based on the analysis, the following components should be extracted:

#### 4.1.1 Agent Core (`@agent-framework/core`)
- **From**: `src/core/task/Task.ts`
- **Extract**:
  - Task execution loop
  - Message processing
  - Tool orchestration
  - Context window management
  - Error handling

#### 4.1.2 API Layer (`@agent-framework/api`)
- **From**: `src/api/`
- **Extract**:
  - `ApiHandler` interface
  - Base provider classes
  - Stream transformation
  - Provider factory
  - Selected providers (start with Anthropic, OpenAI, Ollama)

#### 4.1.3 Tool System (`@agent-framework/tools`)
- **From**: `src/core/tools/`
- **Extract**:
  - Tool interface and base classes
  - Core tools (file operations, command execution)
  - Tool validation
  - Tool repetition detection

#### 4.1.4 Runtime Adapters (`@agent-framework/runtime`)
- **New Package** - Create adapters for different environments:
  - `VSCodeAdapter` - For VSCode extensions
  - `TerminalAdapter` - For CLI applications
  - `NodeAdapter` - For Node.js applications
  - `WebAdapter` - For web applications

#### 4.1.5 Prompt System (`@agent-framework/prompts`)
- **From**: `src/core/prompts/`
- **Extract**:
  - System prompt builder
  - Response formatters
  - Tool definitions
  - Prompt templates

#### 4.1.6 State Management (`@agent-framework/state`)
- **New Package** - Runtime-agnostic state management:
  - Event emitter-based
  - Observable patterns
  - Can integrate with Jotai, Redux, Zustand, etc.

### 4.2 Framework Architecture

```
@agent-framework/
├── core/                  # Core agent execution engine
│   ├── Agent.ts          # Main agent class
│   ├── Task.ts           # Task execution
│   ├── Context.ts        # Context management
│   └── MessageQueue.ts   # Message processing
│
├── api/                   # LLM provider abstraction
│   ├── ApiHandler.ts     # Interface
│   ├── providers/        # Provider implementations
│   ├── stream.ts         # Streaming
│   └── factory.ts        # Provider factory
│
├── tools/                 # Tool system
│   ├── Tool.ts           # Base tool class
│   ├── ToolExecutor.ts   # Tool orchestration
│   ├── core/             # Core tools
│   └── validation.ts     # Tool validation
│
├── runtime/               # Runtime adapters
│   ├── Adapter.ts        # Base adapter interface
│   ├── VSCodeAdapter.ts  # VSCode runtime
│   ├── TerminalAdapter.ts # CLI runtime
│   └── NodeAdapter.ts    # Node.js runtime
│
├── prompts/               # Prompt system
│   ├── SystemPrompt.ts   # System prompt builder
│   ├── templates/        # Prompt templates
│   └── formatters/       # Response formatters
│
└── state/                 # State management
    ├── EventBus.ts       # Event system
    ├── Observable.ts     # Observable state
    └── Store.ts          # State store
```

### 4.3 Key Design Principles

1. **Runtime Agnostic**: Core framework should work in any JavaScript runtime
2. **Adapter Pattern**: Use adapters to integrate with specific environments
3. **Minimal Dependencies**: Keep core dependencies minimal
4. **Pluggable Architecture**: Easy to add new providers, tools, and adapters
5. **Type-Safe**: Full TypeScript support with strong types
6. **Event-Driven**: Use events for loose coupling
7. **Testable**: Easy to unit test without environment dependencies

### 4.4 Separation of Concerns

**What to Include**:
- Agent execution logic
- LLM API abstraction
- Tool system
- Context management
- Prompt building
- Message processing

**What to Exclude** (environment-specific):
- VSCode-specific APIs
- Webview rendering
- UI components (except terminal adapter)
- Extension lifecycle
- Workspace tracking (provide interfaces instead)
- Cloud services (provide as optional plugin)
- Telemetry (provide as optional plugin)

### 4.5 Proposed API Surface

```typescript
// Simple usage example
import { Agent, OpenAIProvider, NodeAdapter } from '@agent-framework/core'
import { FileTools, CommandTools } from '@agent-framework/tools'

// 1. Create an agent
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

// 2. Execute a task
const task = await agent.executeTask({
  prompt: "Create a new Express.js server",
  onProgress: (event) => {
    console.log(event.type, event.data)
  }
})

// 3. Wait for completion
await task.waitForCompletion()

// 4. Get results
console.log(task.result)
```

---

## 5. Implementation Challenges and Solutions

### 5.1 Challenge: VSCode API Dependencies

**Problem**: Many components deeply depend on VSCode APIs (`vscode` module)

**Solution**:
1. Extract interfaces from VSCode API usage
2. Create adapter pattern for environment-specific implementations
3. Mock VSCode APIs for non-VSCode environments (like the CLI does)

**Example**:
```typescript
// Framework interface
interface FileSystem {
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  listFiles(dir: string): Promise<string[]>
}

// VSCode adapter
class VSCodeFileSystem implements FileSystem {
  async readFile(path: string) {
    const uri = vscode.Uri.file(path)
    const content = await vscode.workspace.fs.readFile(uri)
    return Buffer.from(content).toString('utf-8')
  }
}

// Node adapter
class NodeFileSystem implements FileSystem {
  async readFile(path: string) {
    return await fs.promises.readFile(path, 'utf-8')
  }
}
```

### 5.2 Challenge: Webview Communication

**Problem**: ClineProvider and Task communicate through webview messages

**Solution**:
1. Abstract message passing into an event bus
2. Different adapters implement the event bus differently
3. Use standard event emitters for non-webview environments

### 5.3 Challenge: Large Monolithic Files

**Problem**: `ClineProvider.ts` (3,347 lines) and `Task.ts` (3,236 lines) are very large

**Solution**:
1. Break down into smaller, focused modules
2. Extract responsibilities into separate classes
3. Use composition over inheritance

**Example Breakdown for Task.ts**:
```typescript
Task.ts              → Agent.ts (orchestrator)
                     → ConversationManager.ts
                     → ToolExecutor.ts
                     → ContextWindowManager.ts
                     → ErrorHandler.ts
                     → CheckpointManager.ts
```

### 5.4 Challenge: Tool System Complexity

**Problem**: 30+ tools with varying complexity

**Solution**:
1. Start with essential tools only (5-10 core tools)
2. Provide plugin system for adding custom tools
3. Document tool creation API

**Essential Tools**:
- File operations (read, write, edit)
- Command execution
- Search/grep
- Browser actions (optional)
- MCP integration (optional)

### 5.5 Challenge: Provider Ecosystem

**Problem**: 40+ LLM providers, each with unique quirks

**Solution**:
1. Start with 3-5 major providers
2. Create clear provider interface
3. Provide base classes for common provider types
4. Document provider creation process

**Priority Providers**:
1. Anthropic (Claude)
2. OpenAI (GPT)
3. Ollama (local models)
4. OpenRouter (multi-provider)
5. Generic OpenAI-compatible

---

## 6. Migration Path

### 6.1 Phase 1: Extract Core (Week 1-2)

**Goal**: Create minimal working framework

**Steps**:
1. Create new monorepo structure
2. Extract `Task.ts` → `Agent.ts` with simplified logic
3. Extract API layer with 3 providers (Anthropic, OpenAI, Ollama)
4. Extract 5 core tools (read, write, execute)
5. Create basic Node adapter
6. Create simple CLI example

**Deliverable**: `@agent-framework/core` with basic functionality

### 6.2 Phase 2: Add Adapters (Week 3)

**Goal**: Support multiple runtime environments

**Steps**:
1. Create adapter interface
2. Implement Node adapter
3. Implement Terminal (Ink) adapter
4. Implement VSCode adapter (stub)
5. Test in all three environments

**Deliverable**: `@agent-framework/runtime` package

### 6.3 Phase 3: Enhance Tools (Week 4)

**Goal**: Add more tools and plugin system

**Steps**:
1. Extract 10 more tools
2. Create tool plugin interface
3. Document tool creation
4. Add tool validation
5. Add tool repetition detection

**Deliverable**: `@agent-framework/tools` with plugin system

### 6.4 Phase 4: Polish and Document (Week 5)

**Goal**: Production-ready framework

**Steps**:
1. Write comprehensive documentation
2. Create examples and tutorials
3. Add tests
4. Optimize performance
5. Create migration guide from Kilocode

**Deliverable**: v1.0.0 release

---

## 7. Code Reduction Strategy

The current codebase is massive. Here's how to reduce complexity:

### 7.1 What to Remove

1. **VSCode-specific UI**: 
   - Webview components
   - Extension views
   - Status bar items
   - Quick picks
   - Tree views

2. **Cloud Services**:
   - Authentication UI
   - Organization management
   - Payment handling
   - Usage tracking

3. **Marketplace Features**:
   - MCP marketplace UI
   - Server installation UI
   - Rating and reviews

4. **Telemetry**:
   - PostHog integration
   - Analytics tracking
   - Error reporting (keep basic logging)

5. **Advanced Features** (initially):
   - Code indexing with embeddings
   - Browser automation
   - MDM service
   - Checkpoint system (keep interface)
   - Workspace tracking (keep interface)

6. **Testing Infrastructure**:
   - E2E tests
   - VSCode-specific tests
   - Integration tests (initially)

### 7.2 What to Keep

1. **Core Agent Logic**:
   - Task execution loop
   - Message processing
   - Tool orchestration
   - Context window management

2. **API Layer**:
   - Provider abstraction
   - Streaming
   - Error handling

3. **Essential Tools**:
   - File operations
   - Command execution
   - Search

4. **Prompt System**:
   - System prompt building
   - Response formatting
   - Tool definitions

5. **Basic Services**:
   - Configuration management
   - Logging
   - Error handling

### 7.3 Estimated Size Reduction

| Component | Current | Target | Reduction |
|-----------|---------|--------|-----------|
| Total codebase | ~100k LOC | ~15k LOC | 85% |
| Core agent | 3,236 LOC | 500 LOC | 85% |
| Provider controller | 3,347 LOC | 300 LOC | 91% |
| API layer | 10k LOC | 3k LOC | 70% |
| Tools | 15k LOC | 2k LOC | 87% |
| Runtime adapters | 0 LOC | 1k LOC | New |
| Infrastructure | 70k LOC | 8k LOC | 89% |

**Total Framework**: ~15,000 lines of code (85% reduction)

---

## 8. Recommended Framework Structure

### 8.1 Package Layout

```
agent-framework/
├── packages/
│   ├── core/                 # ~3k LOC
│   │   ├── src/
│   │   │   ├── Agent.ts
│   │   │   ├── Task.ts
│   │   │   ├── Context.ts
│   │   │   ├── MessageQueue.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── api/                  # ~3k LOC
│   │   ├── src/
│   │   │   ├── ApiHandler.ts
│   │   │   ├── ApiStream.ts
│   │   │   ├── providers/
│   │   │   │   ├── anthropic.ts
│   │   │   │   ├── openai.ts
│   │   │   │   └── ollama.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── tools/                # ~2k LOC
│   │   ├── src/
│   │   │   ├── Tool.ts
│   │   │   ├── ToolExecutor.ts
│   │   │   ├── core/
│   │   │   │   ├── readFile.ts
│   │   │   │   ├── writeFile.ts
│   │   │   │   ├── execute.ts
│   │   │   │   └── search.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── runtime/              # ~1k LOC
│   │   ├── src/
│   │   │   ├── Adapter.ts
│   │   │   ├── NodeAdapter.ts
│   │   │   ├── TerminalAdapter.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── prompts/              # ~1k LOC
│   │   ├── src/
│   │   │   ├── SystemPrompt.ts
│   │   │   ├── templates/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── types/                # ~500 LOC
│       ├── src/
│       │   └── index.ts
│       └── package.json
│
├── examples/                 # ~2k LOC
│   ├── basic-cli/
│   ├── express-server/
│   └── vscode-extension/
│
├── docs/
│   ├── getting-started.md
│   ├── api-reference.md
│   ├── creating-tools.md
│   └── creating-adapters.md
│
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

### 8.2 Dependency Graph

```
@agent-framework/core
  ↓ depends on
  ├── @agent-framework/types
  ├── @agent-framework/api
  ├── @agent-framework/tools
  └── @agent-framework/prompts

@agent-framework/runtime
  ↓ depends on
  └── @agent-framework/core

Examples
  ↓ depend on
  ├── @agent-framework/core
  └── @agent-framework/runtime
```

---

## 9. Next Steps

### 9.1 Immediate Actions

1. **Create Framework Repository**
   - Set up monorepo structure
   - Configure build tools (tsup/esbuild)
   - Set up TypeScript configuration

2. **Extract Core Module** (`@agent-framework/core`)
   - Create simplified `Agent` class from `Task.ts`
   - Remove VSCode dependencies
   - Add basic event system

3. **Extract API Module** (`@agent-framework/api`)
   - Copy and simplify provider system
   - Start with Anthropic provider
   - Add streaming support

4. **Create Basic Example**
   - Simple CLI that uses the framework
   - Demonstrates core functionality
   - Acts as integration test

### 9.2 Success Criteria

A successful framework extraction will:

1. ✅ Work in both Node.js CLI and VSCode extension environments
2. ✅ Support at least 3 major LLM providers
3. ✅ Include 5-10 essential tools
4. ✅ Have clear, simple API (<100 lines for basic usage)
5. ✅ Be well-documented with examples
6. ✅ Be <20k lines of code total
7. ✅ Have minimal dependencies (<20 direct dependencies)
8. ✅ Be fully typed with TypeScript
9. ✅ Be tested (unit tests for core functionality)
10. ✅ Be extensible (plugin system for tools and providers)

---

## 10. Conclusion

The Kilocode codebase is a sophisticated AI agent system with rich functionality but significant complexity. By extracting the core agent execution logic, API abstraction, and tool system into a standalone framework with runtime adapters, we can create a reusable foundation for building custom AI agents without the baggage of VSCode-specific code, UI components, cloud services, and other non-essential features.

The proposed framework will be:
- **Lean**: ~15k LOC vs 100k+ in Kilocode
- **Flexible**: Works in multiple environments via adapters
- **Extensible**: Plugin system for tools and providers
- **Well-documented**: Clear examples and API reference
- **Production-ready**: Built on battle-tested Kilocode code

This framework will enable developers to quickly build custom AI agents and LLM applications while leveraging the proven architecture and tooling from Kilocode.

---

## Appendices

### A. Key Files Reference

| File | LOC | Purpose | Extract? |
|------|-----|---------|----------|
| src/core/task/Task.ts | 3,236 | Main task execution | ✅ Yes (core) |
| src/core/webview/ClineProvider.ts | 3,347 | Provider controller | ⚠️ Partial (orchestration) |
| src/api/index.ts | 100 | API handler factory | ✅ Yes (complete) |
| src/api/providers/*.ts | ~10k | LLM providers | ⚠️ Partial (3-5 providers) |
| src/core/tools/*.ts | ~15k | Tool implementations | ⚠️ Partial (5-10 tools) |
| src/core/prompts/system.ts | ~500 | System prompt | ✅ Yes (complete) |
| cli/src/host/ExtensionHost.ts | ~800 | Extension host | ✅ Yes (as adapter) |

### B. Glossary

- **Agent**: An autonomous AI assistant that can execute tasks
- **Task**: A single unit of work with conversation history
- **Tool**: A capability the agent can use (file operations, commands, etc.)
- **Provider**: An LLM API integration (Anthropic, OpenAI, etc.)
- **Adapter**: Runtime-specific implementation layer
- **MCP**: Model Context Protocol - standard for extending AI capabilities
- **Webview**: VSCode's UI panel for rendering HTML/React
- **ExtensionHost**: Isolated Node.js process that runs extension code

### C. External Resources

- [VSCode Extension API](https://code.visualstudio.com/api)
- [Ink - React for CLIs](https://github.com/vadimdemedes/ink)
- [Anthropic API](https://docs.anthropic.com/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Jotai State Management](https://jotai.org/)

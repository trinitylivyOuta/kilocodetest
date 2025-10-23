# Kilo Code Architecture Analysis

## Executive Summary

This document provides a comprehensive analysis of the Kilo Code codebase architecture, including its major components, agent execution flow, and the relationship between the VSCode extension and the standalone CLI tool. The analysis reveals a sophisticated architecture that achieves significant code reuse (~70-80%) between the CLI and VSCode extension through careful abstraction and a comprehensive VSCode API mocking layer.

**Key Findings:**
- **Monorepo Structure**: Organized using pnpm workspaces with Turbo for build orchestration
- **Code Sharing**: CLI and VSCode extension share 70-80% of their codebase through shared packages
- **VSCode API Mocking**: CLI implements a 2,111-line mock VSCode API to enable code reuse
- **Extension Host Pattern**: CLI uses an ExtensionHost to load and run the actual extension code
- **Shared Core Logic**: Task execution, AI interaction, and tool usage logic are identical in both environments

---

## Table of Contents

1. [Codebase Architecture Overview](#1-codebase-architecture-overview)
2. [Major Components](#2-major-components)
3. [Agent Execution Flow](#3-agent-execution-flow)
4. [CLI Tool Deep Dive](#4-cli-tool-deep-dive)
5. [Code Sharing Analysis](#5-code-sharing-analysis)
6. [VSCode Runtime Context Handling](#6-vscode-runtime-context-handling)
7. [Build and Deployment Pipeline](#7-build-and-deployment-pipeline)
8. [Key Architectural Patterns](#8-key-architectural-patterns)

---

## 1. Codebase Architecture Overview

### 1.1 Repository Structure

The Kilo Code repository is organized as a **monorepo** using pnpm workspaces:

```
kilocodetest/
├── src/                          # Main VSCode extension source
│   ├── core/                     # Core business logic (shared)
│   ├── services/                 # Service implementations
│   ├── integrations/             # VSCode-specific integrations
│   ├── api/                      # LLM provider integrations
│   ├── shared/                   # Shared utilities and types
│   └── extension.ts              # Extension entry point
│
├── cli/                          # Standalone CLI tool
│   ├── src/
│   │   ├── host/                 # VSCode API mock and extension hosting
│   │   ├── services/             # CLI-specific services
│   │   ├── ui/                   # Terminal UI (Ink/React)
│   │   ├── state/                # State management (Jotai)
│   │   └── index.ts              # CLI entry point
│   └── package.json
│
├── packages/                     # Shared packages
│   ├── types/                    # Shared TypeScript types
│   ├── cloud/                    # Cloud service integration
│   ├── telemetry/                # Analytics and telemetry
│   ├── config-typescript/        # Shared TS config
│   └── config-eslint/            # Shared ESLint config
│
├── webview-ui/                   # React-based UI (VSCode only)
├── jetbrains/                    # JetBrains plugin
├── apps/                         # Additional applications
│   ├── web-roo-code/            # Web version
│   ├── playwright-e2e/          # E2E tests
│   └── kilocode-docs/           # Documentation site
│
└── package.json                  # Root package configuration
```

### 1.2 Technology Stack

**Core Technologies:**
- **Language**: TypeScript 5.4.5
- **Runtime**: Node.js 20.19.2
- **Package Manager**: pnpm 10.8.1
- **Build Orchestration**: Turbo
- **Bundler**: esbuild

**VSCode Extension:**
- **Framework**: VSCode Extension API
- **UI**: React (webview-ui)
- **State Management**: VSCode ExtensionContext

**CLI Tool:**
- **UI Framework**: Ink (React for terminal)
- **State Management**: Jotai
- **Testing**: Vitest
- **Terminal**: ANSI escape sequences, Ink components

**Shared Libraries:**
- **AI SDKs**: Anthropic SDK, OpenAI SDK, various LLM providers
- **MCP**: Model Context Protocol SDK (@modelcontextprotocol/sdk)
- **Browser Automation**: Puppeteer
- **File Processing**: tree-sitter, tiktoken, shiki

### 1.3 Architectural Principles

1. **Separation of Concerns**: Clear boundaries between UI, business logic, and services
2. **Code Reuse**: Maximum code sharing through abstraction
3. **Platform Abstraction**: Abstract away platform-specific details (VSCode API)
4. **Event-Driven**: Extensive use of EventEmitters for loose coupling
5. **Type Safety**: Comprehensive TypeScript types in `@roo-code/types`

---

## 2. Major Components

### 2.1 Core Extension Components

#### 2.1.1 ClineProvider (`src/core/webview/ClineProvider.ts`)

**Size**: 3,347 lines  
**Role**: Central orchestrator for the VSCode extension

**Responsibilities:**
- Implements `vscode.WebviewViewProvider` for sidebar UI
- Manages the lifecycle of Task instances
- Handles communication between webview UI and extension backend
- Coordinates with services (McpHub, CodeIndexManager, TerminalRegistry)
- Manages authentication and cloud services
- Handles telemetry and analytics

**Key Interfaces:**
```typescript
export class ClineProvider
    extends EventEmitter<TaskProviderEvents>
    implements vscode.WebviewViewProvider, TelemetryPropertiesProvider, TaskProviderLike
```

**Important Methods:**
- `resolveWebviewView()`: Initializes webview when sidebar is opened
- `initClineWithTask()`: Creates new Task instances
- `postMessageToWebview()`: Sends messages to React UI
- `handleWebviewAskResponse()`: Processes user responses from UI

#### 2.1.2 Task (`src/core/task/Task.ts`)

**Size**: 3,236 lines  
**Role**: Core agent execution engine

**Responsibilities:**
- Manages the complete lifecycle of an AI agent task
- Orchestrates API calls to LLM providers
- Executes tools (file operations, terminal commands, browser automation)
- Handles conversation history and context management
- Implements sliding window for context truncation
- Manages checkpointing and task persistence

**Key Features:**
- **Tool Execution**: 20+ different tools for various operations
- **Streaming**: Real-time streaming of LLM responses
- **Error Recovery**: Automatic retry with exponential backoff
- **Context Management**: Intelligent truncation to fit token limits
- **State Persistence**: Saves conversation history to disk

**Tool Categories:**
1. **File Operations**: read_file, write_to_file, replace_in_file
2. **Search**: search_files, regex_search, list_files
3. **Code Analysis**: list_code_definition_names
4. **Terminal**: execute_command
5. **Browser**: browser_action
6. **Task Management**: ask_followup_question, attempt_completion
7. **MCP Tools**: Dynamic tools from MCP servers

#### 2.1.3 API Handler (`src/api/`)

**Role**: Abstraction layer for LLM providers

**Supported Providers:**
- Anthropic (Claude)
- OpenAI (GPT models)
- Bedrock (AWS)
- Vertex AI (Google Cloud)
- Azure OpenAI
- OpenRouter
- LM Studio (local)
- Ollama (local)
- Kilo Code cloud service
- Gemini
- DeepSeek
- Mistral

**Key Abstractions:**
- `ApiHandler`: Interface for all providers
- `ApiStream`: Unified streaming interface
- Transform layer: Converts provider-specific responses to common format

### 2.2 CLI-Specific Components

#### 2.2.1 ExtensionHost (`cli/src/host/ExtensionHost.ts`)

**Size**: 902 lines  
**Role**: Loads and executes the VSCode extension in CLI environment

**Responsibilities:**
- Loads the compiled extension.js bundle
- Sets up VSCode API mock as global `vscode` object
- Manages extension lifecycle (activate/deactivate)
- Intercepts console output for logging
- Handles errors and recovery
- Forwards messages between CLI and extension

**Key Methods:**
```typescript
async activate(): Promise<ExtensionAPI>
async deactivate(): Promise<void>
async sendWebviewMessage(message: WebviewMessage): Promise<void>
private setupVSCodeAPIMock(): Promise<void>
private loadExtensionModule(): Promise<void>
private activateExtension(): Promise<void>
```

**Initialization Flow:**
1. Create VSCode API mock with identity and workspace
2. Set mock as global `vscode` object
3. Intercept console methods for logging
4. Load extension module from bundle path
5. Call extension's `activate()` function
6. Wait for webview provider registration
7. Simulate webview launch
8. Emit 'activated' event with API reference

#### 2.2.2 VSCode API Mock (`cli/src/host/VSCode.ts`)

**Size**: 2,111 lines  
**Role**: Comprehensive mock implementation of VSCode API

**Implemented APIs:**
- **Window**: Output channels, status bar, input boxes, quick picks
- **Workspace**: File system, configuration, workspace folders
- **Commands**: Command registration and execution
- **Uri**: File path and URI handling
- **EventEmitter**: Event subscription and firing
- **FileSystem**: File/directory operations
- **TextEditor**: Basic editor operations (limited)
- **Env**: Environment information (machineId, sessionId, etc.)

**Example Implementation:**
```typescript
export function createVSCodeAPIMock(
    extensionRootPath: string,
    workspacePath: string,
    identity?: IdentityInfo
): any {
    const vscode = {
        window: {
            createOutputChannel(name: string): OutputChannel { /* ... */ },
            showInformationMessage(message: string): Promise<string | undefined> { /* ... */ },
            // ... 20+ more methods
        },
        workspace: {
            workspaceFolders: [/* workspace folder objects */],
            getConfiguration(section?: string): WorkspaceConfiguration { /* ... */ },
            fs: { /* file system operations */ },
            // ... 15+ more methods
        },
        commands: {
            registerCommand(command: string, callback: Function): Disposable { /* ... */ },
            executeCommand(command: string, ...args: any[]): Promise<any> { /* ... */ }
        },
        // ... 10+ more namespaces
    }
    return vscode
}
```

**Limitations:**
- Text editor operations are mocked but don't perform actual edits
- Some VSCode UI elements (notifications, quick picks) are simulated
- Extension API features not used by Kilo Code are not implemented

#### 2.2.3 ExtensionService (`cli/src/services/extension.ts`)

**Size**: 376 lines  
**Role**: Service layer for managing ExtensionHost

**Responsibilities:**
- Initializes and manages ExtensionHost lifecycle
- Provides event-driven interface for UI
- Handles message bridging
- Remains stateless (no UI concerns)

**Event Interface:**
```typescript
interface ExtensionServiceEvents {
    ready: (api: ExtensionAPI) => void
    stateChange: (state: ExtensionState) => void
    message: (message: ExtensionMessage) => void
    error: (error: Error) => void
    warning: (warning: { context: string; error: Error }) => void
    disposed: () => void
}
```

#### 2.2.4 CLI Application (`cli/src/cli.ts`)

**Size**: ~150 lines  
**Role**: Main CLI orchestrator

**Responsibilities:**
- Creates ExtensionService
- Sets up Jotai store for state management
- Initializes telemetry
- Renders Ink UI
- Handles CI/autonomous mode
- Manages cleanup on exit

**Initialization Sequence:**
```typescript
1. Load configuration
2. Initialize telemetry service
3. Create ExtensionService with identity
4. Set service in Jotai store
5. Initialize service effects (event subscriptions)
6. Load task history
7. Render Ink UI
8. If CI mode: inject initial prompt
9. Wait for task completion or timeout
```

#### 2.2.5 Terminal UI (`cli/src/ui/`)

**Technology**: Ink (React for terminal)  
**Components**:
- `App.tsx`: Root component
- `ChatView.tsx`: Main chat interface
- `MessageList.tsx`: Conversation display
- `ApprovalPrompt.tsx`: Interactive approval dialogs
- `SettingsView.tsx`: Configuration UI

**State Management**: Jotai atoms for reactive state

### 2.3 Shared Packages

#### 2.3.1 @roo-code/types

**Purpose**: Shared TypeScript types and interfaces  
**Key Exports**:
- `TaskLike`, `TaskMetadata`, `TaskEvents`
- `ClineMessage`, `ClineSay`, `ClineAsk`
- `ToolName`, `ToolUsage`
- `ProviderSettings`, `RooCodeSettings`
- `HistoryItem`, `TokenUsage`

**Usage**: Imported by both CLI and extension to ensure type consistency

#### 2.3.2 @roo-code/cloud

**Purpose**: Cloud service integration  
**Features**:
- Authentication flow
- Organization management
- API key management
- Usage tracking

**Note**: Primarily used by VSCode extension; CLI has limited cloud integration

#### 2.3.3 @roo-code/telemetry

**Purpose**: Analytics and telemetry  
**Features**:
- Event tracking (PostHog)
- Identity management
- Privacy-compliant data collection

**Shared By**: Both CLI and extension use identical telemetry

---

## 3. Agent Execution Flow

### 3.1 High-Level Flow

The agent execution follows this general pattern in both CLI and VSCode extension:

```
┌─────────────────────────────────────────────────────────────┐
│                    User Input/Prompt                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              Task Instance Created                           │
│              (src/core/task/Task.ts)                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Build System Prompt & Context                        │
│         - Mode-specific instructions                         │
│         - Available tools                                     │
│         - Custom rules and prompts                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         API Call to LLM Provider                             │
│         (streaming response)                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
         ┌─────────────┴─────────────┐
         │                           │
         ▼                           ▼
┌────────────────┐          ┌────────────────┐
│ Text Response  │          │  Tool Calls    │
└────────┬───────┘          └────────┬───────┘
         │                           │
         │                           ▼
         │              ┌────────────────────────┐
         │              │   Execute Tool         │
         │              │   - Requires approval? │
         │              │   - Execute operation  │
         │              │   - Return result      │
         │              └────────────┬───────────┘
         │                           │
         │                           ▼
         │              ┌────────────────────────┐
         │              │   Append to History    │
         │              └────────────┬───────────┘
         │                           │
         └───────────┬───────────────┘
                     │
                     ▼
         ┌────────────────────────┐
         │  More turns needed?     │
         └───────┬───────┬────────┘
                 │       │
            Yes  │       │  No
                 │       │
                 ▼       ▼
         [Loop back]  [Complete]
```

### 3.2 Detailed Task Lifecycle

#### Phase 1: Initialization

1. **Task Creation**:
   - User provides prompt through UI (webview or terminal)
   - `ClineProvider.initClineWithTask()` or equivalent creates Task instance
   - Task ID, mode, and initial context are set

2. **Configuration Loading**:
   - Load provider settings (API keys, model selection)
   - Load mode-specific configuration
   - Load custom rules and system prompts
   - Initialize MCP servers if enabled

3. **Context Gathering**:
   - Scan workspace for relevant files
   - Load `.rooignore` and `.rooprotected` rules
   - Initialize file context tracker
   - Build initial system prompt with:
     - Mode instructions
     - Available tools
     - Custom instructions
     - Workspace context

#### Phase 2: LLM Interaction Loop

1. **Prepare API Request**:
   ```typescript
   // Build messages array
   const messages = [
       { role: 'system', content: systemPrompt },
       ...conversationHistory,
       { role: 'user', content: userMessage }
   ]
   
   // Call API handler
   const stream = await apiHandler.createMessage(
       systemPrompt,
       messages,
       tools
   )
   ```

2. **Stream Processing**:
   - Receive streaming chunks from LLM
   - Parse text responses and tool calls
   - Update UI in real-time
   - Track token usage

3. **Tool Execution**:
   ```typescript
   // For each tool call in response
   for (const toolUse of toolUses) {
       // Check if approval required
       if (requiresApproval(toolUse)) {
           const approved = await askForApproval(toolUse)
           if (!approved) {
               addToolResult(toolUse.id, 'rejected')
               continue
           }
       }
       
       // Execute tool
       const result = await executeTool(toolUse.name, toolUse.input)
       
       // Add result to conversation
       addToolResult(toolUse.id, result)
   }
   ```

4. **Context Management**:
   - Track context window usage
   - Implement sliding window if needed
   - Compress or summarize old messages
   - Maintain important context (system prompt, recent tools)

5. **Continuation**:
   - Append tool results to conversation
   - Make another API call with updated history
   - Repeat until task completion or user interruption

#### Phase 3: Completion

1. **Task Finalization**:
   - Receive `attempt_completion` tool call
   - Show completion message to user
   - Save conversation history
   - Update telemetry

2. **Cleanup**:
   - Close browser sessions
   - Terminate terminal processes
   - Release file locks
   - Dispose of resources

### 3.3 Tool Approval Flow

Both CLI and extension implement a sophisticated approval system:

```typescript
interface ApprovalRequest {
    type: 'read' | 'write' | 'execute' | 'browser' | 'mcp'
    path?: string           // For file operations
    command?: string        // For terminal commands
    operation?: string      // For MCP tools
    content?: string        // For write operations
}

async function requiresApproval(request: ApprovalRequest): Promise<boolean> {
    // Check auto-approval settings
    const autoApproval = getAutoApprovalConfig()
    
    if (autoApproval[request.type]?.enabled) {
        // Check specific rules
        if (request.type === 'write' && isProtectedFile(request.path)) {
            return autoApproval.write.protected !== true
        }
        
        if (request.type === 'execute') {
            return !isCommandAllowed(request.command, autoApproval.execute.allowed)
        }
        
        return false // Auto-approved
    }
    
    return true // Requires approval
}
```

**Auto-Approval Configuration** (CLI):
```json
{
    "autoApproval": {
        "read": { "enabled": true, "outside": true },
        "write": { "enabled": true, "outside": false, "protected": false },
        "execute": {
            "enabled": true,
            "allowed": ["npm", "git status"],
            "denied": ["rm -rf", "sudo"]
        },
        "browser": { "enabled": false },
        "mcp": { "enabled": true }
    }
}
```

---

## 4. CLI Tool Deep Dive

### 4.1 CLI Architecture

The CLI tool is architected to reuse the VSCode extension code while providing a terminal-based user experience:

```
┌─────────────────────────────────────────────────────────────┐
│                     CLI Application                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Ink UI (React)                          │  │
│  │  - ChatView                                           │  │
│  │  - MessageList                                        │  │
│  │  - ApprovalPrompt                                     │  │
│  └────────────────────┬─────────────────────────────────┘  │
│                       │                                      │
│  ┌────────────────────▼─────────────────────────────────┐  │
│  │          Jotai State Management                       │  │
│  │  - extensionServiceAtom                               │  │
│  │  - mappedExtensionStateAtom                          │  │
│  │  - conversationHistoryAtom                           │  │
│  └────────────────────┬─────────────────────────────────┘  │
│                       │                                      │
│  ┌────────────────────▼─────────────────────────────────┐  │
│  │          ExtensionService                             │  │
│  │  - Event-driven interface                             │  │
│  │  - Message bridging                                   │  │
│  └────────────────────┬─────────────────────────────────┘  │
│                       │                                      │
│  ┌────────────────────▼─────────────────────────────────┐  │
│  │          ExtensionHost                                │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │   VSCode API Mock (global.vscode)             │  │  │
│  │  └────────────────────┬───────────────────────────┘  │  │
│  │                       │                               │  │
│  │  ┌────────────────────▼───────────────────────────┐  │  │
│  │  │   Extension Bundle (extension.js)             │  │  │
│  │  │   ┌───────────────────────────────────────┐   │  │  │
│  │  │   │  ClineProvider                        │   │  │  │
│  │  │   │  ┌────────────────────────────────┐  │   │  │  │
│  │  │   │  │  Task                          │  │   │  │  │
│  │  │   │  │  ┌──────────────────────────┐  │  │   │  │  │
│  │  │   │  │  │  ApiHandler              │  │  │   │  │  │
│  │  │   │  │  └──────────────────────────┘  │  │   │  │  │
│  │  │   │  └────────────────────────────────┘  │   │  │  │
│  │  │   └───────────────────────────────────────┘   │  │  │
│  │  └──────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Message Flow

The CLI implements a bidirectional message flow:

#### CLI → Extension (WebviewMessage)

```typescript
// Types from shared package
type WebviewMessage =
    | { type: 'webviewDidLaunch' }
    | { type: 'newTask', text: string, images?: string[] }
    | { type: 'askResponse', askResponse: ClineAskResponse }
    | { type: 'clearTask' }
    | { type: 'selectImages', images: string[] }
    // ... 30+ more message types

// Sending from CLI
await extensionService.sendWebviewMessage({
    type: 'askResponse',
    askResponse: 'yesButtonClicked',
    text: 'approved'
})
```

#### Extension → CLI (ExtensionMessage)

```typescript
// Types from shared package
type ExtensionMessage =
    | { type: 'state', state: ExtensionState }
    | { type: 'action', action: string }
    | { type: 'selectedImages', images: string[] }
    | { type: 'partialMessage', partialMessage: ClineMessage }
    // ... 20+ more message types

// Receiving in CLI
extensionService.on('message', (message: ExtensionMessage) => {
    if (message.type === 'state') {
        store.set(mappedExtensionStateAtom, message.state)
    }
    // Handle other message types
})
```

### 4.3 Extension Bundle Loading

The CLI loads the actual compiled extension code:

1. **Build Process**:
   ```bash
   # VSCode extension is built normally
   pnpm bundle  # Creates bin-unpacked/extension/dist/extension.js
   
   # CLI build copies extension bundle
   pnpm cli:build
   # Copies extension to cli/dist/kilocode/
   ```

2. **Runtime Loading**:
   ```typescript
   // cli/src/host/ExtensionHost.ts
   private async loadExtensionModule(): Promise<void> {
       const extensionPath = this.options.extensionBundlePath
       // e.g., /path/to/cli/dist/kilocode/dist/extension.js
       
       // Dynamic import of extension
       this.extensionModule = await import(extensionPath)
       
       if (!this.extensionModule.activate) {
           throw new Error('Extension module missing activate function')
       }
   }
   ```

3. **Extension Activation**:
   ```typescript
   private async activateExtension(): Promise<void> {
       // Call extension's activate() with mock context
       this.extensionAPI = await this.extensionModule.activate(
           this.vscodeAPI.context
       )
       
       // Wait for ClineProvider registration
       await this.waitForWebviewProvider()
   }
   ```

### 4.4 Key Differences from VSCode Extension

| Aspect | VSCode Extension | CLI Tool |
|--------|-----------------|----------|
| **UI Framework** | React (webview) | Ink (React for terminal) |
| **VSCode API** | Real VSCode API | Mocked VSCode API |
| **State Management** | ExtensionContext | Jotai atoms |
| **User Interaction** | Buttons, forms, panels | Terminal prompts, menus |
| **File Operations** | VSCode FileSystem API | Node.js fs module |
| **Editor Integration** | Full editor control | Read/write files only |
| **Settings** | VSCode settings | JSON config file |
| **Lifecycle** | Managed by VSCode | Process lifecycle |
| **Deployment** | VSIX package | NPM package |

---

## 5. Code Sharing Analysis

### 5.1 Shared Code Percentage

Based on line count analysis:

**Completely Shared** (~60%):
- `src/core/task/Task.ts` (3,236 lines) - Agent execution engine
- `src/api/` (5,000+ lines) - LLM provider integrations
- `src/core/prompts/` (2,000+ lines) - System prompts and tool definitions
- `src/core/tools/` (3,000+ lines) - Tool implementations
- `src/services/mcp/` (1,500+ lines) - MCP server integration
- `src/services/browser/` (1,000+ lines) - Browser automation
- `packages/types/` (500+ lines) - Shared types

**Partially Shared** (~15%):
- File system operations (different APIs but same logic)
- Configuration management (different storage but same structure)
- Telemetry (same events, different transports)

**Platform-Specific** (~25%):
- **VSCode**: 
  - `ClineProvider.ts` webview management (1,000+ lines)
  - `webview-ui/` React frontend (5,000+ lines)
  - VSCode-specific integrations (terminal, editor, etc.)
  
- **CLI**:
  - `ExtensionHost.ts` and `VSCode.ts` mocking layer (3,000+ lines)
  - `ui/` Ink components (2,000+ lines)
  - State management with Jotai

**Conclusion**: Approximately **70-80% of the business logic is shared** between CLI and extension.

### 5.2 How Code Sharing is Achieved

#### 5.2.1 Abstraction Layers

**File System Abstraction**:
```typescript
// Extension uses VSCode API
const content = await vscode.workspace.fs.readFile(uri)

// CLI uses Node.js fs
const content = await fs.promises.readFile(path)

// But Task.ts uses abstract interface
interface FileSystem {
    readFile(path: string): Promise<string>
    writeFile(path: string, content: string): Promise<void>
}
```

**Configuration Abstraction**:
```typescript
// Extension
const config = vscode.workspace.getConfiguration('kilocode')
const value = config.get('apiKey')

// CLI
const config = await loadConfig()
const value = config.apiKey

// Task.ts receives config object
class Task {
    constructor(private config: RooCodeSettings) {}
}
```

#### 5.2.2 Dependency Injection

```typescript
// Task doesn't know about UI
class Task extends EventEmitter {
    // Emits events instead of calling UI directly
    emit('ask', {
        type: 'command',
        question: 'Execute: npm install?',
        command: 'npm install'
    })
}

// UI layers handle events differently
// VSCode: Show in webview
clineProvider.on('ask', (ask) => {
    postMessageToWebview({ type: 'ask', ask })
})

// CLI: Show in terminal
task.on('ask', (ask) => {
    const response = await showApprovalPrompt(ask)
    task.respondToAsk(response)
})
```

#### 5.2.3 Shared Packages

The monorepo structure enables code sharing:

```typescript
// Both import from same package
import { TaskLike, ClineMessage } from '@roo-code/types'
import { TelemetryService } from '@roo-code/telemetry'
import { CloudService } from '@roo-code/cloud'

// Types ensure compatibility
const handleMessage = (message: ClineMessage) => {
    // Works identically in both environments
}
```

### 5.3 Benefits of Code Sharing

1. **Single Source of Truth**: Bug fixes in Task.ts benefit both platforms
2. **Consistent Behavior**: Agent behaves identically in CLI and VSCode
3. **Reduced Maintenance**: Don't need to maintain two separate codebases
4. **Testing**: Tests for shared code cover both platforms
5. **Feature Parity**: New features automatically available in both

### 5.4 Challenges of Code Sharing

1. **Abstraction Overhead**: Extra layer of indirection
2. **Platform Limitations**: CLI can't use all VSCode features
3. **Testing Complexity**: Must test both platforms
4. **Build Complexity**: Must bundle extension for CLI
5. **Type Compatibility**: Must maintain compatible interfaces

---

## 6. VSCode Runtime Context Handling

The CLI tool must handle numerous VSCode-specific runtime contexts that don't naturally exist in a terminal environment. This section explores how each is addressed.

### 6.1 VSCode API Namespaces

#### 6.1.1 vscode.window

**What it provides**: UI interactions (messages, input boxes, output channels)

**VSCode Extension Usage**:
```typescript
vscode.window.showInformationMessage('Task completed!')
const choice = await vscode.window.showQuickPick(['Option 1', 'Option 2'])
const input = await vscode.window.showInputBox({ prompt: 'Enter value' })
```

**CLI Handling**:
```typescript
// Mock implementation logs or shows in terminal UI
window: {
    showInformationMessage(message: string) {
        logs.info(message, 'VSCode')
        // Could also emit event for UI to show
        return Promise.resolve(undefined)
    },
    
    showQuickPick(items: string[]) {
        // In CLI, this could be handled by Ink UI
        logs.warn('QuickPick not supported in CLI', 'VSCode')
        return Promise.resolve(items[0]) // Return first item
    },
    
    createOutputChannel(name: string): OutputChannel {
        // Returns mock output channel
        return {
            append: (text) => logs.debug(text, name),
            appendLine: (text) => logs.info(text, name),
            clear: () => {},
            show: () => {},
            hide: () => {},
            dispose: () => {}
        }
    }
}
```

**Impact on Extension**:
- Information messages are logged but not shown interactively
- Quick picks auto-select first option
- Input boxes use default values
- Output channels write to log files

**Workarounds**:
- Most UI interactions are handled through the ask/approval system
- Extension code that requires UI should use Task event emitters instead

#### 6.1.2 vscode.workspace

**What it provides**: Workspace access, file system, configuration

**VSCode Extension Usage**:
```typescript
const folders = vscode.workspace.workspaceFolders
const config = vscode.workspace.getConfiguration('kilocode')
const files = await vscode.workspace.findFiles('**/*.ts')
```

**CLI Handling**:
```typescript
workspace: {
    // Provide workspace folders based on CLI --workspace argument
    workspaceFolders: [
        {
            uri: vscode.Uri.file(workspacePath),
            name: path.basename(workspacePath),
            index: 0
        }
    ],
    
    // Configuration loaded from ~/.kilocode/cli/config.json
    getConfiguration(section?: string): WorkspaceConfiguration {
        const config = loadCliConfig()
        return {
            get: (key: string, defaultValue?: any) => {
                return config[section]?.[key] ?? defaultValue
            },
            update: async (key: string, value: any) => {
                config[section] = config[section] || {}
                config[section][key] = value
                await saveCliConfig(config)
            },
            has: (key: string) => {
                return config[section]?.[key] !== undefined
            }
        }
    },
    
    // File system uses Node.js fs
    fs: {
        readFile: async (uri: vscode.Uri) => {
            const content = await fs.promises.readFile(uri.fsPath)
            return new Uint8Array(content)
        },
        writeFile: async (uri: vscode.Uri, content: Uint8Array) => {
            await fs.promises.writeFile(uri.fsPath, content)
        },
        // ... more fs methods
    }
}
```

**Impact on Extension**:
- File operations work normally (Node.js fs under the hood)
- Configuration comes from CLI config file instead of VSCode settings
- Workspace is limited to single folder

#### 6.1.3 vscode.commands

**What it provides**: Command registration and execution

**VSCode Extension Usage**:
```typescript
vscode.commands.registerCommand('kilocode.openSettings', () => {
    // Open settings UI
})

await vscode.commands.executeCommand('workbench.action.reloadWindow')
```

**CLI Handling**:
```typescript
commands: {
    registerCommand(command: string, callback: Function): Disposable {
        // Store command in registry
        commandRegistry.set(command, callback)
        
        return {
            dispose: () => commandRegistry.delete(command)
        }
    },
    
    executeCommand(command: string, ...args: any[]): Promise<any> {
        const callback = commandRegistry.get(command)
        if (callback) {
            return Promise.resolve(callback(...args))
        }
        
        // Some commands are silently ignored
        if (command === 'workbench.action.reloadWindow') {
            logs.debug('Ignoring reload command in CLI', 'VSCode')
            return Promise.resolve()
        }
        
        logs.warn(`Command not found: ${command}`, 'VSCode')
        return Promise.resolve()
    }
}
```

**Impact on Extension**:
- Most commands work as registered callbacks
- VSCode-specific commands (reload window, open settings) are no-ops
- Extension can still use commands for internal communication

#### 6.1.4 vscode.env

**What it provides**: Environment information

**VSCode Extension Usage**:
```typescript
const machineId = vscode.env.machineId
const sessionId = vscode.env.sessionId
const language = vscode.env.language
```

**CLI Handling**:
```typescript
env: {
    // Generate consistent machine ID
    machineId: identity?.machineId || generateMachineId(),
    
    // Generate session ID per CLI run
    sessionId: identity?.sessionId || crypto.randomUUID(),
    
    // Use system language
    language: process.env.LANG?.split('.')[0] || 'en',
    
    // CLI-specific user ID
    cliUserId: identity?.cliUserId,
    
    // Other properties
    appName: 'Kilo Code CLI',
    appRoot: extensionRootPath,
    uriScheme: 'kilocode',
    shell: process.env.SHELL || '/bin/bash',
    
    // Remote/UI kind
    uiKind: UIKind.Desktop,
    remoteName: undefined,
    
    // Methods
    openExternal: async (uri: vscode.Uri) => {
        // Open URLs in default browser
        await openUrl(uri.toString())
        return true
    },
    
    asExternalUri: (uri: vscode.Uri) => Promise.resolve(uri),
    
    clipboard: {
        readText: async () => {
            logs.warn('Clipboard read not supported in CLI', 'VSCode')
            return ''
        },
        writeText: async (text: string) => {
            logs.warn('Clipboard write not supported in CLI', 'VSCode')
        }
    }
}
```

**Identity Generation**:
```typescript
// CLI generates consistent identity
function generateMachineId(): string {
    // Use hostname + username for consistency
    const hostname = os.hostname()
    const username = os.userInfo().username
    return crypto.createHash('sha256')
        .update(`${hostname}-${username}`)
        .digest('hex')
}
```

### 6.2 ExtensionContext

**What it provides**: Extension state, storage, secrets

**VSCode Extension Usage**:
```typescript
export function activate(context: vscode.ExtensionContext) {
    const state = context.globalState.get('key')
    context.globalState.update('key', value)
    
    const secret = await context.secrets.get('apiKey')
    
    context.subscriptions.push(disposable)
}
```

**CLI Handling**:
```typescript
// Create mock context
const context: vscode.ExtensionContext = {
    subscriptions: [], // Disposables registered by extension
    
    // Global state uses JSON file
    globalState: {
        keys: () => loadGlobalState().keys(),
        get: (key: string, defaultValue?: any) => {
            const state = loadGlobalState()
            return state[key] ?? defaultValue
        },
        update: async (key: string, value: any) => {
            const state = loadGlobalState()
            state[key] = value
            await saveGlobalState(state)
        }
    },
    
    // Workspace state (similar to global state)
    workspaceState: { /* similar implementation */ },
    
    // Secrets use secure storage
    secrets: {
        get: async (key: string) => {
            return await getSecret(key)
        },
        store: async (key: string, value: string) => {
            await storeSecret(key, value)
        },
        delete: async (key: string) => {
            await deleteSecret(key)
        },
        onDidChange: new EventEmitter<any>().event
    },
    
    // Paths
    extensionUri: vscode.Uri.file(extensionRootPath),
    extensionPath: extensionRootPath,
    globalStorageUri: vscode.Uri.file(globalStoragePath),
    storageUri: vscode.Uri.file(workspaceStoragePath),
    logUri: vscode.Uri.file(logPath),
    
    // Extension mode
    extensionMode: vscode.ExtensionMode.Production,
    
    // Other properties
    extension: /* extension manifest */,
    environmentVariableCollection: /* ... */
}
```

**Storage Locations**:
```
~/.kilocode/cli/
├── config.json           # User configuration
├── state/
│   ├── global.json      # Global state
│   └── workspace-{id}.json  # Workspace state
├── secrets/
│   └── secrets.json     # Encrypted secrets
└── logs/
    └── cli.txt          # Log file
```

### 6.3 Text Editor and Documents

**What it provides**: Editor access, document manipulation

**Limitation**: CLI cannot provide real text editors

**VSCode Extension Usage**:
```typescript
const editor = vscode.window.activeTextEditor
await editor.edit(editBuilder => {
    editBuilder.replace(range, newText)
})

const document = await vscode.workspace.openTextDocument(uri)
const text = document.getText()
```

**CLI Handling**:
```typescript
// Mock text editor (non-functional)
window: {
    activeTextEditor: undefined, // No active editor in CLI
    
    showTextDocument: async (document: vscode.TextDocument) => {
        logs.debug(`Would open document: ${document.uri.fsPath}`, 'VSCode')
        // Return mock editor
        return {
            document,
            selection: new vscode.Selection(0, 0, 0, 0),
            edit: async () => false, // Edits don't work
            // ... other properties
        }
    }
}

workspace: {
    openTextDocument: async (uri: vscode.Uri | string) => {
        const fsPath = typeof uri === 'string' ? uri : uri.fsPath
        const content = await fs.promises.readFile(fsPath, 'utf-8')
        
        // Return mock document
        return {
            uri: typeof uri === 'string' ? vscode.Uri.file(uri) : uri,
            fileName: fsPath,
            isUntitled: false,
            languageId: detectLanguage(fsPath),
            version: 1,
            isDirty: false,
            isClosed: false,
            save: async () => true,
            getText: () => content,
            // ... other properties
        }
    }
}
```

**Impact on Extension**:
- Extension cannot interact with text editors
- File operations use file system API instead
- Diff view features are disabled
- Code navigation features don't work

**Mitigation**:
- Kilo Code primarily uses file system operations, not editor API
- `replace_in_file` tool uses string manipulation instead of editor edits
- Users must manually open files in their editor

### 6.4 Terminal Integration

**What it provides**: Integrated terminal access

**VSCode Extension Usage**:
```typescript
const terminal = vscode.window.createTerminal('Task')
terminal.sendText('npm install')
terminal.show()
```

**CLI Handling**:
```typescript
// CLI creates real terminals using child_process
window: {
    createTerminal(options: TerminalOptions): Terminal {
        // Spawn actual process
        const process = spawn(options.shellPath || 'bash', {
            cwd: options.cwd,
            env: { ...process.env, ...options.env }
        })
        
        return {
            name: options.name,
            processId: Promise.resolve(process.pid),
            sendText: (text: string) => {
                process.stdin.write(text + '\n')
            },
            show: () => {
                // In CLI, output is captured and shown in UI
            },
            dispose: () => {
                process.kill()
            },
            // ... other properties
        }
    }
}
```

**Impact on Extension**:
- Terminal operations work normally in CLI
- Output is captured and displayed in CLI UI
- Interactive terminals are supported

### 6.5 Webview Provider

**What it provides**: Custom webview panels

**Critical for Extension**: ClineProvider implements WebviewViewProvider

**VSCode Extension Usage**:
```typescript
export class ClineProvider implements vscode.WebviewViewProvider {
    resolveWebviewView(webviewView: vscode.WebviewView) {
        webviewView.webview.html = getHtml()
        webviewView.webview.onDidReceiveMessage(handleMessage)
    }
    
    postMessageToWebview(message: ExtensionMessage) {
        this.view?.webview.postMessage(message)
    }
}

// Register with VSCode
vscode.window.registerWebviewViewProvider(
    ClineProvider.sideBarId,
    provider
)
```

**CLI Handling**:
```typescript
// ExtensionHost intercepts provider registration
window: {
    registerWebviewViewProvider(
        viewId: string,
        provider: vscode.WebviewViewProvider
    ): vscode.Disposable {
        // Store provider for later access
        webviewProviders.set(viewId, provider)
        
        // Simulate webview view
        const mockWebview: vscode.Webview = {
            html: '',
            options: {},
            onDidReceiveMessage: new EventEmitter<any>().event,
            postMessage: async (message: any) => {
                // Forward to CLI UI via ExtensionHost event
                extensionHost.emit('message', message)
                return true
            },
            asWebviewUri: (uri: vscode.Uri) => uri,
            cspSource: 'none'
        }
        
        const mockWebviewView: vscode.WebviewView = {
            webview: mockWebview,
            viewType: viewId,
            visible: true,
            onDidDispose: new EventEmitter<void>().event,
            onDidChangeVisibility: new EventEmitter<void>().event,
            show: () => {},
            badge: undefined
        }
        
        // Call provider's resolveWebviewView
        provider.resolveWebviewView(mockWebviewView)
        
        return { dispose: () => webviewProviders.delete(viewId) }
    }
}

// Simulate webview launch
async handleWebviewLaunch() {
    const provider = webviewProviders.get('kilo-code.SidebarProvider')
    if (provider) {
        // Simulate webviewDidLaunch message
        await provider.handleCLIMessage({ type: 'webviewDidLaunch' })
    }
}
```

**Impact on Extension**:
- ClineProvider initializes normally
- No actual webview HTML is rendered
- Messages flow through ExtensionHost events instead of webview
- Extension behavior is identical

### 6.6 Features Not Supported in CLI

Some VSCode features cannot be reasonably mocked:

1. **Text Editor UI**:
   - Syntax highlighting
   - Code folding
   - IntelliSense
   - Inline hints
   - Decorations

2. **UI Elements**:
   - Webview panels (only webview views are mocked)
   - Custom tree views
   - Status bar items (limited)
   - Notifications (logged instead)

3. **Extension API**:
   - Language providers (hover, completion, etc.)
   - Code actions
   - Debugger API
   - Source control API

4. **Workspace Features**:
   - Multi-root workspaces
   - Workspace trust
   - Extension host types

**Mitigation Strategies**:
1. Kilo Code's core functionality doesn't rely on these features
2. Features are degraded gracefully (logged or skipped)
3. Users know CLI has limited capabilities compared to VSCode

### 6.7 Environment Variables

The CLI sets specific environment variables to signal CLI mode:

```typescript
process.env.KILO_CLI_MODE = 'true'
process.env.NODE_ENV = process.env.NODE_ENV || 'production'
```

**Extension Code Checks**:
```typescript
// In extension code
if (process.env.KILO_CLI_MODE === 'true') {
    // Skip VSCode-specific features
    return
}

// Or use utilities
import { isCliMode } from './utils/environment'

if (!isCliMode()) {
    // Only do this in VSCode
    vscode.window.showInformationMessage('Welcome!')
}
```

---

## 7. Build and Deployment Pipeline

### 7.1 VSCode Extension Build

```bash
# Build webview UI (React)
cd webview-ui
pnpm build
# Output: webview-ui/build/

# Build extension (TypeScript + esbuild)
cd ..
pnpm bundle
# Output: bin-unpacked/extension/dist/extension.js

# Create VSIX package
pnpm vsix
# Output: bin/kilo-code-{version}.vsix
```

**Extension Bundle Contents**:
```
bin-unpacked/extension/
├── dist/
│   ├── extension.js          # Main extension bundle
│   └── extension.js.map      # Source map
├── webview-ui/
│   └── build/                # React UI assets
│       ├── index.html
│       ├── static/
│       │   ├── js/
│       │   └── css/
│       └── assets/
├── assets/                   # Extension assets
│   ├── icons/
│   └── images/
├── package.json              # Extension manifest
└── README.md
```

### 7.2 CLI Build

```bash
# Build CLI (esbuild)
cd cli
pnpm build

# Build process:
# 1. Bundle CLI source to dist/index.js
# 2. Copy extension bundle to dist/kilocode/
# 3. Copy schemas and configs
# 4. Make dist/index.js executable
# 5. Install production dependencies

# Output: cli/dist/
```

**CLI Build Script** (`cli/esbuild.config.mjs`):
```javascript
const config = {
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    outfile: 'dist/index.js',
    external: [
        // Large dependencies kept external
        '@anthropic-ai/sdk',
        'puppeteer-core',
        'ink',
        'react',
        // ... 50+ more
    ],
    plugins: [
        {
            name: 'after-build',
            setup(build) {
                build.onEnd(() => {
                    // Copy extension bundle
                    copySync(
                        '../bin-unpacked/extension/',
                        'dist/kilocode/'
                    )
                    
                    // Copy configs
                    copyFileSync('src/config/schema.json', 'dist/config/schema.json')
                    
                    // Make executable
                    chmodSync('dist/index.js', 0o755)
                    
                    // Install deps
                    execSync('npm install --omit=dev --prefix ./dist')
                })
            }
        }
    ]
}
```

**CLI Package Structure**:
```
cli/dist/
├── index.js                  # CLI entry point (bundled)
├── package.json              # Production package.json
├── npm-shrinkwrap.json       # Locked dependencies
├── node_modules/             # Production dependencies
├── config/
│   └── schema.json           # Config schema
├── kilocode/                 # Extension bundle
│   ├── dist/
│   │   └── extension.js
│   ├── assets/
│   └── package.json
└── README.md
```

### 7.3 Dependency Management

**External Dependencies Strategy**:
- Large dependencies (AI SDKs, React, Ink) are external
- Installed via npm after build
- Reduces bundle size (from ~50MB to ~5MB bundle)
- Faster build times

**Workspace Dependencies**:
- `@roo-code/types`: Shared types, bundled into both
- `@roo-code/cloud`: Cloud integration, bundled
- `@roo-code/telemetry`: Analytics, bundled

### 7.4 Publishing

**VSCode Extension**:
```bash
# Publish to VS Code Marketplace
pnpm vsix:production
vsce publish

# Publish to Open VSX
ovsx publish bin/kilo-code-{version}.vsix
```

**CLI Tool**:
```bash
# Build CLI
cd cli
pnpm build

# Publish to npm
cd dist
npm publish

# Users install globally
npm install -g @kilocode/cli
```

**Version Management**:
- Uses Changesets for version bumping
- Both packages version together
- Changelog generated automatically

---

## 8. Key Architectural Patterns

### 8.1 Event-Driven Architecture

Both CLI and extension use EventEmitters extensively:

```typescript
// Task emits events instead of calling UI
class Task extends EventEmitter {
    async ask(question: ClineAsk): Promise<ClineAskResponse> {
        return new Promise((resolve) => {
            this.emit('ask', { question, resolve })
        })
    }
}

// Different handlers in different environments
// VSCode
clineProvider.on('ask', ({ question, resolve }) => {
    showInWebview(question)
    // Resolve when user responds via webview
})

// CLI
task.on('ask', ({ question, resolve }) => {
    const response = await showInTerminalPrompt(question)
    resolve(response)
})
```

**Benefits**:
- Loose coupling between Task and UI
- Same Task class works in both environments
- Easy to test (mock event handlers)

### 8.2 Dependency Injection

Configuration and dependencies are injected, not imported:

```typescript
// Constructor injection
class Task {
    constructor(
        private apiHandler: ApiHandler,
        private config: RooCodeSettings,
        private fileSystem: FileSystemAbstraction,
        private terminal: TerminalAbstraction
    ) {}
}

// Different implementations for different environments
// VSCode
const task = new Task(
    apiHandler,
    config,
    new VSCodeFileSystem(vscode.workspace.fs),
    new VSCodeTerminal(vscode.window.createTerminal)
)

// CLI
const task = new Task(
    apiHandler,
    config,
    new NodeFileSystem(fs.promises),
    new NodeTerminal(spawn)
)
```

### 8.3 Factory Pattern

Services are created through factory functions:

```typescript
// createExtensionService factory
export function createExtensionService(
    options: ExtensionServiceOptions
): ExtensionService {
    return new ExtensionService(options)
}

// createExtensionHost factory
export function createExtensionHost(
    options: ExtensionHostOptions
): ExtensionHost {
    return new ExtensionHost(options)
}

// buildApiHandler factory
export function buildApiHandler(config: ApiConfiguration): ApiHandler {
    const provider = getProvider(config.provider)
    return new provider.Handler(config)
}
```

**Benefits**:
- Centralized creation logic
- Easy to add test mocks
- Consistent initialization

### 8.4 Strategy Pattern

Different implementations for different providers:

```typescript
// API Handler interface
interface ApiHandler {
    createMessage(params: CreateMessageParams): Promise<ApiStream>
}

// Different implementations
class AnthropicHandler implements ApiHandler {
    async createMessage(params) {
        // Anthropic-specific implementation
    }
}

class OpenAIHandler implements ApiHandler {
    async createMessage(params) {
        // OpenAI-specific implementation
    }
}

// Factory selects implementation
function buildApiHandler(config): ApiHandler {
    switch (config.provider) {
        case 'anthropic': return new AnthropicHandler(config)
        case 'openai': return new OpenAIHandler(config)
        // ... more providers
    }
}
```

### 8.5 Observer Pattern

State changes are observed and reacted to:

```typescript
// Jotai atoms in CLI
const extensionStateAtom = atom<ExtensionState | null>(null)

// Components observe state
function ChatView() {
    const state = useAtomValue(extensionStateAtom)
    
    // Re-render when state changes
    return <div>{state?.taskHistory.length} tasks</div>
}

// Service updates state
extensionService.on('stateChange', (newState) => {
    store.set(extensionStateAtom, newState)
})
```

### 8.6 Adapter Pattern

VSCode API mock is an adapter:

```typescript
// VSCode API interface (real)
interface VSCodeAPI {
    window: WindowNamespace
    workspace: WorkspaceNamespace
    commands: CommandsNamespace
    // ...
}

// CLI adapter
function createVSCodeAPIMock(...): VSCodeAPI {
    return {
        window: createWindowAdapter(...),
        workspace: createWorkspaceAdapter(...),
        commands: createCommandsAdapter(...),
        // ...
    }
}

// Adapters translate VSCode API to Node.js API
function createWorkspaceAdapter(workspacePath: string) {
    return {
        workspaceFolders: [createWorkspaceFolder(workspacePath)],
        getConfiguration: () => loadCliConfig(),
        fs: {
            readFile: (uri) => fs.promises.readFile(uri.fsPath),
            // ...
        }
    }
}
```

---

## Conclusion

The Kilo Code architecture demonstrates a sophisticated approach to building a multi-platform AI coding agent:

1. **Monorepo Organization**: Clear separation of concerns with shared packages
2. **Code Reuse**: 70-80% code sharing through abstraction and mocking
3. **Platform Abstraction**: Comprehensive VSCode API mock enables CLI to run extension code
4. **Event-Driven Design**: Loose coupling between components
5. **Consistent Behavior**: Identical agent behavior across VSCode and CLI

**Key Success Factors**:
- Task.ts is platform-agnostic and contains all core logic
- VSCode-specific code is isolated in integration layers
- CLI's ExtensionHost pattern cleverly reuses existing extension code
- Shared packages ensure type safety and consistency

**Future Considerations**:
- Web version could use similar approach with browser API mocks
- JetBrains plugin could share core Task logic
- Mobile app could reuse agent execution engine

The architecture is well-designed for extensibility and maintainability, making it easy to add new features that automatically work across all platforms.

# Basic CLI Example

A simple command-line application demonstrating the Agent Framework.

## Setup

1. Install dependencies (from agent-framework root):
   ```bash
   pnpm install
   ```

2. Build the framework packages:
   ```bash
   pnpm build
   ```

3. Create a `.env` file in this directory:
   ```bash
   ANTHROPIC_API_KEY=your-api-key-here
   ```

## Usage

Run with default prompt:
```bash
pnpm start
```

Run with custom prompt:
```bash
pnpm start "Create a file called hello.txt with the text 'Hello, World!'"
```

## What it does

This example:
- Initializes an agent with Anthropic (Claude) provider
- Uses Node.js runtime adapter for file system and commands
- Includes all core tools (read, write, execute, list, completion)
- Tracks progress and displays tool usage in real-time
- Auto-approves all operations (for demo purposes)
- Shows token usage statistics

## Example Output

```
🚀 Agent Framework - Basic CLI Example

✓ Agent initialized
✓ Provider: anthropic
✓ Model: claude-3-5-sonnet-20241022
✓ Workspace: /path/to/workspace

📝 Task: List all TypeScript files in the current directory

────────────────────────────────────────────────────────────

I'll help you list all TypeScript files in the current directory.

🔧 Using tool: list_files
   Input: {
     "path": "."
   }
   ✓ Result: index.ts
tsup.config.ts

🔧 Using tool: attempt_completion
   Input: {
     "result": "Found 2 TypeScript files:\n- index.ts\n- tsup.config.ts"
   }

⏳ Waiting for task to complete...

────────────────────────────────────────────────────────────
✅ Task completed successfully!

Result:
Found 2 TypeScript files:
- index.ts
- tsup.config.ts

📊 Token Usage:
   Input: 1250
   Output: 150
```

## Features Demonstrated

- ✅ Provider initialization (Anthropic)
- ✅ Runtime adapter (Node.js)
- ✅ Tool usage (list_files, attempt_completion)
- ✅ Event-driven progress tracking
- ✅ Token usage reporting
- ✅ Error handling

# Code Analyzer Example

A real-world example showing how to use Agent Framework to analyze codebases.

## Features

- 🔍 Analyzes code structure and organization
- 🎯 Identifies potential issues and bugs
- 📊 Provides actionable recommendations
- 🔄 Works with both cloud (Anthropic) and local (Ollama) models
- 📝 Generates comprehensive analysis reports

## Setup

1. Build the framework packages:
   ```bash
   cd ../..
   pnpm install
   pnpm build
   ```

2. Configure API keys:
   ```bash
   cd examples/code-analyzer
   cp .env.example .env
   # Edit .env and add ANTHROPIC_API_KEY (or use --ollama for local)
   ```

## Usage

### With Anthropic (Claude)

```bash
# Analyze current directory
node dist/index.js

# Analyze specific directory
node dist/index.js src/

# Analyze another project
node dist/index.js ../my-project
```

### With Ollama (Local Model)

```bash
# First, ensure Ollama is running with codellama model
ollama pull codellama
ollama serve

# Then run analyzer
node dist/index.js --ollama

# Analyze specific directory
node dist/index.js src/ --ollama
```

## What It Does

The code analyzer:

1. **Explores the codebase structure**
   - Uses `search_files` to find source files
   - Uses `list_files` to understand organization

2. **Analyzes code patterns**
   - Uses `read_file` to examine code
   - Identifies technology stack
   - Finds common patterns

3. **Provides recommendations**
   - Code quality issues
   - Security concerns
   - Performance improvements
   - Best practice violations

## Example Output

```
🔍 Code Analyzer - Powered by Agent Framework

✓ Using Anthropic (Claude)
✓ Model: claude-3-5-sonnet-20241022

📂 Analyzing: src/

────────────────────────────────────────────────────────────

🔧 search_files
   🔎 *.ts
   ✓ Found 15 file(s):
src/index.ts
src/types.ts
...

🔧 read_file
   📁 src/index.ts
   ✓ import { Agent } from '@agent-framework/core'...

⏳ Analyzing codebase...

# Analysis Report

## Technology Stack
- TypeScript
- Node.js
- Agent Framework

## Code Structure
The project follows a modular structure...

## Findings
1. **Good**: Clear separation of concerns
2. **Issue**: Missing error handling in async functions
3. **Recommendation**: Add try-catch blocks...

────────────────────────────────────────────────────────────

✅ Analysis Complete!

📊 Token Usage:
   Input: 3250
   Output: 1850
   Estimated Cost: $0.0374

────────────────────────────────────────────────────────────
```

## Demonstrates

This example shows:

- ✅ Real-world use case (code analysis)
- ✅ Using multiple tools (search, read, list)
- ✅ Custom system prompts
- ✅ Progress tracking
- ✅ Supporting both cloud and local models
- ✅ Token usage tracking
- ✅ Error handling
- ✅ Professional output formatting

## Extending

You can modify this example to:

- Generate specific reports (security, performance, etc.)
- Integrate with CI/CD pipelines
- Save reports to files
- Compare multiple codebases
- Track improvements over time

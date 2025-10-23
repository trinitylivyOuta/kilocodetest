# Layer 0: Direct LLM Client Example

This example demonstrates the lowest level of the framework - direct LLM access without any agent complexity.

## What is Layer 0?

Layer 0 provides direct access to LLM providers with a simple, unified interface. No tools, no agentic loop, just pure LLM completions.

**Use Layer 0 when you need**:
- Simple LLM completions
- Custom streaming logic
- Direct control over API calls
- Integration with existing LLM code
- Minimal framework overhead

## Features Demonstrated

1. **Simple Completion** - Get complete response at once
2. **Streaming with Callbacks** - Process chunks as they arrive
3. **Async Generator Streaming** - Most flexible streaming option
4. **Batch Processing** - Multiple completions in parallel

## Usage

```bash
# Build
pnpm build

# Run with Anthropic
ANTHROPIC_API_KEY=your-key node dist/index.js

# Run with Ollama (local, free)
node dist/index.js --ollama
```

## Code Example

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
  messages: [{ role: 'user', content: 'Hello!' }]
})
console.log(result.content)

// Streaming
for await (const chunk of client.streamGenerator({
  messages: [{ role: 'user', content: 'Tell me a story' }]
})) {
  process.stdout.write(chunk)
}
```

## When to Use

✅ **Use Layer 0 when:**
- You just need LLM completions
- You don't need tools or agents
- You want minimal overhead
- You're integrating with existing code

❌ **Don't use Layer 0 when:**
- You need tool calling
- You need agentic behavior
- You need task management
- You want automatic iteration

For those cases, see Layer 1 (LLM App) or higher layers.

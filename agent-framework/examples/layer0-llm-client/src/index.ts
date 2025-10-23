/**
 * Layer 0 Example: Direct LLM Client
 * 
 * Demonstrates low-level LLM access without any framework complexity
 * Use this when you just need simple LLM completions
 */

import 'dotenv/config'
import { LLMClient } from '@agent-framework/llm-client'
import { AnthropicProvider, OllamaProvider } from '@agent-framework/api'

async function main() {
  console.log('🔧 Layer 0: Direct LLM Client Example\n')
  
  // Choose provider
  const useOllama = !process.env.ANTHROPIC_API_KEY || process.argv.includes('--ollama')
  
  const provider = useOllama
    ? new OllamaProvider({
        provider: 'ollama',
        model: 'llama2',
        baseURL: process.env.OLLAMA_URL || 'http://localhost:11434'
      })
    : new AnthropicProvider({
        provider: 'anthropic',
        apiKey: process.env.ANTHROPIC_API_KEY!,
        model: 'claude-3-5-sonnet-20241022'
      })
  
  console.log(`Provider: ${provider.getProvider()}`)
  console.log(`Model: ${provider.getModel().id}\n`)
  
  // Create LLM client
  const client = new LLMClient(provider)
  
  // Example 1: Simple completion
  console.log('Example 1: Simple Completion')
  console.log('─'.repeat(50))
  
  const result1 = await client.complete({
    messages: [
      { role: 'user', content: 'Explain TypeScript in one sentence.' }
    ],
    maxTokens: 100
  })
  
  console.log('Response:', result1.content)
  console.log('Tokens:', result1.usage)
  console.log()
  
  // Example 2: Streaming with callback
  console.log('Example 2: Streaming with Callback')
  console.log('─'.repeat(50))
  
  await client.stream({
    messages: [
      { role: 'user', content: 'Count from 1 to 5 slowly.' }
    ],
    maxTokens: 200,
    onChunk: (content) => {
      process.stdout.write(content)
    }
  })
  console.log('\n')
  
  // Example 3: Streaming as async generator
  console.log('Example 3: Streaming as Async Generator')
  console.log('─'.repeat(50))
  
  for await (const chunk of client.streamGenerator({
    messages: [
      { role: 'user', content: 'What are the benefits of async/await?' }
    ],
    maxTokens: 150
  })) {
    process.stdout.write(chunk)
  }
  console.log('\n')
  
  // Example 4: Batch processing
  console.log('Example 4: Batch Processing')
  console.log('─'.repeat(50))
  
  const questions = [
    'What is Node.js?',
    'What is TypeScript?',
    'What is async/await?'
  ]
  
  const results = await client.batch(
    questions.map(q => ({
      messages: [{ role: 'user', content: q }],
      maxTokens: 50
    }))
  )
  
  results.forEach((result, i) => {
    console.log(`Q: ${questions[i]}`)
    console.log(`A: ${result.content}`)
    console.log()
  })
  
  console.log('─'.repeat(50))
  console.log('✅ Layer 0 examples complete!')
  console.log('\nKey benefits of Layer 0:')
  console.log('  - Direct LLM access')
  console.log('  - No agent framework overhead')
  console.log('  - Full control over requests')
  console.log('  - Perfect for simple use cases')
}

main().catch(error => {
  console.error('Error:', error)
  process.exit(1)
})

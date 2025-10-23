/**
 * Simple test to verify the framework builds and basic APIs work
 */

import { Agent } from '@agent-framework/core'
import { AnthropicProvider } from '@agent-framework/api'
import { NodeAdapter } from '@agent-framework/runtime'
import { CoreTools } from '@agent-framework/tools'

console.log('✓ All imports successful')

// Test 1: Provider creation
try {
  const provider = new AnthropicProvider({
    provider: 'anthropic',
    apiKey: 'test-key',
    model: 'claude-3-5-sonnet-20241022'
  })
  console.log('✓ AnthropicProvider created')
  console.log('  Model:', provider.getModel().id)
  console.log('  Provider:', provider.getProvider())
} catch (error) {
  console.error('✗ Provider creation failed:', error)
  process.exit(1)
}

// Test 2: Adapter creation
try {
  const adapter = new NodeAdapter({
    workspaceDir: process.cwd()
  })
  console.log('✓ NodeAdapter created')
  console.log('  Workspace:', adapter.workspaceDir)
} catch (error) {
  console.error('✗ Adapter creation failed:', error)
  process.exit(1)
}

// Test 3: Tools loaded
try {
  console.log('✓ CoreTools loaded')
  console.log('  Number of tools:', CoreTools.length)
  CoreTools.forEach(tool => {
    console.log(`  - ${tool.definition.name}`)
  })
} catch (error) {
  console.error('✗ Tools loading failed:', error)
  process.exit(1)
}

// Test 4: Agent creation (without API key - just constructor)
try {
  const mockProvider = new AnthropicProvider({
    provider: 'anthropic',
    apiKey: 'sk-test-key-for-construction-only',
    model: 'claude-3-5-sonnet-20241022'
  })
  
  const mockAdapter = new NodeAdapter({
    workspaceDir: process.cwd()
  })
  
  const agent = new Agent({
    apiHandler: mockProvider,
    adapter: mockAdapter,
    tools: CoreTools
  })
  
  console.log('✓ Agent created successfully')
  console.log('  Provider:', agent.getProvider())
  console.log('  Model:', agent.getModelInfo().id)
} catch (error) {
  console.error('✗ Agent creation failed:', error)
  process.exit(1)
}

console.log('\n✅ All framework tests passed!')
console.log('\nFramework is working correctly and ready to use.')
console.log('To test with real API calls, set ANTHROPIC_API_KEY or OPENAI_API_KEY')
console.log('and run the example in examples/basic-cli/')

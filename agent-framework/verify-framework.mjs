#!/usr/bin/env node
/**
 * Framework Verification Test
 * Tests that all packages build correctly and APIs are accessible
 */

// Test that we can import from all packages
console.log('Testing framework imports...\n')

let exitCode = 0

// Test @agent-framework/types
try {
  const types = await import('./packages/types/dist/index.js')
  console.log('✓ @agent-framework/types - PASS')
} catch (error) {
  console.error('✗ @agent-framework/types - FAIL:', error.message)
  exitCode = 1
}

// Test @agent-framework/api
try {
  const api = await import('./packages/api/dist/index.js')
  console.log('✓ @agent-framework/api - PASS')
  
  // Test that we can create a provider
  const { AnthropicProvider } = api
  const provider = new AnthropicProvider({
    provider: 'anthropic',
    apiKey: 'test-key',
    model: 'claude-3-5-sonnet-20241022'
  })
  console.log('  - AnthropicProvider instantiation: OK')
  console.log('  - Model:', provider.getModel().id)
} catch (error) {
  console.error('✗ @agent-framework/api - FAIL:', error.message)
  exitCode = 1
}

// Test @agent-framework/tools
try {
  const tools = await import('./packages/tools/dist/index.js')
  console.log('✓ @agent-framework/tools - PASS')
  console.log('  - CoreTools count:', tools.CoreTools.length)
  console.log('  - Available tools:', tools.CoreTools.map(t => t.definition.name).join(', '))
} catch (error) {
  console.error('✗ @agent-framework/tools - FAIL:', error.message)
  exitCode = 1
}

// Test @agent-framework/runtime
try {
  const runtime = await import('./packages/runtime/dist/index.js')
  console.log('✓ @agent-framework/runtime - PASS')
  
  const { NodeAdapter } = runtime
  const adapter = new NodeAdapter({ workspaceDir: process.cwd() })
  console.log('  - NodeAdapter instantiation: OK')
  console.log('  - Workspace:', adapter.workspaceDir)
} catch (error) {
  console.error('✗ @agent-framework/runtime - FAIL:', error.message)
  exitCode = 1
}

// Test @agent-framework/core
try {
  const core = await import('./packages/core/dist/index.js')
  const api = await import('./packages/api/dist/index.js')
  const runtime = await import('./packages/runtime/dist/index.js')
  const tools = await import('./packages/tools/dist/index.js')
  
  console.log('✓ @agent-framework/core - PASS')
  
  // Test Agent creation
  const { Agent } = core
  const { AnthropicProvider } = api
  const { NodeAdapter } = runtime
  const { CoreTools } = tools
  
  const agent = new Agent({
    apiHandler: new AnthropicProvider({
      provider: 'anthropic',
      apiKey: 'test-key',
      model: 'claude-3-5-sonnet-20241022'
    }),
    adapter: new NodeAdapter({ workspaceDir: process.cwd() }),
    tools: CoreTools
  })
  
  console.log('  - Agent instantiation: OK')
  console.log('  - Provider:', agent.getProvider())
  console.log('  - Model:', agent.getModelInfo().id)
} catch (error) {
  console.error('✗ @agent-framework/core - FAIL:', error.message)
  exitCode = 1
}

// Test example app
try {
  const fs = await import('fs')
  const path = await import('path')
  const examplePath = './examples/basic-cli/dist/index.js'
  
  if (fs.existsSync(examplePath)) {
    const stats = fs.statSync(examplePath)
    console.log('✓ examples/basic-cli - PASS (built successfully)')
    console.log('  - Built file size:', Math.round(stats.size / 1024) + 'KB')
  } else {
    throw new Error('Built file not found')
  }
} catch (error) {
  console.error('✗ examples/basic-cli - FAIL:', error.message)
  exitCode = 1
}

console.log('\n' + '='.repeat(50))
if (exitCode === 0) {
  console.log('✅ All framework tests PASSED')
  console.log('\nThe framework is working correctly!')
  console.log('\nNext steps:')
  console.log('  1. Set ANTHROPIC_API_KEY or OPENAI_API_KEY')
  console.log('  2. Run: cd examples/basic-cli && node dist/index.js')
} else {
  console.log('❌ Some tests FAILED')
  console.log('\nPlease check the errors above.')
}
console.log('='.repeat(50))

process.exit(exitCode)

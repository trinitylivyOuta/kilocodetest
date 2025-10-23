/**
 * Basic CLI Example
 * Demonstrates using the Agent Framework in a simple CLI application
 */

import 'dotenv/config'
import { Agent } from '@agent-framework/core'
import { AnthropicProvider } from '@agent-framework/api'
import { NodeAdapter } from '@agent-framework/runtime'
import { CoreTools } from '@agent-framework/tools'

async function main() {
  console.log('🚀 Agent Framework - Basic CLI Example\n')
  
  // Check for API key
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('❌ Error: ANTHROPIC_API_KEY environment variable is required')
    console.log('\nPlease set it in a .env file or export it:')
    console.log('  export ANTHROPIC_API_KEY=your-api-key-here')
    process.exit(1)
  }
  
  // Create API provider
  const apiHandler = new AnthropicProvider({
    provider: 'anthropic',
    apiKey,
    model: 'claude-3-5-sonnet-20241022'
  })
  
  // Create runtime adapter
  const adapter = new NodeAdapter({
    workspaceDir: process.cwd(),
    getApproval: async (action: string, details: any) => {
      // For demo, auto-approve everything
      console.log(`\n✓ Auto-approved: ${action}`)
      return true
    }
  })
  
  // Create agent
  const agent = new Agent({
    apiHandler,
    adapter,
    tools: CoreTools,
    systemPrompt: `You are a helpful AI assistant that can read and write files, execute commands, and list directories.

When completing a task, always use the attempt_completion tool to present your result.`
  })
  
  console.log('✓ Agent initialized')
  console.log(`✓ Provider: ${agent.getProvider()}`)
  console.log(`✓ Model: ${agent.getModelInfo().id}`)
  console.log(`✓ Workspace: ${adapter.workspaceDir}\n`)
  
  // Get prompt from command line or use default
  const prompt = process.argv.slice(2).join(' ') || 
    'List all TypeScript files in the current directory and create a summary file called FILES.txt with their names.'
  
  console.log(`📝 Task: ${prompt}\n`)
  console.log('─'.repeat(60))
  
  // Execute task with progress tracking
  const task = await agent.executeTask({
    prompt,
    onProgress: (event) => {
      switch (event.type) {
        case 'progress':
          process.stdout.write(event.data.content)
          break
          
        case 'tool_use':
          console.log(`\n🔧 Using tool: ${event.data.toolUse.name}`)
          console.log(`   Input: ${JSON.stringify(event.data.toolUse.input, null, 2)}`)
          break
          
        case 'tool_result':
          const result = event.data.result
          console.log(`   ${result.is_error ? '❌' : '✓'} Result:`, 
            result.content.substring(0, 200) + (result.content.length > 200 ? '...' : ''))
          break
          
        case 'error':
          console.error(`\n❌ Error: ${event.data.error}`)
          break
      }
    }
  })
  
  // Wait for completion
  console.log('\n\n⏳ Waiting for task to complete...')
  const result = await task.waitForCompletion()
  
  console.log('\n' + '─'.repeat(60))
  
  if (result.success) {
    console.log('✅ Task completed successfully!\n')
    if (result.message) {
      console.log('Result:')
      console.log(result.message)
    }
  } else {
    console.log('❌ Task failed!\n')
    if (result.error) {
      console.error('Error:', result.error)
    }
  }
  
  // Show token usage
  const usage = task.getUsage()
  console.log('\n📊 Token Usage:')
  console.log(`   Input: ${usage.inputTokens}`)
  console.log(`   Output: ${usage.outputTokens}`)
  if (usage.cacheReadTokens) {
    console.log(`   Cache Reads: ${usage.cacheReadTokens}`)
  }
  if (usage.cacheWriteTokens) {
    console.log(`   Cache Writes: ${usage.cacheWriteTokens}`)
  }
}

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})

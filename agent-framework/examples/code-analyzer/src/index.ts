/**
 * Code Analyzer Example
 * Real-world usage of Agent Framework to analyze and improve code
 */

import 'dotenv/config'
import { Agent } from '@agent-framework/core'
import { AnthropicProvider, OllamaProvider } from '@agent-framework/api'
import { NodeAdapter } from '@agent-framework/runtime'
import { CoreTools } from '@agent-framework/tools'

async function main() {
  console.log('🔍 Code Analyzer - Powered by Agent Framework\n')
  
  // Check for API key or use Ollama
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const useOllama = !anthropicKey || process.argv.includes('--ollama')
  
  // Create appropriate provider
  const apiHandler = useOllama
    ? new OllamaProvider({
        provider: 'ollama',
        model: 'codellama',  // Or 'llama2' if codellama not available
        baseURL: process.env.OLLAMA_URL || 'http://localhost:11434'
      })
    : new AnthropicProvider({
        provider: 'anthropic',
        apiKey: anthropicKey!,
        model: 'claude-3-5-sonnet-20241022'
      })
  
  console.log(`✓ Using ${useOllama ? 'Ollama (local)' : 'Anthropic (Claude)'}`)
  console.log(`✓ Model: ${apiHandler.getModel().id}\n`)
  
  // Create runtime adapter
  const adapter = new NodeAdapter({
    workspaceDir: process.cwd(),
    getApproval: async (action: string, details: any) => {
      // Auto-approve for analysis (read-only operations)
      console.log(`\n✓ Approved: ${action}`)
      return true
    }
  })
  
  // Create agent with custom system prompt for code analysis
  const agent = new Agent({
    apiHandler,
    adapter,
    tools: CoreTools,
    systemPrompt: `You are an expert code analyzer and software architect.

Your task is to analyze codebases and provide actionable insights.

Available tools:
- search_files: Find files by pattern
- read_file: Read file contents
- list_files: List directory contents
- execute_command: Run commands (e.g., grep, find)
- attempt_completion: Present your analysis

Analysis approach:
1. First, explore the codebase structure
2. Identify the technology stack
3. Analyze code quality, patterns, and potential issues
4. Provide specific, actionable recommendations
5. Use attempt_completion with your complete analysis

Focus on:
- Code organization and structure
- Common patterns and anti-patterns
- Potential bugs or issues
- Performance considerations
- Best practice violations
- Security concerns
- Areas for improvement

Be specific and provide examples from the actual code.`
  })
  
  // Get directory to analyze
  const targetDir = process.argv.find(arg => !arg.startsWith('--') && arg !== 'node' && !arg.includes('index.js')) || '.'
  
  console.log(`📂 Analyzing: ${targetDir}\n`)
  console.log('─'.repeat(60))
  
  // Execute analysis task
  const task = await agent.executeTask({
    prompt: `Analyze the codebase in "${targetDir}". 

Please provide:
1. Technology stack overview
2. Project structure analysis
3. Code quality assessment
4. Potential issues or bugs
5. Security concerns
6. Performance considerations
7. Recommended improvements

Be specific and reference actual files and code patterns you find.`,
    onProgress: (event) => {
      switch (event.type) {
        case 'progress':
          process.stdout.write(event.data.content)
          break
          
        case 'tool_use':
          console.log(`\n\n🔧 ${event.data.toolUse.name}`)
          const input = event.data.toolUse.input
          if (input.path) console.log(`   📁 ${input.path}`)
          if (input.pattern) console.log(`   🔎 ${input.pattern}`)
          if (input.command) console.log(`   💻 ${input.command}`)
          break
          
        case 'tool_result':
          const result = event.data.result
          if (!result.is_error) {
            const preview = result.content.substring(0, 100)
            console.log(`   ✓ ${preview}${result.content.length > 100 ? '...' : ''}`)
          } else {
            console.log(`   ❌ ${result.content}`)
          }
          break
          
        case 'error':
          console.error(`\n\n❌ Error: ${event.data.error}`)
          break
      }
    }
  })
  
  // Wait for analysis to complete
  console.log('\n\n⏳ Analyzing codebase...\n')
  const result = await task.waitForCompletion()
  
  console.log('\n' + '─'.repeat(60))
  
  if (result.success) {
    console.log('\n✅ Analysis Complete!\n')
    
    // Show token usage
    const usage = task.getUsage()
    console.log('📊 Token Usage:')
    console.log(`   Input: ${usage.inputTokens}`)
    console.log(`   Output: ${usage.outputTokens}`)
    if (usage.cacheReadTokens) {
      console.log(`   Cache Reads: ${usage.cacheReadTokens}`)
    }
    
    if (!useOllama) {
      // Estimate cost (approximate)
      const cost = (usage.inputTokens * 0.003 / 1000) + (usage.outputTokens * 0.015 / 1000)
      console.log(`   Estimated Cost: $${cost.toFixed(4)}`)
    } else {
      console.log(`   Cost: $0 (local model)`)
    }
  } else {
    console.log('\n❌ Analysis Failed!\n')
    if (result.error) {
      console.error('Error:', result.error)
    }
  }
  
  console.log('\n' + '─'.repeat(60))
  console.log('\nUsage:')
  console.log('  node dist/index.js [directory]     # Analyze directory')
  console.log('  node dist/index.js --ollama        # Use local Ollama')
  console.log('\nExamples:')
  console.log('  node dist/index.js src/')
  console.log('  node dist/index.js ../my-project --ollama')
}

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})

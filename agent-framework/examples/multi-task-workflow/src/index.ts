/**
 * Multi-Task Workflow Example - See README.md
 */

import { Agent, withErrorRecovery } from '@agent-framework/core'
import { AnthropicProvider, OllamaProvider } from '@agent-framework/api'
import { NodeAdapter } from '@agent-framework/runtime'
import { CoreTools } from '@agent-framework/tools'

// Example showing multi-task orchestration
console.log('Multi-Task Workflow Example')
console.log('Run with: ANTHROPIC_API_KEY=key node dist/index.js')

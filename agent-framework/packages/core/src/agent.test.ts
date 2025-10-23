import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Agent } from './agent'
import type { APIHandler, RuntimeAdapter, Tool } from '@agent-framework/types'

// Mock provider
class MockProvider implements APIHandler {
  provider = 'mock' as const
  apiKey = 'test'
  model = 'mock-model'

  async createMessage() {
    return {
      id: 'msg_test',
      type: 'message' as const,
      role: 'assistant' as const,
      content: [{ type: 'text' as const, text: 'Test response' }],
      model: 'mock-model',
      stop_reason: 'end_turn' as const,
      usage: { input_tokens: 10, output_tokens: 20 },
    }
  }

  async *streamMessage() {
    yield {
      type: 'content_block_delta' as const,
      index: 0,
      delta: { type: 'text_delta' as const, text: 'Test' },
    }
  }

  getModel() {
    return { id: 'mock-model', name: 'Mock Model' }
  }
}

// Mock adapter
class MockAdapter implements RuntimeAdapter {
  workspaceDir = '/test'
  
  fileSystem = {
    readFile: vi.fn().mockResolvedValue('file content'),
    writeFile: vi.fn().mockResolvedValue(undefined),
    listFiles: vi.fn().mockResolvedValue(['file1.ts', 'file2.ts']),
    fileExists: vi.fn().mockResolvedValue(true),
    createDirectory: vi.fn().mockResolvedValue(undefined),
    deleteFile: vi.fn().mockResolvedValue(undefined),
  }

  commandExecutor = {
    execute: vi.fn().mockResolvedValue({
      stdout: 'command output',
      stderr: '',
      exitCode: 0,
    }),
  }
}

// Mock tool
class MockTool implements Tool {
  get definition() {
    return {
      name: 'mock_tool',
      description: 'A mock tool',
      input_schema: {
        type: 'object' as const,
        properties: {},
      },
    }
  }

  async execute() {
    return {
      success: true,
      data: { result: 'mock result' },
      toolName: 'mock_tool',
    }
  }
}

describe('Agent', () => {
  let agent: Agent
  let mockProvider: MockProvider
  let mockAdapter: MockAdapter
  let mockTool: MockTool

  beforeEach(() => {
    mockProvider = new MockProvider()
    mockAdapter = new MockAdapter()
    mockTool = new MockTool()

    agent = new Agent({
      apiHandler: mockProvider,
      adapter: mockAdapter,
      tools: [mockTool],
    })
  })

  describe('constructor', () => {
    it('should create an agent with required dependencies', () => {
      expect(agent).toBeDefined()
      expect(agent['apiHandler']).toBe(mockProvider)
      expect(agent['adapter']).toBe(mockAdapter)
      expect(agent['tools']).toHaveLength(1)
    })

    it('should throw error if apiHandler is missing', () => {
      expect(() => new Agent({
        apiHandler: null as any,
        adapter: mockAdapter,
        tools: [],
      })).toThrow()
    })

    it('should throw error if adapter is missing', () => {
      expect(() => new Agent({
        apiHandler: mockProvider,
        adapter: null as any,
        tools: [],
      })).toThrow()
    })
  })

  describe('executeTask', () => {
    it('should create and return a task', async () => {
      const task = await agent.executeTask({
        prompt: 'Test prompt',
      })

      expect(task).toBeDefined()
      expect(task.waitForCompletion).toBeDefined()
    })

    it('should handle progress callbacks', async () => {
      const onProgress = vi.fn()

      await agent.executeTask({
        prompt: 'Test prompt',
        onProgress,
      })

      // Wait a bit for async operations
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(onProgress).toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      const errorProvider = new MockProvider()
      errorProvider.createMessage = vi.fn().mockRejectedValue(new Error('API error'))

      const errorAgent = new Agent({
        apiHandler: errorProvider,
        adapter: mockAdapter,
        tools: [],
      })

      const task = await errorAgent.executeTask({
        prompt: 'Test prompt',
      })

      await expect(task.waitForCompletion()).rejects.toThrow()
    })
  })

  describe('tool integration', () => {
    it('should provide tools to tasks', async () => {
      const task = await agent.executeTask({
        prompt: 'Test prompt',
      })

      expect(task).toBeDefined()
      // Task should have access to tools through the agent
    })

    it('should handle multiple tools', () => {
      const tool2 = new MockTool()
      const multiToolAgent = new Agent({
        apiHandler: mockProvider,
        adapter: mockAdapter,
        tools: [mockTool, tool2],
      })

      expect(multiToolAgent['tools']).toHaveLength(2)
    })
  })
})

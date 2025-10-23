import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Task } from './task'
import type { APIHandler, RuntimeAdapter, Tool } from '@agent-framework/types'

// Mock provider with streaming
class MockProvider implements APIHandler {
  provider = 'mock' as const
  apiKey = 'test'
  model = 'mock-model'

  async createMessage() {
    return {
      id: 'msg_test',
      type: 'message' as const,
      role: 'assistant' as const,
      content: [
        { type: 'text' as const, text: 'I will use a tool.' },
        {
          type: 'tool_use' as const,
          id: 'tool_1',
          name: 'mock_tool',
          input: { param: 'value' },
        },
      ],
      model: 'mock-model',
      stop_reason: 'tool_use' as const,
      usage: { input_tokens: 10, output_tokens: 20 },
    }
  }

  async *streamMessage() {
    yield {
      type: 'content_block_start' as const,
      index: 0,
      content_block: { type: 'text' as const, text: '' },
    }
    yield {
      type: 'content_block_delta' as const,
      index: 0,
      delta: { type: 'text_delta' as const, text: 'Test' },
    }
    yield {
      type: 'content_block_stop' as const,
      index: 0,
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
      description: 'A mock tool for testing',
      input_schema: {
        type: 'object' as const,
        properties: {
          param: { type: 'string' as const },
        },
      },
    }
  }

  async execute(input: any) {
    return {
      success: true,
      data: { result: `Processed ${input.param}` },
      toolName: 'mock_tool',
    }
  }
}

// Mock completion tool
class MockCompletionTool implements Tool {
  get definition() {
    return {
      name: 'attempt_completion',
      description: 'Complete the task',
      input_schema: {
        type: 'object' as const,
        properties: {
          result: { type: 'string' as const },
        },
      },
    }
  }

  async execute() {
    return {
      success: true,
      data: { completed: true },
      toolName: 'attempt_completion',
    }
  }
}

describe('Task', () => {
  let task: Task
  let mockProvider: MockProvider
  let mockAdapter: MockAdapter
  let mockTool: MockTool
  let completionTool: MockCompletionTool

  beforeEach(() => {
    mockProvider = new MockProvider()
    mockAdapter = new MockAdapter()
    mockTool = new MockTool()
    completionTool = new MockCompletionTool()

    task = new Task({
      apiHandler: mockProvider,
      adapter: mockAdapter,
      tools: [mockTool, completionTool],
      prompt: 'Test task prompt',
    })
  })

  describe('constructor', () => {
    it('should create a task with required parameters', () => {
      expect(task).toBeDefined()
    })

    it('should set initial state correctly', () => {
      expect(task['conversationHistory']).toHaveLength(1)
      expect(task['conversationHistory'][0].role).toBe('user')
    })
  })

  describe('execute', () => {
    it('should execute task and emit events', async () => {
      const onProgress = vi.fn()
      
      const taskWithCallback = new Task({
        apiHandler: mockProvider,
        adapter: mockAdapter,
        tools: [mockTool, completionTool],
        prompt: 'Test task',
        onProgress,
      })

      // Mock provider to return completion
      mockProvider.createMessage = vi.fn().mockResolvedValue({
        id: 'msg_test',
        type: 'message' as const,
        role: 'assistant' as const,
        content: [
          { type: 'text' as const, text: 'Task completed.' },
          {
            type: 'tool_use' as const,
            id: 'tool_complete',
            name: 'attempt_completion',
            input: { result: 'Done!' },
          },
        ],
        model: 'mock-model',
        stop_reason: 'end_turn' as const,
        usage: { input_tokens: 10, output_tokens: 20 },
      })

      await taskWithCallback.execute()

      expect(onProgress).toHaveBeenCalled()
    })

    it('should handle tool execution', async () => {
      await task.execute()

      // Tool should have been called during execution
      expect(task['conversationHistory'].length).toBeGreaterThan(1)
    })

    it('should stop on max iterations', async () => {
      const limitedTask = new Task({
        apiHandler: mockProvider,
        adapter: mockAdapter,
        tools: [mockTool],
        prompt: 'Test',
        maxIterations: 2,
      })

      // Provider never returns completion
      mockProvider.createMessage = vi.fn().mockResolvedValue({
        id: 'msg_test',
        type: 'message' as const,
        role: 'assistant' as const,
        content: [
          { type: 'text' as const, text: 'Still working...' },
          {
            type: 'tool_use' as const,
            id: 'tool_1',
            name: 'mock_tool',
            input: { param: 'value' },
          },
        ],
        model: 'mock-model',
        stop_reason: 'tool_use' as const,
        usage: { input_tokens: 10, output_tokens: 20 },
      })

      await limitedTask.execute()

      // Should have stopped at max iterations
      expect(mockProvider.createMessage).toHaveBeenCalledTimes(2)
    })
  })

  describe('waitForCompletion', () => {
    it('should resolve when task completes', async () => {
      // Mock immediate completion
      mockProvider.createMessage = vi.fn().mockResolvedValue({
        id: 'msg_test',
        type: 'message' as const,
        role: 'assistant' as const,
        content: [
          {
            type: 'tool_use' as const,
            id: 'tool_complete',
            name: 'attempt_completion',
            input: { result: 'Done' },
          },
        ],
        model: 'mock-model',
        stop_reason: 'end_turn' as const,
        usage: { input_tokens: 10, output_tokens: 20 },
      })

      const startPromise = task.execute()
      const result = await task.waitForCompletion()

      await startPromise

      expect(result).toBeDefined()
      expect(result.status).toBe('completed')
    })

    it('should handle errors', async () => {
      mockProvider.createMessage = vi.fn().mockRejectedValue(new Error('API Error'))

      const startPromise = task.execute()

      await expect(task.waitForCompletion()).rejects.toThrow('API Error')
      await expect(startPromise).rejects.toThrow('API Error')
    })
  })

  describe('event system', () => {
    it('should emit progress events', async () => {
      const events: any[] = []
      
      const taskWithEvents = new Task({
        apiHandler: mockProvider,
        adapter: mockAdapter,
        tools: [mockTool, completionTool],
        prompt: 'Test',
        onProgress: (event) => events.push(event),
      })

      mockProvider.createMessage = vi.fn().mockResolvedValue({
        id: 'msg_test',
        type: 'message' as const,
        role: 'assistant' as const,
        content: [
          {
            type: 'tool_use' as const,
            id: 'tool_complete',
            name: 'attempt_completion',
            input: { result: 'Done' },
          },
        ],
        model: 'mock-model',
        stop_reason: 'end_turn' as const,
        usage: { input_tokens: 10, output_tokens: 20 },
      })

      await taskWithEvents.execute()

      expect(events.length).toBeGreaterThan(0)
      expect(events.some(e => e.type === 'progress')).toBe(true)
    })
  })
})

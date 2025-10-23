import { describe, it, expect } from 'vitest'
import { BaseTool } from './base'

class TestTool extends BaseTool {
  get definition() {
    return {
      name: 'test_tool',
      description: 'A test tool',
      input_schema: {
        type: 'object' as const,
        properties: {
          input: { type: 'string' as const },
        },
        required: ['input'],
      },
    }
  }

  async execute(input: any) {
    return this.success({ processed: input.input }, 'test_tool')
  }
}

describe('BaseTool', () => {
  let tool: TestTool

  beforeEach(() => {
    tool = new TestTool()
  })

  describe('definition', () => {
    it('should have correct tool definition', () => {
      const def = tool.definition
      
      expect(def.name).toBe('test_tool')
      expect(def.description).toBe('A test tool')
      expect(def.input_schema.type).toBe('object')
    })
  })

  describe('execute', () => {
    it('should execute successfully', async () => {
      const result = await tool.execute({ input: 'test' }, {} as any)
      
      expect(result.success).toBe(true)
      expect(result.data).toEqual({ processed: 'test' })
      expect(result.toolName).toBe('test_tool')
    })
  })

  describe('helper methods', () => {
    it('should create success response', () => {
      const result = tool['success']({ key: 'value' }, 'tool_name')
      
      expect(result.success).toBe(true)
      expect(result.data).toEqual({ key: 'value' })
      expect(result.toolName).toBe('tool_name')
    })

    it('should create error response', () => {
      const result = tool['error']('Something went wrong', 'tool_name')
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('Something went wrong')
      expect(result.toolName).toBe('tool_name')
    })
  })
})

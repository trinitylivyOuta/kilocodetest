import { BaseTool, type ToolContext } from './base'
import type { ToolResult } from '@agent-framework/types'

/**
 * Browser Automation Tool
 * 
 * Provides web browsing capabilities using Puppeteer.
 * Allows agents to navigate, interact with, and extract data from web pages.
 * 
 * Note: Requires puppeteer to be installed in the project.
 * 
 * @example
 * ```typescript
 * import { BrowserTool } from '@agent-framework/tools'
 * 
 * const tool = new BrowserTool()
 * const result = await tool.execute({
 *   action: 'navigate',
 *   url: 'https://example.com'
 * }, context)
 * ```
 */
export class BrowserTool extends BaseTool {
  private browser: any = null
  private page: any = null

  get definition() {
    return {
      name: 'browser',
      description: `Interact with web pages through browser automation. Supports actions:
- navigate: Go to a URL
- click: Click an element by selector
- type: Type text into an input by selector
- screenshot: Take a screenshot
- extract: Extract text content by selector
- evaluate: Run JavaScript in the page context`,
      input_schema: {
        type: 'object' as const,
        properties: {
          action: {
            type: 'string' as const,
            enum: ['navigate', 'click', 'type', 'screenshot', 'extract', 'evaluate'],
            description: 'The browser action to perform',
          },
          url: {
            type: 'string' as const,
            description: 'URL to navigate to (for navigate action)',
          },
          selector: {
            type: 'string' as const,
            description: 'CSS selector for elements (for click, type, extract actions)',
          },
          text: {
            type: 'string' as const,
            description: 'Text to type (for type action)',
          },
          script: {
            type: 'string' as const,
            description: 'JavaScript code to execute (for evaluate action)',
          },
        },
        required: ['action'],
      },
    }
  }

  async execute(
    input: {
      action: 'navigate' | 'click' | 'type' | 'screenshot' | 'extract' | 'evaluate'
      url?: string
      selector?: string
      text?: string
      script?: string
    },
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      // Lazy load puppeteer
      if (!this.browser) {
        await this.initBrowser()
      }

      switch (input.action) {
        case 'navigate':
          return await this.navigate(input.url!)

        case 'click':
          return await this.click(input.selector!)

        case 'type':
          return await this.type(input.selector!, input.text!)

        case 'screenshot':
          return await this.screenshot()

        case 'extract':
          return await this.extract(input.selector!)

        case 'evaluate':
          return await this.evaluate(input.script!)

        default:
          return this.error('Unknown action', 'browser')
      }
    } catch (error) {
      return this.error(`Browser error: ${error}`, 'browser')
    }
  }

  /**
   * Initialize Puppeteer browser
   */
  private async initBrowser() {
    try {
      // Dynamic import to avoid build-time dependency
      // @ts-ignore - puppeteer is optional dependency
      const puppeteer: any = await import('puppeteer').catch(() => {
        throw new Error(
          'Puppeteer not installed. Install it with: npm install puppeteer'
        )
      })
      
      this.browser = await puppeteer.default.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })

      this.page = await this.browser.newPage()
      
      // Set reasonable viewport
      await this.page.setViewport({
        width: 1280,
        height: 720,
      })

    } catch (error) {
      throw new Error(
        `Failed to initialize browser: ${error}. Make sure puppeteer is installed: npm install puppeteer`
      )
    }
  }

  /**
   * Navigate to URL
   */
  private async navigate(url: string): Promise<ToolResult> {
    if (!url) {
      return this.error('URL is required for navigate action', 'browser')
    }

    await this.page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    })

    const title = await this.page.title()

    return this.success(
      `Navigated to ${url}. Title: ${title}`,
      'browser'
    )
  }

  /**
   * Click element
   */
  private async click(selector: string): Promise<ToolResult> {
    if (!selector) {
      return this.error('Selector is required for click action', 'browser')
    }

    await this.page.waitForSelector(selector, { timeout: 5000 })
    await this.page.click(selector)

    return this.success(`Clicked element: ${selector}`, 'browser')
  }

  /**
   * Type text into element
   */
  private async type(selector: string, text: string): Promise<ToolResult> {
    if (!selector) {
      return this.error('Selector is required for type action', 'browser')
    }
    if (!text) {
      return this.error('Text is required for type action', 'browser')
    }

    await this.page.waitForSelector(selector, { timeout: 5000 })
    await this.page.type(selector, text)

    return this.success(`Typed "${text}" into ${selector}`, 'browser')
  }

  /**
   * Take screenshot
   */
  private async screenshot(): Promise<ToolResult> {
    const screenshot = await this.page.screenshot({
      encoding: 'base64',
      fullPage: false,
    })

    return this.success(`Screenshot captured (${screenshot.toString().length} bytes, base64)`, 'browser')
  }

  /**
   * Extract text content
   */
  private async extract(selector: string): Promise<ToolResult> {
    if (!selector) {
      return this.error('Selector is required for extract action', 'browser')
    }

    const elements = await this.page.$$(selector)
    
    if (elements.length === 0) {
      return this.error(`No elements found for selector: ${selector}`, 'browser')
    }

    const texts = await Promise.all(
      elements.map(async (el: any) => {
        return await this.page.evaluate((element: any) => element.textContent, el)
      })
    )

    return this.success(
      `Found ${texts.length} elements for ${selector}. Texts: ${JSON.stringify(texts)}`,
      'browser'
    )
  }

  /**
   * Evaluate JavaScript
   */
  private async evaluate(script: string): Promise<ToolResult> {
    if (!script) {
      return this.error('Script is required for evaluate action', 'browser')
    }

    const result = await this.page.evaluate(script)

    return this.success(`Script executed. Result: ${JSON.stringify(result)}`, 'browser')
  }

  /**
   * Cleanup browser resources
   */
  async cleanup() {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
      this.page = null
    }
  }
}

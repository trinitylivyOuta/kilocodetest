/**
 * Error Recovery System
 * 
 * Provides retry logic, timeout handling, and error recovery for API calls and tool execution.
 */

export interface RetryOptions {
  maxRetries?: number
  initialDelay?: number
  maxDelay?: number
  backoffFactor?: number
  retryOn?: (error: Error) => boolean
}

export interface TimeoutOptions {
  timeout?: number
  timeoutMessage?: string
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
    retryOn = () => true,
  } = options

  let lastError: Error | null = null
  let delay = initialDelay

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      // Don't retry if this is the last attempt
      if (attempt === maxRetries) {
        break
      }

      // Check if we should retry this error
      if (!retryOn(lastError)) {
        throw lastError
      }

      // Wait before retrying
      await sleep(delay)

      // Exponential backoff
      delay = Math.min(delay * backoffFactor, maxDelay)
    }
  }

  throw new Error(`Failed after ${maxRetries + 1} attempts: ${lastError?.message}`)
}

/**
 * Add timeout to a promise
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  options: TimeoutOptions = {}
): Promise<T> {
  const { timeout = 60000, timeoutMessage = 'Operation timed out' } = options

  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), timeout)
    }),
  ])
}

/**
 * Retry with timeout
 */
export async function withRetryAndTimeout<T>(
  fn: () => Promise<T>,
  retryOptions: RetryOptions = {},
  timeoutOptions: TimeoutOptions = {}
): Promise<T> {
  return withRetry(() => withTimeout(fn(), timeoutOptions), retryOptions)
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase()

  // Network errors
  if (
    message.includes('network') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('enotfound')
  ) {
    return true
  }

  // Rate limiting
  if (message.includes('rate limit') || message.includes('429')) {
    return true
  }

  // Server errors (5xx)
  if (message.includes('500') || message.includes('502') || message.includes('503')) {
    return true
  }

  return false
}

/**
 * Circuit breaker pattern
 */
export class CircuitBreaker {
  private failures = 0
  private lastFailureTime = 0
  private state: 'closed' | 'open' | 'half-open' = 'closed'

  constructor(
    private options: {
      failureThreshold?: number
      resetTimeout?: number
      monitoringPeriod?: number
    } = {}
  ) {
    this.options.failureThreshold = options.failureThreshold || 5
    this.options.resetTimeout = options.resetTimeout || 60000
    this.options.monitoringPeriod = options.monitoringPeriod || 10000
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      // Check if we should try again
      if (Date.now() - this.lastFailureTime >= this.options.resetTimeout!) {
        this.state = 'half-open'
      } else {
        throw new Error('Circuit breaker is open')
      }
    }

    try {
      const result = await fn()

      // Success - reset if in half-open state
      if (this.state === 'half-open') {
        this.reset()
      }

      return result
    } catch (error) {
      this.recordFailure()
      throw error
    }
  }

  private recordFailure() {
    this.failures++
    this.lastFailureTime = Date.now()

    if (this.failures >= this.options.failureThreshold!) {
      this.state = 'open'
    }
  }

  private reset() {
    this.failures = 0
    this.state = 'closed'
  }

  getState() {
    return this.state
  }
}

/**
 * Rate limiter
 */
export class RateLimiter {
  private queue: Array<() => void> = []
  private activeRequests = 0

  constructor(
    private options: {
      maxConcurrent?: number
      minInterval?: number
    } = {}
  ) {
    this.options.maxConcurrent = options.maxConcurrent || 5
    this.options.minInterval = options.minInterval || 100
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.waitForSlot()

    this.activeRequests++

    try {
      const result = await fn()
      return result
    } finally {
      this.activeRequests--

      // Wait minimum interval before processing next
      setTimeout(() => this.processQueue(), this.options.minInterval)
    }
  }

  private waitForSlot(): Promise<void> {
    if (this.activeRequests < this.options.maxConcurrent!) {
      return Promise.resolve()
    }

    return new Promise<void>((resolve) => {
      this.queue.push(resolve)
    })
  }

  private processQueue() {
    if (this.queue.length > 0 && this.activeRequests < this.options.maxConcurrent!) {
      const next = this.queue.shift()
      if (next) next()
    }
  }
}

/**
 * Helper to sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Wrap API handler with error recovery
 */
export function withErrorRecovery<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: RetryOptions & TimeoutOptions = {}
): T {
  return (async (...args: any[]) => {
    return withRetryAndTimeout(
      () => fn(...args),
      {
        ...options,
        retryOn: options.retryOn || isRetryableError,
      },
      options
    )
  }) as T
}

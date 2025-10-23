import type { RuntimeAdapter, FileSystem, CommandExecutor } from '@agent-framework/types'

/**
 * VSCode Runtime Adapter
 * 
 * Provides VSCode-specific implementations for file system and command execution.
 * Designed to work within VSCode extension context.
 * 
 * @example
 * ```typescript
 * import * as vscode from 'vscode'
 * import { VSCodeAdapter } from '@agent-framework/runtime'
 * 
 * const adapter = new VSCodeAdapter({
 *   workspace: vscode.workspace.workspaceFolders?.[0],
 *   terminal: vscode.window.createTerminal('Agent')
 * })
 * ```
 */
export class VSCodeAdapter implements RuntimeAdapter {
  public readonly name = 'vscode'
  public readonly workspaceDir: string
  private terminal?: any // vscode.Terminal

  constructor(options: {
    workspace: any // vscode.WorkspaceFolder
    terminal?: any // vscode.Terminal
  }) {
    if (!options.workspace) {
      throw new Error('VSCode workspace is required')
    }

    this.terminal = options.terminal
    this.workspaceDir = options.workspace.uri.fsPath
  }

  /**
   * File system operations using VSCode's workspace API
   */
  public readonly fileSystem: FileSystem = {
    /**
     * Read file using VSCode workspace API
     */
    readFile: async (path: string): Promise<string> => {
      try {
        // Dynamically import vscode to avoid issues in non-VSCode environments
        const vscode = await this.getVSCode()
        const uri = vscode.Uri.file(path)
        const content = await vscode.workspace.fs.readFile(uri)
        return Buffer.from(content).toString('utf-8')
      } catch (error) {
        throw new Error(`Failed to read file ${path}: ${error}`)
      }
    },

    /**
     * Write file using VSCode workspace API
     */
    writeFile: async (path: string, content: string): Promise<void> => {
      try {
        const vscode = await this.getVSCode()
        const uri = vscode.Uri.file(path)
        const buffer = Buffer.from(content, 'utf-8')
        await vscode.workspace.fs.writeFile(uri, buffer)
      } catch (error) {
        throw new Error(`Failed to write file ${path}: ${error}`)
      }
    },

    /**
     * List files in directory using VSCode workspace API
     */
    listFiles: async (dirPath: string): Promise<string[]> => {
      try {
        const vscode = await this.getVSCode()
        const uri = vscode.Uri.file(dirPath)
        const entries = await vscode.workspace.fs.readDirectory(uri)
        
        const files: string[] = []
        
        for (const [name, type] of entries) {
          const fullPath = `${dirPath}/${name}`
          
          if (type === vscode.FileType.File) {
            files.push(fullPath)
          }
        }
        
        return files
      } catch (error) {
        throw new Error(`Failed to list files in ${dirPath}: ${error}`)
      }
    },

    /**
     * Check if file exists
     */
    exists: async (path: string): Promise<boolean> => {
      try {
        const vscode = await this.getVSCode()
        const uri = vscode.Uri.file(path)
        await vscode.workspace.fs.stat(uri)
        return true
      } catch {
        return false
      }
    },

    /**
     * Delete file
     */
    deleteFile: async (path: string): Promise<void> => {
      try {
        const vscode = await this.getVSCode()
        const uri = vscode.Uri.file(path)
        await vscode.workspace.fs.delete(uri)
      } catch (error) {
        throw new Error(`Failed to delete file ${path}: ${error}`)
      }
    },
  }

  /**
   * Command execution using VSCode terminal
   */
  public readonly commandExecutor: CommandExecutor = {
    /**
     * Execute command in VSCode terminal
     */
    execute: async (command: string, cwd?: string): Promise<{
      stdout: string
      stderr: string
      exitCode: number
    }> => {
      return new Promise(async (resolve, reject) => {
        try {
          const vscode = await this.getVSCode()
          
          // Create or reuse terminal
          const terminal = this.terminal || vscode.window.createTerminal({
            name: 'Agent Framework',
            cwd: cwd || this.workspaceDir,
          })

          // VSCode terminal doesn't provide direct output capture
          // This is a limitation - in practice, you'd need to use a Task
          // or integrate with a language server for proper output capture
          
          // Send command to terminal
          terminal.show()
          terminal.sendText(command)

          // Since we can't capture output directly from terminal,
          // we'll return a placeholder response
          // In production, consider using vscode.tasks.executeTask instead
          setTimeout(() => {
            resolve({
              stdout: `Command executed: ${command}`,
              stderr: '',
              exitCode: 0,
            })
          }, 1000)

        } catch (error) {
          reject(new Error(`Failed to execute command: ${error}`))
        }
      })
    },
  }

  /**
   * Dynamically load vscode module
   * This prevents errors when running outside VSCode
   */
  private async getVSCode(): Promise<any> {
    try {
      // @ts-ignore - vscode module only available in VSCode extensions
      return await import('vscode')
    } catch (error) {
      throw new Error('VSCode module not available. This adapter must run inside a VSCode extension.')
    }
  }

  /**
   * Show message in VSCode
   */
  public async showMessage(message: string, type: 'info' | 'warning' | 'error' = 'info'): Promise<void> {
    const vscode = await this.getVSCode()
    
    switch (type) {
      case 'info':
        vscode.window.showInformationMessage(message)
        break
      case 'warning':
        vscode.window.showWarningMessage(message)
        break
      case 'error':
        vscode.window.showErrorMessage(message)
        break
    }
  }

  /**
   * Show progress notification in VSCode
   */
  public async withProgress<T>(
    title: string,
    task: () => Promise<T>
  ): Promise<T> {
    const vscode = await this.getVSCode()
    
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title,
        cancellable: false,
      },
      async () => {
        return await task()
      }
    )
  }
}

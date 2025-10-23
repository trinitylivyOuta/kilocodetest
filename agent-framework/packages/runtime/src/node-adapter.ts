/**
 * Node.js Runtime Adapter
 * Provides file system and command execution for Node.js environments
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import type { RuntimeAdapter, FileSystem, CommandExecutor, CommandResult } from '@agent-framework/types'

const execPromise = promisify(exec)

class NodeFileSystem implements FileSystem {
  private workspaceDir: string
  
  constructor(workspaceDir: string) {
    this.workspaceDir = workspaceDir
  }
  
  private resolvePath(filePath: string): string {
    return path.isAbsolute(filePath) 
      ? filePath 
      : path.join(this.workspaceDir, filePath)
  }
  
  async readFile(filePath: string): Promise<string> {
    const fullPath = this.resolvePath(filePath)
    return await fs.readFile(fullPath, 'utf-8')
  }
  
  async writeFile(filePath: string, content: string): Promise<void> {
    const fullPath = this.resolvePath(filePath)
    
    // Ensure directory exists
    const dir = path.dirname(fullPath)
    await fs.mkdir(dir, { recursive: true })
    
    await fs.writeFile(fullPath, content, 'utf-8')
  }
  
  async exists(filePath: string): Promise<boolean> {
    const fullPath = this.resolvePath(filePath)
    try {
      await fs.access(fullPath)
      return true
    } catch {
      return false
    }
  }
  
  async listFiles(dir: string): Promise<string[]> {
    const fullPath = this.resolvePath(dir)
    const entries = await fs.readdir(fullPath, { withFileTypes: true })
    
    return entries.map(entry => {
      const name = entry.name
      return entry.isDirectory() ? `${name}/` : name
    })
  }
  
  async deleteFile(filePath: string): Promise<void> {
    const fullPath = this.resolvePath(filePath)
    await fs.unlink(fullPath)
  }
}

class NodeCommandExecutor implements CommandExecutor {
  async execute(command: string, cwd?: string): Promise<CommandResult> {
    try {
      const { stdout, stderr } = await execPromise(command, {
        cwd: cwd || process.cwd(),
        maxBuffer: 10 * 1024 * 1024 // 10MB
      })
      
      return {
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        exitCode: 0
      }
    } catch (error: any) {
      return {
        stdout: error.stdout?.toString() || '',
        stderr: error.stderr?.toString() || error.message,
        exitCode: error.code || 1
      }
    }
  }
}

export interface NodeAdapterOptions {
  workspaceDir?: string
  getApproval?: (action: string, details: any) => Promise<boolean>
}

export class NodeAdapter implements RuntimeAdapter {
  name = 'node'
  fileSystem: FileSystem
  commandExecutor: CommandExecutor
  workspaceDir: string
  private approvalHandler?: (action: string, details: any) => Promise<boolean>
  
  constructor(options: NodeAdapterOptions = {}) {
    this.workspaceDir = options.workspaceDir || process.cwd()
    this.fileSystem = new NodeFileSystem(this.workspaceDir)
    this.commandExecutor = new NodeCommandExecutor()
    this.approvalHandler = options.getApproval
  }
  
  async getApproval(action: string, details: any): Promise<boolean> {
    if (!this.approvalHandler) {
      // Auto-approve if no handler provided
      return true
    }
    
    return await this.approvalHandler(action, details)
  }
}

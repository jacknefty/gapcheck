/**
 * MCP Server - Model Context Protocol interface for GapCheck
 *
 * Allows Claude Code to use gapcheck as a tool via:
 *   claude mcp add gapcheck -- npx gapcheck --mcp
 */

import { buildIndex } from './scanner'
import { analyze } from './analyzer'
import { generateReport } from './report'
import { basename } from 'path'

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number | string
  method: string
  params?: any
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: number | string
  result?: any
  error?: { code: number; message: string; data?: any }
}

const TOOLS = [
  {
    name: 'analyze_codebase',
    description: 'Analyze a codebase for viability using the Viable System Model (VSM). Returns scores for S1-S5 systems, variety engineering metrics, and detected pathologies.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the codebase to analyze (absolute or relative)',
        },
        format: {
          type: 'string',
          enum: ['markdown', 'json'],
          description: 'Output format (default: markdown)',
        },
        verbose: {
          type: 'boolean',
          description: 'Include all findings including LOW severity (default: false)',
        },
      },
      required: ['path'],
    },
  },
]

function send(response: JsonRpcResponse) {
  const json = JSON.stringify(response)
  process.stdout.write(`Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`)
}

async function handleRequest(request: JsonRpcRequest) {
  const { id, method, params } = request

  switch (method) {
    case 'initialize':
      return send({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: 'gapcheck',
            version: '0.1.0',
          },
        },
      })

    case 'initialized':
      // Notification, no response needed
      return

    case 'tools/list':
      return send({
        jsonrpc: '2.0',
        id,
        result: { tools: TOOLS },
      })

    case 'tools/call':
      const { name, arguments: args } = params
      if (name === 'analyze_codebase') {
        try {
          const path = args.path || '.'
          const format = args.format || 'markdown'
          const verbose = args.verbose || false

          const index = await buildIndex(path)
          if (index.files.size === 0) {
            return send({
              jsonrpc: '2.0',
              id,
              result: {
                content: [{ type: 'text', text: 'Error: No source files found' }],
                isError: true,
              },
            })
          }

          const analysis = analyze(index)
          const report = generateReport(basename(path) || 'project', index, analysis, {
            format: format as 'markdown' | 'json',
            verbose,
          })

          // Strip ANSI codes for clean output
          const cleanReport = report.replace(/\x1b\[[0-9;]*m/g, '')

          return send({
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: cleanReport }],
            },
          })
        } catch (err: any) {
          return send({
            jsonrpc: '2.0',
            id,
            result: {
              content: [{ type: 'text', text: `Error: ${err.message}` }],
              isError: true,
            },
          })
        }
      }
      return send({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Unknown tool: ${name}` },
      })

    default:
      return send({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      })
  }
}

export async function startMcpServer() {
  let buffer = ''

  process.stdin.setEncoding('utf8')
  process.stdin.on('data', async (chunk: string) => {
    buffer += chunk

    while (true) {
      const headerEnd = buffer.indexOf('\r\n\r\n')
      if (headerEnd === -1) break

      const header = buffer.slice(0, headerEnd)
      const contentLengthMatch = header.match(/Content-Length: (\d+)/)
      if (!contentLengthMatch) {
        buffer = buffer.slice(headerEnd + 4)
        continue
      }

      const contentLength = parseInt(contentLengthMatch[1], 10)
      const contentStart = headerEnd + 4
      const contentEnd = contentStart + contentLength

      if (buffer.length < contentEnd) break

      const content = buffer.slice(contentStart, contentEnd)
      buffer = buffer.slice(contentEnd)

      try {
        const request = JSON.parse(content) as JsonRpcRequest
        await handleRequest(request)
      } catch (err) {
        // Parse error
        send({
          jsonrpc: '2.0',
          id: null as any,
          error: { code: -32700, message: 'Parse error' },
        })
      }
    }
  })

  process.stdin.on('end', () => {
    process.exit(0)
  })
}

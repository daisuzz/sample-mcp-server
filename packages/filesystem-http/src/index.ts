#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from '@modelcontextprotocol/sdk/types.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs/promises';

class FileSystemHTTPMCPServer {
    private transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

    private createServer(): Server {
        const server = new Server(
            {
                name: 'filesystem-http-mcp-server',
                version: '1.0.0',
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        this.setupToolHandlers(server);
        return server;
    }

    private setupToolHandlers(server: Server) {
        // ツール一覧を返すハンドラー
        server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: 'read_file',
                        description: 'ファイルの内容を読み取る',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                path: {
                                    type: 'string',
                                    description: '読み取るファイルのパス',
                                },
                            },
                            required: ['path'],
                        },
                    },
                    {
                        name: 'write_file',
                        description: 'ファイルに内容を書き込む',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                path: {
                                    type: 'string',
                                    description: '書き込み先ファイルのパス',
                                },
                                content: {
                                    type: 'string',
                                    description: '書き込む内容',
                                },
                            },
                            required: ['path', 'content'],
                        },
                    },
                    {
                        name: 'list_directory',
                        description: 'ディレクトリの内容を一覧表示する',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                path: {
                                    type: 'string',
                                    description: '一覧表示するディレクトリのパス',
                                },
                            },
                            required: ['path'],
                        },
                    },
                ] as Tool[],
            };
        });

        // ツール実行ハンドラー
        server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;

            try {
                switch (name) {
                    case 'read_file':
                        return await this.readFile(args?.path as string);

                    case 'write_file':
                        return await this.writeFile(args?.path as string, args?.content as string);

                    case 'list_directory':
                        return await this.listDirectory(args?.path as string);

                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }
            } catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
                        },
                    ],
                    isError: true,
                };
            }
        });
    }

    private async readFile(filePath: string) {
        const content = await fs.readFile(filePath, 'utf-8');
        return {
            content: [
                {
                    type: 'text',
                    text: content,
                },
            ],
        };
    }

    private async writeFile(filePath: string, content: string) {
        await fs.writeFile(filePath, content, 'utf-8');
        return {
            content: [
                {
                    type: 'text',
                    text: `Successfully wrote to ${filePath}`,
                },
            ],
        };
    }

    private async listDirectory(dirPath: string) {
        const items = await fs.readdir(dirPath, { withFileTypes: true });
        const itemList = items.map(item => {
            const type = item.isDirectory() ? 'directory' : 'file';
            return `${type}: ${item.name}`;
        }).join('\n');

        return {
            content: [
                {
                    type: 'text',
                    text: itemList || 'Directory is empty',
                },
            ],
        };
    }

    async startHttpServer(port: number = 3000) {
        const app = express();
        app.use(express.json());

        // CORS設定 - Mcp-Session-Idヘッダーを公開
        app.use(cors({
            origin: '*',
            exposedHeaders: ['Mcp-Session-Id']
        }));

        // Streamable HTTP transport endpoint
        app.all('/mcp', async (req, res) => {
            console.log(`Received ${req.method} request to /mcp`);
            
            try {
                const sessionId = req.headers['mcp-session-id'] as string;
                let transport: StreamableHTTPServerTransport;

                if (sessionId && this.transports[sessionId]) {
                    // 既存のセッションを再利用
                    transport = this.transports[sessionId];
                } else if (!sessionId && req.method === 'POST' && isInitializeRequest(req.body)) {
                    // 新しいセッションを作成（初期化リクエストの場合）
                    transport = new StreamableHTTPServerTransport({
                        sessionIdGenerator: () => randomUUID(),
                        onsessioninitialized: (sessionId: string) => {
                            console.log(`HTTP session initialized with ID: ${sessionId}`);
                            this.transports[sessionId] = transport;
                        },
                        onsessionclosed: (sessionId: string) => {
                            console.log(`HTTP session closed: ${sessionId}`);
                            delete this.transports[sessionId];
                        }
                    });

                    // トランスポートのクローズハンドラーを設定
                    transport.onclose = () => {
                        const sid = transport.sessionId;
                        if (sid && this.transports[sid]) {
                            console.log(`Transport closed for session ${sid}`);
                            delete this.transports[sid];
                        }
                    };

                    // MCPサーバーとトランスポートを接続
                    const server = this.createServer();
                    await server.connect(transport);
                } else {
                    // 無効なリクエスト
                    res.status(400).json({
                        jsonrpc: '2.0',
                        error: {
                            code: -32000,
                            message: 'Bad Request: No valid session ID provided or not an initialization request',
                        },
                        id: null,
                    });
                    return;
                }

                // リクエストをトランスポートで処理
                await transport.handleRequest(req, res, req.body);
            } catch (error) {
                console.error('Error handling MCP request:', error);
                if (!res.headersSent) {
                    res.status(500).json({
                        jsonrpc: '2.0',
                        error: {
                            code: -32603,
                            message: 'Internal server error',
                        },
                        id: null,
                    });
                }
            }
        });

        // ヘルスチェックエンドポイント
        app.get('/health', (req, res) => {
            res.json({ status: 'OK', timestamp: new Date().toISOString() });
        });

        // サーバー起動
        return new Promise<void>((resolve, reject) => {
            app.listen(port, (error?: Error) => {
                if (error) {
                    reject(error);
                } else {
                    console.log(`Filesystem HTTP MCP Server listening on port ${port}`);
                    console.log(`
==============================================
HTTP MCP SERVER ENDPOINTS:

1. MCP Streamable HTTP Transport:
   Endpoint: /mcp
   Methods: GET, POST, DELETE
   
   Usage:
   - Initialize: POST /mcp (with initialization request)
   - Stream: GET /mcp (with Mcp-Session-Id header)
   - Request: POST /mcp (with Mcp-Session-Id header)
   - Terminate: DELETE /mcp (with Mcp-Session-Id header)

2. Health Check:
   Endpoint: /health
   Method: GET
==============================================
                    `);
                    resolve();
                }
            });
        });
    }
}

// サーバー起動
const server = new FileSystemHTTPMCPServer();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

server.startHttpServer(PORT).catch((error) => {
    console.error('Failed to start HTTP MCP server:', error);
    process.exit(1);
});

// シャットダウン処理
process.on('SIGINT', async () => {
    console.log('Shutting down HTTP MCP server...');
    process.exit(0);
});
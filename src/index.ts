#!/usr/bin/env node

import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {CallToolRequestSchema, ListToolsRequestSchema, Tool,} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs/promises';

class FileSystemMCPServer {
    private server: Server;

    constructor() {
        this.server = new Server(
            {
                name: 'filesystem-mcp-server',
                version: '1.0.0',
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        this.setupToolHandlers();
    }

    private setupToolHandlers() {
        // ツール一覧を返すハンドラー
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
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
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const {name, arguments: args} = request.params;

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
        const items = await fs.readdir(dirPath, {withFileTypes: true});
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

    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('Filesystem MCP Server running on stdio');
    }
}

const server = new FileSystemMCPServer();
server.run().catch(console.error);

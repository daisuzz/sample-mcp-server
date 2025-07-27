import { Tool } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs/promises';

/**
 * 共通のファイルシステムツール定義
 */
export const FILESYSTEM_TOOLS: Tool[] = [
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
];

/**
 * ファイルシステム操作の実装クラス
 */
export class FileSystemOperations {
    async readFile(filePath: string) {
        const content = await fs.readFile(filePath, 'utf-8');
        return {
            content: [
                {
                    type: 'text' as const,
                    text: content,
                },
            ],
        };
    }

    async writeFile(filePath: string, content: string) {
        await fs.writeFile(filePath, content, 'utf-8');
        return {
            content: [
                {
                    type: 'text' as const,
                    text: `Successfully wrote to ${filePath}`,
                },
            ],
        };
    }

    async listDirectory(dirPath: string) {
        const items = await fs.readdir(dirPath, { withFileTypes: true });
        const itemList = items.map(item => {
            const type = item.isDirectory() ? 'directory' : 'file';
            return `${type}: ${item.name}`;
        }).join('\n');

        return {
            content: [
                {
                    type: 'text' as const,
                    text: itemList || 'Directory is empty',
                },
            ],
        };
    }

    /**
     * ツール名から対応する操作を実行
     */
    async executeOperation(name: string, args: any) {
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
                        type: 'text' as const,
                        text: `Error: ${error instanceof Error ? error.message : String(error)}`,
                    },
                ],
                isError: true,
            };
        }
    }
}
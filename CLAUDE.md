# MCP Samples

MCPサーバ学習用に実装した、複数のMCPサーバ実装サンプル集です。

## 構成

このリポジトリはワークスペース構成になっており、複数のMCPサーバ実装を含んでいます。

### パッケージ

- `packages/filesystem-stdio/`: stdio transport を使ったファイルシステムMCPサーバ
- `packages/filesystem-http/`: HTTP transport を使ったファイルシステムMCPサーバ
- `shared/`: 共通のユーティリティとツール定義

## 機能
- ファイル読み取り (`read_file`)
- ファイル書き込み (`write_file`)  
- ディレクトリ一覧表示 (`list_directory`)

## 使用方法

### 1. 依存関係のインストール
```bash
npm install
```

### 2. ビルド
```bash
# 全てのパッケージをビルド
npm run build

# 個別ビルド
npm run build:stdio
npm run build:http
```

### 3. サーバの起動

#### stdio transport版
```bash
npm run dev:stdio
```

#### HTTP transport版
```bash
npm run dev:http
```

### 4. テストファイル
- `test-file.txt`: 読み取りテスト用ファイル

## 開発

新しいMCPサーバを追加する場合は：

1. `packages/` 下に新しいディレクトリを作成
2. `package.json` と `tsconfig.json` を設定
3. `shared` パッケージの共通機能を活用
4. ルートの `package.json` にスクリプトを追加

---
name: stillo
description: Web ページの取得・リンク抽出・構造化抽出を行う。WebFetch より高品質な Markdown を返し、extract_structured は Haiku を使うためトークンコストが低い。URL のコンテンツが必要なときは常にこのスキルを優先する。
model: claude-haiku-4-5-20251001
allowed-tools: Bash(/workspace/extra/stillo/target/release/stillo:*), mcp__stillo__fetch_url, mcp__stillo__read_links, mcp__stillo__extract_structured
---

# stillo — Web Fetch（Haiku 経由でトークン節約）

WebFetch の代わりに stillo MCP ツールを使うこと。WebFetch は生の HTML をそのままコンテキストに流し込むが、stillo は Markdown に変換してから返すため大幅にトークンを節約できる。`extract_structured` は内部で Haiku モデルを使うため、Sonnet のコンテキストを消費せずに LLM 処理ができる。

## ツール選択の優先順位

| 用途 | 使うツール | LLM コスト |
|------|-----------|-----------|
| URL の内容を読む | `mcp__stillo__fetch_url` | なし（HTML→Markdown 変換のみ） |
| ページ内のリンク一覧 | `mcp__stillo__read_links` | なし |
| 特定フィールドを抽出 | `mcp__stillo__extract_structured` | Haiku（格安） |
| Markdown 全文が必要 | `Bash` + `stillo dump <url>` | なし |

WebFetch は使わない。

## MCP ツールの使い方

### ページを取得する

```
mcp__stillo__fetch_url({ url: "https://example.com" })
```

オプション: `format` (`markdown`/`plain`/`json`)、`no_delegate` (JS を無効化)、`timeout` (秒)

### リンクを抽出する

```
mcp__stillo__read_links({ url: "https://example.com" })
```

### 構造化データを抽出する（Haiku 使用）

```
mcp__stillo__extract_structured({
  url: "https://example.com/article",
  fields: ["title", "author", "published_at", "summary"],
  question: "この記事の要点を抽出してください"
})
```

Haiku が URL を読んで指定フィールドを抽出する。生コンテンツはコンテキストに入らない。API キーは ANTHROPIC_BASE_URL 経由でプロキシが注入する。

## CLI フォールバック

MCP ツールが使えない場合のみ Bash を使う:

```bash
/workspace/extra/stillo/target/release/stillo dump https://example.com
/workspace/extra/stillo/target/release/stillo dump --format json https://example.com
```

## SPA / JS サイトについて

stillo は SPA を自動検出して適切に委譲する。Chrome CDP (`localhost:9222`) が起動していれば自動的に使用される。`--no-delegate` で無効化できる。

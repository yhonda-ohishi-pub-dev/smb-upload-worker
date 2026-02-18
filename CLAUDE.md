# smb-upload-worker

smb-watch からのファイルアップロードを中継する Cloudflare Worker。
cf-grpc-proxy (Service Binding) 経由で rust-logi (Cloud Run) に gRPC-Web でファイルを転送する。

## プロジェクト概要

| 項目 | 値 |
|---|---|
| ランタイム | Cloudflare Workers |
| 言語 | TypeScript |
| パッケージマネージャー | npm |
| ビルド/デプロイ | wrangler |

## エンドポイント

| パス | メソッド | 説明 |
|---|---|---|
| `/auth/login` | POST | ユーザー認証、JWT 取得 |
| `/upload` | POST | ファイルアップロード（JWT 必須） |

## Service Binding

| Binding 名 | 接続先 Worker |
|---|---|
| `GRPC_PROXY` | `cf-grpc-proxy` |

## 開発

```bash
npm install
npm run dev        # ローカル開発サーバー
npm run typecheck  # 型チェック
```

## デプロイ

```bash
npm run deploy     # wrangler deploy
```

## 依存パッケージ

- `@yhonda-ohishi-pub-dev/logi-proto` — proto 生成済み TypeScript (GitHub Packages)
- `@connectrpc/connect-web` — gRPC-Web トランスポート
- `@bufbuild/protobuf` — Protobuf ランタイム

## 制約事項

- worker-configuration.d.ts の直接変更は禁止
- `as any` 使用禁止

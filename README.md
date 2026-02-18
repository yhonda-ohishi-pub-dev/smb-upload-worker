# smb-upload-worker

smb-watch からのファイルアップロードを中継する Cloudflare Worker。
cf-grpc-proxy (Service Binding) 経由で rust-logi (Cloud Run) に gRPC-Web でファイルを転送する。

## アーキテクチャ

```
smb-watch ──► smb-upload-worker (Cloudflare Worker)
              ├─ POST /auth/login
              └─ POST /upload
                     │ Service Binding (GRPC_PROXY)
                     ▼
              cf-grpc-proxy (Cloudflare Worker)
                     │ gRPC-Web
                     ▼
              rust-logi (Cloud Run)
```

## エンドポイント

### POST /auth/login

JWT トークンを取得する。

```bash
curl -X POST https://smb-upload-worker.<account>.workers.dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "user", "password": "pass"}'
```

レスポンス:

```json
{ "token": "eyJ...", "expiresAt": "2026-02-19T00:00:00Z" }
```

### POST /upload

JWT 認証付きでファイルをアップロードする。

```bash
curl -X POST https://smb-upload-worker.<account>.workers.dev/upload \
  -H "Authorization: Bearer <JWT>" \
  -F "data=@file.pdf"
```

レスポンス:

```json
{ "uuid": "abc-123", "message": "Uploaded file.pdf" }
```

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

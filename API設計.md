# 子連れ向けスポット検索アプリ — API設計 v0.2（REST / JSON）
作成日: 2025-09-03 / 版: v0.2

本書は **要件定義 v0.2** と **DB設計 v0.2** を前提にした REST API 仕様です。  
- **Base URL**: `https://api.example.com/v1`（仮）  
- **Content-Type**: `application/json; charset=utf-8`  
- **Auth**: Bearer JWT（`Authorization: Bearer <token>`）  
- **時刻**: ISO 8601（UTC保管／応答はISO文字列）

---

## 0. 共通仕様
### 0.1 ページング（カーソル方式）
- クエリ: `limit`（最大50, 既定20）, `cursor`（次ページトークン）  
- レスポンス: `next_cursor`（次が無い場合 `null`）

```json
{ "items": [ /* ... */ ], "next_cursor": "eyJwYWdlIjoyfQ==" }
```

### 0.2 並び替え・検索・フィルタ
- `sort`: `distance` | `score` | `reviews` | `new`
- `q`: プレーンテキスト検索（名称/説明/住所）
- `category`: `park|indoor_kids|restaurant|...`
- `features[]`: 設備・サービスのコード配列（例：`features=nursing_room&features=diaper_table`）
- 位置: `lat`, `lng`, `radius_m`（最大30000）

### 0.3 エラー形式
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "lat is required",
    "details": {"field": "lat"},
    "trace_id": "req_01HV..."
  }
}
```
代表コード: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `RATE_LIMITED`, `CONFLICT`, `SERVER_ERROR`

### 0.4 共通ヘッダ
- `Accept-Language`: `ja-JP` 他
- `Idempotency-Key`: 冪等化キー（POST系に推奨）
- レート制限応答ヘッダ: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`

### 0.5 バージョニング
- パス版（`/v1`）。破壊的変更はメジャーを上げる。

---

## 1. 認証 / アカウント
> 外部Auth（Supabase/Cognito）でも同等の入出力でラップ可。

### 1.1 サインアップ
`POST /auth/signup`
```json
{ "email": "user@example.com", "password": "********", "nickname": "みやぎ" }
```
201 →
```json
{ "user": { "id": "uuid", "email": "user@example.com", "nickname": "みやぎ" } }
```

### 1.2 ログイン
`POST /auth/login`
```json
{ "email": "user@example.com", "password": "********" }
```
200 →
```json
{
  "access_token": "jwt",
  "refresh_token": "jwt",
  "user": { "id": "uuid", "email": "user@example.com", "nickname": "みやぎ", "role": "member" }
}
```

### 1.3 トークン更新 / ログアウト
- `POST /auth/refresh` `{ "refresh_token": "..." }`
- `POST /auth/logout`（サーバー側でリフレッシュトークン失効）

### 1.4 マイプロフィール
- `GET /me` / `PATCH /me`（`nickname`, `home_area`, `child_age_band_id` など）

---

## 2. マスタ（参照）
- `GET /categories`
- `GET /features`（設備・サービス）
- `GET /age-bands`

---

## 3. 施設（Places）
### 3.1 施設検索（距離・サービス・キーワード）
`GET /places`  
**Query**: `q`, `category`, `features[]`, `lat`, `lng`, `radius_m`, `sort`, `limit`, `cursor`  
**Response 200**
```json
{
  "items": [
    {
      "id": "uuid",
      "name": "中央公園",
      "category": { "code":"park", "label":"公園" },
      "location": { "lat": 35.68, "lng": 139.76, "distance_m": 420 },
      "features_summary": ["diaper_table","stroller_ok","kids_toilet"],
      "rating": { "overall": 4.3, "count": 52 },
      "thumbnail_url": "/media/p/xxx.jpg"
    }
  ],
  "next_cursor": null
}
```

### 3.2 施設詳細
`GET /places/{placeId}`
```json
{
  "id":"uuid",
  "name":"中央公園",
  "category": { "code":"park","label":"公園" },
  "address":"東京都...",
  "phone":"03-xxxx-xxxx",
  "website_url":"https://...",
  "opening_hours": { "mon":[["09:00","18:00"]], "tue": [] },
  "location": { "lat":35.68,"lng":139.76 },
  "features": [
    { "code":"nursing_room","label":"授乳室","value":1,"detail":"個室2・男性利用可" },
    { "code":"stroller_ok","label":"ベビーカーOK","value":1 }
  ],
  "rating": { "overall":4.2, "count":52, "axes": { "cleanliness":4.5, "diaper_table":4.3 } },
  "photos":[{"url":"/media/p1.jpg","width":1600,"height":1066}],
  "google": { "place_id": "ChIJ...", "source": "google", "synced_at":"2025-09-01T02:03:04Z" }
}
```

### 3.3（管理）施設のCRUD・サービス更新
- `POST /places`（ADMIN）
- `PATCH /places/{placeId}`（ADMIN/MODERATOR）※`manual_lock` を更新可能
- `DELETE /places/{placeId}`（ADMIN）
- `PUT /places/{placeId}/features`（ADMIN/MODERATOR; 一括置換）
```json
{ "features": [ { "code":"nursing_room","value":1,"detail":"個室2" }, { "code":"kids_toilet","value":1 } ] }
```

---

## 4. レビュー / コメント / 参考になった
### 4.1 レビュー一覧（施設別）
`GET /places/{placeId}/reviews?sort=new|helpful&limit=20&cursor=...`

### 4.2 レビュー投稿
`POST /reviews`（認証必須）
```json
{
  "place_id":"uuid",
  "overall":4,
  "age_band_id":"uuid",
  "stay_minutes":60,
  "revisit_intent":4,
  "text":"キッズトイレが助かる",
  "scores":[
    {"axis_code":"cleanliness","score":4},
    {"axis_code":"diaper_table","score":5}
  ],
  "photo_ids":["upload-uuid-1","upload-uuid-2"]
}
```
201 → 作成されたレビューを返却。  
冪等化：`Idempotency-Key` を使用。

### 4.3 レビュー編集/削除
- `PATCH /reviews/{reviewId}`（本人 or MOD/ADMIN）
- `DELETE /reviews/{reviewId}`（本人 or MOD/ADMIN）

### 4.4 参考になった（Like）
- `POST /reviews/{reviewId}/like` / `DELETE /reviews/{reviewId}/like`

### 4.5 コメント
- `GET /reviews/{reviewId}/comments`
- `POST /comments` `{ "review_id":"...", "text":"..." }`
- `PATCH /comments/{commentId}` / `DELETE /comments/{commentId}`

---

## 5. ブックマーク
- `GET /me/bookmarks?limit=20&cursor=...`
- `POST /bookmarks` `{ "place_id":"..." }`
- `DELETE /bookmarks/{placeId}`

---

## 6. 施設修正提案（Suggestions）
### 6.1 提案の作成（ユーザー）
`POST /place-suggestions`（認証必須）
```json
{
  "place_id": "uuid",
  "payload": {
    "address": "新住所...",
    "features": [
      {"code": "nursing_room", "value": 1, "detail": "新設"}
    ]
  }
}
```
201 → `{ "id":"sug-uuid", "status":"pending" }`

### 6.2 自分の提案一覧
`GET /me/place-suggestions?status=pending|approved|rejected&limit=20&cursor=...`

### 6.3（管理）提案の審査
- `GET /admin/place-suggestions?status=pending&limit=50`
- `PATCH /admin/place-suggestions/{suggestionId}`
```json
{ "action": "approve", "note": "現地確認OK" }  // or { "action":"reject", "note":"重複" }
```

---

## 7. Google連携（管理：取込＆同期ジョブ）
### 7.1 Place ID 指定で取り込み（キュー投入）
`POST /admin/places/import-by-place-id`
```json
{ "place_id": "ChIJxxxxxxxxxxxx" }
```
201 →
```json
{
  "job": {
    "id":"job-uuid",
    "status":"queued",
    "provider":"google",
    "provider_place_id":"ChIJxxxxxxxxxxxx"
  }
}
```

### 7.2 同期ジョブ一覧／詳細／再実行
- `GET /admin/sync-jobs?status=queued|running|succeeded|failed&place_id=...&limit=50&cursor=...`
- `GET /admin/sync-jobs/{jobId}`
- `PATCH /admin/sync-jobs/{jobId}` `{ "action":"requeue" | "cancel" }`

**レスポンス例（一覧）**
```json
{
  "items": [
    {
      "id":"job-uuid",
      "place_id":"uuid",
      "provider":"google",
      "provider_place_id":"ChIJ...",
      "status":"running",
      "scheduled_at":"2025-09-01T01:23:45Z",
      "started_at":"2025-09-01T01:24:00Z",
      "finished_at": null,
      "error_message": null
    }
  ],
  "next_cursor": null
}
```

### 7.3 取得元メタの参照
- `GET /admin/places/{placeId}/source-meta?limit=10`  
  → 最新の `raw_json` サマリ/`fetched_at`/`etag` を返却（`raw_json` は管理者のみフル取得可）。

---

## 8. 画像アップロード（ローカル保存）
> **multipart/form-data** で直接アップロードします。保存先はローカル（例：`/media/...`）。

### 8.1 アップロード
`POST /uploads`（認証必須、`multipart/form-data`）  
**Fields**:  
- `file`: 画像ファイル（jpg/png/webp）  
- `purpose`: `review_photo` | `place_photo`  

**Response 201**
```json
{
  "photo": {
    "id":"upload-uuid",
    "storage_path":"/media/reviews/2025/09/abc.jpg",
    "public_url":"/media/reviews/2025/09/abc.jpg",
    "width":1600,
    "height":1066,
    "mime_type":"image/jpeg"
  }
}
```

**cURL 例**
```bash
curl -X POST "https://api.example.com/v1/uploads" \
  -H "Authorization: Bearer $TOKEN" \
  -F "purpose=review_photo" \
  -F "file=@./photo.jpg"
```

---

## 9. スコアリング / 並び替え（仕様）
- **総合スコア（一覧）**: `距離(20%) + 子連れ軸スコア(50%) + レビュー件数補正(10%) + 新着補正(10%) + 写真有無(10%)`  
- 軸スコアは `review_axes.weight_default` を基に平均。年齢帯重みは将来拡張。  
- `distance` ソートは PostGIS KNN（`geog <-> user_point`）。

---

## 10. OpenAPI（抜粋：新規・管理系とアップロード）
```yaml
openapi: 3.1.0
info:
  title: Kids-friendly Places API
  version: "0.2.0"
servers:
  - url: https://api.example.com/v1
paths:
  /admin/places/import-by-place-id:
    post:
      summary: Google Place ID で取込ジョブを作成
      security: [{ bearerAuth: [] }]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                place_id: { type: string }
              required: [place_id]
      responses:
        "201": { description: Job queued }
  /admin/sync-jobs:
    get:
      summary: 同期ジョブ一覧
      security: [{ bearerAuth: [] }]
      parameters:
        - in: query; name: status; schema: { type: string, enum: [queued,running,succeeded,failed] }
        - in: query; name: place_id; schema: { type: string, format: uuid }
        - in: query; name: limit; schema: { type: integer, maximum: 50, default: 20 }
        - in: query; name: cursor; schema: { type: string }
      responses:
        "200": { description: OK }
  /uploads:
    post:
      summary: 画像をローカル保存にアップロード（multipart/form-data）
      security: [{ bearerAuth: [] }]
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                purpose: { type: string, enum: [review_photo, place_photo] }
                file: { type: string, format: binary }
              required: [purpose, file]
      responses:
        "201": { description: Created }
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```
---

## 11. ステータスコード / セキュリティ
- 2xx: `200 OK`, `201 Created`, `204 No Content`
- 4xx: `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `409 Conflict`, `422 Unprocessable Entity`, `429 Too Many Requests`
- 5xx: `500 Internal Server Error`
- 既定レート制限例: 全体 **60 req/min/トークン**, 検索系 **30 req/min**

---

## 12. 実装メモ（DRF想定）
- ViewSet + Router。`/admin/*` は `IsAdminUser | IsModerator`。  
- 検索は `search_vector` + `plainto_tsquery('simple', q)`、位置は `geog <->` KNN。  
- `place_stats` はビュー/マテビューまたは定期バッチ更新で JOIN 取得。  
- 画像は`MEDIA_ROOT`配下に保存し、`/media/*` を静的配信。EXIF除去/自動リサイズを実装。

---

以上。

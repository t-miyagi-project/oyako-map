// APIクライアント（ブラウザ側から呼び出す）
// - GET /api/places を呼び出して距離順の施設一覧を取得する
//   ※現時点のサーバーは sort=distance のみ対応のため、並び替え（総合/件数/新着）はフロント側でローカルソートする
// - エラー時は例外を投げる（呼び出し元でトースト/メッセージを表示）

export type PlaceListItem = {
  id: string
  name: string
  category: { code: string; label: string }
  location: { lat: number | null; lng: number | null; distance_m: number }
  features_summary: string[]
  rating: { overall: number | null; count: number }
  thumbnail_url: string | null
  // 将来の新着ソート用に created_at をオプションで保持（現状のAPIレスポンスには未含有）
  created_at?: string | null
}

// features マスタの型
export type FeatureMasterItem = {
  code: string
  label: string
  category?: string | null
  description?: string | null
}

// カテゴリマスタの型（トップ画面のクイックフィルタで使用）
export type CategoryMasterItem = {
  code: string
  label: string
  sort: number
}

// 年齢帯マスタの型（レビュー投稿フォームの選択肢で使用）
export type AgeBandMasterItem = {
  code: string
  label: string
  sort: number
}

export type FetchPlacesParams = {
  lat: number
  lng: number
  radius_m?: number
  limit?: number
  cursor?: string | null
  q?: string
  category?: string
  // 設備・サービスのコード配列（API設計: features[]=nursing_room&features=diaper_table ...）
  features?: string[]
  // 並び替え（API仕様に準拠）: distance | score | reviews | new
  sort?: "distance" | "score" | "reviews" | "new"
}

// 施設一覧取得（AbortSignal対応のため options を許容）
export async function fetchPlaces(
  params: FetchPlacesParams,
  options?: { signal?: AbortSignal }
): Promise<{ items: PlaceListItem[]; next_cursor: string | null }> {
  // ベースURL（.env の NEXT_PUBLIC_API_BASE_URL から取得）
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || ""
  const u = new URL("/api/places", base)

  // クエリパラメータを付与
  u.searchParams.set("lat", String(params.lat))
  u.searchParams.set("lng", String(params.lng))
  if (params.radius_m) u.searchParams.set("radius_m", String(params.radius_m))
  if (params.limit) u.searchParams.set("limit", String(params.limit))
  if (params.cursor) u.searchParams.set("cursor", params.cursor)
  if (params.q && params.q.trim()) u.searchParams.set("q", params.q.trim())
  if (params.category) u.searchParams.set("category", params.category)
  if (params.features && params.features.length > 0) {
    // features[] 形式で複数付与（例: features=nursing_room&features=diaper_table）
    for (const code of params.features) {
      u.searchParams.append("features", code)
    }
  }
  // 並び替え（未指定時は distance）
  u.searchParams.set("sort", params.sort ?? "distance")

  // API呼び出し
  const res = await fetch(u.toString(), {
    method: "GET",
    headers: {
      "Accept": "application/json",
    },
    credentials: "include", // 将来の認証を見据えCookie送信を許可
    signal: options?.signal,
  })

  // ステータス確認
  if (!res.ok) {
    // エラー形式（API設計の error オブジェクト）を考慮
    let message = `HTTP ${res.status}`
    try {
      const data = await res.json()
      if (data?.error?.message) message = data.error.message
    } catch {
      // JSONでない場合は既定のメッセージ
    }
    throw new Error(message)
  }

  // 正常時のデータを返却
  return (await res.json()) as { items: PlaceListItem[]; next_cursor: string | null }
}

// 施設詳細の型（GET /api/places/{id}）
export type PlaceDetail = {
  id: string
  name: string
  category: { code: string; label: string }
  description: string | null
  address: string | null
  phone: string | null
  website_url: string | null
  opening_hours: any | null
  location: { lat: number | null; lng: number | null }
  features: { code: string; label: string; value: number | null; detail?: string | null }[]
  rating: { overall: number | null; count: number; axes: Record<string, number> }
  photos: { url: string; width?: number | null; height?: number | null; blurhash?: string | null }[]
  google: { place_id: string; source: string; synced_at: string | null } | null
  data_source: string
  created_at: string
  updated_at: string
}

// 施設詳細を取得する（エラー時は共通メッセージ化）
export async function fetchPlaceDetail(placeId: string): Promise<PlaceDetail> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || ""
  const u = new URL(`/api/places/${encodeURIComponent(placeId)}`, base)
  const res = await fetch(u.toString(), { method: "GET", headers: { Accept: "application/json" } })
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const data = await res.json()
      if (data?.error?.message) message = data.error.message
    } catch {}
    throw new Error(message)
  }
  return (await res.json()) as PlaceDetail
}

// features マスタを取得する（UIのフィルタドロワーで使用）
export async function fetchFeaturesMaster(): Promise<{ items: FeatureMasterItem[] }> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || ""
  const u = new URL("/api/features", base)
  const res = await fetch(u.toString(), { method: "GET", headers: { Accept: "application/json" } })
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const data = await res.json()
      if (data?.error?.message) message = data.error.message
    } catch {}
    throw new Error(message)
  }
  return (await res.json()) as { items: FeatureMasterItem[] }
}

// カテゴリ一覧を取得する（クイックフィルタのボタン生成に利用）
export async function fetchCategoriesMaster(): Promise<{ items: CategoryMasterItem[] }> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || ""
  const u = new URL("/api/categories", base)
  const res = await fetch(u.toString(), { method: "GET", headers: { Accept: "application/json" } })
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const data = await res.json()
      if (data?.error?.message) message = data.error.message
    } catch {}
    throw new Error(message)
  }
  return (await res.json()) as { items: CategoryMasterItem[] }
}

// 年齢帯一覧を取得する（レビュー投稿時のセレクトに使用）
export async function fetchAgeBandsMaster(): Promise<{ items: AgeBandMasterItem[] }> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || ""
  const u = new URL("/api/age-bands", base)
  const res = await fetch(u.toString(), { method: "GET", headers: { Accept: "application/json" } })
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const data = await res.json()
      if (data?.error?.message) message = data.error.message
    } catch {}
    throw new Error(message)
  }
  return (await res.json()) as { items: AgeBandMasterItem[] }
}

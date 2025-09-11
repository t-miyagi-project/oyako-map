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

export async function fetchPlaces(params: FetchPlacesParams): Promise<{ items: PlaceListItem[]; next_cursor: string | null }> {
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

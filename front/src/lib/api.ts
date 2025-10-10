// APIクライアント（ブラウザ側から呼び出す）
// - GET /api/places を呼び出して距離順の施設一覧を取得する
//   ※現時点のサーバーは sort=distance のみ対応のため、並び替え（総合/件数/新着）はフロント側でローカルソートする
// - エラー時は例外を投げる（呼び出し元でトースト/メッセージを表示）

import { authFetch, clearTokens, getAccessToken, getRefreshToken, setTokens } from "@/lib/auth"

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
  id: string
  code: string
  label: string
  sort: number
}

export type ChildAgeBand = {
  id: string
  code: string
  label: string
  sort: number
}

export type CurrentUser = {
  id: string
  email: string
  role: string
  nickname: string | null
  home_area: string | null
  child_age_band: ChildAgeBand | null
}

export type UploadedPhoto = {
  id: string
  storage_path: string
  public_url: string
  width: number | null
  height: number | null
  mime_type: string | null
}

export type PlaceReview = {
  id: string
  overall: number
  text: string
  stay_minutes: number | null
  revisit_intent: number | null
  created_at: string
  age_band: string | null
  axes: Record<string, number>
  user: {
    id: string
    nickname: string
    child_age_band: string | null
  }
  photos: {
    id: string
    url: string
    width: number | null
    height: number | null
    mime_type: string | null
  }[]
}

type AuthResponse = {
  user: CurrentUser
  access_token: string
  refresh_token: string
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
  const res = await authFetch(u.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
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
  const res = await authFetch(u.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
  })
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
  const res = await authFetch(u.toString(), { method: "GET", headers: { Accept: "application/json" } })
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
  const res = await authFetch(u.toString(), { method: "GET", headers: { Accept: "application/json" } })
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
  const res = await authFetch(u.toString(), { method: "GET", headers: { Accept: "application/json" } })
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

function extractErrorMessage(res: Response, fallback?: string) {
  return res
    .json()
    .then((data: any) => data?.error?.message ?? fallback ?? `HTTP ${res.status}`)
    .catch(() => fallback ?? `HTTP ${res.status}`)
}

async function handleAuthResponse(res: Response): Promise<AuthResponse> {
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, "認証に失敗しました"))
  }
  return (await res.json()) as AuthResponse
}

export async function signup(params: {
  email: string
  password: string
  nickname?: string
  home_area?: string
  child_age_band_id?: string | null
}): Promise<CurrentUser> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || ""
  const res = await fetch(new URL("/api/auth/signup", base), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      email: params.email,
      password: params.password,
      nickname: params.nickname,
      home_area: params.home_area,
      child_age_band_id: params.child_age_band_id,
    }),
  })
  const data = await handleAuthResponse(res)
  setTokens(data.access_token, data.refresh_token)
  return data.user
}

export async function login(params: { email: string; password: string }): Promise<CurrentUser> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || ""
  const res = await fetch(new URL("/api/auth/login", base), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(params),
  })
  const data = await handleAuthResponse(res)
  setTokens(data.access_token, data.refresh_token)
  return data.user
}

export async function logout(): Promise<void> {
  const refresh = getRefreshToken()
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || ""
  if (refresh) {
    await fetch(new URL("/api/auth/logout", base), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    }).catch(() => undefined)
  }
  clearTokens()
}

export async function getMyProfile(): Promise<CurrentUser | null> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || ""
  const res = await authFetch(new URL("/api/me", base).toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
  })
  if (res.status === 401) {
    clearTokens()
    return null
  }
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, "プロフィール取得に失敗しました"))
  }
  const data = (await res.json()) as { user: CurrentUser }
  return data.user
}

export async function updateMyProfile(params: {
  nickname?: string
  home_area?: string
  child_age_band_id?: string | null
}): Promise<CurrentUser> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || ""
  const res = await authFetch(new URL("/api/me", base).toString(), {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(params),
  })
  if (res.status === 401) {
    clearTokens()
    throw new Error("ログインが必要です")
  }
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, "プロフィール更新に失敗しました"))
  }
  const data = (await res.json()) as { user: CurrentUser }
  return data.user
}

export async function createReview(params: {
  place_id: string
  overall: number
  age_band_id?: string | null
  stay_minutes?: number | null
  revisit_intent?: number | null
  text: string
  axes: { code: string; score: number }[]
  photo_ids?: string[]
}): Promise<{ review_id: string }> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || ""
  const res = await authFetch(new URL("/api/reviews", base).toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(params),
  })
  if (res.status === 401) {
    clearTokens()
    throw new Error("ログインが必要です")
  }
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, "レビュー投稿に失敗しました"))
  }
  return (await res.json()) as { review_id: string }
}

export async function uploadPhoto(params: {
  file: File
  purpose: "review_photo" | "place_photo"
  place_id?: string
}): Promise<UploadedPhoto> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || ""
  const form = new FormData()
  form.append("purpose", params.purpose)
  form.append("file", params.file)
  if (params.place_id) {
    form.append("place_id", params.place_id)
  }

  const res = await authFetch(new URL("/api/uploads", base).toString(), {
    method: "POST",
    body: form,
  })
  if (res.status === 401) {
    clearTokens()
    throw new Error("ログインが必要です")
  }
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, "画像のアップロードに失敗しました"))
  }
  const data = (await res.json()) as { photo: UploadedPhoto }
  return data.photo
}

export async function fetchPlaceReviews(params: {
  placeId: string
  limit?: number
  cursor?: string | null
  sort?: "new" | "rating"
  has_photo?: boolean
}): Promise<{ items: PlaceReview[]; next_cursor: string | null }> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || ""
  const u = new URL(`/api/places/${params.placeId}/reviews`, base)
  if (params.limit) u.searchParams.set("limit", String(params.limit))
  if (params.cursor) u.searchParams.set("cursor", params.cursor)
  if (params.sort) u.searchParams.set("sort", params.sort)
  if (params.has_photo) u.searchParams.set("has_photo", "1")

  const res = await fetch(u.toString(), { method: "GET", headers: { Accept: "application/json" } })
  if (!res.ok) {
    throw new Error(await extractErrorMessage(res, "レビューの取得に失敗しました"))
  }
  return (await res.json()) as { items: PlaceReview[]; next_cursor: string | null }
}

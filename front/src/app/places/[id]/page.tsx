"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { fetchPlaceDetail, type PlaceDetail } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// 施設詳細ページ
// - ルート: /places/[id]
// - 初回に API から詳細を取得し、名称/カテゴリ/住所/サービス/評価/写真/取得元メタを表示する
export default function PlaceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<PlaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 詳細データを読み込む
    const id = params?.id;
    if (!id) return;
    setLoading(true);
    setError(null);
    fetchPlaceDetail(String(id))
      .then((res) => setData(res))
      .catch((e: any) => setError(e?.message ?? "読み込みに失敗しました"))
      .finally(() => setLoading(false));
  }, [params?.id]);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Button variant="outline" onClick={() => router.back()}>戻る</Button>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">トップへ</Link>
      </div>

      {loading && <div className="text-sm text-neutral-500">読み込み中...</div>}
      {error && !loading && (
        <div className="text-sm text-red-600">読み込みに失敗しました: {error}</div>
      )}
      {!loading && !error && data && (
        <div className="space-y-4">
          {/* タイトル + カテゴリ */}
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="text-xl font-semibold">{data.name}</h1>
            <span className="text-sm text-neutral-500">{data.category.label}</span>
          </div>

          {/* 基本情報 */}
          <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
            {data.address && <div><span className="text-neutral-500">住所:</span> {data.address}</div>}
            {data.phone && <div><span className="text-neutral-500">電話:</span> {data.phone}</div>}
            {data.website_url && (
              <div>
                <span className="text-neutral-500">サイト:</span> <a className="text-blue-600 hover:underline" href={data.website_url} target="_blank" rel="noreferrer">{data.website_url}</a>
              </div>
            )}
            {data.location?.lat != null && data.location?.lng != null && (
              <div><span className="text-neutral-500">座標:</span> {data.location.lat}, {data.location.lng}</div>
            )}
          </div>

          {/* サービス（features） */}
          {data.features?.length > 0 && (
            <div>
              <div className="mb-2 text-sm text-neutral-500">設備・サービス</div>
              <div className="flex flex-wrap gap-2">
                {data.features.map((f) => (
                  <Badge key={f.code} variant="secondary" title={f.detail || undefined}>
                    {f.label}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* 評価 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <StarRating score={data.rating.overall ?? 0} />
              <span className="text-sm text-neutral-700">{data.rating.overall != null ? data.rating.overall.toFixed(1) : "-"}</span>
            </div>
            <div className="text-sm text-neutral-500">レビュー {data.rating.count}件</div>
          </div>

          {/* 写真ギャラリー */}
          {data.photos && data.photos.length > 0 && (
            <div>
              <div className="mb-2 text-sm text-neutral-500">写真</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {data.photos.map((p, i) => (
                  <img key={i} src={p.url} alt="photo" className="h-32 w-full rounded object-cover" />
                ))}
              </div>
            </div>
          )}

          {/* 取得元メタ（Google） */}
          {data.google && (
            <div className="text-xs text-neutral-500">
              取得元: Google（place_id: {data.google.place_id}）{data.google.synced_at ? ` / 取得日時: ${data.google.synced_at}` : ""}
              {data.google.place_id && (
                <>
                  {" "}|{" "}
                  <a className="text-blue-600 hover:underline" href={`https://www.google.com/maps/place/?q=place_id:${data.google.place_id}`} target="_blank" rel="noreferrer">
                    Googleマップで開く
                  </a>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}

// 簡易の★表示（平均★が null の場合は 0 として描画）
function StarRating({ score }: { score: number }) {
  const full = Math.floor(score)
  const half = score - full >= 0.5 ? 1 : 0
  const empty = 5 - full - half
  return (
    <div className="flex items-center text-yellow-500">
      {Array.from({ length: full }).map((_, i) => (
        <span key={`f-${i}`}>★</span>
      ))}
      {half === 1 && <span>☆</span>}
      {Array.from({ length: empty }).map((_, i) => (
        <span key={`e-${i}`} className="text-neutral-300">★</span>
      ))}
    </div>
  )
}


"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { fetchPlaceDetail, type PlaceDetail } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DAY_LABELS: Record<(typeof DAY_ORDER)[number], string> = {
  mon: "月曜",
  tue: "火曜",
  wed: "水曜",
  thu: "木曜",
  fri: "金曜",
  sat: "土曜",
  sun: "日曜",
};

const FALLBACK_PHOTOS: PlaceDetail["photos"] = [
  { url: "/noimage.svg", width: null, height: null, blurhash: null },
];

const JS_DAY_TO_KEY = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

// 営業時間のスロットを "09:00〜18:00" の形式へ整形する
function formatSpanList(slots: unknown): string {
  if (!Array.isArray(slots)) return "";
  return (slots as string[][])
    .filter((span) => Array.isArray(span) && span.length === 2)
    .map((span) => `${span[0]}〜${span[1]}`)
    .join(" / ");
}

// 営業時間を画面表示用のテキスト配列へ変換する
function formatOpeningHours(opening: PlaceDetail["opening_hours"]): { day: string; text: string }[] {
  if (!opening) return [];
  return DAY_ORDER.map((key) => {
    const slots = Array.isArray((opening as Record<string, unknown>)[key])
      ? ((opening as Record<string, string[][]>)[key] ?? [])
      : [];
    const text =
      slots.length > 0 ? formatSpanList(slots) : "休業";
    return { day: DAY_LABELS[key], text: text || "時間情報なし" };
  });
}

// 本日の営業時間を「本日 09:00〜18:00」の形式で返す（情報が無ければ null）
function formatTodayHours(opening: PlaceDetail["opening_hours"]): string | null {
  if (!opening) return null;
  const todayKey = JS_DAY_TO_KEY[new Date().getDay()];
  const label = DAY_LABELS[todayKey as (typeof DAY_ORDER)[number]];
  const slots = (opening as Record<string, unknown>)[todayKey];
  const text = formatSpanList(slots);
  if (!text) return `${label}：休業`;
  return `本日(${label}) ${text}`;
}

// 施設詳細ページ
// - ルート: /places/[id]
// - 初回に API から詳細を取得し、名称/カテゴリ/住所/サービス/評価/写真/取得元メタを表示する
export default function PlaceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<PlaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  // 表示用に事前計算した配列やURL（dataがnullの間は空として扱う）
  const openingRows = data ? formatOpeningHours(data.opening_hours) : [];
  const todayHours = data ? formatTodayHours(data.opening_hours) : null;
  const photos = data && data.photos && data.photos.length > 0 ? data.photos : FALLBACK_PHOTOS;
  const heroImage = photos[0]?.url ?? "/noimage.svg";
  const galleryPhotos = photos;
  const hasOriginalPhotos = Boolean(data?.photos?.length);
  const ratingAxesEntries = data?.rating?.axes ? Object.entries(data.rating.axes) : [];
  const basicInfoLine =
    data
      ? [
          data.address ? `住所：${data.address}` : null,
          todayHours,
          data.phone ? `電話：${data.phone}` : null,
        ].filter(Boolean).join("　|　")
      : "";
  const primaryFeatures = data?.features ? data.features.slice(0, 6) : [];
  const allFeatures = data?.features ?? [];
  const googleDirectionsUrl =
    data?.location?.lat != null && data.location?.lng != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${data.location.lat},${data.location.lng}`
      : null;
  const googlePlaceLink = data?.google?.place_id
    ? `https://www.google.com/maps/place/?q=place_id:${data.google.place_id}`
    : null;

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
        <div className="space-y-8">
          <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
            <div className="relative aspect-[16/9] w-full bg-neutral-100">
              <img src={heroImage} alt={`${data.name}の写真`} className="h-full w-full object-cover" />
              {!hasOriginalPhotos && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-sm font-medium text-neutral-500">
                  <span>Noimage</span>
                  <span className="text-xs text-neutral-400">写真が登録されていません</span>
                </div>
              )}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent" />
            </div>
            <div className="space-y-4 p-5 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{data.category.label}</Badge>
                    <span className="text-xs text-neutral-400">ID: {params?.id}</span>
                  </div>
                  <h1 className="text-2xl font-semibold text-neutral-900">{data.name}</h1>
                </div>
                <div className="text-right">
                  <div className="flex items-center justify-end gap-2 text-lg font-semibold text-neutral-900">
                    <StarRating score={data.rating.overall ?? 0} />
                    <span>{data.rating.overall != null ? data.rating.overall.toFixed(1) : "-"}</span>
                  </div>
                  <div className="text-xs text-neutral-500">レビュー {data.rating.count}件</div>
                </div>
              </div>
              {basicInfoLine && (
                <div className="rounded-md bg-neutral-50 px-3 py-2 text-sm leading-relaxed text-neutral-600">
                  {basicInfoLine}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {googleDirectionsUrl && (
                  <Button asChild size="sm">
                    <a href={googleDirectionsUrl} target="_blank" rel="noreferrer">
                      ルート案内
                    </a>
                  </Button>
                )}
                {data.website_url && (
                  <Button asChild variant="outline" size="sm">
                    <a href={data.website_url} target="_blank" rel="noreferrer">
                      公式サイト
                    </a>
                  </Button>
                )}
                {googlePlaceLink && (
                  <Button asChild variant="ghost" size="sm">
                    <a href={googlePlaceLink} target="_blank" rel="noreferrer">
                      Googleマップで確認
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-neutral-900">設備・サービス</h2>
            {allFeatures.length > 0 ? (
              <>
                <div className="mt-3 flex flex-wrap gap-2">
                  {allFeatures.map((f) => (
                    <Badge key={`all-${f.code}`} variant="outline">
                      {f.label}
                    </Badge>
                  ))}
                </div>
                {allFeatures.some((f) => f.detail) && (
                  <ul className="mt-3 space-y-1 text-sm text-neutral-600">
                    {allFeatures
                      .filter((f) => f.detail)
                      .map((f) => (
                        <li key={`${f.code}-detail`}>{f.label}：{f.detail}</li>
                      ))}
                  </ul>
                )}
              </>
            ) : (
              <div className="mt-3 text-sm text-neutral-500">設備・サービス情報は準備中です。</div>
            )}
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-neutral-900">基本情報</h2>
              <Button variant="outline" size="sm" onClick={() => setDetailsOpen((prev) => !prev)}>
                {detailsOpen ? "閉じる ▲" : "さらに詳しく ▼"}
              </Button>
            </div>
            {!detailsOpen && (
              <p className="mt-2 text-sm text-neutral-600">
                住所や営業時間、取得元メタ情報などを確認できます。
              </p>
            )}
            {detailsOpen && (
              <div className="mt-4 space-y-4">
                <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                  {data.address && (
                    <div>
                      <dt className="text-neutral-500">住所</dt>
                      <dd className="mt-1 text-neutral-800">{data.address}</dd>
                    </div>
                  )}
                  {data.phone && (
                    <div>
                      <dt className="text-neutral-500">電話番号</dt>
                      <dd className="mt-1">
                        <a className="text-blue-600 hover:underline" href={`tel:${data.phone}`}>
                          {data.phone}
                        </a>
                      </dd>
                    </div>
                  )}
                  {data.website_url && (
                    <div>
                      <dt className="text-neutral-500">公式サイト</dt>
                      <dd className="mt-1">
                        <a className="text-blue-600 hover:underline" href={data.website_url} target="_blank" rel="noreferrer">
                          {data.website_url}
                        </a>
                      </dd>
                    </div>
                  )}
                  {data.location?.lat != null && data.location?.lng != null && (
                    <div>
                      <dt className="text-neutral-500">緯度・経度</dt>
                      <dd className="mt-1 text-neutral-800">
                        {data.location.lat}, {data.location.lng}
                      </dd>
                    </div>
                  )}
                  {data.data_source && (
                    <div>
                      <dt className="text-neutral-500">データソース</dt>
                      <dd className="mt-1 text-neutral-800">{data.data_source}</dd>
                    </div>
                  )}
                  {data.created_at && (
                    <div>
                      <dt className="text-neutral-500">登録日時</dt>
                      <dd className="mt-1 text-neutral-800">{data.created_at}</dd>
                    </div>
                  )}
                  {data.updated_at && (
                    <div>
                      <dt className="text-neutral-500">最終更新</dt>
                      <dd className="mt-1 text-neutral-800">{data.updated_at}</dd>
                    </div>
                  )}
                </dl>
                {openingRows.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-800">営業時間</h3>
                    <div className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                      {openingRows.map((row) => (
                        <div key={row.day} className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
                          <span className="font-medium text-neutral-700">{row.day}</span>
                          <span className="text-neutral-600">{row.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {data.description && (
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-800">注意事項・メモ</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">{data.description}</p>
                  </div>
                )}
                {data.google && (
                  <div className="space-y-1 text-xs text-neutral-600">
                    <div>Place ID: {data.google.place_id}</div>
                    {data.google.synced_at && <div>最終同期: {data.google.synced_at}</div>}
                    {googlePlaceLink && (
                      <a className="text-blue-600 hover:underline" href={googlePlaceLink} target="_blank" rel="noreferrer">
                        Googleマップで詳細を確認
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-neutral-900">フォトギャラリー</h2>
              <span className="text-xs text-neutral-400">
                {hasOriginalPhotos ? `${galleryPhotos.length}枚` : "Noimage"}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {galleryPhotos.map((p, i) => (
                <div key={`photo-${i}`} className="relative h-32 w-full overflow-hidden rounded-md bg-neutral-100">
                  <img src={p.url} alt={`${data.name}の写真 ${i + 1}`} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-neutral-900">レビュー</h2>
              <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                <span>並び替え:</span>
                <span className="rounded-full border border-neutral-300 px-3 py-1">新着</span>
                <span className="rounded-full border border-neutral-300 px-3 py-1">役に立った</span>
                <span className="rounded-full border border-neutral-300 px-3 py-1">写真あり</span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-lg font-semibold text-neutral-900">
                <StarRating score={data.rating.overall ?? 0} />
                <span>{data.rating.overall != null ? data.rating.overall.toFixed(1) : "-"}</span>
              </div>
              <div className="text-sm text-neutral-500">総レビュー数 {data.rating.count}件</div>
              <Button asChild size="sm" className="ml-auto">
                <Link href={`/places/${params?.id}/review`}>レビューを投稿する</Link>
              </Button>
            </div>
            {ratingAxesEntries.length > 0 ? (
              <dl className="mt-4 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                {ratingAxesEntries.map(([axis, score]) => (
                  <div
                    key={axis}
                    className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2"
                  >
                    <span className="text-neutral-600">{axis.replace(/_/g, " ")}</span>
                    <span className="font-medium text-neutral-800">{score.toFixed(1)}</span>
                  </div>
                ))}
              </dl>
            ) : (
              <div className="mt-4 text-sm text-neutral-500">
                レビューはまだ登録されていません。公開準備中です。
              </div>
            )}
          </section>
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

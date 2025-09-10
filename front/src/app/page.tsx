"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchPlaces, type PlaceListItem } from "@/lib/api";

// クイックフィルタ（UI表示用）
const QUICK_FILTERS = [
  { key: "nursing_room", label: "授乳室" },
  { key: "diaper_table", label: "おむつ台" },
  { key: "kids_toilet", label: "キッズトイレ" },
  { key: "stroller_ok", label: "ベビーカーOK" },
] as const;

export default function Page() {
  // 検索語（q）
  const [query, setQuery] = useState("");
  // クイックフィルタのON/OFF状態
  const [filters, setFilters] = useState<Record<string, boolean>>({});
  // 現在地（T-007で本実装予定。ここではデフォルト座標を設定）
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: 35.6812, lng: 139.7671 }); // 東京駅付近を既定
  // 読み込み/エラー状態
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // APIからの一覧データ
  const [items, setItems] = useState<PlaceListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // 検索トリガ（ボタン押下でインクリメントし、useEffect依存に含める）
  const [searchVersion, setSearchVersion] = useState(0);
  const incrementSearch = () => setSearchVersion((v) => v + 1);

  // クイックフィルタのトグル
  const toggleFilter = (key: string) => setFilters((prev) => ({ ...prev, [key]: !prev[key] }));

  // APIから一覧取得
  const load = useCallback(
    async (cursor: string | null = null) => {
      setLoading(true);
      setError(null);
      try {
        // API呼び出し（距離順）
        const res = await fetchPlaces({ lat: coords.lat, lng: coords.lng, radius_m: 3000, limit: 20, cursor, q: query });
        if (!cursor) {
          // 先頭ページ。既存を置き換える
          setItems(res.items);
        } else {
          // 追加ページ。末尾に連結
          setItems((prev) => [...prev, ...res.items]);
        }
        setNextCursor(res.next_cursor);
      } catch (e: any) {
        setError(e?.message ?? "エラーが発生しました");
      } finally {
        setLoading(false);
      }
    },
    [coords.lat, coords.lng, query]
  );

  // 初回と検索トリガ/座標変更時に読み込み
  useEffect(() => {
    void load(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords.lat, coords.lng, searchVersion]);

  // クイックフィルタはクライアント側で features_summary に基づいて絞り込み
  const filtered = useMemo(() => {
    const active = Object.entries(filters)
      .filter(([, v]) => v)
      .map(([k]) => k)
    if (active.length === 0) return items
    return items.filter((it) => active.every((code) => it.features_summary?.includes(code)))
  }, [items, filters])

  // 現在地を取得して coords を更新（T-007で強化予定）
  const requestGeolocation = () => {
    if (!("geolocation" in navigator)) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // 取得成功時：座標を更新し、自動で再検索が走る
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => {
        // エラー時：何もしない（簡易運用）。UI上の現在地は既定値のまま
      }
    )
  }

  return (
    <main className="min-h-[100dvh]">
      {/* ヘッダー（検索バー + クイックフィルタ） */}
      <header className="sticky top-0 z-10 border-b bg-[color:var(--background)]/80 backdrop-blur">
        <div className="mx-auto w-full max-w-7xl px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="font-semibold">Oyako Map</div>
            <div className="hidden text-xs text-neutral-500 sm:block">子連れ向けスポット検索</div>
          </div>
          <div className="mt-3 flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="スポット名・カテゴリを検索"
              className="flex-1"
            />
            <Button onClick={() => incrementSearch()}>検索</Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {QUICK_FILTERS.map(({ key, label }) => {
              const active = !!filters[key]
              return (
                <Button key={key} variant={active ? "default" : "outline"} size="sm" onClick={() => toggleFilter(key)}>
                  {label}
                </Button>
              )
            })}
            <div className="ml-auto text-xs text-neutral-500">中心: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</div>
          </div>
        </div>
      </header>

      {/* メイン（地図 + 一覧） */}
      <section className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 px-4 py-4 md:grid-cols-12">
        {/* 地図（プレースホルダ） */}
        <div className="md:col-span-7 lg:col-span-8">
          <div className="relative h-[48vh] w-full overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
            {/* 地図は後続でGoogle Maps連携 */}
            <div className="pointer-events-none absolute inset-0 select-none bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.06),transparent_60%)]" />
            <div className="absolute left-3 top-3">
              <Badge variant="outline">地図</Badge>
            </div>
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
              <div className="text-xs text-neutral-500">現在地中心・ピン表示（後続実装）</div>
              <Button size="sm" variant="secondary" onClick={requestGeolocation}>
                現在地取得
              </Button>
            </div>
          </div>
        </div>

        {/* 一覧 */}
        <div className="md:col-span-5 lg:col-span-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm text-neutral-500">近い順に{filtered.length}件表示</div>
            <Button variant="outline" size="sm">並び替え: 距離</Button>
          </div>

          {/* ローディング/エラー表示 */}
          {loading && <div className="p-4 text-sm text-neutral-500">読み込み中...</div>}
          {error && !loading && (
            <div className="p-4 text-sm text-red-600">読み込みに失敗しました: {error}</div>
          )}

          <div className="flex flex-col gap-3">
            {filtered.map((f) => (
              <Card key={f.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <CardTitle>{f.name}</CardTitle>
                    <div className="text-sm text-neutral-500">{(f.location.distance_m / 1000).toFixed(2)}km</div>
                  </div>
                  <div className="text-xs text-neutral-500">{f.category.label}</div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="mb-2 flex items-center gap-2">
                    <StarRating score={f.rating.overall ?? 0} />
                    <span className="text-sm text-neutral-600">{(f.rating.overall ?? 0).toFixed(1)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {f.features_summary.includes("nursing_room") && <Badge variant="secondary">授乳室</Badge>}
                    {f.features_summary.includes("diaper_table") && <Badge variant="secondary">おむつ台</Badge>}
                    {f.features_summary.includes("kids_toilet") && <Badge variant="secondary">キッズトイレ</Badge>}
                    {f.features_summary.includes("stroller_ok") && <Badge variant="secondary">ベビーカーOK</Badge>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* もっと見る（ページング） */}
          {nextCursor && !loading && (
            <div className="mt-3 flex justify-center">
              <Button variant="outline" onClick={() => void load(nextCursor)}>もっと見る</Button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

// 簡易の★表示（APIの平均★が null の場合は 0 として描画）
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

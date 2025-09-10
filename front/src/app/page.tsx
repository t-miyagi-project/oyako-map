"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchPlaces, type PlaceListItem } from "@/lib/api";
import { useRouter, useSearchParams } from "next/navigation";

// クイックフィルタ（UI表示用）
const QUICK_FILTERS = [
  { key: "nursing_room", label: "授乳室" },
  { key: "diaper_table", label: "おむつ台" },
  { key: "kids_toilet", label: "キッズトイレ" },
  { key: "stroller_ok", label: "ベビーカーOK" },
] as const;

export default function Page() {
  // ルーター/URLクエリ
  const router = useRouter();
  const searchParams = useSearchParams();

  // 検索語（q）
  const [query, setQuery] = useState("");
  // クイックフィルタのON/OFF状態
  const [filters, setFilters] = useState<Record<string, boolean>>({});
  // 現在地（初期値は東京駅付近。URL/ローカル保存で上書き）
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: 35.6812, lng: 139.7671 });
  // 読み込み/エラー状態
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // APIからの一覧データ
  const [items, setItems] = useState<PlaceListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  // 位置情報の権限状態（granted/denied/prompt/unknown）
  const [geoPermission, setGeoPermission] = useState<"granted" | "denied" | "prompt" | "unknown">("unknown");

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

  // 初期化: URLクエリ/ローカル保存から座標と検索語を復元し、位置情報の権限状態を取得
  useEffect(() => {
    // URLクエリから lat/lng/q を復元
    try {
      const latQ = searchParams?.get("lat");
      const lngQ = searchParams?.get("lng");
      const qQ = searchParams?.get("q");
      if (qQ) setQuery(qQ);
      if (latQ && lngQ) {
        const latNum = Number(latQ);
        const lngNum = Number(lngQ);
        if (!Number.isNaN(latNum) && !Number.isNaN(lngNum)) {
          setCoords({ lat: latNum, lng: lngNum });
        }
      } else {
        // URLに無い場合はローカル保存から復元
        const saved = (typeof window !== "undefined") ? window.localStorage.getItem("oyako:lastCoords") : null;
        if (saved) {
          const obj = JSON.parse(saved) as { lat: number; lng: number };
          if (typeof obj?.lat === "number" && typeof obj?.lng === "number") {
            setCoords({ lat: obj.lat, lng: obj.lng });
          }
        }
      }
    } catch {
      // パースエラー時は既定値のままにする
    }

    // 位置情報の権限状態を問い合わせ
    if (typeof navigator !== "undefined" && (navigator as any).permissions?.query) {
      (navigator as any).permissions
        .query({ name: "geolocation" as PermissionName })
        .then((res: any) => {
          setGeoPermission(res.state || "unknown");
          // 既に許可済みの場合は自動取得（ユーザー操作不要）
          if (res.state === "granted") {
            requestGeolocation();
          }
          // 変化監視（タブ内で許可切り替えされた場合に反映）
          if (typeof res.onchange !== "undefined") {
            res.onchange = () => setGeoPermission(res.state || "unknown");
          }
        })
        .catch(() => setGeoPermission("unknown"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 座標や検索語が変わったらURLとローカル保存へ反映（共有・リロード対応）
  useEffect(() => {
    try {
      // ローカル保存
      if (typeof window !== "undefined") {
        window.localStorage.setItem("oyako:lastCoords", JSON.stringify(coords));
      }
      // URLクエリを更新（現在のパスを維持して置換）
      const u = new URL(window.location.href);
      u.searchParams.set("lat", String(coords.lat));
      u.searchParams.set("lng", String(coords.lng));
      if (query.trim()) {
        u.searchParams.set("q", query.trim());
      } else {
        u.searchParams.delete("q");
      }
      router.replace(u.pathname + "?" + u.searchParams.toString());
    } catch {
      // 失敗しても致命的ではないため握りつぶす
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords.lat, coords.lng, query]);

  // クイックフィルタはクライアント側で features_summary に基づいて絞り込み
  const filtered = useMemo(() => {
    const active = Object.entries(filters)
      .filter(([, v]) => v)
      .map(([k]) => k)
    if (active.length === 0) return items
    return items.filter((it) => active.every((code) => it.features_summary?.includes(code)))
  }, [items, filters])

  // 現在地を取得して coords を更新
  const requestGeolocation = () => {
    if (!("geolocation" in navigator)) {
      setError("このブラウザは位置情報に対応していません");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // 取得成功：座標を更新（URL/ローカル保存/再検索は副作用で自動実行）
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoPermission("granted");
      },
      (err) => {
        // 失敗：権限やタイムアウトなどのエラーを表示
        if (err.code === err.PERMISSION_DENIED) setGeoPermission("denied");
        setError("現在地の取得に失敗しました（権限や通信状況をご確認ください）");
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 30000,
      }
    );
  };

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
              <div className="text-xs text-neutral-500">
                現在地中心・ピン表示（後続実装）
                {geoPermission === "denied" && (
                  <span className="ml-2 text-red-500">位置情報がブロックされています</span>
                )}
              </div>
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

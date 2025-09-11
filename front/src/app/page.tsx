"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchPlaces, type PlaceListItem } from "@/lib/api";
import { useRouter, useSearchParams } from "next/navigation";
import MapView from "@/components/MapView";

// 並び替えキーの型とラベル
type SortKey = "distance" | "overall" | "count" | "new";
const SORT_LABEL: Record<SortKey, string> = {
  distance: "近い順",
  overall: "総合評価順",
  count: "レビュー件数順",
  new: "新着順",
};

// フィルタ（features）候補一覧（APIのSeedと同等）
const FEATURE_OPTIONS = [
  { code: "nursing_room", label: "授乳室" },
  { code: "diaper_table", label: "おむつ交換台" },
  { code: "kids_toilet", label: "キッズトイレ" },
  { code: "stroller_ok", label: "ベビーカーOK" },
  { code: "elevator", label: "エレベーター" },
  { code: "kids_menu", label: "キッズメニュー" },
  { code: "allergy_label", label: "アレルギー表示" },
];

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

  // 並び替え（UI状態）。初期値は距離順（サーバーの既定ソートに合わせる）
  const [sortKey, setSortKey] = useState<SortKey>("distance");

  // リストと地図の相互連動用：選択中の施設ID
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // リスト側スクロール用の参照
  const listRef = useRef<HTMLDivElement | null>(null);
  // ヘッダーの参照（高さを測って残りの高さをリストに割り当てる）
  const headerRef = useRef<HTMLElement | null>(null);
  // 画面の高さに応じたリストの高さ（px）
  const [listHeight, setListHeight] = useState<number | null>(null);

  // フィルタドロワーの開閉状態
  const [filterOpen, setFilterOpen] = useState(false);
  // ドロワー内の一時選択（適用時に filters に反映する）
  const [draftFilters, setDraftFilters] = useState<Record<string, boolean>>({});

  // 検索トリガ（ボタン押下でインクリメントし、useEffect依存に含める）
  const [searchVersion, setSearchVersion] = useState(0);
  const incrementSearch = () => setSearchVersion((v) => v + 1);

  // 無限スクロール用の監視対象（リスト最下部に配置）
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // クイックフィルタのトグル
  const toggleFilter = (key: string) => setFilters((prev) => ({ ...prev, [key]: !prev[key] }));

  // 選択中の features（filters の true キーを抽出）
  const selectedFeatures = useMemo(() => {
    return Object.entries(filters).filter(([, v]) => !!v).map(([k]) => k);
  }, [filters]);

  // APIから一覧取得
  const load = useCallback(
    async (cursor: string | null = null) => {
      setLoading(true);
      setError(null);
      try {
        // API呼び出し（距離順）
        // features は API 設計に従い複数指定（サーバー未対応時はフロント側で絞り込み）
        const res = await fetchPlaces({ lat: coords.lat, lng: coords.lng, radius_m: 3000, limit: 20, cursor, q: query, features: selectedFeatures });
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
    [coords.lat, coords.lng, query, selectedFeatures]
  );

  // 初回と検索トリガ/座標変更時に読み込み
  useEffect(() => {
    void load(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords.lat, coords.lng, searchVersion]);

  // 無限スクロール：リスト内のsentinelが可視になったら次のカーソルで読み込み
  useEffect(() => {
    const el = sentinelRef.current;
    const rootEl = listRef.current; // リスト領域だけを監視対象にする
    if (!el) return;
    // rootMarginで早めに発火（手前200px）
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        // 次のページが存在し、読み込み中でなければ追加読み込み
        if (e.isIntersecting && nextCursor && !loading) {
          void load(nextCursor);
        }
      },
      { root: rootEl ?? null, rootMargin: "200px", threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [nextCursor, loading, load]);

  // 画面サイズやヘッダー高さに応じてリストコンテナの高さを調整（md以上のみ固定高にし、smでは自然な縦並び）
  useEffect(() => {
    const update = () => {
      if (typeof window === "undefined") return;
      const vh = window.innerHeight || 0;
      const headerH = headerRef.current?.offsetHeight || 0;
      const isMdUp = window.matchMedia("(min-width: 768px)").matches; // Tailwind md
      if (isMdUp) {
        // ヘッダー高さを引いた残りを各領域に割り当て（2カラム時）
        const h = Math.max(240, vh - headerH);
        setListHeight(h);
      } else {
        // 1カラム時は自然な縦スクロールに任せる
        setListHeight(null);
      }
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  // 初期化: URLクエリ/ローカル保存から座標・検索語・並び替え・features を復元し、位置情報の権限状態を取得
  useEffect(() => {
    // URLクエリから lat/lng/q を復元
    try {
      const latQ = searchParams?.get("lat");
      const lngQ = searchParams?.get("lng");
      const qQ = searchParams?.get("q");
      const sQ = (searchParams?.get("sort") || "distance") as SortKey;
      // features は複数指定（仕様: features=nursing_room&features=diaper_table）。features[] 形式にも両対応
      const fQ = [
        ...(searchParams?.getAll("features") ?? []),
        ...(searchParams?.getAll("features[]") ?? []),
      ];
      if (qQ) setQuery(qQ);
      // 並び替えの復元（不正値は distance にフォールバック）
      if (["distance", "overall", "count", "new"].includes(sQ)) {
        setSortKey(sQ);
      } else {
        setSortKey("distance");
      }
      // features の復元（Record<string, boolean> へ展開）
      if (fQ.length > 0) {
        const rec: Record<string, boolean> = {};
        for (const code of fQ) rec[code] = true;
        setFilters((prev) => ({ ...prev, ...rec }));
      }
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

  // 座標・検索語・並び替え・features が変わったらURLとローカル保存へ反映（共有・リロード対応）
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
      // 並び替え（distance/overall/count/new）をURLへ反映
      u.searchParams.set("sort", sortKey);
      // features（複数）をURLへ反映
      u.searchParams.delete("features");
      u.searchParams.delete("features[]");
      for (const code of selectedFeatures) {
        u.searchParams.append("features", code);
      }
      router.replace(u.pathname + "?" + u.searchParams.toString());
    } catch {
      // 失敗しても致命的ではないため握りつぶす
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords.lat, coords.lng, query, sortKey, selectedFeatures]);

  // クイックフィルタ/ドロワー問わず、選択された features でクライアント側でも絞り込み（AND条件）
  const filtered = useMemo(() => {
    const active = Object.entries(filters)
      .filter(([, v]) => v)
      .map(([k]) => k)
    if (active.length === 0) return items
    return items.filter((it) => active.every((code) => it.features_summary?.includes(code)))
  }, [items, filters])

  // 並び替えは距離以外をフロント側で実施（サーバーは常に距離順で返す）
  const sorted = useMemo(() => {
    // 距離順はサーバーの返却順を尊重（ソートしない）
    if (sortKey === "distance") return filtered;
    // その他は項目に応じて降順（高評価/件数多い/新しい順）でソート
    const arr = filtered.slice();
    if (sortKey === "overall") {
      // 総合評価（nullは0扱い）
      arr.sort((a, b) => (b.rating.overall ?? 0) - (a.rating.overall ?? 0));
    } else if (sortKey === "count") {
      // レビュー件数
      arr.sort((a, b) => (b.rating.count ?? 0) - (a.rating.count ?? 0));
    } else if (sortKey === "new") {
      // 新着（created_at が無い場合は元順序を優先しつつ0タイムスタンプ扱い）
      const toTs = (v: string | null | undefined) => {
        const t = v ? Date.parse(v) : NaN;
        return Number.isNaN(t) ? 0 : t;
      };
      arr.sort((a, b) => toTs(b.created_at) - toTs(a.created_at));
    }
    return arr;
  }, [filtered, sortKey]);

  // 並び替え/フィルタ変更で選択中が見えなくなった場合は選択を解除
  useEffect(() => {
    if (!selectedId) return;
    if (!sorted.some((s) => s.id === selectedId)) {
      setSelectedId(null);
    }
  }, [sorted, selectedId]);

  // ピン選択やリストクリックで選択が変わったとき、該当カードへ自動スクロール（リスト領域のみスクロールする）
  useEffect(() => {
    if (!selectedId) return;
    const container = listRef.current;
    const el = document.getElementById(`place-card-${selectedId}`);
    if (!container || !el) return;
    // コンテナと要素の相対位置を算出し、コンテナだけをスクロール
    const contRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const diff = elRect.top - contRect.top; // コンテナ内の要素の見かけ位置
    const targetScrollTop = container.scrollTop + diff - (container.clientHeight - el.clientHeight) / 2;
    container.scrollTo({ top: targetScrollTop, behavior: "smooth" });
  }, [selectedId]);

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
      <header ref={headerRef} className="sticky top-0 z-10 border-b bg-[color:var(--background)]/80 backdrop-blur">
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
            {/* ドロワーを開くボタン（選択数をバッジ表示） */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // 開く際に現在の filters をドラフトへコピー
                setDraftFilters(filters);
                setFilterOpen(true);
              }}
            >
              フィルタ{selectedFeatures.length > 0 ? `(${selectedFeatures.length})` : ""}
            </Button>
            <div className="ml-auto text-xs text-neutral-500">中心: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</div>
          </div>
        </div>
      </header>

      {/* メイン（地図 + 一覧） */}
      <section className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 px-4 py-0 md:grid-cols-12">
        {/* 地図（Google Maps） */}
        <div className="md:col-span-7 lg:col-span-8">
          <div className="relative">
            <div className="absolute left-3 top-3 z-10">
              <Badge variant="outline">地図</Badge>
            </div>
            {/* 地図のピンもフィルタ後の結果に合わせる */}
            <MapView
              center={coords}
              places={filtered}
              selectedId={selectedId}
              onSelect={(id) => setSelectedId(id)}
              heightPx={listHeight ?? undefined}
            />
            <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between">
              <div className="text-xs text-neutral-500">
                現在地中心
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
            {/* 件数と現在の並び替えラベルを表示 */}
            <div className="text-sm text-neutral-500">{SORT_LABEL[sortKey]}で{filtered.length}件表示</div>
            {/* 並び替えセレクタ（ネイティブselectでシンプルに実装） */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-500">並び替え:</span>
              <select
                className="h-8 rounded-md border border-neutral-200 bg-transparent px-2 text-sm dark:border-neutral-800"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                aria-label="並び替え"
              >
                <option value="distance">距離</option>
                <option value="overall">総合</option>
                <option value="count">件数</option>
                <option value="new">新着</option>
              </select>
            </div>
          </div>

          {/* ローディング/エラー表示 */}
          {loading && <div className="p-4 text-sm text-neutral-500">読み込み中...</div>}
          {error && !loading && (
            <div className="p-4 text-sm text-red-600">読み込みに失敗しました: {error}</div>
          )}

          {/* 並び替え済み配列で描画（距離以外はローカルソート） */}
          {/* リストは独立スクロール（画面高 - ヘッダー高 分を使用） */}
          <div
            ref={listRef}
            className="flex flex-col gap-3 overflow-y-auto pr-1"
            style={listHeight ? { height: `${listHeight}px` } : undefined}
          >
            {sorted.map((f) => {
              const isSelected = selectedId === f.id;
              return (
                <Card
                  key={f.id}
                  id={`place-card-${f.id}`}
                  onClick={() => setSelectedId(f.id)}
                  className={isSelected ? "ring-2 ring-primary border-primary" : "cursor-pointer"}
                  role="button"
                >
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
              );
            })}
            {/* 無限スクロール監視用の要素（リスト末尾で交差したら次ページ取得） */}
            <div ref={sentinelRef} className="h-8" />
            {/* フォールバック: もっと見る（Observer非対応や発火失敗時） */}
            {nextCursor && !loading && (
              <div className="mb-2 mt-2 flex justify-center">
                <Button variant="outline" onClick={() => void load(nextCursor)}>もっと見る</Button>
              </div>
            )}
          </div>
        </div>
      </section>
      {/* フィルタドロワー（右スライド） */}
      {filterOpen && (
        <div className="fixed inset-0 z-20">
          {/* オーバーレイ */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setFilterOpen(false)}
            aria-hidden
          />
          {/* 本体 */}
          <div className="absolute right-0 top-0 h-full w-80 max-w-[90vw] bg-[color:var(--background)] shadow-xl border-l border-neutral-200 dark:border-neutral-800 flex flex-col">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="font-medium">フィルタ</div>
              <Button variant="outline" size="sm" onClick={() => setFilterOpen(false)}>閉じる</Button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <div className="mb-3 text-sm text-neutral-500">設備・サービス</div>
              <div className="grid grid-cols-1 gap-2">
                {FEATURE_OPTIONS.map((opt) => {
                  const checked = !!draftFilters[opt.code];
                  return (
                    <label key={opt.code} className="flex items-center gap-2">
                      {/* チェックボックス（選択で一時状態を更新） */}
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-current"
                        checked={checked}
                        onChange={(e) => setDraftFilters((prev) => ({ ...prev, [opt.code]: e.target.checked }))}
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="border-t px-4 py-3 flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // すべてクリア（ドラフトを空に）
                  setDraftFilters({});
                }}
              >
                すべてクリア
              </Button>
              <div className="ml-auto flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setFilterOpen(false)}>キャンセル</Button>
                <Button
                  size="sm"
                  onClick={() => {
                    // 適用：filters に反映し、検索を発火
                    setFilters(draftFilters);
                    setFilterOpen(false);
                    incrementSearch();
                  }}
                >
                  適用
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
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

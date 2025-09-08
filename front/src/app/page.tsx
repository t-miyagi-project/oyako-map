"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Facility = {
  id: string;
  name: string;
  distanceKm: number;
  category: string;
  score: number;
  services: {
    nursingRoom: boolean; // 授乳室
    diaper: boolean; // おむつ台
    kidsToilet: boolean; // キッズトイレ/ベビーキープ
    strollerOk: boolean; // ベビーカーOK
  };
};

const mockFacilities: Facility[] = [
  {
    id: "1",
    name: "わくわくキッズパーク",
    distanceKm: 0.35,
    category: "屋内施設",
    score: 4.4,
    services: { nursingRoom: true, diaper: true, kidsToilet: true, strollerOk: true },
  },
  {
    id: "2",
    name: "中央公園",
    distanceKm: 0.8,
    category: "公園",
    score: 4.1,
    services: { nursingRoom: false, diaper: false, kidsToilet: true, strollerOk: true },
  },
  {
    id: "3",
    name: "ファミリーカフェ こもれび",
    distanceKm: 1.2,
    category: "飲食店",
    score: 4.6,
    services: { nursingRoom: true, diaper: true, kidsToilet: true, strollerOk: true },
  },
];

const QUICK_FILTERS = [
  { key: "nursingRoom", label: "授乳室" },
  { key: "diaper", label: "おむつ台" },
  { key: "kidsToilet", label: "キッズトイレ" },
  { key: "strollerOk", label: "ベビーカーOK" },
] as const;

export default function Page() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    let list = mockFacilities;
    if (query.trim()) {
      const q = query.trim();
      list = list.filter(
        (f) => f.name.includes(q) || f.category.includes(q)
      );
    }
    const activeKeys = Object.entries(filters)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (activeKeys.length) {
      list = list.filter((f) => activeKeys.every((k) => (f.services as any)[k]));
    }
    // 距離の近い順
    return [...list].sort((a, b) => a.distanceKm - b.distanceKm);
  }, [query, filters]);

  const toggleFilter = (key: string) =>
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));

  const requestGeolocation = () => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      () => {
        // 取得成功時のハンドリングは後続実装
      },
      () => {
        // エラー時は何もしない（MVP）
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
            <div className="hidden text-xs text-neutral-500 sm:block">
              子連れ向けスポット検索
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="スポット名・カテゴリを検索"
              className="flex-1"
            />
            <Button onClick={() => { /* 後続で検索API連携 */ }}>
              検索
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {QUICK_FILTERS.map(({ key, label }) => {
              const active = !!filters[key];
              return (
                <Button
                  key={key}
                  variant={active ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleFilter(key)}
                >
                  {label}
                </Button>
              );
            })}
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
            <div className="text-sm text-neutral-500">
              近い順に{filtered.length}件表示
            </div>
            <Button variant="outline" size="sm">並び替え: 距離</Button>
          </div>
          <div className="flex flex-col gap-3">
            {filtered.map((f) => (
              <Card key={f.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <CardTitle>{f.name}</CardTitle>
                    <div className="text-sm text-neutral-500">{(f.distanceKm).toFixed(2)}km</div>
                  </div>
                  <div className="text-xs text-neutral-500">{f.category}</div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="mb-2 flex items-center gap-2">
                    <StarRating score={f.score} />
                    <span className="text-sm text-neutral-600">{f.score.toFixed(1)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {f.services.nursingRoom && <Badge variant="secondary">授乳室</Badge>}
                    {f.services.diaper && <Badge variant="secondary">おむつ台</Badge>}
                    {f.services.kidsToilet && <Badge variant="secondary">キッズトイレ</Badge>}
                    {f.services.strollerOk && <Badge variant="secondary">ベビーカーOK</Badge>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function StarRating({ score }: { score: number }) {
  const full = Math.floor(score);
  const half = score - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
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
  );
}

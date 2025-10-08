"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchAgeBandsMaster, type AgeBandMasterItem } from "@/lib/api";

const STAR_VALUES = [1, 2, 3, 4, 5] as const;
const MAX_PHOTOS = 5;
const REVIEW_AXES = [
  { code: "cleanliness", label: "清潔さ" },
  { code: "nursing_room", label: "授乳室" },
  { code: "diaper_table", label: "おむつ交換" },
  { code: "stroller", label: "ベビーカー移動" },
  { code: "kids_menu", label: "キッズメニュー" },
] as const;

type AxisScoreMap = Record<string, number>;

export default function ReviewPostPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [ageBands, setAgeBands] = useState<AgeBandMasterItem[]>([]);
  const [ageBandError, setAgeBandError] = useState<string | null>(null);
  const [loadingAgeBands, setLoadingAgeBands] = useState(false);

  const [overall, setOverall] = useState<number>(0);
  const [ageBand, setAgeBand] = useState<string | null>(null);
  const [stayMinutes, setStayMinutes] = useState<string>("");
  const [revisitIntent, setRevisitIntent] = useState<number>(3);
  const [body, setBody] = useState<string>("");
  const [axisScores, setAxisScores] = useState<AxisScoreMap>(() =>
    REVIEW_AXES.reduce<AxisScoreMap>((acc, axis) => {
      acc[axis.code] = 3;
      return acc;
    }, {})
  );
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const minOverallSelected = overall > 0;
  const stayMinutesNumber = Number(stayMinutes);
  const isStayMinutesValid =
    stayMinutes.trim().length === 0 || (!Number.isNaN(stayMinutesNumber) && stayMinutesNumber >= 0 && stayMinutesNumber <= 600);
  const isReadyToSubmit = minOverallSelected && body.trim().length > 0 && isStayMinutesValid && !submitting;

  useEffect(() => {
    let cancelled = false;
    setLoadingAgeBands(true);
    setAgeBandError(null);
    fetchAgeBandsMaster()
      .then((res) => {
        if (cancelled) return;
        setAgeBands(res.items);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setAgeBandError(e?.message ?? "年齢帯の取得に失敗しました");
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingAgeBands(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      photoPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photoPreviews]);

  const handleAxisChange = useCallback((code: string, value: number) => {
    setAxisScores((prev) => ({ ...prev, [code]: value }));
  }, []);

  const handlePhotoChange = useCallback((files: FileList | null) => {
    if (!files) return;
    const selected = Array.from(files).slice(0, MAX_PHOTOS - photos.length);
    if (selected.length === 0) return;
    const newPreviews = selected.map((file) => URL.createObjectURL(file));
    setPhotos((prev) => [...prev, ...selected]);
    setPhotoPreviews((prev) => [...prev, ...newPreviews]);
  }, [photos.length]);

  const handleRemovePhoto = useCallback((index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed);
      return next;
    });
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!isReadyToSubmit) return;
      setSubmitting(true);
      try {
        console.log("submit review", {
          placeId: params?.id,
          overall,
          ageBand,
          stayMinutes: stayMinutesNumber || null,
          revisitIntent,
          body,
          axisScores,
          photos,
        });
        alert("レビュー投稿のモックが完了しました。実装時はAPI連携してください。");
        router.back();
      } finally {
        setSubmitting(false);
      }
    },
    [ageBand, axisScores, body, isReadyToSubmit, overall, params?.id, photos, revisitIntent, router, stayMinutesNumber]
  );

  const overallLabel = useMemo(() => {
    if (!minOverallSelected) return "未選択";
    return `${overall} / 5`;
  }, [minOverallSelected, overall]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Button variant="outline" onClick={() => router.back()}>戻る</Button>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">トップへ</Link>
      </div>

      <header className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold text-neutral-900">レビューを投稿する</h1>
        <p className="text-sm text-neutral-600">
          施設で感じた点を共有してください。★やコメント、写真があると他の保護者の参考になります。
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-8">
        <section aria-labelledby="overall-rating" className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 id="overall-rating" className="text-base font-semibold text-neutral-900">総合評価（必須）</h2>
              <p className="text-xs text-neutral-500">★1が低評価、★5が高評価です。</p>
            </div>
            <span className="text-sm text-neutral-600">選択中: {overallLabel}</span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {STAR_VALUES.map((value) => (
              <StarButton
                key={`overall-${value}`}
                checked={overall >= value}
                onClick={() => setOverall(value)}
                label={`${value}`}
              />
            ))}
            <button type="button" className="text-sm text-neutral-500 underline" onClick={() => setOverall(0)}>
              クリア
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <label className="block text-sm font-semibold text-neutral-900">
              年齢帯（任意）
              <select
                className="mt-2 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={ageBand ?? ""}
                onChange={(e) => setAgeBand(e.target.value || null)}
              >
                <option value="">未選択</option>
                {ageBands.map((band) => (
                  <option key={band.code} value={band.code}>{band.label}</option>
                ))}
              </select>
            </label>
            {loadingAgeBands && <p className="mt-2 text-xs text-neutral-500">年齢帯を読み込み中...</p>}
            {ageBandError && <p className="mt-2 text-xs text-red-600">{ageBandError}</p>}
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm space-y-4">
            <label className="block text-sm font-semibold text-neutral-900">
              滞在時間（分）
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={600}
                placeholder="例: 90"
                value={stayMinutes}
                onChange={(e) => setStayMinutes(e.target.value)}
                className="mt-2"
              />
            </label>
            {!isStayMinutesValid && (
              <p className="text-xs text-red-600">0〜600分の範囲で入力してください。</p>
            )}
            <div>
              <p className="text-sm font-semibold text-neutral-900">再訪意向（1〜5）</p>
              <div className="mt-2 flex gap-2">
                {STAR_VALUES.map((value) => (
                  <StarButton
                    key={`revisit-${value}`}
                    checked={revisitIntent >= value}
                    onClick={() => setRevisitIntent(value)}
                    label={`${value}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <label className="block text-sm font-semibold text-neutral-900">
            本文（最大2000文字）
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={2000}
              rows={8}
              className="mt-2 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="設備の使いやすさ、スタッフの対応、おすすめポイントなどを記入してください。"
              required
            />
          </label>
          <div className="mt-2 text-xs text-neutral-500 text-right">{body.length}/2000</div>
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-neutral-900">評価軸（1〜5）</h2>
          <p className="text-xs text-neutral-500">各カテゴリについて感じた満足度を選択してください。</p>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {REVIEW_AXES.map((axis) => (
              <div key={axis.code} className="rounded-lg border border-neutral-200 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-neutral-700">{axis.label}</span>
                  <span className="text-xs text-neutral-500">{axisScores[axis.code]}/5</span>
                </div>
                <div className="mt-2 flex gap-1">
                  {STAR_VALUES.map((value) => (
                    <StarButton
                      key={`${axis.code}-${value}`}
                      checked={axisScores[axis.code] >= value}
                      onClick={() => handleAxisChange(axis.code, value)}
                      size="sm"
                      label={`${value}`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-neutral-900">写真（最大5枚）</h2>
          <p className="text-xs text-neutral-500">端末に保存している写真をアップロードできます。横向きの写真が見やすくおすすめです。</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {photoPreviews.map((src, index) => (
              <div key={`preview-${index}`} className="relative h-24 w-24 overflow-hidden rounded-lg border border-neutral-200">
                <img src={src} alt={`選択済み写真 ${index + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  className="absolute right-1 top-1 rounded-full bg-black/60 px-2 text-xs text-white"
                  onClick={() => handleRemovePhoto(index)}
                >
                  ×
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 text-xs text-neutral-500 hover:border-neutral-400">
                <span>追加</span>
                <span className="text-[10px] text-neutral-400">{photos.length}/{MAX_PHOTOS}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handlePhotoChange(e.target.files)}
                />
              </label>
            )}
          </div>
        </section>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-neutral-500">
            投稿前に内容をご確認ください。送信後は管理者による確認のうえ公開されます。
          </p>
          <Button type="submit" disabled={!isReadyToSubmit} className="md:min-w-[220px]">
            {submitting ? "送信中..." : "レビューを投稿する"}
          </Button>
        </div>
      </form>
    </main>
  );
}

type StarButtonProps = {
  checked: boolean;
  onClick: () => void;
  label: string;
  size?: "default" | "sm";
};

function StarButton({ checked, onClick, label, size = "default" }: StarButtonProps) {
  const className =
    size === "sm"
      ? "h-8 w-8 rounded-md border border-neutral-300 text-sm font-medium hover:border-primary hover:text-primary"
      : "h-10 w-10 rounded-md border border-neutral-300 text-base font-semibold hover:border-primary hover:text-primary";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${className} ${checked ? "border-primary bg-primary/5 text-primary" : "text-neutral-400"}`}
    >
      ★{label}
    </button>
  );
}

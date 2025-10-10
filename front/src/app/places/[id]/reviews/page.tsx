"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { fetchPlaceDetail, fetchPlaceReviews, type PlaceDetail, type PlaceReview } from "@/lib/api";

function formatReviewDate(value: string) {
  try {
    return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
}

function ReviewCard({ review }: { review: PlaceReview }) {
  const axisEntries = Object.entries(review.axes);
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-4 py-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-neutral-900">{review.user.nickname}</div>
          <div className="text-xs text-neutral-500">
            {formatReviewDate(review.created_at)}
            {review.age_band ? ` ｜ 利用年齢：${review.age_band}` : ""}
          </div>
        </div>
        <div className="text-sm font-semibold text-neutral-900">★{review.overall.toFixed(1)}</div>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">{review.text}</p>
      {axisEntries.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-600">
          {axisEntries.map(([label, score]) => (
            <span key={label} className="rounded-full bg-neutral-100 px-2 py-1">
              {label}：{score.toFixed(1)}
            </span>
          ))}
        </div>
      )}
      {review.photos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {review.photos.map((p) => (
            <img key={p.id} src={p.url} alt={`${review.user.nickname} の写真`} className="h-20 w-28 rounded-md object-cover" />
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-500">
        {review.stay_minutes != null && <span>滞在時間：約{review.stay_minutes}分</span>}
        {review.revisit_intent != null && <span>再訪意向：{review.revisit_intent}/5</span>}
      </div>
    </div>
  );
}

export default function PlaceReviewsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialSort = (searchParams?.get("sort") ?? "new") as "new" | "rating";
  const initialHasPhoto = searchParams?.get("has_photo") === "1";

  const [detail, setDetail] = useState<PlaceDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [sort, setSort] = useState<"new" | "rating">(initialSort);
  const [hasPhoto, setHasPhoto] = useState<boolean>(initialHasPhoto);
  const [reviews, setReviews] = useState<PlaceReview[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placeId = params?.id ?? "";

  if (!placeId) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-6">
        <div className="text-sm text-red-600">施設IDが不正です。</div>
      </main>
    );
  }

  useEffect(() => {
    if (!placeId) return;
    fetchPlaceDetail(placeId)
      .then((res) => setDetail(res))
      .catch(() => setDetailError("施設情報の取得に失敗しました"));
  }, [placeId]);

  useEffect(() => {
    if (!placeId) return;
    setLoading(true);
    setError(null);
    fetchPlaceReviews({ placeId, limit: 10, sort, has_photo: hasPhoto })
      .then((res) => {
        setReviews(res.items);
        setCursor(res.next_cursor);
      })
      .catch((e: any) => setError(e?.message ?? "レビューの取得に失敗しました"))
      .finally(() => setLoading(false));
  }, [placeId, sort, hasPhoto]);

  const updateSearchParams = (nextSort: "new" | "rating", nextHasPhoto: boolean) => {
    const params = new URLSearchParams();
    if (nextSort !== "new") params.set("sort", nextSort);
    if (nextHasPhoto) params.set("has_photo", "1");
    const query = params.toString();
    router.replace(query ? `?${query}` : "?");
  };

  const handleSortChange = (value: "new" | "rating") => {
    if (value === sort) return;
    setSort(value);
    updateSearchParams(value, hasPhoto);
  };

  const handlePhotoToggle = () => {
    const next = !hasPhoto;
    setHasPhoto(next);
    updateSearchParams(sort, next);
  };

  const handleLoadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetchPlaceReviews({ placeId, sort, has_photo: hasPhoto, cursor, limit: 10 });
      setReviews((prev) => [...prev, ...res.items]);
      setCursor(res.next_cursor);
    } catch (e: any) {
      setError(e?.message ?? "追加読み込みに失敗しました");
    } finally {
      setLoadingMore(false);
    }
  };

  const title = useMemo(() => detail?.name ?? "レビュー一覧", [detail?.name]);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">{title}</h1>
          {detailError && <p className="text-sm text-red-600">{detailError}</p>}
        </div>
        <Button variant="outline" onClick={() => router.push(`/places/${placeId}`)}>
          施設詳細へ戻る
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-neutral-600">並び替え:</span>
        <Button size="sm" variant={sort === "new" ? "default" : "outline"} onClick={() => handleSortChange("new")}>
          新着順
        </Button>
        <Button size="sm" variant={sort === "rating" ? "default" : "outline"} onClick={() => handleSortChange("rating")}>
          評価順
        </Button>
        <Button size="sm" variant={hasPhoto ? "default" : "outline"} onClick={handlePhotoToggle}>
          写真ありのみ
        </Button>
      </div>

      {loading && <div className="text-sm text-neutral-500">レビューを読み込んでいます...</div>}
      {error && !loading && <div className="text-sm text-red-600">{error}</div>}

      {!loading && !error && reviews.length === 0 && (
        <div className="text-sm text-neutral-500">条件に合致するレビューはまだありません。</div>
      )}

      {!loading && !error && reviews.length > 0 && (
        <div className="space-y-4">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}

      {cursor && !loading && (
        <div className="flex justify-center">
          <Button onClick={handleLoadMore} disabled={loadingMore} variant="outline">
            {loadingMore ? "読み込み中..." : "さらに表示"}
          </Button>
        </div>
      )}

      <div className="flex justify-center text-sm text-neutral-500">
        <Link className="text-blue-600 hover:underline" href={`/places/${placeId}/review`}>
          レビューを投稿する
        </Link>
      </div>
    </main>
  );
}

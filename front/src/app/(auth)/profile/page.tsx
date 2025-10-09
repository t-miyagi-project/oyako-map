"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fetchAgeBandsMaster,
  getMyProfile,
  logout,
  updateMyProfile,
  type AgeBandMasterItem,
  type CurrentUser,
} from "@/lib/api";
import { hasAuthToken } from "@/lib/auth";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [ageBands, setAgeBands] = useState<AgeBandMasterItem[]>([]);
  const [nickname, setNickname] = useState("");
  const [homeArea, setHomeArea] = useState("");
  const [childAgeBandId, setChildAgeBandId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasAuthToken()) {
      router.replace("/login?redirect=/profile");
      return;
    }
    async function initialize() {
      try {
        const [profile, bands] = await Promise.all([getMyProfile(), fetchAgeBandsMaster()]);
        setAgeBands(bands.items);
        if (profile) {
          setUser(profile);
          setNickname(profile.nickname ?? "");
          setHomeArea(profile.home_area ?? "");
          setChildAgeBandId(profile.child_age_band?.id ?? "");
        } else {
          router.replace("/login?redirect=/profile");
        }
      } catch (err: any) {
        setError(err?.message ?? "プロフィールの取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    }
    void initialize();
  }, [router]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setSaving(true);
    try {
      const updated = await updateMyProfile({
        nickname: nickname || undefined,
        home_area: homeArea || undefined,
        child_age_band_id: childAgeBandId || null,
      });
      setUser(updated);
      setMessage("プロフィールを更新しました。");
    } catch (err: any) {
      setError(err?.message ?? "プロフィールの更新に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-[60vh] w-full max-w-3xl items-center justify-center px-4">
        <p className="text-sm text-neutral-500">読み込み中...</p>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">マイプロフィール</h1>
          <p className="text-sm text-neutral-600">登録情報を編集できます。</p>
        </div>
        <Button
          variant="outline"
          onClick={async () => {
            await logout();
            router.replace("/login");
          }}
        >
          ログアウト
        </Button>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="mb-6 space-y-1">
          <p className="text-sm text-neutral-500">登録メールアドレス</p>
          <p className="text-base font-medium text-neutral-800">{user.email}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-sm font-semibold text-neutral-900">
              ニックネーム
              <Input value={nickname} onChange={(e) => setNickname(e.target.value)} className="mt-2" />
            </label>
          </div>
          <div>
            <label className="text-sm font-semibold text-neutral-900">
              居住エリア
              <Input value={homeArea} onChange={(e) => setHomeArea(e.target.value)} className="mt-2" />
            </label>
          </div>
          <div>
            <label className="text-sm font-semibold text-neutral-900">
              お子さまの年齢帯
              <select
                value={childAgeBandId}
                onChange={(e) => setChildAgeBandId(e.target.value)}
                className="mt-2 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">未選択</option>
                {ageBands.map((band) => (
                  <option key={band.id} value={band.id}>
                    {band.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {message && <p className="text-sm text-green-600">{message}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "更新中..." : "変更を保存"}
          </Button>
        </form>
      </div>
    </main>
  );
}

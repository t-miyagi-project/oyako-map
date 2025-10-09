"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchAgeBandsMaster, signup, type AgeBandMasterItem } from "@/lib/api";

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [homeArea, setHomeArea] = useState("");
  const [ageBandId, setAgeBandId] = useState<string>("");
  const [ageBands, setAgeBands] = useState<AgeBandMasterItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTo = searchParams?.get("redirect") || "/";

  useEffect(() => {
    fetchAgeBandsMaster()
      .then((res) => setAgeBands(res.items))
      .catch(() => setAgeBands([]));
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("メールアドレスとパスワードを入力してください。");
      return;
    }
    setLoading(true);
    try {
      await signup({
        email,
        password,
        nickname: nickname || undefined,
        home_area: homeArea || undefined,
        child_age_band_id: ageBandId || undefined,
      });
      router.replace(redirectTo);
    } catch (err: any) {
      setError(err?.message ?? "登録に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col justify-center px-4 py-8">
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-neutral-900">新規登録</h1>
        <p className="mt-2 text-sm text-neutral-600">
          子連れで訪れたスポットのレビューやブックマークを活用するためにアカウントを作成しましょう。
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-neutral-700">
              メールアドレス
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2"
                autoComplete="email"
                required
              />
            </label>
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700">
              パスワード（8文字以上）
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700">
              ニックネーム（任意）
              <Input value={nickname} onChange={(e) => setNickname(e.target.value)} className="mt-2" />
            </label>
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700">
              居住エリア（任意）
              <Input value={homeArea} onChange={(e) => setHomeArea(e.target.value)} className="mt-2" />
            </label>
          </div>
          <div>
            <label className="text-sm font-medium text-neutral-700">
              お子さまの年齢帯（任意）
              <select
                value={ageBandId}
                onChange={(e) => setAgeBandId(e.target.value)}
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
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "送信中..." : "登録する"}
          </Button>
        </form>
        <p className="mt-4 text-sm text-neutral-600">
          すでにアカウントをお持ちの場合は{" "}
          <Link className="text-blue-600 hover:underline" href="/login">
            ログイン
          </Link>
          へ。
        </p>
      </div>
    </main>
  );
}

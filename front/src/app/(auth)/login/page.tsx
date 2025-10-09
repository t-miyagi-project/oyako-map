"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hasAuthToken } from "@/lib/auth";
import { login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTo = searchParams?.get("redirect") || "/";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("メールアドレスとパスワードを入力してください。");
      return;
    }
    setLoading(true);
    try {
      await login({ email, password });
      router.replace(redirectTo);
    } catch (err: any) {
      setError(err?.message ?? "ログインに失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (hasAuthToken()) {
      router.replace(redirectTo);
    }
  }, [redirectTo, router]);

  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col justify-center px-4 py-8">
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-neutral-900">ログイン</h1>
        <p className="mt-2 text-sm text-neutral-600">登録済みのメールアドレスでログインしてください。</p>
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
              パスワード
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2"
                autoComplete="current-password"
                required
              />
            </label>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "送信中..." : "ログイン"}
          </Button>
        </form>
        <p className="mt-4 text-sm text-neutral-600">
          アカウントをお持ちでない方は{" "}
          <Link className="text-blue-600 hover:underline" href="/signup">
            新規登録
          </Link>
          へ。
        </p>
      </div>
    </main>
  );
}

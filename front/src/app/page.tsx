export default async function Page() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/ping/`, {
    cache: 'no-store',
  });
  const data = await res.json(); // { pong: true }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Ping from Django: {String(data.pong)}</h1>
    </main>
  );
}

import { useEffect, useState } from "react";

type Health = { ok: true; db: number } | { ok: false; error: string };

export function App() {
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json() as Promise<Health>)
      .then(setHealth)
      .catch((err: unknown) => setHealth({ ok: false, error: String(err) }));
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 32 }}>
      <h1>Coursemap</h1>
      {health === null && <p>Checking backend…</p>}
      {health?.ok === true && <p>Backend OK — {health.db} courses in D1.</p>}
      {health?.ok === false && <p style={{ color: "crimson" }}>Backend error: {health.error}</p>}
    </main>
  );
}

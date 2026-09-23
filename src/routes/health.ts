export async function health(env: Env): Promise<Response> {
  try {
    const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM courses").first<{ n: number }>();
    return Response.json({ ok: true, db: row?.n ?? 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: `D1 query failed: ${message}` }, { status: 500 });
  }
}

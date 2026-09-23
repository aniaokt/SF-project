import { health } from "./routes/health";

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health" && request.method === "GET") {
      return health(env);
    }

    if (url.pathname.startsWith("/api/")) {
      return Response.json({ error: `No route for ${request.method} ${url.pathname}` }, { status: 404 });
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

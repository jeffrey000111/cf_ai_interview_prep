import { InterviewSession } from "./agent";
import HTML from "./html";

export { InterviewSession };

interface Env {
  AI: Ai;
  INTERVIEW_SESSION: DurableObjectNamespace;
}

function getSessionId(request: Request): string {
  // Use a cookie-based session ID, or generate one
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/session_id=([^;]+)/);
  return match ? match[1] : crypto.randomUUID();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // API routes → Durable Object
    if (url.pathname.startsWith("/api/")) {
      const sessionId = getSessionId(request);
      const id = env.INTERVIEW_SESSION.idFromName(sessionId);
      const stub = env.INTERVIEW_SESSION.get(id);

      // Strip /api prefix and forward to DO
      const doUrl = new URL(request.url);
      doUrl.pathname = url.pathname.replace("/api", "");

      const doRequest = new Request(doUrl.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });

      const response = await stub.fetch(doRequest);
      const newResponse = new Response(response.body, response);

      // Set session cookie if new
      const cookie = request.headers.get("Cookie") || "";
      if (!cookie.includes("session_id=")) {
        newResponse.headers.append(
          "Set-Cookie",
          `session_id=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`
        );
      }
      return newResponse;
    }

    // Serve the app
    return new Response(HTML, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
};


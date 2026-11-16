import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createCrmServer } from "@/lib/mcp/server";
import { SCOPE, appOrigin, mcpUrl } from "@/lib/oauth";
import { userForAccessToken } from "@/lib/oauth-store";

function unauthorized(origin: string) {
  return Response.json(
    { error: "invalid_token", error_description: "Connect this app to your CRM account first." },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": `Bearer error="invalid_token", resource_metadata="${origin}/.well-known/oauth-protected-resource/api/mcp", scope="${SCOPE}"`,
      },
    },
  );
}

// Stateless Streamable HTTP: a fresh server per request, bound to the token's user.
async function handle(req: Request) {
  const origin = appOrigin(req.headers);
  const token = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const grant = token ? await userForAccessToken(token) : null;
  if (!grant) return unauthorized(origin);

  const server = createCrmServer(grant.userId, origin);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(req, {
      authInfo: { token: token!, clientId: grant.clientId, scopes: [SCOPE], resource: new URL(mcpUrl(origin)) },
    });
  } finally {
    await server.close();
  }
}

export { handle as GET, handle as POST, handle as DELETE };

import { SCOPE, appOrigin, mcpUrl } from "@/lib/oauth";

// RFC 9728, served at /.well-known/oauth-protected-resource[/api/mcp] via a rewrite.
export function GET(req: Request) {
  const origin = appOrigin(req.headers);
  return Response.json({
    resource: mcpUrl(origin),
    authorization_servers: [origin],
    scopes_supported: [SCOPE],
    bearer_methods_supported: ["header"],
    resource_name: "Personal CRM",
  });
}

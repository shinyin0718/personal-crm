import { clientAuthOk, findClient, revokeToken } from "@/lib/oauth-store";
import { clientCredentials, oauthError } from "../client-auth";

// RFC 7009: revoking either token disconnects the app.
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return oauthError("invalid_request", "Expected a form-encoded body");
  const { clientId, clientSecret } = clientCredentials(req, form);
  const client = await findClient(clientId);
  if (!client || !clientAuthOk(client, clientSecret)) {
    return oauthError("invalid_client", "Unknown client or bad client secret", 401);
  }
  const token = form.get("token");
  if (typeof token === "string" && token) await revokeToken(token, client.id);
  return new Response(null, { status: 200 });
}

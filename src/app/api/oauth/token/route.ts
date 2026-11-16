import { appOrigin, isOwnResource, verifyPkce } from "@/lib/oauth";
import {
  clientAuthOk,
  createGrant,
  findClient,
  redeemCode,
  refreshGrant,
  sweepExpired,
  tokenResponse,
} from "@/lib/oauth-store";
import { clientCredentials, oauthError } from "../client-auth";

const noStore = { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } };

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return oauthError("invalid_request", "Expected a form-encoded body");
  const field = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v : "";
  };

  const { clientId, clientSecret } = clientCredentials(req, form);
  const client = await findClient(clientId);
  if (!client || !clientAuthOk(client, clientSecret)) {
    return oauthError("invalid_client", "Unknown client or bad client secret", 401);
  }

  const grantType = field("grant_type");
  if (grantType === "authorization_code") {
    const code = await redeemCode(field("code"));
    if (
      !code ||
      code.clientId !== client.id ||
      code.redirectUri !== field("redirect_uri") ||
      !verifyPkce(field("code_verifier"), code.codeChallenge)
    ) {
      return oauthError("invalid_grant", "The authorization code is invalid or expired");
    }
    const resource = field("resource") || code.resource;
    if (!isOwnResource(resource, appOrigin(req.headers))) {
      return oauthError("invalid_target", "Unknown resource");
    }
    await sweepExpired();
    const tokens = await createGrant(client.id, code.userId, resource);
    return Response.json(tokenResponse(tokens), noStore);
  }

  if (grantType === "refresh_token") {
    const tokens = await refreshGrant(field("refresh_token"), client.id);
    if (!tokens) return oauthError("invalid_grant", "The refresh token is invalid or expired");
    return Response.json(tokenResponse(tokens), noStore);
  }

  return oauthError("unsupported_grant_type", "Use authorization_code or refresh_token");
}

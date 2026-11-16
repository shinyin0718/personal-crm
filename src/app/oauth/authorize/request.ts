import "server-only";
import { SCOPE, appOrigin, isOwnResource, isValidChallenge } from "@/lib/oauth";
import { findClient } from "@/lib/oauth-store";

type Raw = Record<string, string | string[] | undefined>;

export type AuthorizeRequest =
  | { ok: false; message: string }
  | {
      ok: true;
      client: { id: string; name: string };
      redirectUri: string;
      codeChallenge: string;
      state: string | null;
      resource: string | null;
    }
  // Errors that can safely go back to the (verified) redirect URI.
  | { ok: "redirect"; redirectUri: string; error: string; state: string | null };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export async function parseAuthorizeRequest(params: Raw, headers: Headers): Promise<AuthorizeRequest> {
  const client = await findClient(one(params.client_id));
  if (!client) return { ok: false, message: "This app isn't registered. Remove it and add it again." };
  const redirectUri = one(params.redirect_uri);
  if (!client.redirectUris.includes(redirectUri)) {
    return { ok: false, message: "This app sent an unexpected return address, so it was blocked." };
  }
  const state = one(params.state) || null;
  const fail = (error: string) => ({ ok: "redirect" as const, redirectUri, error, state });

  if (one(params.response_type) !== "code") return fail("unsupported_response_type");
  const codeChallenge = one(params.code_challenge);
  if (one(params.code_challenge_method) !== "S256" || !isValidChallenge(codeChallenge)) {
    return fail("invalid_request");
  }
  const scope = one(params.scope);
  if (scope && !scope.split(" ").every((s) => s === SCOPE || s === "")) return fail("invalid_scope");
  const resource = one(params.resource) || null;
  if (!isOwnResource(resource, appOrigin(headers))) return fail("invalid_target");

  return { ok: true, client: { id: client.id, name: client.name }, redirectUri, codeChallenge, state, resource };
}

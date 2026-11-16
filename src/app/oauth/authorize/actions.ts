"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/dal";
import { appOrigin, withParams } from "@/lib/oauth";
import { createCode } from "@/lib/oauth-store";
import { parseAuthorizeRequest } from "./request";

export async function decide(fd: FormData) {
  const userId = await requireUserId();
  const h = await headers();
  const params = Object.fromEntries(
    ["client_id", "redirect_uri", "response_type", "code_challenge", "code_challenge_method", "state", "scope", "resource"].map(
      (k) => [k, String(fd.get(k) ?? "")],
    ),
  );
  const req = await parseAuthorizeRequest(params, h);
  if (req.ok === false) throw new Error(req.message);
  const iss = appOrigin(h);
  if (req.ok === "redirect") redirect(withParams(req.redirectUri, { error: req.error, state: req.state, iss }));

  if (fd.get("decision") !== "allow") {
    redirect(withParams(req.redirectUri, { error: "access_denied", state: req.state, iss }));
  }
  const code = await createCode({
    clientId: req.client.id,
    userId,
    redirectUri: req.redirectUri,
    codeChallenge: req.codeChallenge,
    resource: req.resource,
  });
  redirect(withParams(req.redirectUri, { code, state: req.state, iss }));
}

/** client_id / client_secret from HTTP Basic auth or the form body. */
export function clientCredentials(req: Request, form: FormData) {
  const basic = req.headers.get("authorization")?.match(/^Basic\s+(.+)$/i);
  if (basic) {
    const decoded = Buffer.from(basic[1], "base64").toString();
    const i = decoded.indexOf(":");
    if (i > 0) {
      return {
        clientId: decodeURIComponent(decoded.slice(0, i)),
        clientSecret: decodeURIComponent(decoded.slice(i + 1)),
      };
    }
  }
  const id = form.get("client_id");
  const secret = form.get("client_secret");
  return {
    clientId: typeof id === "string" ? id : "",
    clientSecret: typeof secret === "string" ? secret : null,
  };
}

export function oauthError(error: string, description: string, status = 400) {
  return Response.json(
    { error, error_description: description },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

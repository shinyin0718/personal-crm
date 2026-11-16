import { auth } from "@/auth";
import { contentTypeFor, getFile, isSafeKey } from "@/lib/storage";

export async function GET(_req: Request, ctx: RouteContext<"/api/files/[...key]">) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const key = (await ctx.params).key.join("/");
  // Files live under "<userId>/...", so this is the ownership check.
  if (!isSafeKey(key) || !key.startsWith(`${userId}/`)) {
    return new Response("Not found", { status: 404 });
  }
  const body = await getFile(key);
  if (!body) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": contentTypeFor(key),
      // no-store: a shared browser must not show one account's cards to the next.
      "Cache-Control": "private, no-store",
    },
  });
}

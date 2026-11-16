import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { buttonClass, cardClass, secondaryButtonClass } from "@/components/ui";
import { requireUserId } from "@/lib/dal";
import { appOrigin, withParams } from "@/lib/oauth";
import { decide } from "./actions";
import { parseAuthorizeRequest } from "./request";

export const metadata: Metadata = { title: "Connect an app" };

const FIELDS = ["client_id", "redirect_uri", "response_type", "code_challenge", "code_challenge_method", "state", "scope", "resource"];

export default async function AuthorizePage({ searchParams }: PageProps<"/oauth/authorize">) {
  await requireUserId();
  const params = await searchParams;
  const h = await headers();
  const req = await parseAuthorizeRequest(params, h);
  if (req.ok === "redirect") {
    redirect(withParams(req.redirectUri, { error: req.error, state: req.state, iss: appOrigin(h) }));
  }
  if (!req.ok) {
    return (
      <div className={`${cardClass} space-y-2`}>
        <h1 className="text-xl font-semibold">Can&apos;t connect</h1>
        <p className="text-sm text-stone-600">{req.message}</p>
      </div>
    );
  }
  const session = await auth();
  const returnHost = new URL(req.redirectUri).host;
  return (
    <form action={decide} className={`${cardClass} space-y-4`}>
      {FIELDS.map((k) => (
        <input key={k} type="hidden" name={k} value={typeof params[k] === "string" ? params[k] : ""} />
      ))}
      <h1 className="text-xl font-semibold">Connect {req.client.name}?</h1>
      <p className="text-sm text-stone-600">
        Signed in as <span className="font-medium text-stone-900">{session?.user?.email}</span>
      </p>
      <div className="space-y-2 text-sm">
        <p>It will be able to:</p>
        <ul className="list-disc space-y-1 pl-5 text-stone-700">
          <li>Read your people, tags and meeting notes</li>
          <li>Add people, meetings and notes</li>
        </ul>
        <p className="text-stone-600">It can&apos;t delete anything. You can disconnect it any time from Account.</p>
      </div>
      <p className="text-xs text-stone-500">You&apos;ll be sent back to {returnHost}.</p>
      <div className="flex gap-2">
        <button name="decision" value="allow" className={`${buttonClass} flex-1`}>
          Allow
        </button>
        <button name="decision" value="deny" className={`${secondaryButtonClass} flex-1`}>
          Cancel
        </button>
      </div>
    </form>
  );
}

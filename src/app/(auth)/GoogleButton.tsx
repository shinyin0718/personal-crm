import { googleSignIn } from "./actions";
import { secondaryButtonClass } from "@/components/ui";

export function GoogleButton({ callbackUrl }: { callbackUrl?: string | null }) {
  return (
    <form action={googleSignIn} className="mt-3">
      {callbackUrl && <input type="hidden" name="callbackUrl" value={callbackUrl} />}
      <button type="submit" className={`${secondaryButtonClass} w-full`}>
        Continue with Google
      </button>
    </form>
  );
}

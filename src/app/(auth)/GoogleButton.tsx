import { googleSignIn } from "./actions";
import { secondaryButtonClass } from "@/components/ui";

export function GoogleButton() {
  return (
    <form action={googleSignIn} className="mt-3">
      <button type="submit" className={`${secondaryButtonClass} w-full`}>
        Continue with Google
      </button>
    </form>
  );
}

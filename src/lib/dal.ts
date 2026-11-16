import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const requireUserId = cache(async (): Promise<string> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) redirect("/login");
  return id;
});

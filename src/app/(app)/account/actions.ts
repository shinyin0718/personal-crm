"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/dal";

export async function disconnectApp(grantId: string) {
  const userId = await requireUserId();
  await prisma.oAuthGrant.deleteMany({ where: { id: grantId, userId } });
  revalidatePath("/account");
}

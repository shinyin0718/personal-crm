"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/dal";
import { deleteFileByUrl, getFile, keyFromUrl, putFile } from "@/lib/storage";
import { readCard } from "@/lib/vision/providers";
import { toCardFields } from "@/lib/vision/parse";
import type { Prisma } from "@/generated/prisma/client";

const MAX_BYTES = 4 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export interface UploadState {
  error?: string;
}

async function extract(scanId: string, userId: string, data: Buffer, mimeType: string) {
  try {
    const result = await readCard({ data, mimeType });
    const fields = toCardFields(result.raw);
    await prisma.cardScan.update({
      where: { id: scanId, userId },
      data: {
        status: "EXTRACTED",
        error: null,
        extractedJson: {
          ...(result.raw as Prisma.InputJsonObject),
          _fields: fields,
          _provider: result.provider,
          _model: result.model,
        } as Prisma.InputJsonObject,
      },
    });
  } catch (err) {
    console.error("Card extraction failed", err);
    await prisma.cardScan.update({
      where: { id: scanId, userId },
      data: { status: "FAILED", error: err instanceof Error ? err.message.slice(0, 500) : "Unknown error" },
    });
  }
}

export async function uploadCard(_prev: UploadState, fd: FormData): Promise<UploadState> {
  const userId = await requireUserId();
  const file = fd.get("card");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo of the card." };
  const ext = TYPES[file.type];
  if (!ext) return { error: "Use a JPEG, PNG or WebP photo." };
  if (file.size > MAX_BYTES) return { error: "That photo is too large (max 4 MB)." };

  const data = Buffer.from(await file.arrayBuffer());
  const imageUrl = await putFile(`${userId}/cards/${randomUUID()}.${ext}`, data);
  const scan = await prisma.cardScan.create({ data: { userId, imageUrl, status: "PROCESSING" } });
  await extract(scan.id, userId, data, file.type);
  redirect(`/scan/${scan.id}`);
}

export async function retryScan(scanId: string) {
  const userId = await requireUserId();
  const scan = await prisma.cardScan.findFirst({ where: { id: scanId, userId } });
  if (!scan || scan.status === "CONFIRMED") redirect("/scan");
  const key = keyFromUrl(scan.imageUrl);
  const data = key ? await getFile(key) : null;
  if (!key || !data) {
    await prisma.cardScan.update({
      where: { id: scanId, userId },
      data: { status: "FAILED", error: "Image not found" },
    });
  } else {
    const ext = key.split(".").pop();
    await extract(scanId, userId, data, ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg");
  }
  redirect(`/scan/${scanId}`);
}

export async function discardScan(scanId: string) {
  const userId = await requireUserId();
  const scan = await prisma.cardScan.findFirst({
    where: { id: scanId, userId, status: { not: "CONFIRMED" } },
  });
  if (scan) {
    await prisma.cardScan.delete({ where: { id: scan.id, userId } });
    await deleteFileByUrl(scan.imageUrl);
  }
  redirect("/scan");
}

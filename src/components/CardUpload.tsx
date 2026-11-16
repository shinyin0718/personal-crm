"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { uploadCard, type UploadState } from "@/app/(app)/scan/actions";
import { FormError, buttonClass, secondaryButtonClass } from "./ui";

const MAX_SIDE = 1600;

/** Downscale phone photos in the browser so uploads stay small and fast. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.85),
  );
}

export function CardUpload() {
  const [state, formAction] = useActionState<UploadState, FormData>(uploadCard, {});
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [localError, setLocalError] = useState<string>();
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLocalError("Choose an image file.");
      return;
    }
    setLocalError(undefined);
    const small = await shrink(file);
    setBlob(small);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(small);
    });
  }

  function submit() {
    if (!blob) return;
    const fd = new FormData();
    fd.set("card", new File([blob], "card.jpg", { type: blob.type || "image/jpeg" }));
    startTransition(() => formAction(fd));
  }

  return (
    <div className="space-y-4">
      <FormError message={localError ?? state.error} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onPick} />
      <input ref={libraryRef} type="file" accept="image/*" hidden onChange={onPick} />

      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- local blob preview
        <img src={preview} alt="Card preview" className="max-h-80 w-full rounded-lg border border-stone-200 object-contain" />
      ) : (
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="flex aspect-[1.75] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 text-stone-500 hover:border-teal-600 hover:text-teal-700"
        >
          <svg aria-hidden viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
          <span className="font-medium">Take a photo of the card</span>
        </button>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => libraryRef.current?.click()} className={secondaryButtonClass}>
          {preview ? "Choose another" : "Choose from photos"}
        </button>
        {preview && (
          <button type="button" onClick={submit} disabled={pending} className={buttonClass}>
            {pending ? "Reading card…" : "Read card"}
          </button>
        )}
      </div>
    </div>
  );
}

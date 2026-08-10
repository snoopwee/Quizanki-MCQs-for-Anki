"use client";

import { useRef, useState } from "react";
import { useUploadCardImage } from "@/hooks/useUploadCardImage";
import { Spinner } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/icons";

// Per-face image control, shared by the bulk deck editor (EditableCard) and the
// per-card edit modal (EditFlashcardModal): a thumbnail with a remove button when
// set, otherwise an "Add image" button that uploads the picked file and reports its
// URL. `url` is "" when the face has no image.
export function CardImageSlot({
  url,
  onChange,
}: {
  url: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadCardImage();
  const [error, setError] = useState<string | null>(null);

  function pick(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    upload.mutate(file, {
      onSuccess: (uploadedUrl) => onChange(uploadedUrl),
      onError: () => setError("Couldn't upload that image. Try again."),
    });
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      {url ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary Supabase Storage host; next/image would need remotePatterns config */}
          <img
            src={url}
            alt=""
            className="max-h-28 rounded-input border border-line object-contain"
          />
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Remove image"
            title="Remove image"
            className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full border border-line bg-surface text-muted shadow-sm transition hover:border-danger hover:text-danger"
          >
            <Icon name="x" size={13} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
          className="inline-flex items-center gap-1.5 rounded-input border border-line-strong bg-surface px-2.5 py-1 text-xs font-medium text-muted transition hover:border-accent hover:text-accent disabled:opacity-60"
        >
          {upload.isPending ? <Spinner className="h-3.5 w-3.5" /> : <Icon name="camera" size={13} />}
          {upload.isPending ? "Uploading…" : "Add image"}
        </button>
      )}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

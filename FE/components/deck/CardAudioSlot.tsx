"use client";

import { useRef, useState } from "react";
import { useUploadCardAudio } from "@/hooks/useUploadCardAudio";
import { Spinner } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/icons";

// Per-face audio control, shared by the bulk deck editor (EditableCard) and the
// per-card edit modal (EditFlashcardModal): a small inline player with a remove
// button when set, otherwise an "Add audio" button that uploads the picked file
// and reports its URL. `url` is "" when the face has no audio. Mirrors
// CardImageSlot; the accept list matches what the backend sniffer allows.
export function CardAudioSlot({
  url,
  onChange,
}: {
  url: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadCardAudio();
  const [error, setError] = useState<string | null>(null);

  function pick(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      setError("Please choose an audio file.");
      return;
    }
    upload.mutate(file, {
      onSuccess: (uploadedUrl) => onChange(uploadedUrl),
      onError: () => setError("Couldn't upload that audio. Try again."),
    });
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/ogg,audio/wav,audio/webm"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      {url ? (
        <div className="flex items-center gap-2">
          <audio src={url} controls preload="none" className="h-8 max-w-full" />
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Remove audio"
            title="Remove audio"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line bg-surface text-muted shadow-sm transition hover:border-danger hover:text-danger"
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
          {upload.isPending ? <Spinner className="h-3.5 w-3.5" /> : <Icon name="sound" size={13} />}
          {upload.isPending ? "Uploading…" : "Add audio"}
        </button>
      )}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

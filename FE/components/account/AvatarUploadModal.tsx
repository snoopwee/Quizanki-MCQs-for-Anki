"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Modal } from "@/components/shared/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { AvatarCropper, type AvatarCropperHandle } from "@/components/account/AvatarCropper";
import { buttonClasses } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/client";
import { CUSTOM_AVATAR_KEY } from "@/lib/userDisplay";
import { ACCEPTED_IMAGE_TYPES, validateImageFile } from "@/lib/image";
import { avatarErrorMessage, removeAvatar, uploadAvatar } from "@/lib/avatarStorage";

// Avatar chooser. Stage 1: show the current photo + "Choose image". Stage 2: the
// interactive cropper (drag + zoom) over the picked file. Save renders the framed
// square to a JPEG, uploads it to Storage, and points user_metadata at the URL.
export function AvatarUploadModal({
  currentUrl,
  initials,
  canRemove,
  onClose,
  onResult,
}: {
  currentUrl: string;
  initials: string;
  // True only when there's an avatar of ours to delete (not an OAuth default).
  canRemove: boolean;
  onClose: () => void;
  onResult: (kind: "success" | "error", message: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropperRef = useRef<AvatarCropperHandle>(null);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [cropReady, setCropReady] = useState(false); // the cropper's image has loaded
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "save" | "remove">(null);

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the user re-pick the same file
    if (!file) return;
    const problem = validateImageFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setCropReady(false); // wait for the new image to load before Save re-enables
    setPickedFile(file);
  }

  async function save() {
    if (!pickedFile || !cropperRef.current) return;
    setBusy("save");
    setError(null);
    try {
      const blob = await cropperRef.current.getBlob();
      const url = await uploadAvatar(blob); // → Spring backend → Supabase Storage
      const supabase = createClient();
      const { error: updateErr } = await supabase.auth.updateUser({
        data: { [CUSTOM_AVATAR_KEY]: url },
      });
      if (updateErr) throw updateErr;
      onResult("success", "Profile picture updated.");
      onClose();
    } catch (err) {
      console.error("[avatar] save failed:", err); // raw error for debugging
      setBusy(null);
      setError(avatarErrorMessage(err));
    }
  }

  async function remove() {
    setBusy("remove");
    setError(null);
    try {
      await removeAvatar(); // → Spring backend → Supabase Storage delete
      const supabase = createClient();
      const { error: updateErr } = await supabase.auth.updateUser({
        data: { [CUSTOM_AVATAR_KEY]: null },
      });
      if (updateErr) throw updateErr;
      onResult("success", "Profile picture removed.");
      onClose();
    } catch (err) {
      console.error("[avatar] remove failed:", err);
      setBusy(null);
      setError(avatarErrorMessage(err));
    }
  }

  const dismiss = busy ? () => {} : onClose; // don't let it close mid-request
  const picking = pickedFile === null;

  return (
    <Modal title="Profile picture" onClose={dismiss}>
      <div className="mx-auto flex max-w-sm flex-col items-center gap-5">
        {picking ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Choose an image"
            className="group relative rounded-full focus-ring"
          >
            <Avatar url={currentUrl || null} initials={initials} className="h-32 w-32 text-4xl" />
            <span className="absolute inset-0 grid place-items-center rounded-full bg-ink/0 text-white opacity-0 transition group-hover:bg-ink/45 group-hover:opacity-100">
              <Icon name="camera" size={26} />
            </span>
          </button>
        ) : (
          <AvatarCropper ref={cropperRef} file={pickedFile} onReady={() => setCropReady(true)} />
        )}

        {picking && (
          <div className="text-center">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={buttonClasses({ variant: "ghost", size: "md" })}
            >
              <Icon name="camera" size={16} />
              Choose image
            </button>
            <p className="mt-2 text-xs text-faint">
              PNG, JPG or WebP, up to 8 MB. We&apos;ll crop it to a square.
            </p>
          </div>
        )}

        {error && (
          <p className="w-full rounded-input bg-danger/10 px-3 py-2 text-center text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex w-full items-center justify-between gap-3 border-t border-line pt-4">
          {!picking ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy !== null}
              className={buttonClasses({ variant: "ghost", size: "md" })}
            >
              Choose different
            </button>
          ) : canRemove ? (
            <button
              type="button"
              onClick={remove}
              disabled={busy !== null}
              className={buttonClasses({ variant: "danger", size: "md" })}
            >
              {busy === "remove" ? "Removing…" : "Remove"}
            </button>
          ) : (
            <span />
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy !== null}
              className={buttonClasses({ variant: "ghost", size: "md" })}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={picking || !cropReady || busy !== null}
              className={buttonClasses({ variant: "primary", size: "md" })}
            >
              {busy === "save" ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        onChange={onPick}
        className="hidden"
      />
    </Modal>
  );
}

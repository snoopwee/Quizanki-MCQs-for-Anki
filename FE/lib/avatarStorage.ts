import axios from "axios";
import api from "@/lib/axios";

// Avatar upload/delete go through the Spring backend (per the "everything through
// Spring Boot" rule) — never straight to Supabase Storage from the client. The
// backend writes to Storage with the service-role key and returns the public URL,
// which the caller then persists into user_metadata.

/** Upload the cropped avatar; returns its cache-busted public URL. */
export async function uploadAvatar(blob: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", blob, "avatar.jpg");
  // Clear the instance's default JSON Content-Type so the browser sets
  // multipart/form-data WITH the boundary (a fixed value would omit it).
  const { data } = await api.post<{ url: string }>("/me/avatar", form, {
    headers: { "Content-Type": undefined },
  });
  return data.url;
}

/** Delete the user's stored avatar (idempotent on the server). */
export async function removeAvatar(): Promise<void> {
  await api.delete("/me/avatar");
}

/** Turn an upload/delete error into copy a human can act on. */
export function avatarErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const serverMessage = (err.response?.data as { message?: string } | undefined)?.message;
    if (err.response?.status === 503) {
      return serverMessage || "Profile picture storage isn't set up on the server yet.";
    }
    return serverMessage || "Couldn't upload your photo — please try again.";
  }
  return err instanceof Error ? err.message : "Couldn't update your photo.";
}

import { useMutation } from "@tanstack/react-query";
import api from "@/lib/axios";

// Upload a flashcard image to our storage and get back its public URL, which the
// editor then saves onto the card's front/back image slot. Mirrors the avatar
// upload — multipart, server stores it with the service-role key.
export function useUploadCardImage() {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post<{ url: string }>("/me/card-image", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data.url;
    },
  });
}

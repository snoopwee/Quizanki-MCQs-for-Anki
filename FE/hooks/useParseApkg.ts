import { useMutation } from "@tanstack/react-query";
import api from "@/lib/axios";
import type { ApkgParseResponse } from "@/types/api";

// Uploads a .apkg to the public parse endpoint. The endpoint is stateless (no
// auth required, persists nothing); the axios interceptor still attaches the JWT
// when a session exists so the backend can rate-limit authed users separately.
export function useParseApkg() {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      // Clear the instance's default JSON Content-Type so the browser sets
      // multipart/form-data WITH the boundary; a fixed value would omit it.
      const { data } = await api.post<ApkgParseResponse>("/public/parse-apkg", form, {
        headers: { "Content-Type": undefined },
      });
      return data;
    },
  });
}

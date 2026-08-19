"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Toast } from "@/components/shared/Toast";
import { useImportDeck, type ImportAudioPayload, type ImportInput } from "@/hooks/useDecks";
import { parsedToImportRequest } from "@/lib/parsedToImportRequest";
import type { EditorState } from "@/lib/deckEditor";
import type { ApkgParseResponse, DeckResponse } from "@/types/api";

// Owns the deck-import mutation + its status toast. Mounted in AppShell so the
// mutation and its UI survive navigation between (app) pages — without this, the
// "Saving deck…" toast lives on /import and disappears the moment the user
// clicks Home, even though the POST is still in flight.
interface ImportContextValue {
  startImport(parsed: ApkgParseResponse): void;
  // Save the reviewed draft: the mutation uploads its images, saves the deck, and
  // imports its .apkg audio — all one operation (one "Saving…" from the first
  // click). `onSaved` runs with the created deck so the caller can drop its local
  // draft and navigate to it.
  startImportRequest(
    draft: EditorState,
    options: { isPublic: boolean; sourceFilename: string | null },
    audio?: ImportAudioPayload | null,
    onSaved?: (deck: DeckResponse) => void,
  ): void;
  retryImport(): void;
  status: "idle" | "pending" | "success" | "error";
}

const ImportContext = createContext<ImportContextValue | null>(null);

export function useImportContext(): ImportContextValue {
  const ctx = useContext(ImportContext);
  if (!ctx) {
    throw new Error("useImportContext must be used inside <ImportProvider>");
  }
  return ctx;
}

export function ImportProvider({ children }: { children: ReactNode }) {
  const importDeck = useImportDeck();
  const [dismissed, setDismissed] = useState(false);
  // Held so the error-toast "Retry" can resubmit the same save (draft + audio)
  // without bouncing the user back to /import to re-upload or re-paste.
  const [lastPayload, setLastPayload] = useState<ImportInput | null>(null);

  // A new save kicks off → reset the dismiss latch so its outcome toast appears
  // even if the previous one was dismissed.
  useEffect(() => {
    if (importDeck.status === "pending") setDismissed(false);
  }, [importDeck.status]);

  function startImportRequest(
    draft: EditorState,
    options: { isPublic: boolean; sourceFilename: string | null },
    audio?: ImportAudioPayload | null,
    onSaved?: (deck: DeckResponse) => void,
  ) {
    const payload: ImportInput = { draft, options, audio };
    setLastPayload(payload);
    setDismissed(false);
    importDeck.mutate(payload, onSaved ? { onSuccess: onSaved } : undefined);
  }

  function startImport(parsed: ApkgParseResponse) {
    const payload: ImportInput = { request: parsedToImportRequest(parsed) };
    setLastPayload(payload);
    setDismissed(false);
    importDeck.mutate(payload);
  }

  function retryImport() {
    if (!lastPayload) return;
    setDismissed(false);
    importDeck.mutate(lastPayload);
  }

  return (
    <ImportContext.Provider
      value={{ startImport, startImportRequest, retryImport, status: importDeck.status }}
    >
      {children}
      {!dismissed && importDeck.status === "pending" && (
        <Toast
          kind="pending"
          message="Saving deck to your account…"
          onDismiss={() => setDismissed(true)}
        />
      )}
      {!dismissed && importDeck.status === "success" && (
        <Toast
          kind="success"
          message="Saved to your decks"
          onDismiss={() => setDismissed(true)}
        />
      )}
      {!dismissed && importDeck.status === "error" && (
        <Toast
          kind="error"
          message="Couldn't save this deck to your account."
          actionLabel="Retry"
          onAction={retryImport}
          onDismiss={() => setDismissed(true)}
        />
      )}
    </ImportContext.Provider>
  );
}

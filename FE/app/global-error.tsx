"use client";

import { useEffect } from "react";

// Last-resort boundary for an error in the ROOT layout itself. It replaces the
// whole document (its own <html>/<body>), so the global stylesheet isn't loaded —
// styles are inlined on purpose to stay dependency-free.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          padding: "24px",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f5f1ea",
          color: "#2b2622",
        }}
      >
        <h1 style={{ fontSize: "22px", fontWeight: 700, margin: 0 }}>Something went wrong</h1>
        <p style={{ maxWidth: "28rem", fontSize: "14px", lineHeight: 1.6, color: "#6b6157", margin: 0 }}>
          The app hit an unexpected error. Please try again.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "8px",
            border: "none",
            borderRadius: "8px",
            background: "#c1663f",
            color: "#fff",
            padding: "8px 16px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}

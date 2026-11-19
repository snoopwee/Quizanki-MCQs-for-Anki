import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/siteUrl";
import { LegalPage } from "@/components/legal/LegalPage";
import { getServerLocale } from "@/lib/i18n/server";
import {
  PrivacyEnBody,
  PrivacyEnSummary,
  privacyEnDescription,
  privacyEnTitle,
  privacyEnUpdated,
} from "@/components/legal/PrivacyEn";
import {
  PrivacyViBody,
  PrivacyViSummary,
  privacyViDescription,
  privacyViTitle,
  privacyViUpdated,
} from "@/components/legal/PrivacyVi";

/**
 * A thin shell that picks a language. The two policies are whole documents in
 * `components/legal/`, not catalogue entries.
 *
 * <p>⚠ `generateMetadata` rather than `export const metadata`: the title and description have to
 * follow the locale, and the locale lives in a cookie that only a request can read. A static
 * `metadata` export is evaluated once at module load and would ship an English `<title>` on the
 * Vietnamese page — which is the whole reason the locale is a cookie and not localStorage.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const vi = locale === "vi";
  const title = vi ? privacyViTitle : privacyEnTitle;
  const description = vi ? privacyViDescription : privacyEnDescription;
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl("/privacy") },
    openGraph: { type: "website", title, description, url: absoluteUrl("/privacy") },
    twitter: { card: "summary", title, description },
  };
}

export default async function PrivacyPage() {
  const locale = await getServerLocale();
  const vi = locale === "vi";

  return (
    <LegalPage
      title={vi ? privacyViTitle : privacyEnTitle}
      updated={vi ? privacyViUpdated : privacyEnUpdated}
      summary={vi ? <PrivacyViSummary /> : <PrivacyEnSummary />}
      // Shown only on the translation. Both languages, deliberately: the reader needs it in
      // theirs, and a clause deferring to English should be unambiguous in English.
      governing={
        vi ? (
          <>
            Bản tiếng Việt này được dịch để thuận tiện cho người đọc.{" "}
            <strong className="font-medium text-ink">
              Nếu có khác biệt, bản tiếng Anh là bản có hiệu lực.
            </strong>{" "}
            <span className="text-faint">
              This Vietnamese translation is provided for convenience. If there is any
              discrepancy, the English version governs.
            </span>
          </>
        ) : undefined
      }
    >
      {vi ? <PrivacyViBody /> : <PrivacyEnBody />}
    </LegalPage>
  );
}

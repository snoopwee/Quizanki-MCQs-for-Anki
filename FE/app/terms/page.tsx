import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/siteUrl";
import { LegalPage } from "@/components/legal/LegalPage";
import { getServerLocale } from "@/lib/i18n/server";
import {
  TermsEnBody,
  TermsEnSummary,
  termsEnDescription,
  termsEnTitle,
  termsEnUpdated,
} from "@/components/legal/TermsEn";
import {
  TermsViBody,
  TermsViSummary,
  termsViDescription,
  termsViTitle,
  termsViUpdated,
} from "@/components/legal/TermsVi";

/**
 * A thin shell that picks a language; the two documents live in `components/legal/`.
 *
 * <p>⚠ `generateMetadata` rather than a static `metadata` export, for the same reason as
 * `/privacy`: the locale lives in a cookie that only a request can read, so a module-level
 * `metadata` would ship an English `<title>` on the Vietnamese page.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const vi = locale === "vi";
  const title = vi ? termsViTitle : termsEnTitle;
  const description = vi ? termsViDescription : termsEnDescription;
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl("/terms") },
    openGraph: { type: "website", title, description, url: absoluteUrl("/terms") },
    twitter: { card: "summary", title, description },
  };
}

export default async function TermsPage() {
  const locale = await getServerLocale();
  const vi = locale === "vi";

  return (
    <LegalPage
      title={vi ? termsViTitle : termsEnTitle}
      updated={vi ? termsViUpdated : termsEnUpdated}
      summary={vi ? <TermsViSummary /> : <TermsEnSummary />}
      // Shown only on the translation, in both languages: the reader needs it in theirs, and a
      // clause deferring to English should be unambiguous in English.
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
      {vi ? <TermsViBody /> : <TermsEnBody />}
    </LegalPage>
  );
}

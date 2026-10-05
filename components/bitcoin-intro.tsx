"use client"

import { useLanguage } from "@/lib/i18n"

export function BitcoinIntro() {
  const { t } = useLanguage()
  return (
    <section className="mx-auto w-full max-w-2xl px-4 pt-6 pb-4" aria-labelledby="explorer-heading">
      <h1 id="explorer-heading" className="text-lg font-semibold">{t("explorerHeading")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("explorerIntro")}
      </p>
    </section>
  )
}

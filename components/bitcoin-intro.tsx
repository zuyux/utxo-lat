"use client"

import { useLanguage } from "@/lib/i18n"

export function BitcoinIntro() {
  const { t } = useLanguage()
  return (
    <section className="sr-only" aria-labelledby="explorer-heading">
      <h1 id="explorer-heading" className="text-lg font-semibold">{t("explorerHeading")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("explorerIntro")}
      </p>
    </section>
  )
}

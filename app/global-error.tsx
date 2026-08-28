"use client"

import { ThemeProvider } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { LanguageProvider, useLanguage } from "@/lib/i18n"

function GlobalErrorContent({ reset }: { reset: () => void }) {
  const { t } = useLanguage()

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
      <div className="max-w-md text-center">
        <h1 className="font-title text-2xl font-semibold">{t("liveDataUnavailable")}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{t("tryAgainShortly")}</p>
        <Button className="mt-6" onClick={reset}>
          {t("retry")}
        </Button>
      </div>
    </main>
  )
}

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <LanguageProvider>
            <GlobalErrorContent reset={reset} />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

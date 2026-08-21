import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { SiteFooter } from "@/components/site-footer"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "sonner"
import { LanguageProvider } from "@/lib/i18n"

export const metadata: Metadata = {
  title: {
    default: "utxo.watch — Explorador de Bitcoin",
    template: "%s | utxo.watch",
  },
  description: "Explorador en tiempo real de la red Bitcoin con precios, transacciones y datos de mempool",
  metadataBase: new URL("https://utxo.watch"),
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <LanguageProvider>
            {children}
            <SiteFooter />
          </LanguageProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}

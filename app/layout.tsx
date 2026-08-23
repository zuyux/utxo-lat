import type React from "react"
import type { Metadata } from "next"
import { Bai_Jamjuree, Chakra_Petch } from "next/font/google"
import "./globals.css"
import { SiteFooter } from "@/components/site-footer"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "sonner"
import { LanguageProvider } from "@/lib/i18n"

const baiJamjuree = Bai_Jamjuree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-content",
})

const chakraPetch = Chakra_Petch({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-title",
})

export const metadata: Metadata = {
  title: {
    default: "utxo.lat — Explorador de Bitcoin",
    template: "%s | utxo.lat",
  },
  description: "Explorador en tiempo real de la red Bitcoin con precios, transacciones y datos de mempool",
  metadataBase: new URL("https://utxo.lat"),
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${baiJamjuree.variable} ${chakraPetch.variable}`}>
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

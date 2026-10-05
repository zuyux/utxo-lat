import type React from "react"
import type { Metadata } from "next"
import { Bai_Jamjuree, Chakra_Petch } from "next/font/google"
import "./globals.css"
import { NotificationsProvider } from "@/components/notifications"
import { SiteFooter } from "@/components/site-footer"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "sonner"
import { LanguageProvider } from "@/lib/i18n"
import { pageMetadata, siteDescription, siteName, siteTitle, siteUrl } from "@/lib/seo"

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
  ...pageMetadata(siteTitle, siteDescription, "/"),
  metadataBase: new URL(siteUrl),
  applicationName: siteName,
  title: { default: siteTitle, template: `%s | ${siteName}` },
  manifest: "/site.webmanifest",
  category: "technology",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
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
            <NotificationsProvider>
              {children}
              <SiteFooter />
            </NotificationsProvider>
          </LanguageProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}

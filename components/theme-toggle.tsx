"use client"

import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { PublicIcon } from "@/components/public-icon"
import { useLanguage } from "@/lib/i18n"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const { t } = useLanguage()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button variant="outline" size="sm" aria-label={t("loadingTheme")}>
        <PublicIcon name="sun" className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <Button
      variant="outline"
      size="sm"
      aria-label={t("switchTheme")}
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
    >
      {theme === "light" ? <PublicIcon name="moon" className="h-4 w-4" /> : <PublicIcon name="sun" className="h-4 w-4" />}
    </Button>
  )
}

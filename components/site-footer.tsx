"use client"

import { Github } from "lucide-react"
import { languages, useLanguage } from "@/lib/i18n"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function SiteFooter() {
  const { language, setLanguage, t } = useLanguage()

  return (
    <footer className="border-t">
      <div className="mx-auto flex min-h-14 max-w-2xl flex-col items-center justify-between gap-2 px-4 py-3 text-xs text-muted-foreground sm:flex-row">
        <p>MIT License · 2026 · zuyux</p>
        <div className="flex items-center gap-3">
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="h-8 w-[128px] text-xs" aria-label={t("language")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {languages.map((item) => (
                <SelectItem key={item.code} value={item.code}>{item.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <a
            href="https://github.com/zuyux/utxo-watch"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="utxo.watch GitHub"
          >
            <span>{t("openSource")}</span>
            <Github className="size-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    </footer>
  )
}

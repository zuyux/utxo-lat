import { Github } from "lucide-react"

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex min-h-14 max-w-2xl flex-col items-center justify-between gap-2 px-4 py-3 text-xs text-muted-foreground sm:flex-row">
        <p>MIT License · 2026 · zuyux</p>
        <a
          href="https://github.com/zuyux/utxo-watch"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="utxo.watch open-source repository on GitHub"
        >
          <span>Open Source</span>
          <Github className="size-4" aria-hidden="true" />
        </a>
      </div>
    </footer>
  )
}

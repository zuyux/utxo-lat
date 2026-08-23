import Link from "next/link"

import { CurrencyConverter } from "@/components/currency-converter"
import { Loader } from "@/components/loader"
import { SearchBar } from "@/components/search-bar"
import { ThemeToggle } from "@/components/theme-toggle"

export default function Loading() {
  return (
    <div className="min-h-screen bg-background pt-14">
      <header className="app-header">
        <div className="grid h-14 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4">
          <Link href="/" className="font-title font-semibold tracking-tight">
            utxo.lat
          </Link>

          <SearchBar className="mx-auto w-full max-w-2xl" />

          <div className="flex items-center gap-1">
            <CurrencyConverter />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="grid min-h-[calc(100vh-3.5rem)] place-items-center">
        <Loader size="lg" label="Loading" />
      </main>
    </div>
  )
}

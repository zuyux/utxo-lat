"use client"

import Link from "next/link"

import { CurrencyConverter } from "@/components/currency-converter"
import { SearchBar } from "@/components/search-bar"
import { ThemeToggle } from "@/components/theme-toggle"

export function MainHeader() {
  return (
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
  )
}

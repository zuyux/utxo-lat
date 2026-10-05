"use client"

import { useExplorerNetwork } from "@/lib/explorer-network"
import { useLanguage } from "@/lib/i18n"
import Link from "next/link"

import { Notifications } from "@/components/notifications"
import { CurrencyConverter } from "@/components/currency-converter"
import { SearchBar } from "@/components/search-bar"
import { ThemeToggle } from "@/components/theme-toggle"

export function MainHeader() {
  const { isTestnet } = useExplorerNetwork()
  const { t } = useLanguage()
  return (
    <header className="app-header">
      <div className="grid min-h-28 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0 px-4 pb-3 sm:h-14 sm:min-h-0 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-3 sm:pb-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-title font-semibold tracking-tight">
            utxo.lat
          </Link>
          <span className="hidden whitespace-nowrap text-[10px] font-medium uppercase tracking-wider text-muted-foreground lg:inline">
            {t("explorerTagline")}
          </span>
        </div>

        <SearchBar className="col-span-2 row-start-2 mx-auto w-full min-w-0 max-w-2xl sm:col-span-1 sm:col-start-2 sm:row-start-1" />

        <div className="col-start-2 row-start-1 flex items-center gap-1 sm:col-start-3">
          {isTestnet ? <span className="px-2 text-xs font-semibold text-amber-600">Testnet</span> : <CurrencyConverter />}
          <Notifications />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

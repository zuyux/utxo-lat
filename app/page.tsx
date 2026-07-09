"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"

import { BlockList } from "@/components/block-list"
import { CurrencyConverter } from "@/components/currency-converter"
import { MempoolCanvas } from "@/components/mempool-canvas"
import { NetworkStatus } from "@/components/network-status"
import { SearchBar } from "@/components/search-bar"
import { ThemeToggle } from "@/components/theme-toggle"
import { Separator } from "@/components/ui/separator"
import { apiFetch, type BlockApi } from "@/lib/mempool"

export default function BitcoinExplorer() {
  const [blocks, setBlocks] = useState<Parameters<typeof BlockList>[0]["blocks"]>([])
  const [error, setError] = useState("")

  const loadBlocks = useCallback(async () => {
    try {
      const data = await apiFetch<BlockApi[]>("/v1/blocks")
      setBlocks(data.slice(0, 10).map((block) => ({
        height: block.height,
        hash: block.id,
        transactions: block.tx_count,
        size: (block.size / 1_000_000).toFixed(2),
        timestamp: new Date(block.timestamp * 1000).toISOString(),
        miner: block.extras?.pool?.name || "Unknown pool",
      })))
      setError("")
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load blocks")
    }
  }, [])

  useEffect(() => {
    loadBlocks()
    const interval = window.setInterval(loadBlocks, 30_000)
    return () => window.clearInterval(interval)
  }, [loadBlocks])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link href="/" className="font-semibold tracking-tight">
            utxo.watch
          </Link>

          <div className="flex items-center gap-1">
            <CurrencyConverter />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <SearchBar />

        <section className="mt-8" aria-labelledby="blocks-heading">
          <div className="flex items-end justify-between pb-3">
            <div>
              <h1 id="blocks-heading" className="text-sm font-semibold">
                Latest blocks
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Bitcoin mainnet
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              Live · refreshes every 30s
            </div>
          </div>

          <Separator />
          {error && <p className="py-6 text-sm text-destructive">{error}. Please try again shortly.</p>}
          {!error && blocks.length === 0 && <p className="py-6 text-sm text-muted-foreground">Loading live blocks…</p>}
          <BlockList blocks={blocks} />
        </section>

        <NetworkStatus />
        <MempoolCanvas />
      </main>
    </div>
  )
}

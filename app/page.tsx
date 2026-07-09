"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Github } from "lucide-react"

import { BlockList } from "@/components/block-list"
import { SearchBar } from "@/components/search-bar"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

const miners = ["Foundry USA", "AntPool", "ViaBTC", "F2Pool"]
const startingHeight = 856_432

const createBlock = (height: number, minedAt: Date) => ({
  height,
  hash: Array.from({ length: 4 }, () => Math.random().toString(16).slice(2)).join("").slice(0, 64),
  transactions: Math.floor(Math.random() * 2_200) + 1_200,
  size: (Math.random() * 0.7 + 1.2).toFixed(2),
  timestamp: minedAt.toISOString(),
  miner: miners[Math.floor(Math.random() * miners.length)],
})

const initialBlocks = Array.from({ length: 10 }, (_, index) => ({
  height: startingHeight - index,
  hash: `${startingHeight - index}`.padStart(64, "0"),
  transactions: 3_148 - index * 137,
  size: (1.84 - index * 0.04).toFixed(2),
  timestamp: new Date(Date.now() - index * 10 * 60 * 1000).toISOString(),
  miner: miners[index % miners.length],
}))

export default function BitcoinExplorer() {
  const [blocks, setBlocks] = useState(initialBlocks)
  const [secondsToNextBlock, setSecondsToNextBlock] = useState(12)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSecondsToNextBlock((seconds) => {
        if (seconds > 1) return seconds - 1

        setBlocks((current) => [
          createBlock(current[0].height + 1, new Date()),
          ...current.slice(0, 9),
        ])
        return 12
      })
    }, 1000)

    return () => window.clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex size-6 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
              ₿
            </span>
            utxo.watch
          </Link>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-9" asChild>
              <a
                href="https://github.com/zuyux/utxo-watch"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View source on GitHub"
              >
                <Github className="size-4" />
              </a>
            </Button>
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
              Next block in ~{secondsToNextBlock}s
            </div>
          </div>

          <Separator />
          <BlockList blocks={blocks} />
        </section>
      </main>
    </div>
  )
}

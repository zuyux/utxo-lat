"use client"

import { useCallback, useEffect, useState } from "react"

import { BlockList } from "@/components/block-list"
import { Loader } from "@/components/loader"
import { MainHeader } from "@/components/main-header"
import { MempoolCanvas } from "@/components/mempool-canvas"
import { NetworkStatus } from "@/components/network-status"
import { RecentBlockStrip } from "@/components/recent-block-strip"
import { Separator } from "@/components/ui/separator"
import { useLanguage } from "@/lib/i18n"
import { apiFetch, type BlockApi } from "@/lib/mempool"

export default function BitcoinExplorer() {
  const [blocks, setBlocks] = useState<Parameters<typeof BlockList>[0]["blocks"]>([])
  const [error, setError] = useState("")
  const [initialLoading, setInitialLoading] = useState(true)
  const { t } = useLanguage()

  const loadBlocks = useCallback(async () => {
    try {
      const data = await apiFetch<BlockApi[]>("/v1/blocks")
      setBlocks(data.slice(0, 10).map((block) => ({
        height: block.height,
        hash: block.id,
        transactions: block.tx_count,
        size: (block.size / 1_000_000).toFixed(2),
        timestamp: new Date(block.timestamp * 1000).toISOString(),
        miner: block.extras?.pool?.name || t("unknownPool"),
      })))
      setError("")
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t("unableBlocks"))
    } finally {
      setInitialLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadBlocks()
    const interval = window.setInterval(loadBlocks, 30_000)
    return () => window.clearInterval(interval)
  }, [loadBlocks])

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-background pt-14">
        <MainHeader />

        <main className="grid min-h-[calc(100vh-3.5rem)] place-items-center">
          <Loader size="lg" label={t("loadingLiveBlocks")} />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pt-14">
      <MainHeader />

      <main className="w-full">
        <div className="w-full px-4">
          <RecentBlockStrip blocks={blocks} />
        </div>

        <div className="mx-auto w-full max-w-2xl px-4 py-8">
          <section aria-labelledby="blocks-heading">
            <div className="flex items-end justify-between pb-3">
              <div>
                <h1 id="blocks-heading" className="text-sm font-semibold">
                  {t("latestBlocks")}
                </h1>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("bitcoinMainnet")}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#0000FF] dark:bg-[#00e5ff] opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-[#0000FF] dark:bg-[#00e5ff]" />
                </span>
                {t("liveRefresh30")}
              </div>
            </div>

            <Separator />
            {error && <p className="py-6 text-sm text-destructive">{error}. {t("tryAgainShortly")}</p>}
            <BlockList blocks={blocks} />
          </section>

          <NetworkStatus />
          <MempoolCanvas />
        </div>
      </main>
    </div>
  )
}

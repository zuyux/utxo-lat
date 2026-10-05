"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"

import { LatestTransactionList, type LatestTransaction } from "@/components/latest-transaction-list"
import { Loader } from "@/components/loader"
import { MainHeader } from "@/components/main-header"
import { MempoolCanvas } from "@/components/mempool-canvas"
import { NetworkStatus } from "@/components/network-status"
import { RecentBlockStrip } from "@/components/recent-block-strip"
import { Separator } from "@/components/ui/separator"
import {
  currencySelectionChangeEvent,
  currencyStorageKey,
  isCurrencyCode,
  type CurrencyCode,
} from "@/lib/currencies"
import { useLanguage } from "@/lib/i18n"
import { apiFetch, type BlockApi } from "@/lib/mempool"

interface RecentMempoolTransaction {
  txid: string
  fee: number
  vsize: number
  value: number
}

interface MempoolWebSocketMessage {
  transactions?: RecentMempoolTransaction[]
}

type PriceResponse = { time: number; source: string } & Partial<Record<CurrencyCode, number>>

const MEMPOOL_WS =
  process.env.NEXT_PUBLIC_MEMPOOL_WS_URL?.replace(/^http/, "ws").replace(/\/$/, "") ||
  ""

const MAX_LATEST_TRANSACTIONS = 12

export default function BitcoinExplorer({ children }: { children?: ReactNode }) {
  const [blocks, setBlocks] = useState<Parameters<typeof RecentBlockStrip>[0]["blocks"]>([])
  const [transactions, setTransactions] = useState<LatestTransaction[]>([])
  const [prices, setPrices] = useState<PriceResponse | null>(null)
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>("USD")
  const [error, setError] = useState("")
  const [initialLoading, setInitialLoading] = useState(true)
  const { t } = useLanguage()
  const reconnectTimeoutRef = useRef<number | null>(null)
  const transactionsCountRef = useRef(0)

  const updateTransactions = useCallback((recentTxs: RecentMempoolTransaction[]) => {
    if (recentTxs.length === 0) return

    const seenAt = new Date().toISOString()
    setTransactions((current) => {
      const merged = [
        ...recentTxs.map((transaction) => ({ ...transaction, seenAt })),
        ...current,
      ]
      const deduped = new Map<string, LatestTransaction>()
      for (const transaction of merged) {
        if (!deduped.has(transaction.txid)) deduped.set(transaction.txid, transaction)
      }
      const nextTransactions = Array.from(deduped.values()).slice(0, MAX_LATEST_TRANSACTIONS)
      transactionsCountRef.current = nextTransactions.length
      return nextTransactions
    })
  }, [])

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
      setError(requestError instanceof Error ? requestError.message : t("liveDataUnavailable"))
    } finally {
      setInitialLoading(false)
    }
  }, [t])

  const loadRecentTransactions = useCallback(async () => {
    try {
      const recentTxs = await apiFetch<RecentMempoolTransaction[]>("/mempool/recent")
      updateTransactions(recentTxs)
      if (recentTxs.length > 0) setError("")
    } catch (requestError) {
      if (transactionsCountRef.current === 0) {
        setError(requestError instanceof Error ? requestError.message : t("liveDataUnavailable"))
      }
    } finally {
      setInitialLoading(false)
    }
  }, [t, updateTransactions])

  const loadPrices = useCallback(async () => {
    try {
      const response = await fetch("/api/prices", { cache: "no-store" })
      if (!response.ok) throw new Error("Price unavailable")
      setPrices(await response.json() as PriceResponse)
    } catch {
      setPrices(null)
    }
  }, [])

  useEffect(() => {
    const syncSelectedCurrency = (value: string | null) => {
      if (isCurrencyCode(value)) setSelectedCurrency(value)
    }

    syncSelectedCurrency(window.localStorage.getItem(currencyStorageKey))

    const handleCurrencySelection = (event: Event) => {
      syncSelectedCurrency((event as CustomEvent<string>).detail)
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === currencyStorageKey) syncSelectedCurrency(event.newValue)
    }

    window.addEventListener(currencySelectionChangeEvent, handleCurrencySelection)
    window.addEventListener("storage", handleStorage)
    return () => {
      window.removeEventListener(currencySelectionChangeEvent, handleCurrencySelection)
      window.removeEventListener("storage", handleStorage)
    }
  }, [])

  useEffect(() => {
    loadBlocks()
    loadRecentTransactions()
    loadPrices()
    const blockInterval = window.setInterval(loadBlocks, 5_000)
    const priceInterval = window.setInterval(loadPrices, 60_000)
    return () => {
      window.clearInterval(blockInterval)
      window.clearInterval(priceInterval)
    }
  }, [loadBlocks, loadPrices, loadRecentTransactions])

  useEffect(() => {
    let closed = false
    let socket: WebSocket | null = null
    let fallbackInterval: number | null = null

    const startFallback = () => {
      if (fallbackInterval != null) return
      fallbackInterval = window.setInterval(loadRecentTransactions, 3_000)
    }

    const stopFallback = () => {
      if (fallbackInterval == null) return
      window.clearInterval(fallbackInterval)
      fallbackInterval = null
    }

    if (!MEMPOOL_WS) {
      startFallback()
      return () => {
        closed = true
        if (fallbackInterval != null) window.clearInterval(fallbackInterval)
      }
    }

    const connect = () => {
      socket = new WebSocket(MEMPOOL_WS)

      socket.addEventListener("open", () => {
        stopFallback()
        socket?.send(JSON.stringify({ action: "want", data: ["blocks", "stats", "mempool-blocks"] }))
      })

      socket.addEventListener("message", (event) => {
        try {
          const message = JSON.parse(event.data as string) as MempoolWebSocketMessage
          if (message.transactions) {
            updateTransactions(message.transactions)
            setError("")
            setInitialLoading(false)
          }
        } catch {
          // Ignore malformed socket frames and wait for the next update.
        }
      })

      socket.addEventListener("error", () => {
        startFallback()
      })

      socket.addEventListener("close", () => {
        if (closed) return
        startFallback()
        reconnectTimeoutRef.current = window.setTimeout(connect, 5_000)
      })
    }

    connect()

    return () => {
      closed = true
      if (reconnectTimeoutRef.current != null) window.clearTimeout(reconnectTimeoutRef.current)
      if (fallbackInterval != null) window.clearInterval(fallbackInterval)
      socket?.close()
    }
  }, [loadRecentTransactions, updateTransactions])

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-background pt-28 sm:pt-14">
        <MainHeader />

        <main>
          {children}
          <div className="grid min-h-[50vh] place-items-center">
          <Loader size="lg" label={t("loadingLiveBlocks")} />
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pt-28 sm:pt-14">
      <MainHeader />

      <main className="w-full">
        {children}
        <div className="w-full px-4">
          <RecentBlockStrip blocks={blocks} />
        </div>

        <div className="mx-auto w-full max-w-2xl px-4 py-8">
          <section aria-labelledby="transactions-heading">
            <div className="flex items-end justify-between pb-3">
              <div>
                <h2 id="transactions-heading" className="text-sm font-semibold">
                  Latest Transactions
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Bitcoin
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#0000FF] dark:bg-[#00e5ff] opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-[#0000FF] dark:bg-[#00e5ff]" />
                </span>
                {t("liveRefresh5")}
              </div>
            </div>

            <Separator />
            {error && <p className="py-6 text-sm text-destructive">{error}. {t("tryAgainShortly")}</p>}
            <LatestTransactionList
              transactions={transactions}
              fiatCurrency={selectedCurrency}
              fiatRate={prices?.[selectedCurrency] ?? null}
            />
          </section>

          <NetworkStatus />
          <MempoolCanvas />
        </div>
      </main>
    </div>
  )
}

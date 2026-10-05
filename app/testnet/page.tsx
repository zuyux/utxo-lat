"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { MainHeader } from "@/components/main-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { testnetApi } from "@/lib/explorer-network"
import { type BlockApi, satsToBtc } from "@/lib/mempool"

interface Mempool {
  count: number
  vsize: number
  total_fee: number
  fee_histogram: [number, number][]
}
interface RecentTransaction {
  txid: string
  fee: number
  vsize: number
  value: number
}
const example =
  "3fa35efd27803c8bcacea1b15da8aa86a97f203ced6bd7e6dd39b3c93f7e5e2f"

export default function TestnetPage() {
  const [blocks, setBlocks] = useState<BlockApi[]>([])
  const [mempool, setMempool] = useState<Mempool | null>(null)
  const [transactions, setTransactions] = useState<RecentTransaction[] | null>(
    null,
  )
  const [fees, setFees] = useState<Record<string, number> | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [updated, setUpdated] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [olderLoading, setOlderLoading] = useState(false)
  const load = useCallback(async (signal?: AbortSignal) => {
    const results = await Promise.allSettled([
      testnetApi.apiFetch<BlockApi[]>("/blocks", signal),
      testnetApi.apiFetch<Mempool>("/mempool", signal),
      testnetApi.apiFetch<RecentTransaction[]>("/mempool/recent", signal),
      testnetApi.apiFetch<Record<string, number>>("/fee-estimates", signal),
    ])
    if (signal?.aborted) return
    const [blockResult, mempoolResult, txResult, feeResult] = results
    if (blockResult.status === "fulfilled")
      setBlocks((current) => [
        ...blockResult.value,
        ...current.filter(
          (block) => block.height < (blockResult.value.at(-1)?.height ?? 0),
        ),
      ])
    if (mempoolResult.status === "fulfilled") setMempool(mempoolResult.value)
    if (txResult.status === "fulfilled") setTransactions(txResult.value)
    if (feeResult.status === "fulfilled") setFees(feeResult.value)
    const labels = [
      "Recent blocks",
      "Mempool",
      "Recent transactions",
      "Fee estimates",
    ]
    setErrors(
      results.flatMap((result, index) =>
        result.status === "rejected"
          ? [
              `${labels[index]} unavailable. Any previously loaded data may be stale.`,
            ]
          : [],
      ),
    )
    if (results.some((result) => result.status === "fulfilled"))
      setUpdated(new Date().toLocaleTimeString())
    setLoading(false)
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    const interval = window.setInterval(
      () => void load(controller.signal),
      15_000,
    )
    return () => {
      controller.abort()
      window.clearInterval(interval)
    }
  }, [load])
  const olderBlocks = async () => {
    const last = blocks.at(-1)
    if (!last || last.height === 0) return
    setOlderLoading(true)
    try {
      const older = await testnetApi.apiFetch<BlockApi[]>(
        `/blocks/${last.height - 1}`,
      )
      setBlocks((current) => [
        ...current,
        ...older.filter(
          (block) => !current.some((existing) => existing.id === block.id),
        ),
      ])
    } catch {
      setErrors((current) => [
        ...current,
        "Older blocks unavailable. Please retry.",
      ])
    } finally {
      setOlderLoading(false)
    }
  }
  const metrics = [
    ["Chain height", blocks[0]?.height.toLocaleString() ?? "—"],
    ["Unconfirmed transactions", mempool?.count.toLocaleString() ?? "—"],
    [
      "Mempool size",
      mempool ? `${(mempool.vsize / 1_000_000).toFixed(2)} MvB` : "—",
    ],
    ["Mempool fees", mempool ? `${satsToBtc(mempool.total_fee)} tBTC` : "—"],
    ["Latest difficulty", blocks[0]?.difficulty.toLocaleString() ?? "—"],
    [
      "Latest block",
      blocks[0] ? new Date(blocks[0].timestamp * 1000).toLocaleString() : "—",
    ],
  ]
  return (
    <div className="min-h-screen bg-background pt-14">
      <MainHeader />
      <main className="container mx-auto space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-amber-600">
              Bitcoin Testnet3
            </p>
            <h1 className="text-3xl font-bold">Testnet explorer</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Explore test transactions, blocks, addresses, and unspent outputs.
              Testnet coins have no monetary value.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => void load()}
            disabled={loading}
          >
            Refresh
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 p-4 text-sm">
          <Link
            className="text-primary hover:underline"
            href={`/testnet/tx/${example}`}
          >
            Explore the example transaction →
          </Link>
          <span className="text-xs text-muted-foreground" role="status">
            {loading
              ? "Loading testnet data…"
              : `Refreshes every 15 seconds${updated ? ` · Updated ${updated}` : ""}`}
          </span>
        </div>
        {errors.length > 0 && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive"
          >
            {errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map(([label, value]) => (
            <Card key={label}>
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-2 break-words text-lg font-semibold tabular-nums">
                  {value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Fee estimates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-4">
              {[1, 3, 6, 144].map((target) => (
                <div key={target}>
                  <p className="text-xs text-muted-foreground">
                    {target === 1 ? "Next block" : `${target} blocks`}
                  </p>
                  <p className="mt-1 font-semibold">
                    {fees?.[String(target)] != null
                      ? `${fees[String(target)].toFixed(2)} sat/vB`
                      : "—"}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Confirmation targets are estimates. Testnet block intervals can
              vary.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent blocks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="p-3">Height</th>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Transactions</th>
                    <th className="p-3">Size</th>
                    <th className="p-3">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {blocks.map((block) => (
                    <tr key={block.id} className="border-b">
                      <td className="p-3">
                        <Link
                          className="font-mono text-primary hover:underline"
                          href={`/testnet/block/${block.id}`}
                        >
                          {block.height.toLocaleString()}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap p-3">
                        {new Date(block.timestamp * 1000).toLocaleString()}
                      </td>
                      <td className="p-3">{block.tx_count.toLocaleString()}</td>
                      <td className="whitespace-nowrap p-3">
                        {(block.size / 1_000_000).toFixed(2)} MB
                      </td>
                      <td className="whitespace-nowrap p-3">
                        {block.weight.toLocaleString()} WU
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!loading && blocks.length === 0 && (
              <p className="py-4 text-sm text-muted-foreground">
                No blocks available. Try refreshing.
              </p>
            )}
            {blocks.length > 0 && blocks.at(-1)!.height > 0 && (
              <Button
                className="mt-4"
                variant="outline"
                onClick={olderBlocks}
                disabled={olderLoading}
              >
                {olderLoading ? "Loading…" : "Load older blocks"}
              </Button>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Latest mempool transactions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {transactions?.map((tx) => (
              <div
                key={tx.txid}
                className="flex flex-wrap justify-between gap-2 border-b pb-3"
              >
                <Link
                  className="min-w-0 break-all font-mono text-xs text-primary hover:underline"
                  href={`/testnet/tx/${tx.txid}`}
                >
                  {tx.txid}
                </Link>
                <div className="text-xs text-muted-foreground">
                  {satsToBtc(tx.value)} tBTC ·{" "}
                  {tx.vsize > 0 ? (tx.fee / tx.vsize).toFixed(2) : "—"} sat/vB
                </div>
              </div>
            ))}
            {transactions?.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No recent mempool transactions.
              </p>
            )}
            {transactions === null && (
              <p className="text-sm text-muted-foreground">
                {loading
                  ? "Loading transactions…"
                  : "Recent transactions unavailable."}
              </p>
            )}
          </CardContent>
        </Card>
        {mempool && (
          <Card>
            <CardHeader>
              <CardTitle>Mempool fee distribution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {mempool.fee_histogram.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  The mempool is empty.
                </p>
              ) : (
                mempool.fee_histogram.map(([rate, size], index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[6rem_1fr_6rem] items-center gap-3 text-xs"
                  >
                    <span>{rate.toFixed(2)} sat/vB</span>
                    <div className="h-2 overflow-hidden rounded bg-muted">
                      <div
                        className="h-full bg-primary"
                        style={{
                          width: `${Math.max(1, (size / Math.max(...mempool.fee_histogram.map((bin) => bin[1]), 1)) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-right">
                      {size.toLocaleString()} vB
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}

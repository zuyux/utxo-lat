"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Copy } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { apiFetch, type MempoolTransaction, satsToBtc } from "@/lib/mempool"

interface Outspend {
  spent: boolean
  txid?: string
  vin?: number
}

interface CpfpRelative {
  txid: string
  weight: number
  fee: number
}

interface CpfpInfo {
  ancestors: CpfpRelative[]
  descendants?: CpfpRelative[]
  bestDescendant?: CpfpRelative | null
  effectiveFeePerVsize?: number
}

interface RbfTransaction {
  txid: string
  fee: number
  vsize: number
  value: number
  rate?: number
  rbf?: boolean
  fullRbf?: boolean
}

interface RbfTree {
  tx: RbfTransaction
  time: number
  fullRbf: boolean
  replaces: RbfTree[]
}

interface RbfHistory {
  replacements: RbfTree | null
  replaces: string[] | null
}

export default function TransactionPage() {
  const { txid } = useParams<{ txid: string }>()
  const router = useRouter()
  const [transaction, setTransaction] = useState<MempoolTransaction | null>(null)
  const [outspends, setOutspends] = useState<Outspend[]>([])
  const [tipHeight, setTipHeight] = useState<number | null>(null)
  const [cpfp, setCpfp] = useState<CpfpInfo | null>(null)
  const [rbfHistory, setRbfHistory] = useState<RbfHistory | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError("")

    const load = async () => {
      try {
        const tx = await apiFetch<MempoolTransaction>(`/tx/${txid}`, controller.signal)
        setTransaction(tx)
        const [spends, height, cpfpInfo, history] = await Promise.allSettled([
          apiFetch<Outspend[]>(`/tx/${txid}/outspends`, controller.signal),
          apiFetch<number>("/blocks/tip/height", controller.signal),
          apiFetch<CpfpInfo>(`/v1/cpfp/${txid}`, controller.signal),
          apiFetch<RbfHistory>(`/v1/tx/${txid}/rbf`, controller.signal),
        ])
        if (spends.status === "fulfilled") setOutspends(spends.value)
        if (height.status === "fulfilled") setTipHeight(height.value)
        if (cpfpInfo.status === "fulfilled") setCpfp(cpfpInfo.value)
        if (history.status === "fulfilled") setRbfHistory(history.value)
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return
        setError(requestError instanceof Error ? requestError.message : "Unable to load transaction")
      } finally {
        setLoading(false)
      }
    }
    load()

    return () => controller.abort()
  }, [txid])

  const totals = useMemo(() => {
    const input = transaction?.vin.reduce((sum, vin) => sum + (vin.prevout?.value ?? 0), 0) ?? 0
    const output = transaction?.vout.reduce((sum, vout) => sum + vout.value, 0) ?? 0
    return { input, output }
  }, [transaction])

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard")
  }

  if (loading) return <PageMessage onBack={() => router.back()} message="Loading live transaction data…" />
  if (error || !transaction) {
    return <PageMessage onBack={() => router.back()} title="Transaction not found" message={error || "No transaction data was returned."} />
  }

  const confirmations =
    transaction.status.confirmed && transaction.status.block_height != null && tipHeight != null
      ? Math.max(0, tipHeight - transaction.status.block_height + 1)
      : 0
  const vsize = transaction.weight / 4
  const isCoinbase = transaction.vin.some((vin) => vin.is_coinbase)
  const signalsRbf = !isCoinbase && transaction.vin.some((vin) => vin.sequence < 0xfffffffe)
  const locktimeEnabled = transaction.locktime > 0 && transaction.vin.some((vin) => vin.sequence < 0xffffffff)
  const nominalFeeRate = isCoinbase ? 0 : transaction.fee / vsize
  const effectiveFeeRate = cpfp?.effectiveFeePerVsize
  const replacementTree = rbfHistory?.replacements ? flattenRbfTree(rbfHistory.replacements) : []

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => router.back()}><ArrowLeft className="mr-2 size-4" />Back</Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="mb-2 text-3xl font-bold">Transaction Details</h1>
          <div className="flex items-center gap-2">
            <code className="min-w-0 break-all rounded bg-muted px-2 py-1 text-sm">{transaction.txid}</code>
            <Button variant="ghost" size="sm" onClick={() => copy(transaction.txid)} aria-label="Copy transaction ID"><Copy className="size-4" /></Button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <InfoCard title="Status" rows={[
            ["State", transaction.status.confirmed ? `${confirmations.toLocaleString()} confirmation${confirmations === 1 ? "" : "s"}` : "Unconfirmed"],
            ["Block", transaction.status.block_height?.toLocaleString() ?? "Not yet mined"],
            ["Timestamp", transaction.status.block_time ? new Date(transaction.status.block_time * 1000).toLocaleString() : "Pending"],
          ]} />
          <InfoCard title="Transaction info" rows={[
            ["Fee", isCoinbase ? "Coinbase (no fee)" : `${satsToBtc(transaction.fee)} BTC`],
            ["Size", `${transaction.size.toLocaleString()} bytes`],
            ["Virtual size", `${vsize.toLocaleString(undefined, { maximumFractionDigits: 2 })} vB`],
            ["Fee rate", isCoinbase ? "—" : `${nominalFeeRate.toFixed(2)} sat/vB`],
          ]} />
          <InfoCard title="Amounts" rows={[
            ["Total input", isCoinbase ? "Newly issued coins" : `${satsToBtc(totals.input)} BTC`],
            ["Total output", `${satsToBtc(totals.output)} BTC`],
          ]} />
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Replacement & fee dependencies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <PolicyMetric
                label="Replace-by-fee"
                value={isCoinbase ? "Not applicable" : signalsRbf ? "Opt-in RBF signaled" : "Not signaled"}
                detail={signalsRbf ? "At least one input sequence permits replacement" : "No input explicitly opts in"}
              />
              <PolicyMetric
                label="Locktime"
                value={formatLocktime(transaction.locktime, locktimeEnabled)}
                detail={locktimeEnabled ? "Enforced by non-final input sequence" : transaction.locktime ? "Ignored because every input is final" : "No time or height constraint"}
              />
              <PolicyMetric
                label="CPFP package"
                value={
                  cpfp && ((cpfp.ancestors?.length ?? 0) > 0 || (cpfp.descendants?.length ?? 0) > 0)
                    ? `${cpfp.ancestors?.length ?? 0} parent · ${cpfp.descendants?.length ?? 0} child`
                    : "No dependencies found"
                }
                detail={
                  effectiveFeeRate != null
                    ? `Effective rate ${effectiveFeeRate.toFixed(2)} sat/vB`
                    : "Effective rate matches the transaction rate"
                }
              />
              <PolicyMetric
                label="Replacement history"
                value={replacementTree.length > 1 ? `${replacementTree.length} versions` : "No replacements found"}
                detail={replacementTree.some(({ tree }) => tree.fullRbf) ? "Includes full-RBF replacement" : "No full-RBF replacement recorded"}
              />
            </div>

            {cpfp && [...(cpfp.ancestors ?? []), ...(cpfp.descendants ?? [])].length > 0 && (
              <DependencyLinks
                title="Related package transactions"
                transactions={[...(cpfp.ancestors ?? []), ...(cpfp.descendants ?? [])]}
              />
            )}

            {replacementTree.length > 1 && (
              <div className="mt-6 border-t pt-5">
                <h3 className="text-sm font-semibold">Replacement timeline</h3>
                <div className="mt-3 space-y-2">
                  {replacementTree.map(({ tree, depth }, index) => (
                    <div key={tree.tx.txid} className="flex flex-col justify-between gap-2 rounded-md border p-3 text-sm sm:flex-row sm:items-center">
                      <div className="min-w-0" style={{ paddingLeft: `${depth * 12}px` }}>
                        <Link href={`/tx/${tree.tx.txid}`} className="break-all font-mono text-xs hover:underline">
                          {tree.tx.txid}
                        </Link>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(tree.time * 1000).toLocaleString()} · {tree.fullRbf ? "Full RBF" : tree.tx.rbf ? "Opt-in RBF" : "Replacement"}
                        </p>
                      </div>
                      <div className="shrink-0 text-left sm:text-right">
                        <p className="font-medium">{(tree.tx.rate ?? tree.tx.fee / tree.tx.vsize).toFixed(2)} sat/vB</p>
                        <p className="text-xs text-muted-foreground">{index === 0 ? "Latest version" : "Replaced version"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ArrowDownLeft className="size-4" />Inputs ({transaction.vin.length})</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {transaction.vin.map((input, index) => (
                <div key={`${input.txid}-${input.vout}-${index}`} className="rounded-lg border p-4">
                  {input.is_coinbase ? (
                    <div className="font-medium">Coinbase (newly generated coins)</div>
                  ) : (
                    <>
                      <Address value={input.prevout?.scriptpubkey_address} fallback={input.prevout?.scriptpubkey_type || "Unknown script"} />
                      <div className="mt-2 font-medium">{input.prevout ? satsToBtc(input.prevout.value) : "Unknown"} BTC</div>
                      <Link className="mt-2 block break-all font-mono text-xs text-muted-foreground hover:underline" href={`/tx/${input.txid}`}>
                        Previous output: {input.txid}:{input.vout}
                      </Link>
                      <div className="mt-1 font-mono text-xs text-muted-foreground">
                        Sequence: {input.sequence.toLocaleString()} (0x{input.sequence.toString(16).padStart(8, "0")})
                      </div>
                    </>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ArrowUpRight className="size-4" />Outputs ({transaction.vout.length})</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {transaction.vout.map((output, index) => (
                <div key={`${output.scriptpubkey}-${index}`} className="rounded-lg border p-4">
                  <Address value={output.scriptpubkey_address} fallback={output.scriptpubkey_type} />
                  <div className="mt-2 font-medium">{satsToBtc(output.value)} BTC</div>
                  <Badge variant={outspends[index]?.spent ? "secondary" : "default"} className="mt-2">
                    {outspends[index]?.spent ? "Spent" : "Unspent"}
                  </Badge>
                  {outspends[index]?.txid && (
                    <Link href={`/tx/${outspends[index].txid}`} className="ml-2 text-xs text-muted-foreground hover:underline">View spending transaction</Link>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

function Address({ value, fallback }: { value?: string; fallback: string }) {
  return value
    ? <Link href={`/address/${value}`} className="break-all font-mono text-sm text-primary hover:underline">{value}</Link>
    : <span className="break-all font-mono text-sm text-muted-foreground">{fallback}</span>
}

function InfoCard({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {rows.map(([label, value]) => <div key={label} className="flex items-start justify-between gap-4"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium">{value}</span></div>)}
      </CardContent>
    </Card>
  )
}

function PolicyMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
    </div>
  )
}

function DependencyLinks({ title, transactions }: { title: string; transactions: CpfpRelative[] }) {
  const unique = Array.from(new Map(transactions.map((transaction) => [transaction.txid, transaction])).values())
  return (
    <div className="mt-6 border-t pt-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {unique.map((transaction) => (
          <Link key={transaction.txid} href={`/tx/${transaction.txid}`} className="rounded-md border p-3 hover:bg-muted/50">
            <p className="break-all font-mono text-xs">{transaction.txid}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {(transaction.fee / (transaction.weight / 4)).toFixed(2)} sat/vB · {satsToBtc(transaction.fee)} BTC fee
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}

function flattenRbfTree(tree: RbfTree, depth = 0): Array<{ tree: RbfTree; depth: number }> {
  return [
    { tree, depth },
    ...tree.replaces.flatMap((replacement) => flattenRbfTree(replacement, depth + 1)),
  ]
}

function formatLocktime(locktime: number, enabled: boolean) {
  if (locktime === 0) return "Disabled"
  if (!enabled) return `${locktime.toLocaleString()} (not enforced)`
  if (locktime < 500_000_000) return `Block ${locktime.toLocaleString()}`
  return new Date(locktime * 1000).toLocaleString()
}

function PageMessage({ onBack, title, message }: { onBack: () => void; title?: string; message: string }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b"><div className="container mx-auto px-4 py-4"><Button variant="ghost" onClick={onBack}><ArrowLeft className="mr-2 size-4" />Back</Button></div></header>
      <main className="container mx-auto px-4 py-20 text-center">
        {title && <h1 className="mb-3 text-2xl font-bold">{title}</h1>}
        <p className="text-muted-foreground">{message}</p>
      </main>
    </div>
  )
}

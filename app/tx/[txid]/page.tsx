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

export default function TransactionPage() {
  const { txid } = useParams<{ txid: string }>()
  const router = useRouter()
  const [transaction, setTransaction] = useState<MempoolTransaction | null>(null)
  const [outspends, setOutspends] = useState<Outspend[]>([])
  const [tipHeight, setTipHeight] = useState<number | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError("")

    Promise.all([
      apiFetch<MempoolTransaction>(`/tx/${txid}`, controller.signal),
      apiFetch<Outspend[]>(`/tx/${txid}/outspends`, controller.signal),
      apiFetch<number>("/blocks/tip/height", controller.signal),
    ])
      .then(([tx, spends, height]) => {
        setTransaction(tx)
        setOutspends(spends)
        setTipHeight(height)
      })
      .catch((requestError) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return
        setError(requestError instanceof Error ? requestError.message : "Unable to load transaction")
      })
      .finally(() => setLoading(false))

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
            ["Fee rate", isCoinbase ? "—" : `${(transaction.fee / vsize).toFixed(2)} sat/vB`],
          ]} />
          <InfoCard title="Amounts" rows={[
            ["Total input", isCoinbase ? "Newly issued coins" : `${satsToBtc(totals.input)} BTC`],
            ["Total output", `${satsToBtc(totals.output)} BTC`],
          ]} />
        </div>

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

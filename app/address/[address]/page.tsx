"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Copy, ExternalLink, TrendingUp, TrendingDown, Wallet } from "lucide-react"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { apiFetch, type MempoolTransaction, satsToBtc } from "@/lib/mempool"

interface AddressTransaction {
  txid: string
  type: "sent" | "received"
  amount: string
  confirmations: number
  timestamp: string
  blockHeight: number
}

interface AddressDetail {
  address: string
  balance: string
  totalReceived: string
  totalSent: string
  transactionCount: number
  firstSeen: string
  lastSeen: string
  transactions: AddressTransaction[]
}

interface AddressStats {
  address: string
  chain_stats: { tx_count: number; funded_txo_sum: number; spent_txo_sum: number }
  mempool_stats: { tx_count: number; funded_txo_sum: number; spent_txo_sum: number }
}

const fetchAddressDetail = async (address: string): Promise<AddressDetail> => {
  const stats = await apiFetch<AddressStats>(`/address/${encodeURIComponent(address)}`)
  const [txResult, tipResult] = await Promise.allSettled([
    apiFetch<MempoolTransaction[]>(`/address/${encodeURIComponent(address)}/txs`),
    apiFetch<number>("/blocks/tip/height"),
  ])
  const txs = txResult.status === "fulfilled" ? txResult.value : []
  const tip = tipResult.status === "fulfilled" ? tipResult.value : 0
  const received = stats.chain_stats.funded_txo_sum + stats.mempool_stats.funded_txo_sum
  const sent = stats.chain_stats.spent_txo_sum + stats.mempool_stats.spent_txo_sum
  const transactions = txs.map((tx) => {
    const incoming = tx.vout.filter((output) => output.scriptpubkey_address === address).reduce((sum, output) => sum + output.value, 0)
    const outgoing = tx.vin.filter((input) => input.prevout?.scriptpubkey_address === address).reduce((sum, input) => sum + (input.prevout?.value ?? 0), 0)
    const net = incoming - outgoing
    return {
      txid: tx.txid,
      type: net >= 0 ? "received" as const : "sent" as const,
      amount: satsToBtc(Math.abs(net)),
      confirmations: tx.status.confirmed && tx.status.block_height && tip > 0 ? tip - tx.status.block_height + 1 : 0,
      timestamp: tx.status.block_time ? new Date(tx.status.block_time * 1000).toISOString() : new Date().toISOString(),
      blockHeight: tx.status.block_height ?? 0,
    }
  })
  const confirmedDates = transactions.filter((tx) => tx.blockHeight > 0).map((tx) => tx.timestamp)
  return {
    address: stats.address,
    balance: satsToBtc(received - sent),
    totalReceived: satsToBtc(received),
    totalSent: satsToBtc(sent),
    transactionCount: stats.chain_stats.tx_count + stats.mempool_stats.tx_count,
    firstSeen: confirmedDates.at(-1) || new Date().toISOString(),
    lastSeen: confirmedDates[0] || new Date().toISOString(),
    transactions,
  }
}

export default function AddressPage() {
  const params = useParams()
  const router = useRouter()
  const address = params.address as string
  const [addressDetail, setAddressDetail] = useState<AddressDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const fetchAddress = async () => {
      setLoading(true)
      setError("")
      try {
        setAddressDetail(await fetchAddressDetail(address))
      } catch (requestError) {
        setAddressDetail(null)
        setError(requestError instanceof Error ? requestError.message : "Unable to load address")
      } finally {
        setLoading(false)
      }
    }

    fetchAddress()
  }, [address])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4">
            <Button variant="ghost" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </div>
        </header>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading address details...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!addressDetail) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4">
            <Button variant="ghost" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </div>
        </header>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Address Not Found</h1>
            <p className="text-muted-foreground">{error || "The address you searched for does not exist."}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Address Details</h1>
          <div className="flex items-center gap-2">
            <code className="text-sm bg-muted px-2 py-1 rounded break-all">{addressDetail.address}</code>
            <Button variant="ghost" size="sm" onClick={() => copyToClipboard(addressDetail.address)}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Balance</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{addressDetail.balance} BTC</div>
              <p className="text-xs text-muted-foreground">Confirmed and mempool totals</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Received</CardTitle>
              <TrendingDown className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{addressDetail.totalReceived} BTC</div>
              <p className="text-xs text-muted-foreground">All time received</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
              <TrendingUp className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{addressDetail.totalSent} BTC</div>
              <p className="text-xs text-muted-foreground">All time sent</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Transactions</CardTitle>
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{addressDetail.transactionCount}</div>
              <p className="text-xs text-muted-foreground">Total transactions</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="transactions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="info">Address Info</TabsTrigger>
          </TabsList>

          <TabsContent value="transactions">
            <Card>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>Newest transactions returned by the live indexer</CardDescription>
              </CardHeader>
              <CardContent>
                {addressDetail.transactions.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Transaction history is temporarily unavailable. Address totals above are current.
                  </p>
                )}
                <div className="space-y-4">
                  {addressDetail.transactions.map((tx) => (
                    <div
                      key={tx.txid}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            tx.type === "received" ? "bg-green-100" : "bg-red-100"
                          }`}
                        >
                          {tx.type === "received" ? (
                            <TrendingDown className="w-4 h-4 text-green-600" />
                          ) : (
                            <TrendingUp className="w-4 h-4 text-red-600" />
                          )}
                        </div>
                        <div>
                          <Button
                            variant="link"
                            className="p-0 h-auto font-mono text-sm"
                            onClick={() => router.push(`/tx/${tx.txid}`)}
                          >
                            {tx.txid.substring(0, 16)}...
                            <ExternalLink className="w-3 h-3 ml-1" />
                          </Button>
                          <div className="text-xs text-muted-foreground">
                            {tx.blockHeight > 0
                              ? `Block #${tx.blockHeight.toLocaleString()} • ${formatDistanceToNow(new Date(tx.timestamp), { addSuffix: true })}`
                              : "Unconfirmed"}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-medium ${tx.type === "received" ? "text-green-600" : "text-red-600"}`}>
                          {tx.type === "received" ? "+" : "-"}
                          {tx.amount} BTC
                        </div>
                        <Badge variant={tx.confirmations === 0 ? "secondary" : "default"} className="text-xs">
                          {tx.confirmations === 0 ? "Unconfirmed" : `${tx.confirmations} conf`}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="info">
            <Card>
              <CardHeader>
                <CardTitle>Address Information</CardTitle>
                <CardDescription>Detailed information about this address</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Address</label>
                    <div className="font-mono text-sm bg-muted p-2 rounded break-all">{addressDetail.address}</div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Address Type</label>
                    <div className="text-sm">
                      {addressDetail.address.startsWith("1")
                        ? "P2PKH (Legacy)"
                        : addressDetail.address.startsWith("3")
                          ? "P2SH (Script)"
                          : "P2WPKH (Bech32)"}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Oldest confirmed shown</label>
                    <div className="text-sm">
                      {formatDistanceToNow(new Date(addressDetail.firstSeen), { addSuffix: true })}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Latest confirmed shown</label>
                    <div className="text-sm">
                      {formatDistanceToNow(new Date(addressDetail.lastSeen), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

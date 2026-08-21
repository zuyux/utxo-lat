"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { Loader } from "@/components/loader"
import { PublicIcon } from "@/components/public-icon"
import { useLanguage } from "@/lib/i18n"
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
  transactions: AddressTransaction[]
  utxos: AddressUtxo[]
  utxosAvailable: boolean
  tipHeight: number
}

interface AddressUtxo {
  txid: string
  vout: number
  value: number
  status: {
    confirmed: boolean
    block_height?: number
    block_hash?: string
    block_time?: number
  }
}

interface AddressStats {
  address: string
  chain_stats: { tx_count: number; funded_txo_sum: number; spent_txo_sum: number }
  mempool_stats: { tx_count: number; funded_txo_sum: number; spent_txo_sum: number }
}

const fetchAddressDetail = async (address: string): Promise<AddressDetail> => {
  const stats = await apiFetch<AddressStats>(`/address/${encodeURIComponent(address)}`)
  const [txResult, tipResult, utxoResult] = await Promise.allSettled([
    apiFetch<MempoolTransaction[]>(`/address/${encodeURIComponent(address)}/txs`),
    apiFetch<number>("/blocks/tip/height"),
    apiFetch<AddressUtxo[]>(`/address/${encodeURIComponent(address)}/utxo`),
  ])
  const txs = txResult.status === "fulfilled" ? txResult.value : []
  const tip = tipResult.status === "fulfilled" ? tipResult.value : 0
  const utxos = utxoResult.status === "fulfilled" ? utxoResult.value : []
  const received = stats.chain_stats.funded_txo_sum + stats.mempool_stats.funded_txo_sum
  const sent = stats.chain_stats.spent_txo_sum + stats.mempool_stats.spent_txo_sum
  const transactions = txs.map((tx) => mapAddressTransaction(tx, address, tip))
  return {
    address: stats.address,
    balance: satsToBtc(received - sent),
    totalReceived: satsToBtc(received),
    totalSent: satsToBtc(sent),
    transactionCount: stats.chain_stats.tx_count + stats.mempool_stats.tx_count,
    transactions,
    utxos,
    utxosAvailable: utxoResult.status === "fulfilled",
    tipHeight: tip,
  }
}

function mapAddressTransaction(tx: MempoolTransaction, address: string, tip: number): AddressTransaction {
  const incoming = tx.vout
    .filter((output) => output.scriptpubkey_address === address)
    .reduce((sum, output) => sum + output.value, 0)
  const outgoing = tx.vin
    .filter((input) => input.prevout?.scriptpubkey_address === address)
    .reduce((sum, input) => sum + (input.prevout?.value ?? 0), 0)
  const net = incoming - outgoing
  return {
    txid: tx.txid,
    type: net >= 0 ? "received" : "sent",
    amount: satsToBtc(Math.abs(net)),
    confirmations: tx.status.confirmed && tx.status.block_height && tip > 0
      ? tip - tx.status.block_height + 1
      : 0,
    timestamp: tx.status.block_time ? new Date(tx.status.block_time * 1000).toISOString() : "",
    blockHeight: tx.status.block_height ?? 0,
  }
}

function getAddressType(address: string) {
  const normalized = address.toLowerCase()
  if (normalized.startsWith("1")) return "P2PKH (Legacy)"
  if (normalized.startsWith("3")) return "P2SH (Script)"
  if (normalized.startsWith("bc1p")) return "P2TR (Taproot)"
  if (normalized.startsWith("bc1q") && normalized.length <= 42) return "P2WPKH (Native SegWit)"
  if (normalized.startsWith("bc1q")) return "P2WSH (Native SegWit)"
  return "Unknown"
}

export default function AddressPage() {
  const params = useParams()
  const router = useRouter()
  const { dateLocale, locale, t } = useLanguage()
  const address = params.address as string
  const [addressDetail, setAddressDetail] = useState<AddressDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMoreTransactions, setHasMoreTransactions] = useState(false)
  const [visibleUtxos, setVisibleUtxos] = useState(50)
  const [error, setError] = useState("")

  useEffect(() => {
    const fetchAddress = async () => {
      setLoading(true)
      setError("")
      try {
        const detail = await fetchAddressDetail(address)
        setAddressDetail(detail)
        setHasMoreTransactions(detail.transactions.filter((tx) => tx.blockHeight > 0).length >= 25)
        setVisibleUtxos(50)
      } catch (requestError) {
        setAddressDetail(null)
        setError(requestError instanceof Error ? requestError.message : t("unableAddress"))
      } finally {
        setLoading(false)
      }
    }

    fetchAddress()
  }, [address, t])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success(t("copied"))
  }

  const loadMoreTransactions = async () => {
    if (!addressDetail || loadingMore || !hasMoreTransactions) return
    const lastConfirmed = [...addressDetail.transactions].reverse().find((tx) => tx.blockHeight > 0)
    if (!lastConfirmed) {
      setHasMoreTransactions(false)
      return
    }
    setLoadingMore(true)
    try {
      const page = await apiFetch<MempoolTransaction[]>(
        `/address/${encodeURIComponent(address)}/txs/chain/${lastConfirmed.txid}`,
      )
      const mapped = page.map((tx) => mapAddressTransaction(tx, address, addressDetail.tipHeight))
      setAddressDetail((current) => current && ({
        ...current,
        transactions: [
          ...current.transactions,
          ...mapped.filter((tx) => !current.transactions.some((existing) => existing.txid === tx.txid)),
        ],
      }))
      setHasMoreTransactions(page.length === 25)
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : t("unableMoreTransactions"))
    } finally {
      setLoadingMore(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4">
            <Button variant="ghost" onClick={() => router.back()}>
              <PublicIcon name="arrow-left" className="mr-2 h-4 w-4" />
              {t("back")}
            </Button>
          </div>
        </header>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader className="mx-auto mb-4" label={t("loadingAddress")} />
              <p className="text-muted-foreground">{t("loadingAddress")}...</p>
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
              <PublicIcon name="arrow-left" className="mr-2 h-4 w-4" />
              {t("back")}
            </Button>
          </div>
        </header>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">{t("addressNotFound")}</h1>
            <p className="text-muted-foreground">{error || t("addressNotFoundMessage")}</p>
          </div>
        </div>
      </div>
    )
  }

  const confirmedTransactions = addressDetail.transactions.filter((tx) => tx.blockHeight > 0)
  const utxoTotal = addressDetail.utxos.reduce((sum, utxo) => sum + utxo.value, 0)
  const shownUtxos = addressDetail.utxos.slice(0, visibleUtxos)

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <PublicIcon name="arrow-left" className="mr-2 h-4 w-4" />
            {t("back")}
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">{t("addressDetails")}</h1>
          <div className="flex items-center gap-2">
            <code className="text-sm bg-muted px-2 py-1 rounded break-all">{addressDetail.address}</code>
            <Button variant="ghost" size="sm" onClick={() => copyToClipboard(addressDetail.address)}>
              <PublicIcon name="copy" className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("balance")}</CardTitle>
              <PublicIcon name="wallet" className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{addressDetail.balance} BTC</div>
              <p className="text-xs text-muted-foreground">{t("confirmedMempoolTotals")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("totalReceived")}</CardTitle>
              <PublicIcon name="received" className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{addressDetail.totalReceived} BTC</div>
              <p className="text-xs text-muted-foreground">{t("allTimeReceived")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("totalSent")}</CardTitle>
              <PublicIcon name="sent" className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{addressDetail.totalSent} BTC</div>
              <p className="text-xs text-muted-foreground">{t("allTimeSent")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("transactions")}</CardTitle>
              <PublicIcon name="externalLink" className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{addressDetail.transactionCount}</div>
              <p className="text-xs text-muted-foreground">{t("totalTransactions")}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="transactions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="transactions">{t("transactions")}</TabsTrigger>
            <TabsTrigger value="utxos">UTXOs ({addressDetail.utxos.length.toLocaleString()})</TabsTrigger>
            <TabsTrigger value="info">{t("addressInfo")}</TabsTrigger>
          </TabsList>

          <TabsContent value="transactions">
            <Card>
              <CardHeader>
                <CardTitle>{t("transactionHistory")}</CardTitle>
                <CardDescription>{t("newestTransactions")}</CardDescription>
              </CardHeader>
              <CardContent>
                {addressDetail.transactions.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {t("historyUnavailable")}
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
                            <PublicIcon name="received" className="h-4 w-4 text-green-600" />
                          ) : (
                            <PublicIcon name="sent" className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                        <div>
                          <Button
                            variant="link"
                            className="p-0 h-auto font-mono text-sm"
                            onClick={() => router.push(`/tx/${tx.txid}`)}
                          >
                            {tx.txid.substring(0, 16)}...
                            <PublicIcon name="externalLink" className="ml-1 h-3 w-3" />
                          </Button>
                          <div className="text-xs text-muted-foreground">
                            {tx.blockHeight > 0
                              ? `${t("block")} #${tx.blockHeight.toLocaleString(locale)} • ${formatDistanceToNow(new Date(tx.timestamp), { addSuffix: true, locale: dateLocale })}`
                              : t("unconfirmed")}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-medium ${tx.type === "received" ? "text-green-600" : "text-red-600"}`}>
                          {tx.type === "received" ? "+" : "-"}
                          {tx.amount} BTC
                        </div>
                        <Badge variant={tx.confirmations === 0 ? "secondary" : "default"} className="text-xs">
                          {tx.confirmations === 0 ? t("unconfirmed") : `${tx.confirmations} conf`}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {hasMoreTransactions && (
                    <div className="pt-2 text-center">
                      <Button variant="outline" onClick={loadMoreTransactions} disabled={loadingMore}>
                        {loadingMore && <Loader className="mr-2" size="sm" label={t("unableMoreTransactions")} />}
                        {t("loadOlderTransactions")}
                      </Button>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t("showing")} {addressDetail.transactions.length.toLocaleString(locale)} {t("of")}{" "}
                        {addressDetail.transactionCount.toLocaleString(locale)}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="utxos">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PublicIcon name="coins" className="size-5" />
                  {t("unspentOutputs")}
                </CardTitle>
                <CardDescription>
                  {addressDetail.utxos.length.toLocaleString(locale)} {addressDetail.utxos.length === 1 ? t("spendableOutput") : t("spendableOutputs")} ·{" "}
                  {satsToBtc(utxoTotal)} {t("btcTotal")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!addressDetail.utxosAvailable ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {t("utxoUnavailable")}
                  </p>
                ) : addressDetail.utxos.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {t("noUtxos")}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {shownUtxos.map((utxo) => {
                      const confirmations =
                        utxo.status.confirmed && utxo.status.block_height && addressDetail.tipHeight > 0
                          ? addressDetail.tipHeight - utxo.status.block_height + 1
                          : 0
                      return (
                        <div key={`${utxo.txid}:${utxo.vout}`} className="rounded-lg border p-4">
                          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                            <div className="min-w-0">
                              <Button
                                variant="link"
                                className="h-auto max-w-full justify-start p-0 text-left font-mono text-xs"
                                onClick={() => router.push(`/tx/${utxo.txid}`)}
                              >
                                <span className="break-all">{utxo.txid}:{utxo.vout}</span>
                                <PublicIcon name="externalLink" className="ml-1.5 size-3 shrink-0" />
                              </Button>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {utxo.status.block_height
                                  ? `${t("block")} #${utxo.status.block_height.toLocaleString(locale)}`
                                  : t("unconfirmedOutput")}
                              </p>
                            </div>
                            <div className="shrink-0 text-left sm:text-right">
                              <p className="font-medium">{satsToBtc(utxo.value)} BTC</p>
                              <Badge variant={confirmations > 0 ? "default" : "secondary"} className="mt-1 text-xs">
                                {confirmations > 0
                                  ? `${confirmations.toLocaleString(locale)} conf`
                                  : utxo.status.confirmed ? t("confirmed") : t("unconfirmed")}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {visibleUtxos < addressDetail.utxos.length && (
                      <div className="pt-2 text-center">
                        <Button
                          variant="outline"
                          onClick={() => setVisibleUtxos((count) => Math.min(count + 50, addressDetail.utxos.length))}
                        >
                          {t("showMoreUtxos")}
                        </Button>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {t("showing")} {shownUtxos.length.toLocaleString(locale)} {t("of")} {addressDetail.utxos.length.toLocaleString(locale)}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="info">
            <Card>
              <CardHeader>
                <CardTitle>{t("addressInfo")}</CardTitle>
                <CardDescription>{t("detailedAddressInfo")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">{t("address")}</label>
                    <div className="font-mono text-sm bg-muted p-2 rounded break-all">{addressDetail.address}</div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">{t("addressType")}</label>
                    <div className="text-sm">
                      {getAddressType(addressDetail.address)}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">{t("oldestConfirmedShown")}</label>
                    <div className="text-sm">
                      {confirmedTransactions.length > 0
                        ? formatDistanceToNow(new Date(confirmedTransactions.at(-1)!.timestamp), { addSuffix: true, locale: dateLocale })
                        : t("noConfirmedShown")}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">{t("latestConfirmedShown")}</label>
                    <div className="text-sm">
                      {confirmedTransactions.length > 0
                        ? formatDistanceToNow(new Date(confirmedTransactions[0].timestamp), { addSuffix: true, locale: dateLocale })
                        : t("noConfirmedShown")}
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

"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { Loader } from "@/components/loader"
import { MainHeader } from "@/components/main-header"
import { PublicIcon } from "@/components/public-icon"
import { Watchlist } from "@/components/watchlist"
import { useLanguage } from "@/lib/i18n"
import { apiFetch, type BitcoinUnit, formatBitcoinAmount, type MempoolTransaction } from "@/lib/mempool"

interface AddressTransaction {
  txid: string
  type: "sent" | "received"
  amount: number
  confirmations: number
  timestamp: string
  blockHeight: number
}

interface AddressDetail {
  address: string
  balance: number
  totalReceived: number
  totalSent: number
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

type UtxoSortField = "value" | "age" | "confirmations" | "outpoint"
type UtxoSortDirection = "asc" | "desc"
type UtxoStatusFilter = "all" | "confirmed" | "unconfirmed"

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
    balance: received - sent,
    totalReceived: received,
    totalSent: sent,
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
    amount: Math.abs(net),
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
  const [bitcoinUnit, setBitcoinUnit] = useState<BitcoinUnit>("btc")
  const [utxoStatusFilter, setUtxoStatusFilter] = useState<UtxoStatusFilter>("all")
  const [utxoSortField, setUtxoSortField] = useState<UtxoSortField>("value")
  const [utxoSortDirection, setUtxoSortDirection] = useState<UtxoSortDirection>("desc")
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

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const textarea = document.createElement("textarea")
        textarea.value = text
        textarea.setAttribute("readonly", "")
        textarea.style.position = "fixed"
        textarea.style.left = "-9999px"
        document.body.appendChild(textarea)
        textarea.select()
        const copied = document.execCommand("copy")
        document.body.removeChild(textarea)

        if (!copied) {
          throw new Error(t("copyFailed"))
        }
      }

      toast.success(t("copied"))
    } catch {
      toast.error(t("copyFailed"))
    }
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
      <div className="min-h-screen bg-background pt-14">
        <MainHeader />

        <main className="grid min-h-[calc(100vh-3.5rem)] place-items-center">
          <Loader size="lg" label={t("loadingAddress")} />
        </main>
      </div>
    )
  }

  if (!addressDetail) {
    return (
      <div className="min-h-screen bg-background pt-14">
        <MainHeader />

        <div className="container mx-auto px-4 py-8">
          <Button className="mb-8" variant="ghost" onClick={() => router.back()}>
            <PublicIcon name="arrow-left" className="mr-2 h-4 w-4" />
            {t("back")}
          </Button>
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
  const addressScriptType = getAddressType(addressDetail.address)
  const managedUtxos = addressDetail.utxos
    .map((utxo) => {
      const confirmations =
        utxo.status.confirmed && utxo.status.block_height && addressDetail.tipHeight > 0
          ? addressDetail.tipHeight - utxo.status.block_height + 1
          : 0
      const ageSeconds = utxo.status.block_time
        ? Math.max(0, Math.floor(Date.now() / 1000) - utxo.status.block_time)
        : 0

      return { ...utxo, confirmations, ageSeconds }
    })
    .filter((utxo) => {
      if (utxoStatusFilter === "confirmed") return utxo.confirmations > 0
      if (utxoStatusFilter === "unconfirmed") return utxo.confirmations === 0
      return true
    })
    .sort((first, second) => {
      const direction = utxoSortDirection === "asc" ? 1 : -1
      if (utxoSortField === "value") return (first.value - second.value) * direction
      if (utxoSortField === "age") return (first.ageSeconds - second.ageSeconds) * direction
      if (utxoSortField === "confirmations") return (first.confirmations - second.confirmations) * direction
      return `${first.txid}:${first.vout}`.localeCompare(`${second.txid}:${second.vout}`) * direction
    })
  const shownUtxos = managedUtxos.slice(0, visibleUtxos)
  const filteredUtxoTotal = managedUtxos.reduce((sum, utxo) => sum + utxo.value, 0)
  const formatAmount = (sats: number) => formatBitcoinAmount(sats, bitcoinUnit, locale)

  return (
    <div className="min-h-screen bg-background pt-14">
      <MainHeader />

      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => router.back()}>
            <PublicIcon name="arrow-left" className="mr-2 h-4 w-4" />
            {t("back")}
          </Button>
        </div>

        <div className="mb-6">
          <div className="mb-2 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <h1 className="text-3xl font-bold">{t("addressDetails")}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <code className="text-sm bg-muted px-2 py-1 rounded break-all">{addressDetail.address}</code>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(addressDetail.address)}
              aria-label={t("copyAddress")}
              title={t("copyAddress")}
            >
              <PublicIcon name="copy" className="h-4 w-4" />
            </Button>
            <Watchlist addressToAdd={addressDetail.address} />
            <div className="ml-0 flex rounded-md border p-0.5 sm:ml-2" aria-label="Bitcoin unit">
              <Button
                variant={bitcoinUnit === "btc" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2"
                onClick={() => setBitcoinUnit("btc")}
              >
                BTC
              </Button>
              <Button
                variant={bitcoinUnit === "sat" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2"
                onClick={() => setBitcoinUnit("sat")}
              >
                SAT
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("balance")}</CardTitle>
              <PublicIcon name="wallet" className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatAmount(addressDetail.balance)}</div>
              <p className="text-xs text-muted-foreground">{t("confirmedMempoolTotals")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("totalReceived")}</CardTitle>
              <PublicIcon name="received" className="h-4 w-4 text-[#0000FF] dark:text-[#00e5ff]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#0000FF] dark:text-[#00e5ff]">{formatAmount(addressDetail.totalReceived)}</div>
              <p className="text-xs text-muted-foreground">{t("allTimeReceived")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("totalSent")}</CardTitle>
              <PublicIcon name="sent" className="h-4 w-4 text-[#ff0000]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#ff0000]">{formatAmount(addressDetail.totalSent)}</div>
              <p className="text-xs text-muted-foreground">{t("allTimeSent")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("transactions")}</CardTitle>
              <PublicIcon name="txs" className="h-4 w-4 text-muted-foreground" />
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
                            tx.type === "received" ? "bg-[#0000FF]/10 dark:bg-[#00e5ff]/15" : "bg-[#ff0000]/15"
                          }`}
                        >
                          {tx.type === "received" ? (
                            <PublicIcon name="received" className="h-4 w-4 text-[#0000FF] dark:text-[#00e5ff]" />
                          ) : (
                            <PublicIcon name="sent" className="h-4 w-4 text-[#ff0000]" />
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
                        <div className={`font-medium ${tx.type === "received" ? "text-[#0000FF] dark:text-[#00e5ff]" : "text-[#ff0000]"}`}>
                          {tx.type === "received" ? "+" : "-"}
                          {formatAmount(tx.amount)}
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
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <PublicIcon name="coins" className="size-5" />
                      UTXO management
                    </CardTitle>
                    <CardDescription>
                      {addressDetail.utxos.length.toLocaleString(locale)} {addressDetail.utxos.length === 1 ? t("spendableOutput") : t("spendableOutputs")} ·{" "}
                      {formatAmount(utxoTotal)}
                    </CardDescription>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:min-w-[34rem]">
                    <Select
                      value={utxoStatusFilter}
                      onValueChange={(value) => {
                        setUtxoStatusFilter(value as UtxoStatusFilter)
                        setVisibleUtxos(50)
                      }}
                    >
                      <SelectTrigger aria-label="Filter UTXOs by status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="confirmed">{t("confirmed")}</SelectItem>
                        <SelectItem value="unconfirmed">{t("unconfirmed")}</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value={utxoSortField}
                      onValueChange={(value) => setUtxoSortField(value as UtxoSortField)}
                    >
                      <SelectTrigger aria-label="Sort UTXOs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="value">Sort by value</SelectItem>
                        <SelectItem value="age">Sort by age</SelectItem>
                        <SelectItem value="confirmations">Sort by confirmations</SelectItem>
                        <SelectItem value="outpoint">Sort by outpoint</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value={utxoSortDirection}
                      onValueChange={(value) => setUtxoSortDirection(value as UtxoSortDirection)}
                    >
                      <SelectTrigger aria-label="Sort direction">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="desc">Descending</SelectItem>
                        <SelectItem value="asc">Ascending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
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
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                      <div className="rounded-md border p-3">
                        <div className="text-xs text-muted-foreground">Filtered value</div>
                        <div className="mt-1 font-medium">{formatAmount(filteredUtxoTotal)}</div>
                      </div>
                      <div className="rounded-md border p-3">
                        <div className="text-xs text-muted-foreground">Visible UTXOs</div>
                        <div className="mt-1 font-medium">
                          {managedUtxos.length.toLocaleString(locale)} {t("of")} {addressDetail.utxos.length.toLocaleString(locale)}
                        </div>
                      </div>
                      <div className="rounded-md border p-3">
                        <div className="text-xs text-muted-foreground">{t("script")}</div>
                        <div className="mt-1 font-medium">{addressScriptType}</div>
                      </div>
                    </div>

                    {managedUtxos.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        No UTXOs match the current filters.
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Outpoint</TableHead>
                            <TableHead>Value</TableHead>
                            <TableHead>Age</TableHead>
                            <TableHead>{t("confirmations")}</TableHead>
                            <TableHead>{t("script")}</TableHead>
                            <TableHead>{t("status")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {shownUtxos.map((utxo) => (
                            <TableRow key={`${utxo.txid}:${utxo.vout}`}>
                              <TableCell className="min-w-[17rem]">
                                <Button
                                  variant="link"
                                  className="h-auto max-w-64 justify-start p-0 text-left font-mono text-xs"
                                  onClick={() => router.push(`/tx/${utxo.txid}`)}
                                >
                                  <span className="truncate">{utxo.txid}:{utxo.vout}</span>
                                  <PublicIcon name="externalLink" className="ml-1.5 size-3 shrink-0" />
                                </Button>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  vout {utxo.vout.toLocaleString(locale)}
                                </div>
                              </TableCell>
                              <TableCell className="whitespace-nowrap font-medium">
                                {formatAmount(utxo.value)}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {utxo.status.block_time
                                  ? formatDistanceToNow(new Date(utxo.status.block_time * 1000), { addSuffix: true, locale: dateLocale })
                                  : t("pending")}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {utxo.confirmations > 0
                                  ? utxo.confirmations.toLocaleString(locale)
                                  : t("unconfirmed")}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {addressScriptType}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1.5">
                                  <Badge variant="outline">{t("unspent")}</Badge>
                                  <Badge variant={utxo.confirmations > 0 ? "default" : "secondary"}>
                                    {utxo.confirmations > 0 ? t("confirmed") : t("unconfirmed")}
                                  </Badge>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}

                    {visibleUtxos < managedUtxos.length && (
                      <div className="pt-2 text-center">
                        <Button
                          variant="outline"
                          onClick={() => setVisibleUtxos((count) => Math.min(count + 50, managedUtxos.length))}
                        >
                          {t("showMoreUtxos")}
                        </Button>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {t("showing")} {shownUtxos.length.toLocaleString(locale)} {t("of")} {managedUtxos.length.toLocaleString(locale)}
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

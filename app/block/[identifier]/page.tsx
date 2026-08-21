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
import { apiFetch, apiFetchText, type BlockApi, type MempoolTransaction, satsToBtc } from "@/lib/mempool"

interface BlockTransaction {
  txid: string
  fee: string
  feeRate: string
  size: number
  vsize: number
  weight: number
  inputCount: number
  outputCount: number
  totalInput: string | null
  totalOutput: string
  isCoinbase: boolean
}

interface BlockDetail {
  height: number
  hash: string
  previousBlockHash: string
  nextBlockHash: string | null
  merkleRoot: string
  timestamp: string
  difficulty: string
  nonce: number
  version: number
  size: number
  weight: number
  transactionCount: number
  totalFees: string | null
  blockReward: string
  medianFeeRate: number | null
  averageFeeRate: number | null
  feeRange: number[]
  totalInputs: number | null
  totalOutputs: number | null
  totalTransferred: string | null
  miner: string
  confirmations: number
  transactions: BlockTransaction[]
}

const HALVING_INTERVAL = 210_000
const INITIAL_BLOCK_SUBSIDY = 5_000_000_000

const formatShortHashEnd = (hash: string, unavailable: string) => hash ? `...${hash.slice(-16)}` : unavailable

const blockSubsidy = (height: number) => {
  const halvings = Math.floor(height / HALVING_INTERVAL)
  if (halvings >= 64) return 0
  return Math.floor(INITIAL_BLOCK_SUBSIDY / 2 ** halvings)
}

const mapTransaction = (tx: MempoolTransaction): BlockTransaction => {
  const isCoinbase = tx.vin.some((input) => input.is_coinbase)
  const vsize = tx.weight / 4
  return {
    txid: tx.txid,
    fee: satsToBtc(tx.fee),
    feeRate: isCoinbase ? "—" : (tx.fee / vsize).toFixed(2),
    size: tx.size,
    vsize,
    weight: tx.weight,
    inputCount: tx.vin.length,
    outputCount: tx.vout.length,
    totalInput: isCoinbase
      ? null
      : satsToBtc(tx.vin.reduce((sum, input) => sum + (input.prevout?.value ?? 0), 0)),
    totalOutput: satsToBtc(tx.vout.reduce((sum, output) => sum + output.value, 0)),
    isCoinbase,
  }
}

const fetchBlockDetail = async (identifier: string): Promise<BlockDetail> => {
  const hash = /^\d+$/.test(identifier)
    ? await apiFetchText(`/block-height/${identifier}`)
    : identifier
  const [baseBlock, status, tip, transactions] = await Promise.all([
    apiFetch<BlockApi>(`/v1/block/${hash}`),
    apiFetch<{ next_best?: string }>(`/block/${hash}/status`),
    apiFetch<number>("/blocks/tip/height"),
    apiFetch<MempoolTransaction[]>(`/block/${hash}/txs/0`),
  ])
  const detailedBlock = await apiFetch<BlockApi[]>(`/v1/blocks/${baseBlock.height}`)
    .then((blocks) => blocks.find((candidate) => candidate.id === baseBlock.id))
    .catch(() => undefined)
  const block: BlockApi = {
    ...baseBlock,
    extras: detailedBlock?.extras ?? baseBlock.extras,
  }
  const totalFees = block.extras?.totalFees
  const subsidy = block.extras?.reward ?? blockSubsidy(block.height)
  return {
    height: block.height,
    hash: block.id,
    previousBlockHash: block.previousblockhash || "",
    nextBlockHash: status.next_best || null,
    merkleRoot: block.merkle_root,
    timestamp: new Date(block.timestamp * 1000).toISOString(),
    difficulty: block.difficulty.toLocaleString(),
    nonce: block.nonce,
    version: block.version,
    size: block.size,
    weight: block.weight,
    transactionCount: block.tx_count,
    totalFees: totalFees != null ? satsToBtc(totalFees) : null,
    blockReward: satsToBtc(subsidy),
    medianFeeRate: block.extras?.medianFee ?? null,
    averageFeeRate: totalFees != null && totalFees > 0
      ? totalFees / (block.extras?.virtualSize ?? block.weight / 4)
      : null,
    feeRange: block.extras?.feeRange ?? [],
    totalInputs: block.extras?.totalInputs ?? null,
    totalOutputs: block.extras?.totalOutputs ?? null,
    totalTransferred: block.extras?.totalOutputAmt != null
      ? satsToBtc(block.extras.totalOutputAmt)
      : null,
    miner: block.extras?.pool?.name || "Unknown pool",
    confirmations: Math.max(0, tip - block.height + 1),
    transactions: transactions.map(mapTransaction),
  }
}

export default function BlockPage() {
  const params = useParams()
  const router = useRouter()
  const { dateLocale, locale, t } = useLanguage()
  const identifier = params.identifier as string
  const [block, setBlock] = useState<BlockDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const fetchBlock = async () => {
      setLoading(true)
      setError("")
      try {
        setBlock(await fetchBlockDetail(identifier))
      } catch (requestError) {
        setBlock(null)
        setError(requestError instanceof Error ? requestError.message : t("unableBlock"))
      } finally {
        setLoading(false)
      }
    }

    fetchBlock()
  }, [identifier, t])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success(t("copied"))
  }

  const navigateToBlock = (height: number) => {
    router.push(`/block/${height}`)
  }

  const loadMoreTransactions = async () => {
    if (!block || loadingMore || block.transactions.length >= block.transactionCount) return
    setLoadingMore(true)
    try {
      const transactions = await apiFetch<MempoolTransaction[]>(
        `/block/${block.hash}/txs/${block.transactions.length}`,
      )
      setBlock((current) => current && ({
        ...current,
        transactions: [
          ...current.transactions,
          ...transactions.map(mapTransaction).filter(
            (transaction) => !current.transactions.some(({ txid }) => txid === transaction.txid),
          ),
        ],
      }))
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
              <Loader className="mx-auto mb-4" label={t("loadingBlock")} />
              <p className="text-muted-foreground">{t("loadingBlock")}...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!block) {
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
            <h1 className="text-2xl font-bold mb-4">{t("blockNotFound")}</h1>
            <p className="text-muted-foreground">{error || t("blockNotFoundMessage")}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => router.back()}>
              <PublicIcon name="arrow-left" className="mr-2 h-4 w-4" />
              {t("back")}
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateToBlock(block.height - 1)}
                disabled={block.height <= 1}
              >
                <PublicIcon name="chevronLeft" className="mr-1 h-4 w-4" />
                {t("previous")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateToBlock(block.height + 1)}
                disabled={!block.nextBlockHash}
              >
                {t("next")}
                <PublicIcon name="chevronRight" className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <PublicIcon name="blocks" className="h-6 w-6" />
            <h1 className="text-3xl font-bold">{t("block")} #{block.height.toLocaleString(locale)}</h1>
          </div>
          <div className="flex items-center gap-2">
            <code className="text-sm bg-muted px-2 py-1 rounded break-all">{block.hash}</code>
            <Button variant="ghost" size="sm" onClick={() => copyToClipboard(block.hash)}>
              <PublicIcon name="copy" className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("confirmations")}</CardTitle>
              <Badge variant="default">{block.confirmations}</Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{block.confirmations}</div>
              <p className="text-xs text-muted-foreground">{t("networkConfirmations")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("transactions")}</CardTitle>
              <PublicIcon name="miner-users" className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{block.transactionCount.toLocaleString(locale)}</div>
              <p className="text-xs text-muted-foreground">{t("totalTransactions")}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("blockSize")}</CardTitle>
              <PublicIcon name="hard-drive" className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(block.size / 1000000).toFixed(2)} MB</div>
              <p className="text-xs text-muted-foreground">Weight: {(block.weight / 1000000).toFixed(2)} MWU</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("timestamp")}</CardTitle>
              <PublicIcon name="clock" className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">
                {formatDistanceToNow(new Date(block.timestamp), { addSuffix: true, locale: dateLocale })}
              </div>
              <p className="text-xs text-muted-foreground">{new Date(block.timestamp).toLocaleString(locale)}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">{t("overview")}</TabsTrigger>
            <TabsTrigger value="transactions">{t("transactions")}</TabsTrigger>
            <TabsTrigger value="technical">{t("technicalDetails")}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t("blockInformation")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t("height")}</span>
                    <span className="font-medium">{block.height.toLocaleString(locale)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t("miner")}</span>
                    <Badge variant="outline">{block.miner}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t("difficulty")}</span>
                    <span className="font-medium">{block.difficulty}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t("blockReward")}</span>
                    <span className="font-medium">{block.blockReward} BTC</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t("totalFees")}</span>
                    <span className="font-medium">{block.totalFees ? `${block.totalFees} BTC` : t("unavailable")}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t("blockNavigation")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">{t("previousBlock")}</label>
                    <Button
                      variant="outline"
                      className="w-full justify-start font-mono text-xs bg-transparent"
                      onClick={() => navigateToBlock(block.height - 1)}
                      disabled={block.height <= 1}
                    >
                      {formatShortHashEnd(block.previousBlockHash, t("unavailable"))}
                      <PublicIcon name="externalLink" className="ml-2 h-3 w-3" />
                    </Button>
                  </div>
                  {block.nextBlockHash && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">{t("nextBlock")}</label>
                      <Button
                        variant="outline"
                        className="w-full justify-start font-mono text-xs bg-transparent"
                        onClick={() => navigateToBlock(block.height + 1)}
                      >
                        {formatShortHashEnd(block.nextBlockHash, t("unavailable"))}
                        <PublicIcon name="externalLink" className="ml-2 h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{t("feeFlow")}</CardTitle>
                <CardDescription>
                  {t("wholeBlockStats")} {block.transactionCount.toLocaleString(locale)} {t("transactions")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-6">
                  <BlockMetric
                    label={t("medianFeeRate")}
                    value={block.medianFeeRate != null ? `${formatFeeRate(block.medianFeeRate)} sat/vB` : t("unavailable")}
                  />
                  <BlockMetric
                    label={t("averageFeeRate")}
                    value={block.averageFeeRate != null ? `${formatFeeRate(block.averageFeeRate)} sat/vB` : t("unavailable")}
                  />
                  <BlockMetric
                    label={t("feeRange")}
                    value={block.feeRange.length > 0
                      ? `${formatFeeRate(Math.min(...block.feeRange))}–${formatFeeRate(Math.max(...block.feeRange))} sat/vB`
                      : t("unavailable")}
                  />
                  <BlockMetric
                    label={t("totalInputs")}
                    value={block.totalInputs?.toLocaleString(locale) ?? t("unavailable")}
                  />
                  <BlockMetric
                    label={t("totalOutputs")}
                    value={block.totalOutputs?.toLocaleString(locale) ?? t("unavailable")}
                  />
                  <BlockMetric
                    label={t("transferredValue")}
                    value={block.totalTransferred ? `${block.totalTransferred} BTC` : t("unavailable")}
                    detail={t("sumAllOutputs")}
                  />
                </div>

                {block.feeRange.length > 0 && (
                  <div className="mt-6 border-t pt-4">
                    <p className="text-xs text-muted-foreground">{t("feeBands")}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {block.feeRange.map((fee, index) => (
                        <span key={`${fee}-${index}`} className="rounded-md bg-secondary px-2 py-1 text-xs font-medium">
                          {formatFeeRate(fee)} sat/vB
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transactions">
            <Card>
              <CardHeader>
                <CardTitle>{t("blockTransactions")}</CardTitle>
                <CardDescription>
                  {t("showing")} {block.transactions.length.toLocaleString(locale)} {t("of")} {block.transactionCount.toLocaleString(locale)} {t("transactions")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {block.transactions.map((tx, index) => (
                    <div
                      key={tx.txid}
                      className="rounded-lg border p-4 transition-colors hover:bg-muted/30"
                    >
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                            <span className="text-xs font-bold">#{index + 1}</span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <code className="break-all text-sm font-medium">{tx.txid}</code>
                              {tx.isCoinbase && <Badge variant="secondary">Coinbase</Badge>}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {tx.inputCount.toLocaleString(locale)} {t("inputs")} ·{" "}
                              {tx.outputCount.toLocaleString(locale)} {t("outputs")}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => copyToClipboard(tx.txid)} aria-label={t("copyTxId")}>
                            <PublicIcon name="copy" className="size-3.5" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => router.push(`/tx/${tx.txid}`)}>
                            {t("details")} <PublicIcon name="externalLink" className="ml-1.5 size-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t pt-4 text-sm md:grid-cols-3 lg:grid-cols-6">
                        <TransactionMetric label={t("totalInput")} value={tx.totalInput ? `${tx.totalInput} BTC` : t("newCoins")} />
                        <TransactionMetric label={t("totalOutput")} value={`${tx.totalOutput} BTC`} />
                        <TransactionMetric label={t("fee")} value={tx.isCoinbase ? t("noFee") : `${tx.fee} BTC`} />
                        <TransactionMetric label={t("feeRate")} value={tx.isCoinbase ? "—" : `${tx.feeRate} sat/vB`} />
                        <TransactionMetric label={t("size")} value={`${tx.size.toLocaleString(locale)} bytes`} />
                        <TransactionMetric
                          label={t("virtualSize")}
                          value={`${tx.vsize.toLocaleString(locale, { maximumFractionDigits: 2 })} vB`}
                        />
                      </div>
                    </div>
                  ))}
                  {block.transactions.length < block.transactionCount && (
                    <div className="pt-2 text-center">
                      <Button variant="outline" onClick={loadMoreTransactions} disabled={loadingMore}>
                        {loadingMore && <Loader className="mr-2" size="sm" label="Loading more transactions" />}
                        {t("loadOlderTransactions")}
                      </Button>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {(block.transactionCount - block.transactions.length).toLocaleString(locale)} {t("remaining")}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="technical">
            <Card>
              <CardHeader>
                <CardTitle>{t("technicalDetails")}</CardTitle>
                <CardDescription>{t("blockInformation")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">{t("blockHash")}</label>
                    <div className="font-mono text-sm bg-muted p-2 rounded break-all flex items-center justify-between">
                      {block.hash}
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(block.hash)}>
                        <PublicIcon name="copy" className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">{t("merkleRoot")}</label>
                    <div className="font-mono text-sm bg-muted p-2 rounded break-all flex items-center justify-between">
                      {block.merkleRoot}
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(block.merkleRoot)}>
                        <PublicIcon name="copy" className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">{t("nonce")}</label>
                    <div className="text-sm bg-muted p-2 rounded">{block.nonce.toLocaleString()}</div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">{t("version")}</label>
                    <div className="text-sm bg-muted p-2 rounded">{block.version}</div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">{t("size")}</label>
                    <div className="text-sm bg-muted p-2 rounded">{block.size.toLocaleString(locale)} bytes</div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">{t("weight")}</label>
                    <div className="text-sm bg-muted p-2 rounded">{block.weight.toLocaleString(locale)} WU</div>
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

function TransactionMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-words font-medium">{value}</p>
    </div>
  )
}

function BlockMetric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-words font-semibold">{value}</p>
      {detail && <p className="mt-0.5 text-[10px] text-muted-foreground">{detail}</p>}
    </div>
  )
}

function formatFeeRate(value: number) {
  return value < 1 ? value.toFixed(2) : value.toFixed(1)
}

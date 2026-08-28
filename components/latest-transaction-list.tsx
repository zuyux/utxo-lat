"use client"

import { useRouter } from "next/navigation"

import { useLanguage } from "@/lib/i18n"

export interface LatestTransaction {
  txid: string
  fee: number
  vsize: number
  value: number
  seenAt: string
}

interface LatestTransactionListProps {
  transactions: LatestTransaction[]
  usdRate: number | null
}

const formatTxid = (txid: string) => `${txid.slice(0, 8)}-${txid.slice(-4)}`

export function LatestTransactionList({ transactions, usdRate }: LatestTransactionListProps) {
  const router = useRouter()
  const { locale, t } = useLanguage()

  if (transactions.length === 0) {
    return (
      <div className="py-6 text-sm text-muted-foreground">
        {t("liveDataUnavailable")}
      </div>
    )
  }

  return (
    <div className="divide-y divide-border/40">
      {transactions.map((transaction) => {
        const btc = transaction.value / 100_000_000
        const usd = usdRate == null ? null : btc * usdRate

        return (
          <button
            key={transaction.txid}
            type="button"
            className="grid w-full grid-cols-[minmax(7rem,1fr)_4.5rem_minmax(8.5rem,auto)_minmax(5.5rem,auto)] items-center gap-3 py-2.5 text-left font-mono text-xs transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={() => router.push(`/tx/${transaction.txid}`)}
          >
            <span className="truncate text-foreground">{formatTxid(transaction.txid)}</span>
            <span className="text-muted-foreground">
              {new Date(transaction.seenAt).toLocaleTimeString(locale, {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })}
            </span>
            <span className="text-right text-foreground">{btc.toFixed(8)} BTC</span>
            <span className="text-right text-foreground">
              {usd == null
                ? "..."
                : usd.toLocaleString(locale, {
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
            </span>
          </button>
        )
      })}
    </div>
  )
}

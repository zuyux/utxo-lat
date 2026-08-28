"use client"

import { useRouter } from "next/navigation"

import type { CurrencyCode } from "@/lib/currencies"
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
  fiatCurrency: CurrencyCode
  fiatRate: number | null
}

const formatTxid = (txid: string) => `${txid.slice(0, 8)}-${txid.slice(-4)}`

export function LatestTransactionList({ transactions, fiatCurrency, fiatRate }: LatestTransactionListProps) {
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
    <div className="overflow-x-auto">
      <div className="min-w-[38rem] divide-y divide-border/40">
        {transactions.map((transaction) => {
          const btc = transaction.value / 100_000_000
          const fiat = fiatRate == null ? null : btc * fiatRate

          return (
            <button
              key={transaction.txid}
              type="button"
              className="grid w-full grid-cols-[minmax(8rem,1fr)_3.5rem_10rem_7.5rem] items-center gap-3 py-2.5 text-left font-mono text-xs tabular-nums transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={() => router.push(`/tx/${transaction.txid}`)}
            >
              <span className="truncate text-foreground">{formatTxid(transaction.txid)}</span>
              <span className="text-center text-muted-foreground">
                {new Date(transaction.seenAt).toLocaleTimeString(locale, {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}
              </span>
              <span className="whitespace-nowrap text-right text-foreground">{btc.toFixed(8)} BTC</span>
              <span className="whitespace-nowrap text-right text-foreground">
                {fiat == null
                  ? "..."
                  : fiat.toLocaleString(locale, {
                      style: "currency",
                      currency: fiatCurrency,
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

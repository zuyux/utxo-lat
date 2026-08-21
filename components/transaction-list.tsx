"use client"

import { PublicIcon } from "@/components/public-icon"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"

interface Transaction {
  hash: string
  amount: string
  fee: string
  confirmations: number
  timestamp: string
}

interface TransactionListProps {
  transactions: Transaction[]
}

export function TransactionList({ transactions }: TransactionListProps) {
  return (
    <div className="space-y-3">
      {transactions.map((tx) => (
        <div
          key={tx.hash}
          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <PublicIcon name="sent" className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <div className="font-mono text-sm font-medium">
                {tx.hash.substring(0, 8)}...{tx.hash.substring(tx.hash.length - 8)}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <PublicIcon name="clock" className="h-3 w-3" />
                {formatDistanceToNow(new Date(tx.timestamp), { addSuffix: true })}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-medium">{tx.amount} BTC</div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Fee: {tx.fee} BTC</span>
              <Badge variant={tx.confirmations === 0 ? "secondary" : "default"} className="text-xs">
                {tx.confirmations === 0 ? "Unconfirmed" : `${tx.confirmations} conf`}
              </Badge>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

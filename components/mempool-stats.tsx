"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Activity, Clock, Zap, TrendingUp } from "lucide-react"

interface MempoolStatsProps {
  mempoolSize: number
  avgFee: number
  transactions: Array<{
    hash: string
    amount: string
    fee: string
    confirmations: number
    timestamp: string
  }>
}

export function MempoolStats({ mempoolSize, avgFee, transactions }: MempoolStatsProps) {
  const unconfirmedTxs = transactions.filter((tx) => tx.confirmations === 0)
  const feeRanges = [
    { label: "Low Priority", range: "1-5 sat/vB", percentage: 25, color: "bg-red-500" },
    { label: "Medium Priority", range: "6-20 sat/vB", percentage: 45, color: "bg-yellow-500" },
    { label: "High Priority", range: "21-50 sat/vB", percentage: 25, color: "bg-green-500" },
    { label: "Very High Priority", range: "50+ sat/vB", percentage: 5, color: "bg-blue-500" },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Mempool Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Mempool Overview
          </CardTitle>
          <CardDescription>Current state of unconfirmed transactions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{mempoolSize.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Transactions</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">{avgFee.toFixed(1)}</div>
              <div className="text-sm text-muted-foreground">Avg Fee (sat/vB)</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Mempool Capacity</span>
              <span>{((mempoolSize / 300000) * 100).toFixed(1)}%</span>
            </div>
            <Progress value={(mempoolSize / 300000) * 100} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Fee Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Fee Distribution
          </CardTitle>
          <CardDescription>Transaction fees by priority level</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {feeRanges.map((range, index) => (
            <div key={index} className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${range.color}`} />
                  <span className="text-sm font-medium">{range.label}</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {range.range}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={range.percentage} className="flex-1 h-2" />
                <span className="text-sm text-muted-foreground w-12">{range.percentage}%</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Fee Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Fee Recommendations
          </CardTitle>
          <CardDescription>Estimated confirmation times</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            <div className="flex justify-between items-center p-3 border rounded-lg">
              <div>
                <div className="font-medium">Next Block</div>
                <div className="text-sm text-muted-foreground">~10 minutes</div>
              </div>
              <Badge className="bg-green-100 text-green-800">{Math.ceil(avgFee)} sat/vB</Badge>
            </div>
            <div className="flex justify-between items-center p-3 border rounded-lg">
              <div>
                <div className="font-medium">30 Minutes</div>
                <div className="text-sm text-muted-foreground">~3 blocks</div>
              </div>
              <Badge className="bg-yellow-100 text-yellow-800">{Math.floor(avgFee * 0.8)} sat/vB</Badge>
            </div>
            <div className="flex justify-between items-center p-3 border rounded-lg">
              <div>
                <div className="font-medium">1 Hour</div>
                <div className="text-sm text-muted-foreground">~6 blocks</div>
              </div>
              <Badge className="bg-blue-100 text-blue-800">{Math.floor(avgFee * 0.6)} sat/vB</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unconfirmed Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Unconfirmed Transactions
          </CardTitle>
          <CardDescription>Transactions waiting for confirmation</CardDescription>
        </CardHeader>
        <CardContent>
          {unconfirmedTxs.length > 0 ? (
            <div className="space-y-3">
              {unconfirmedTxs.slice(0, 5).map((tx) => (
                <div key={tx.hash} className="flex justify-between items-center p-2 border rounded">
                  <div className="font-mono text-sm">
                    {tx.hash.substring(0, 8)}...{tx.hash.substring(tx.hash.length - 8)}
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{tx.amount} BTC</div>
                    <div className="text-xs text-muted-foreground">Fee: {tx.fee} BTC</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No unconfirmed transactions in current view</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

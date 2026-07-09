"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Copy, ExternalLink, ArrowUpRight, ArrowDownLeft } from "lucide-react"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"

interface TransactionDetail {
  txid: string
  blockHeight: number
  blockHash: string
  confirmations: number
  timestamp: string
  fee: string
  size: number
  inputs: Array<{
    address: string
    amount: string
    txid: string
    vout: number
  }>
  outputs: Array<{
    address: string
    amount: string
    spent: boolean
  }>
  totalInput: string
  totalOutput: string
}

// Mock data generator for transaction details
const generateTransactionDetail = (txid: string): TransactionDetail => {
  const confirmations = Math.floor(Math.random() * 100)
  const inputCount = Math.floor(Math.random() * 5) + 1
  const outputCount = Math.floor(Math.random() * 5) + 1

  const inputs = Array.from({ length: inputCount }, (_, i) => ({
    address: `1${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`,
    amount: (Math.random() * 5 + 0.1).toFixed(8),
    txid: Math.random().toString(36).substring(2, 15),
    vout: i,
  }))

  const outputs = Array.from({ length: outputCount }, () => ({
    address: `1${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`,
    amount: (Math.random() * 3 + 0.05).toFixed(8),
    spent: Math.random() > 0.5,
  }))

  const totalInput = inputs.reduce((sum, input) => sum + Number.parseFloat(input.amount), 0).toFixed(8)
  const totalOutput = outputs.reduce((sum, output) => sum + Number.parseFloat(output.amount), 0).toFixed(8)
  const fee = (Number.parseFloat(totalInput) - Number.parseFloat(totalOutput)).toFixed(8)

  return {
    txid,
    blockHeight: 800000 + Math.floor(Math.random() * 1000),
    blockHash: Math.random().toString(36).substring(2, 15),
    confirmations,
    timestamp: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString(),
    fee,
    size: Math.floor(Math.random() * 500) + 200,
    inputs,
    outputs,
    totalInput,
    totalOutput,
  }
}

export default function TransactionPage() {
  const params = useParams()
  const router = useRouter()
  const txid = params.txid as string
  const [transaction, setTransaction] = useState<TransactionDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate API call
    const fetchTransaction = async () => {
      setLoading(true)
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setTransaction(generateTransactionDetail(txid))
      setLoading(false)
    }

    fetchTransaction()
  }, [txid])

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
              <p className="text-muted-foreground">Loading transaction details...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!transaction) {
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
            <h1 className="text-2xl font-bold mb-4">Transaction Not Found</h1>
            <p className="text-muted-foreground">The transaction you searched for does not exist.</p>
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
          <h1 className="text-3xl font-bold mb-2">Transaction Details</h1>
          <div className="flex items-center gap-2">
            <code className="text-sm bg-muted px-2 py-1 rounded">{transaction.txid}</code>
            <Button variant="ghost" size="sm" onClick={() => copyToClipboard(transaction.txid)}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Confirmations</span>
                  <Badge variant={transaction.confirmations === 0 ? "secondary" : "default"}>
                    {transaction.confirmations === 0 ? "Unconfirmed" : `${transaction.confirmations} confirmations`}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Block Height</span>
                  <span className="font-medium">{transaction.blockHeight.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Timestamp</span>
                  <span className="font-medium">
                    {formatDistanceToNow(new Date(transaction.timestamp), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Transaction Info</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fee</span>
                  <span className="font-medium">{transaction.fee} BTC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Size</span>
                  <span className="font-medium">{transaction.size} bytes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fee Rate</span>
                  <span className="font-medium">
                    {((Number.parseFloat(transaction.fee) * 100000000) / transaction.size).toFixed(2)} sat/vB
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Amounts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Input</span>
                  <span className="font-medium">{transaction.totalInput} BTC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Output</span>
                  <span className="font-medium">{transaction.totalOutput} BTC</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Inputs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowDownLeft className="w-4 h-4" />
                Inputs ({transaction.inputs.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {transaction.inputs.map((input, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Button
                        variant="link"
                        className="p-0 h-auto font-mono text-sm"
                        onClick={() => router.push(`/address/${input.address}`)}
                      >
                        {input.address}
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                      <span className="font-medium">{input.amount} BTC</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Previous TX: {input.txid}:{input.vout}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Outputs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4" />
                Outputs ({transaction.outputs.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {transaction.outputs.map((output, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Button
                        variant="link"
                        className="p-0 h-auto font-mono text-sm"
                        onClick={() => router.push(`/address/${output.address}`)}
                      >
                        {output.address}
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                      <span className="font-medium">{output.amount} BTC</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={output.spent ? "secondary" : "default"} className="text-xs">
                        {output.spent ? "Spent" : "Unspent"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

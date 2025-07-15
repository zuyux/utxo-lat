"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { TrendingUp, TrendingDown, Activity, Blocks, DollarSign, Zap, Users, RefreshCw, Github } from "lucide-react"
import { PriceChart } from "@/components/price-chart"
import { TransactionList } from "@/components/transaction-list"
import { MempoolStats } from "@/components/mempool-stats"
import { BlockList } from "@/components/block-list"
import { SearchBar } from "@/components/search-bar"
import { ThemeToggle } from "@/components/theme-toggle"
import { CurrencyConverter } from "@/components/currency-converter"

// Mock data generators
const generatePriceData = () => {
  const data = []
  const basePrice = 45000
  let currentPrice = basePrice

  for (let i = 0; i < 24; i++) {
    // More realistic price movements
    const volatility = 0.02 // 2% volatility
    const change = currentPrice * volatility * (Math.random() - 0.5) * 2
    currentPrice = Math.max(currentPrice + change, 30000) // Ensure price doesn't go below 30k

    data.push({
      time: `${i.toString().padStart(2, "0")}:00`,
      price: Math.round(currentPrice * 100) / 100, // Round to 2 decimal places
      volume: Math.round(Math.random() * 1000000000),
    })
  }
  return data
}

const generateTransaction = () => ({
  hash: Math.random().toString(36).substring(2, 15),
  amount: (Math.random() * 10).toFixed(8),
  fee: (Math.random() * 0.001).toFixed(8),
  confirmations: Math.floor(Math.random() * 6),
  timestamp: new Date().toISOString(),
})

const generateBlock = () => ({
  height: 800000 + Math.floor(Math.random() * 1000),
  hash: Math.random().toString(36).substring(2, 15),
  transactions: Math.floor(Math.random() * 3000) + 1000,
  size: (Math.random() * 2 + 1).toFixed(2),
  timestamp: new Date().toISOString(),
  miner: ["Antpool", "F2Pool", "Foundry USA", "ViaBTC"][Math.floor(Math.random() * 4)],
})

export default function BitcoinExplorer() {
  const [currentPrice, setCurrentPrice] = useState(45234.67)
  const [priceChange, setPriceChange] = useState(1234.56)
  const [priceData, setPriceData] = useState(generatePriceData())
  const [transactions, setTransactions] = useState(Array.from({ length: 10 }, generateTransaction))
  const [blocks, setBlocks] = useState(Array.from({ length: 5 }, generateBlock))
  const [mempoolSize, setMempoolSize] = useState(150000)
  const [avgFee, setAvgFee] = useState(25.12345)
  const [hashRate, setHashRate] = useState(450)
  const [difficulty, setDifficulty] = useState(62.46)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Update price with more realistic movements
      const volatility = 0.001 // 0.1% volatility for real-time updates
      const change = currentPrice * volatility * (Math.random() - 0.5) * 2

      setCurrentPrice((prev) => {
        const newPrice = Math.max(prev + change, 30000)
        return Math.round(newPrice * 100) / 100
      })
      setPriceChange((prev) => prev + change)

      // Update price data for chart with the same realistic movement
      setPriceData((prev) => {
        const newData = [...prev]
        const lastPoint = newData[newData.length - 1]
        const newPrice = Math.max(lastPoint.price + change, 30000)

        // Update the last point and shift the array for real-time effect
        newData.shift() // Remove first element
        newData.push({
          time: new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" }),
          price: Math.round(newPrice * 100) / 100,
          volume: Math.round(Math.random() * 1000000000),
        })

        return newData
      })

      // Update mempool
      setMempoolSize((prev) => Math.max(prev + Math.floor((Math.random() - 0.5) * 10000), 50000))
      setAvgFee((prev) => Math.max(prev + (Math.random() - 0.5) * 0.5, 5.00001))

      // Add new transaction occasionally
      if (Math.random() < 0.3) {
        setTransactions((prev) => [generateTransaction(), ...prev.slice(0, 9)])
      }

      // Add new block occasionally
      if (Math.random() < 0.1) {
        setBlocks((prev) => [generateBlock(), ...prev.slice(0, 4)])
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1000))

    setPriceData(generatePriceData())
    setTransactions(Array.from({ length: 10 }, generateTransaction))
    setBlocks(Array.from({ length: 5 }, generateBlock))

    setIsRefreshing(false)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">₿</span>
              </div>
              <h1 className="text-2xl font-bold">utxo.watch</h1>
            </div>
            <div className="flex-1 max-w-md">
              <SearchBar />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open("https://github.com/fabohax/utxo.watch", "_blank")}
              >
                <Github className="w-4 h-4 mr-2" />
                Source
              </Button>
              <ThemeToggle />
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Main Content */}
        <Tabs defaultValue="overview" className="w-full space-y-4">
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Price Chart */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Price Chart (24h)</CardTitle>
                  <CardDescription>Bitcoin price movement over the last 24 hours</CardDescription>
                </CardHeader>
                <CardContent>
                  <PriceChart data={priceData} />
                </CardContent>
              </Card>

              {/* Currency Converter */}
              <CurrencyConverter />
            </div>

            {/* Price Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Bitcoin Price</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${currentPrice.toLocaleString()}</div>
                  <div className={`flex items-center text-xs ${priceChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {priceChange >= 0 ? (
                      <TrendingUp className="w-3 h-3 mr-1" />
                    ) : (
                      <TrendingDown className="w-3 h-3 mr-1" />
                    )}
                    {priceChange >= 0 ? "+" : ""}
                    {priceChange.toFixed(2)} (24h)
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Hash Rate</CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{hashRate} EH/s</div>
                  <p className="text-xs text-muted-foreground">Network hash rate</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Mempool Size</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{mempoolSize.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Unconfirmed transactions</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average Fee</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{avgFee.toFixed(5)} sat/vB</div>
                  <p className="text-xs text-muted-foreground">Next block fee</p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Recent Transactions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <TransactionList transactions={transactions.slice(0, 5)} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Blocks className="w-4 h-4" />
                    Latest Blocks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <BlockList blocks={blocks} />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
        <div className="my-4">
          <MempoolStats mempoolSize={mempoolSize} avgFee={avgFee} transactions={transactions} />
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t mt-12">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-xs">₿</span>
              </div>
              <span className="text-sm text-muted-foreground">utxo.watch - Bitcoin Network Explorer</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <a
                href="https://github.com/fabohax/utxo.watch"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <Github className="w-4 h-4" />
                Source Code
              </a>
              <span>•</span>
              <span>Built with v0.dev</span>
              <span>•</span>
              <span>© 2024</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

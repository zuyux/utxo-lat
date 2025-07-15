"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowUpDown, Calculator } from "lucide-react"
import { Separator } from "@/components/ui/separator"

// Mock exchange rates (in a real app, these would come from an API)
const mockExchangeRates = {
  USD: 45234.67,
  EUR: 41562.33,
  GBP: 35789.45,
  JPY: 6587234.12,
  CAD: 61234.89,
  AUD: 67543.21,
  CHF: 40876.54,
  CNY: 327654.32,
}

const currencies = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
]

export function CurrencyConverter() {
  const [selectedCurrency, setSelectedCurrency] = useState("USD")
  const [satoshiAmount, setSatoshiAmount] = useState("")
  const [fiatAmount, setFiatAmount] = useState("")
  const [exchangeRates, setExchangeRates] = useState(mockExchangeRates)
  const [conversionMode, setConversionMode] = useState<"sats-to-fiat" | "fiat-to-sats">("sats-to-fiat")

  const selectedCurrencyData = currencies.find((c) => c.code === selectedCurrency)
  const btcRate = exchangeRates[selectedCurrency as keyof typeof exchangeRates]
  const satoshiRate = btcRate / 100000000 // 1 BTC = 100,000,000 satoshis

  // Simulate real-time rate updates
  useEffect(() => {
    const interval = setInterval(() => {
      setExchangeRates((prev) => {
        const newRates = { ...prev }
        Object.keys(newRates).forEach((currency) => {
          const volatility = 0.001 // 0.1% volatility
          const change = newRates[currency as keyof typeof newRates] * volatility * (Math.random() - 0.5) * 2
          newRates[currency as keyof typeof newRates] = Math.max(
            newRates[currency as keyof typeof newRates] + change,
            1000,
          )
        })
        return newRates
      })
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const handleSatoshiChange = (value: string) => {
    setSatoshiAmount(value)
    if (value && !isNaN(Number(value))) {
      const fiatValue = Number(value) * satoshiRate
      setFiatAmount(fiatValue.toFixed(2))
    } else {
      setFiatAmount("")
    }
  }

  const handleFiatChange = (value: string) => {
    setFiatAmount(value)
    if (value && !isNaN(Number(value))) {
      const satoshiValue = Number(value) / satoshiRate
      setSatoshiAmount(Math.round(satoshiValue).toString())
    } else {
      setSatoshiAmount("")
    }
  }

  const handleQuickConvert = (btcAmount: number) => {
    const satoshis = btcAmount * 100000000
    setSatoshiAmount(satoshis.toString())
    const fiatValue = satoshis * satoshiRate
    setFiatAmount(fiatValue.toFixed(2))
  }

  const toggleConversionMode = () => {
    setConversionMode((prev) => (prev === "sats-to-fiat" ? "fiat-to-sats" : "sats-to-fiat"))
    // Clear inputs when switching modes
    setSatoshiAmount("")
    setFiatAmount("")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="w-4 h-4" />
          Currency Converter
        </CardTitle>
        <CardDescription>Convert between satoshis and fiat currencies</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Exchange Rate Display */}
        <div className="text-center p-3 bg-muted rounded-lg">
          <div className="text-sm text-muted-foreground">1 BTC =</div>
          <div className="text-lg font-bold">
            {selectedCurrencyData?.symbol}
            {btcRate.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="text-xs text-muted-foreground">{selectedCurrencyData?.name}</div>
        </div>

        {/* Currency Selection */}
        <div className="space-y-2">
          <Label htmlFor="currency">Currency</Label>
          <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
            <SelectTrigger>
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              {currencies.map((currency) => (
                <SelectItem key={currency.code} value={currency.code}>
                  {currency.symbol} {currency.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Conversion Mode Toggle */}
        <div className="flex items-center justify-center">
          <Button variant="outline" size="sm" onClick={toggleConversionMode}>
            <ArrowUpDown className="w-4 h-4 mr-2" />
            {conversionMode === "sats-to-fiat" ? "Sats → Fiat" : "Fiat → Sats"}
          </Button>
        </div>

        {/* Conversion Inputs */}
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="satoshi">Satoshis</Label>
            <Input
              id="satoshi"
              type="number"
              placeholder="Enter satoshis"
              value={satoshiAmount}
              onChange={(e) => handleSatoshiChange(e.target.value)}
            />
            {satoshiAmount && (
              <div className="text-xs text-muted-foreground">
                = {(Number(satoshiAmount) / 100000000).toFixed(8)} BTC
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="fiat">{selectedCurrencyData?.name}</Label>
            <Input
              id="fiat"
              type="number"
              placeholder={`Enter ${selectedCurrencyData?.name}`}
              value={fiatAmount}
              onChange={(e) => handleFiatChange(e.target.value)}
            />
          </div>
        </div>

        <Separator />

        {/* Quick Convert Buttons */}
        <div className="space-y-2">
          <Label>Quick Convert</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => handleQuickConvert(1)}>
              1 BTC
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickConvert(0.1)}>
              0.1 BTC
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickConvert(0.01)}>
              0.01 BTC
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickConvert(0.001)}>
              0.001 BTC
            </Button>
          </div>
        </div>

        {/* Common Values Reference */}
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="font-medium">Common Values:</div>
          <div>
            1 sat = {selectedCurrencyData?.symbol}
            {satoshiRate.toFixed(8)}
          </div>
          <div>
            1,000 sats = {selectedCurrencyData?.symbol}
            {(satoshiRate * 1000).toFixed(6)}
          </div>
          <div>
            100,000 sats = {selectedCurrencyData?.symbol}
            {(satoshiRate * 100000).toFixed(4)}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

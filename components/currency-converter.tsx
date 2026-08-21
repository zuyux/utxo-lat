"use client"

import { useCallback, useEffect, useState } from "react"

import { PublicIcon } from "@/components/public-icon"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
const currencies = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF " },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "PEN", name: "Peruvian Sol", symbol: "S/" },
  { code: "ARS", name: "Argentinian Peso", symbol: "$" },
] as const

type CurrencyCode = (typeof currencies)[number]["code"]
type BitcoinUnit = "BTC" | "SAT"
type PriceResponse = { time: number; source: string } & Record<CurrencyCode, number>

const currencyStorageKey = "current-currency"
const satsPerBtc = 100_000_000

function isCurrencyCode(value: string | null): value is CurrencyCode {
  return currencies.some((currency) => currency.code === value)
}

function formatPrice(value: number, currency: CurrencyCode, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits,
  }).format(value)
}

function cryptoAmountToBtc(value: string, unit: BitcoinUnit) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return null
  return unit === "SAT" ? amount / satsPerBtc : amount
}

function btcToCryptoAmount(value: number, unit: BitcoinUnit) {
  return unit === "SAT" ? String(Math.round(value * satsPerBtc)) : value.toFixed(8)
}

export function CurrencyConverter() {
  const [prices, setPrices] = useState<PriceResponse | null>(null)
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>("USD")
  const [bitcoinUnit, setBitcoinUnit] = useState<BitcoinUnit>("BTC")
  const [bitcoinAmount, setBitcoinAmount] = useState("1")
  const [fiatAmount, setFiatAmount] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    const storedCurrency = window.localStorage.getItem(currencyStorageKey)
    if (isCurrencyCode(storedCurrency)) {
      setSelectedCurrency(storedCurrency)
    }
  }, [])

  const loadPrices = useCallback(async () => {
    try {
      const response = await fetch("/api/prices", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      })
      if (!response.ok) throw new Error("Live price unavailable")
      const data = await response.json() as PriceResponse
      setPrices(data)
      setError("")
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Price unavailable")
    }
  }, [])

  useEffect(() => {
    loadPrices()
    const interval = window.setInterval(loadPrices, 60_000)
    return () => window.clearInterval(interval)
  }, [loadPrices])

  useEffect(() => {
    if (!prices) return
    if (bitcoinAmount.trim() === "") {
      setFiatAmount("")
      return
    }
    const btcAmount = cryptoAmountToBtc(bitcoinAmount, bitcoinUnit)
    setFiatAmount(btcAmount !== null ? (btcAmount * prices[selectedCurrency]).toFixed(2) : "")
  }, [bitcoinAmount, bitcoinUnit, prices, selectedCurrency])

  const handleBitcoinChange = (value: string) => {
    setBitcoinAmount(value)
    if (!prices) return
    if (value.trim() === "") {
      setFiatAmount("")
      return
    }
    const btcAmount = cryptoAmountToBtc(value, bitcoinUnit)
    setFiatAmount(btcAmount !== null ? (btcAmount * prices[selectedCurrency]).toFixed(2) : "")
  }

  const handleFiatChange = (value: string) => {
    setFiatAmount(value)
    if (!prices) return
    if (value.trim() === "") {
      setBitcoinAmount("")
      return
    }
    const amount = Number(value)
    setBitcoinAmount(Number.isFinite(amount) ? btcToCryptoAmount(amount / prices[selectedCurrency], bitcoinUnit) : "")
  }

  const handleCurrencyChange = (value: string) => {
    if (!isCurrencyCode(value)) return
    setSelectedCurrency(value)
    window.localStorage.setItem(currencyStorageKey, value)
  }

  const handleBitcoinUnitToggle = () => {
    const nextUnit = bitcoinUnit === "BTC" ? "SAT" : "BTC"
    const btcAmount = bitcoinAmount.trim() === "" ? null : cryptoAmountToBtc(bitcoinAmount, bitcoinUnit)
    setBitcoinUnit(nextUnit)
    if (btcAmount !== null) {
      setBitcoinAmount(btcToCryptoAmount(btcAmount, nextUnit))
    }
  }

  const handlePresetBtcAmount = (amount: number) => {
    setBitcoinUnit("BTC")
    handleBitcoinChange(String(amount))
  }

  const selectedPrice = prices?.[selectedCurrency]

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-9 px-2 font-mono text-xs tabular-nums">
          {selectedPrice ? formatPrice(selectedPrice, selectedCurrency) : "—"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bitcoin converter</DialogTitle>
          <DialogDescription>
            Live BTC exchange rates{prices ? ` from ${prices.source} · updated ${new Date(prices.time * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border bg-muted/30 p-4 text-center">
          <p className="text-xs text-muted-foreground">1 BTC</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {prices ? formatPrice(prices[selectedCurrency], selectedCurrency, 2) : "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {currencies.find((currency) => currency.code === selectedCurrency)?.name}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="converter-currency">Fiat currency</Label>
          <Select value={selectedCurrency} onValueChange={handleCurrencyChange}>
            <SelectTrigger id="converter-currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {currencies.map((currency) => (
                <SelectItem key={currency.code} value={currency.code}>
                  {currency.symbol} {currency.code} · {currency.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="bitcoin-amount">{bitcoinUnit}</Label>
              <button
                type="button"
                className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={handleBitcoinUnitToggle}
              >
                {bitcoinUnit === "BTC" ? "SAT" : "BTC"}
              </button>
            </div>
            <Input
              id="bitcoin-amount"
              type="number"
              min="0"
              step={bitcoinUnit === "SAT" ? "1" : "any"}
              inputMode={bitcoinUnit === "SAT" ? "numeric" : "decimal"}
              value={bitcoinAmount}
              onChange={(event) => handleBitcoinChange(event.target.value)}
            />
          </div>
          <div className="flex size-9 items-center justify-center text-muted-foreground">
            <PublicIcon name="arrow-right" className="size-4 rotate-90" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fiat-amount">{selectedCurrency}</Label>
            <Input
              id="fiat-amount"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={fiatAmount}
              onChange={(event) => handleFiatChange(event.target.value)}
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/40 p-3 text-xs text-destructive">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={loadPrices}>Retry</Button>
          </div>
        )}

        <div className="grid grid-cols-4 gap-2">
          {[1, 0.1, 0.01, 0.001].map((amount) => (
            <Button key={amount} variant="outline" size="sm" onClick={() => handlePresetBtcAmount(amount)}>
              {amount} BTC
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

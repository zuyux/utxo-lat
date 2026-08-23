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
import { cn } from "@/lib/utils"
import { currencies, currencyCountries, type CurrencyCode } from "@/lib/currencies"
import { useLanguage } from "@/lib/i18n"

type BitcoinUnit = "BTC" | "SAT"
type PriceResponse = { time: number; source: string } & Partial<Record<CurrencyCode, number>>

const currencyStorageKey = "current-currency"
const satsPerBtc = 100_000_000

function isCurrencyCode(value: string | null): value is CurrencyCode {
  return currencies.some((currency) => currency.code === value)
}

function formatPrice(value: number, currency: CurrencyCode, locale: string, maximumFractionDigits = 0) {
  return new Intl.NumberFormat(locale, {
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

function hasPrice(value: number | undefined): value is number {
  return Number.isFinite(value)
}

function formatCurrencyLabel(currency: (typeof currencies)[number]) {
  return `${currency.symbol} ${currency.code} · ${currency.name}`
}

export function CurrencyConverter() {
  const { locale, t } = useLanguage()
  const [prices, setPrices] = useState<PriceResponse | null>(null)
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode>("USD")
  const [bitcoinUnit, setBitcoinUnit] = useState<BitcoinUnit>("BTC")
  const [bitcoinAmount, setBitcoinAmount] = useState("1")
  const [fiatAmount, setFiatAmount] = useState("")
  const [editingAmount, setEditingAmount] = useState<"bitcoin" | "fiat">("bitcoin")
  const [currencySearch, setCurrencySearch] = useState("")
  const [isCurrencySearchFocused, setIsCurrencySearchFocused] = useState(false)
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
      if (!response.ok) throw new Error(t("livePriceUnavailable"))
      const data = await response.json() as PriceResponse
      setPrices(data)
      setError("")
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t("priceUnavailable"))
    }
  }, [t])

  useEffect(() => {
    loadPrices()
    const interval = window.setInterval(loadPrices, 60_000)
    return () => window.clearInterval(interval)
  }, [loadPrices])

  useEffect(() => {
    if (!prices) return
    if (editingAmount !== "bitcoin") return
    if (bitcoinAmount.trim() === "") {
      setFiatAmount("")
      return
    }
    const btcAmount = cryptoAmountToBtc(bitcoinAmount, bitcoinUnit)
    const selectedPrice = prices[selectedCurrency]
    setFiatAmount(btcAmount !== null && hasPrice(selectedPrice) ? (btcAmount * selectedPrice).toFixed(2) : "")
  }, [bitcoinAmount, bitcoinUnit, editingAmount, prices, selectedCurrency])

  const handleBitcoinChange = (value: string) => {
    setEditingAmount("bitcoin")
    setBitcoinAmount(value)
    if (!prices) return
    if (value.trim() === "") {
      setFiatAmount("")
      return
    }
    const btcAmount = cryptoAmountToBtc(value, bitcoinUnit)
    const selectedPrice = prices[selectedCurrency]
    setFiatAmount(btcAmount !== null && hasPrice(selectedPrice) ? (btcAmount * selectedPrice).toFixed(2) : "")
  }

  const handleFiatChange = (value: string) => {
    setEditingAmount("fiat")
    setFiatAmount(value)
    if (!prices) return
    if (value.trim() === "") {
      setBitcoinAmount("")
      return
    }
    const amount = Number(value)
    const selectedPrice = prices[selectedCurrency]
    setBitcoinAmount(Number.isFinite(amount) && hasPrice(selectedPrice) ? btcToCryptoAmount(amount / selectedPrice, bitcoinUnit) : "")
  }

  const handleCurrencyChange = (value: string) => {
    if (!isCurrencyCode(value)) return
    setSelectedCurrency(value)
    setCurrencySearch("")
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
  const selectedCurrencyHasPrice = hasPrice(selectedPrice)
  const selectedCurrencyDetails = currencies.find((currency) => currency.code === selectedCurrency)
  const selectedCurrencyLabel = selectedCurrencyDetails ? formatCurrencyLabel(selectedCurrencyDetails) : selectedCurrency
  const normalizedCurrencySearch = currencySearch.trim().toLowerCase()
  const filteredCurrencies = normalizedCurrencySearch
    ? currencies.filter((currency) => (
      currency.code.toLowerCase().includes(normalizedCurrencySearch)
        || currency.name.toLowerCase().includes(normalizedCurrencySearch)
        || currency.symbol.toLowerCase().includes(normalizedCurrencySearch)
        || currencyCountries[currency.code]?.some((country) => country.toLowerCase().includes(normalizedCurrencySearch))
    ))
    : currencies

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-9 px-2 font-mono text-xs tabular-nums">
          {selectedCurrencyHasPrice ? formatPrice(selectedPrice, selectedCurrency, locale) : "—"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("converter")}</DialogTitle>
          <DialogDescription>
            {t("liveRates")}{prices ? ` ${t("from")} ${prices.source} · ${t("updated")} ${new Date(prices.time * 1000).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border bg-muted/30 p-4 text-center">
          <p className="text-xs text-muted-foreground">1 BTC</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {selectedCurrencyHasPrice ? formatPrice(selectedPrice, selectedCurrency, locale, 2) : "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {selectedCurrencyDetails?.name}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="converter-currency-search">{t("fiatCurrency")}</Label>
          <Input
            id="converter-currency-search"
            type="search"
            placeholder={t("searchCurrency")}
            value={isCurrencySearchFocused ? currencySearch : currencySearch || selectedCurrencyLabel}
            onChange={(event) => setCurrencySearch(event.target.value)}
            onFocus={() => setIsCurrencySearchFocused(true)}
            onBlur={() => setIsCurrencySearchFocused(false)}
          />
          <div
            className="max-h-56 overflow-y-auto rounded-md border bg-background p-1"
            role="listbox"
            aria-label={t("fiatCurrency")}
          >
            {filteredCurrencies.map((currency) => (
              <button
                key={currency.code}
                type="button"
                role="option"
                aria-selected={currency.code === selectedCurrency}
                className={cn(
                  "flex h-9 w-full min-w-0 items-center gap-2 rounded-sm px-2 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground",
                  currency.code === selectedCurrency && "bg-accent text-accent-foreground",
                )}
                onClick={() => handleCurrencyChange(currency.code)}
              >
                <span className="w-5 shrink-0 text-base leading-none" aria-hidden="true">
                  {currency.flag}
                </span>
                <span className="truncate">
                  {formatCurrencyLabel(currency)}
                </span>
              </button>
            ))}
            {filteredCurrencies.length === 0 && (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                {t("noCurrenciesFound")}
              </div>
            )}
          </div>
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
              disabled={!selectedCurrencyHasPrice}
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/40 p-3 text-xs text-destructive">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={loadPrices}>{t("retry")}</Button>
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

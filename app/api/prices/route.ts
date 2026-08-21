import { NextResponse } from "next/server"

import { currencyCodes } from "@/lib/currencies"

export const dynamic = "force-dynamic"

interface CoinbaseResponse {
  data?: {
    currency?: string
    rates?: Record<string, string>
  }
}

export async function GET() {
  try {
    const response = await fetch("https://api.coinbase.com/v2/exchange-rates?currency=BTC", {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) throw new Error(`Price provider returned ${response.status}`)

    const payload = await response.json() as CoinbaseResponse
    const rates = payload.data?.rates
    if (payload.data?.currency !== "BTC" || !rates) throw new Error("Invalid price response")

    const prices = Object.fromEntries(currencyCodes.map((currency) => {
      const price = Number(rates[currency])
      if (!Number.isFinite(price)) throw new Error(`Missing ${currency} rate`)
      return [currency, price]
    }))

    return NextResponse.json(
      { time: Math.floor(Date.now() / 1000), source: "Coinbase", ...prices },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch {
    return NextResponse.json({ error: "Live Bitcoin prices are unavailable" }, { status: 502 })
  }
}

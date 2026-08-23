"use client"

import Link from "next/link"
import { FormEvent, useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { PublicIcon } from "@/components/public-icon"
import { useLanguage } from "@/lib/i18n"
import { apiFetch, type BitcoinUnit, formatBitcoinAmount } from "@/lib/mempool"

interface WatchAddress {
  id: string
  address: string
  label: string
  group: string
  createdAt: number
}

interface AddressStats {
  address: string
  chain_stats: { funded_txo_sum: number; spent_txo_sum: number }
  mempool_stats: { funded_txo_sum: number; spent_txo_sum: number }
}

interface BalanceState {
  balance: number
  loading: boolean
  error: string
}

const storageKey = "utxo-watchlist"

function isBitcoinAddress(address: string) {
  return /^(1|3|bc1|BC1)/.test(address) && address.length >= 26 && address.length <= 90
}

function readStoredWatchlist() {
  try {
    const stored = window.localStorage.getItem(storageKey)
    if (!stored) return []
    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []
    return parsed.reduce<WatchAddress[]>((items, item) => {
      if (typeof item?.address !== "string" || !isBitcoinAddress(item.address)) return items

      const address = item.address.trim()
      items.push({
        id: typeof item.id === "string" ? item.id : `${Date.now()}-${address.slice(0, 8)}`,
        address,
        label: typeof item.label === "string" && item.label.trim() ? item.label : address,
        group: typeof item.group === "string" ? item.group : "",
        createdAt: typeof item.createdAt === "number" ? item.createdAt : Date.now(),
      })
      return items
    }, [])
  } catch {
    return []
  }
}

interface WatchlistProps {
  addressToAdd?: string
  trigger?: "button" | "icon"
}

export function Watchlist({ addressToAdd = "", trigger = "button" }: WatchlistProps) {
  const { locale, t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [addresses, setAddresses] = useState<WatchAddress[]>([])
  const [balances, setBalances] = useState<Record<string, BalanceState>>({})
  const [address, setAddress] = useState(addressToAdd)
  const [label, setLabel] = useState("")
  const [bitcoinUnit, setBitcoinUnit] = useState<BitcoinUnit>("btc")

  const refreshBalances = useCallback(async (items: WatchAddress[]) => {
    if (items.length === 0) return
    setBalances((current) => {
      const next = { ...current }
      items.forEach((item) => {
        next[item.address] = { balance: current[item.address]?.balance ?? 0, loading: true, error: "" }
      })
      return next
    })

    const results = await Promise.allSettled(
      items.map(async (item) => {
        const stats = await apiFetch<AddressStats>(`/address/${encodeURIComponent(item.address)}`)
        const funded = stats.chain_stats.funded_txo_sum + stats.mempool_stats.funded_txo_sum
        const spent = stats.chain_stats.spent_txo_sum + stats.mempool_stats.spent_txo_sum
        return { address: item.address, balance: funded - spent }
      }),
    )

    setBalances((current) => {
      const next = { ...current }
      results.forEach((result, index) => {
        const watchedAddress = items[index].address
        if (result.status === "fulfilled") {
          next[watchedAddress] = { balance: result.value.balance, loading: false, error: "" }
        } else {
          next[watchedAddress] = {
            balance: current[watchedAddress]?.balance ?? 0,
            loading: false,
            error: result.reason instanceof Error ? result.reason.message : t("unableAddress"),
          }
        }
      })
      return next
    })
  }, [t])

  useEffect(() => {
    const stored = readStoredWatchlist()
    setAddresses(stored)
    setLoaded(true)
    refreshBalances(stored)
  }, [refreshBalances])

  useEffect(() => {
    if (!loaded) return
    window.localStorage.setItem(storageKey, JSON.stringify(addresses))
  }, [addresses, loaded])

  useEffect(() => {
    if (open) setAddress(addressToAdd)
  }, [addressToAdd, open])

  const totalBalance = addresses.reduce((sum, item) => sum + (balances[item.address]?.balance ?? 0), 0)
  const formatAmount = (sats: number) => formatBitcoinAmount(sats, bitcoinUnit, locale)
  const savedCurrentAddress = addresses.find(
    (item) => item.address.toLowerCase() === addressToAdd.toLowerCase(),
  )

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedAddress = address.trim()
    if (!isBitcoinAddress(normalizedAddress)) {
      toast.error(t("watchlistInvalidAddress"))
      return
    }
    if (addresses.some((item) => item.address.toLowerCase() === normalizedAddress.toLowerCase())) {
      toast.error(t("watchlistDuplicate"))
      return
    }

    const nextItem: WatchAddress = {
      id: `${Date.now()}-${normalizedAddress.slice(0, 8)}`,
      address: normalizedAddress,
      label: label.trim() || t("watchlistUntitled"),
      group: "",
      createdAt: Date.now(),
    }
    const nextAddresses = [nextItem, ...addresses]
    setAddresses(nextAddresses)
    setAddress("")
    setLabel("")
    refreshBalances([nextItem])
    setOpen(false)
    toast.success(t("watchlistSaved"))
  }

  const removeAddress = (id: string) => {
    setAddresses((current) => current.filter((item) => item.id !== id))
  }

  const updateAddressLabel = (id: string, value: string) => {
    setAddresses((current) => current.map((item) => item.id === id ? { ...item, label: value } : item))
  }

  const removeCurrentAddress = () => {
    if (!savedCurrentAddress) return
    removeAddress(savedCurrentAddress.id)
    toast.success(t("watchlistRemoved"))
  }

  if (savedCurrentAddress) {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("watchlistRemoveAddress")}
        className="bg-transparent text-white hover:bg-transparent hover:text-white/80"
        onClick={removeCurrentAddress}
      >
        <PublicIcon name="save-remove" className="size-4" />
      </Button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={trigger === "icon" ? t("watchlistTitle") : t("watchlistSaveAddress")}
          className={trigger === "icon" ? "size-8 bg-transparent text-white hover:text-white" : "text-white hover:text-white"}
        >
          <PublicIcon name="save" className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("watchlistTitle")}</DialogTitle>
          <DialogDescription>{t("watchlistDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap justify-end gap-2">
            <div className="flex rounded-md border p-0.5" aria-label="Bitcoin unit">
              <Button
                variant={bitcoinUnit === "btc" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2"
                onClick={() => setBitcoinUnit("btc")}
              >
                BTC
              </Button>
              <Button
                variant={bitcoinUnit === "sat" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2"
                onClick={() => setBitcoinUnit("sat")}
              >
                SAT
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={() => refreshBalances(addresses)} disabled={addresses.length === 0}>
              <PublicIcon name="refresh" className="mr-2 size-4" />
              {t("refresh")}
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem]">
            <form onSubmit={handleSubmit} className="rounded-lg border bg-card p-4">
              <div className="grid gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="watch-address">{t("address")}</Label>
                  <Input
                    id="watch-address"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    placeholder={t("watchlistAddressPlaceholder")}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="watch-label">{t("watchlistLabel")}</Label>
                  <Input
                    id="watch-label"
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                    placeholder={t("watchlistLabelPlaceholder")}
                  />
                </div>
              </div>
              <Button type="submit" className="mt-4 w-full">
                <PublicIcon name="save" className="mr-2 size-4" />
                {t("watchlistAddCurrent")}
              </Button>
            </form>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("watchlistCombinedBalance")}</CardTitle>
                <CardDescription>{addresses.length.toLocaleString(locale)} {t("watchlistSavedAddresses")}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{formatAmount(totalBalance)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("confirmedMempoolTotals")}</p>
              </CardContent>
            </Card>
          </div>

          {addresses.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <PublicIcon name="dashed-square" className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">{t("watchlistEmptyTitle")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("watchlistEmptyDescription")}</p>
            </div>
          ) : (
            <div className="rounded-lg border">
              <div className="divide-y">
                {addresses.map((item) => {
                  const balance = balances[item.address]
                  return (
                    <div key={item.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Input
                            value={item.label}
                            onChange={(event) => updateAddressLabel(item.id, event.target.value)}
                            onBlur={(event) => {
                              if (!event.target.value.trim()) {
                                updateAddressLabel(item.id, t("watchlistUntitled"))
                              }
                            }}
                            aria-label={t("watchlistLabel")}
                            placeholder={t("watchlistUntitled")}
                            className="h-8 min-w-0 border-0 bg-transparent px-0 text-sm font-medium shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                          {balance?.loading && <PublicIcon name="refresh" className="size-3 animate-spin text-muted-foreground" />}
                        </div>
                        <Link
                          href={`/address/${encodeURIComponent(item.address)}`}
                          className="mt-1 block truncate font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {item.address}
                        </Link>
                        {balance?.error && <p className="mt-1 text-xs text-destructive">{balance.error}</p>}
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <p className="font-mono text-sm tabular-nums">{formatAmount(balance?.balance ?? 0)}</p>
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => removeAddress(item.id)} aria-label={t("watchlistRemove")}>
                          <PublicIcon name="close" className="size-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

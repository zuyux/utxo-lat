"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { toast } from "sonner"
import { useExplorerNetwork } from "@/lib/explorer-network"
import { PublicIcon } from "@/components/public-icon"
import { useLanguage } from "@/lib/i18n"
import { cn } from "@/lib/utils"

interface SearchBarProps {
  className?: string
}

const popularTargets = [
  {
    title: "Satoshi Nakamoto address",
    detail: "Genesis coinbase address",
    value: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    href: "/address/1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    icon: "wallet",
  },
  {
    title: "Genesis Block",
    detail: "Block height 0",
    value: "0",
    href: "/block/0",
    icon: "blocks",
  },
  {
    title: "Bitcoin Pizza transaction",
    detail: "Historic 10,000 BTC spend",
    value: "a1075db55d416d3ca199f55b6084e2115b9345e16c5cf302fc80e9d5fbf5d48d",
    href: "/tx/a1075db55d416d3ca199f55b6084e2115b9345e16c5cf302fc80e9d5fbf5d48d",
    icon: "txs",
  },
  {
    title: "Latest known early block",
    detail: "Block height 210000",
    value: "210000",
    href: "/block/210000",
    icon: "hash",
  },
] as const

export function SearchBar({ className }: SearchBarProps) {
  const [query, setQuery] = useState("")
  const [paletteQuery, setPaletteQuery] = useState("")
  const [open, setOpen] = useState(false)
  const { prefix, isTestnet, apiFetch } = useExplorerNetwork()
  const router = useRouter()
  const { t } = useLanguage()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const runSearch = async (rawQuery: string) => {
    const trimmedQuery = rawQuery.trim()
    if (!trimmedQuery) return

    if (trimmedQuery.length === 64 && /^[a-fA-F0-9]+$/.test(trimmedQuery)) {
      try {
        await apiFetch(`/block/${trimmedQuery}`)
        router.push(`${prefix}/block/${trimmedQuery}`)
      } catch {
        router.push(`${prefix}/tx/${trimmedQuery}`)
      }
    } else if (/^\d+$/.test(trimmedQuery)) {
      router.push(`${prefix}/block/${trimmedQuery}`)
    } else if (
      (isTestnet ? /^(m|n|2|tb1|TB1)/ : /^(1|3|bc1|BC1)/).test(trimmedQuery) &&
      trimmedQuery.length >= 26 &&
      trimmedQuery.length <= 90
    ) {
      router.push(`${prefix}/address/${encodeURIComponent(trimmedQuery)}`)
    } else {
      toast.error(t("searchInvalid"))
    }
  }

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault()
    await runSearch(query)
  }

  const handlePaletteSearch = async () => {
    await runSearch(paletteQuery)
    setOpen(false)
  }

  const goToTarget = (href: string) => {
    router.push(href)
    setOpen(false)
    setPaletteQuery("")
  }

  return (
    <>
      <form
        onSubmit={handleSearch}
        className={cn(
          "flex h-10 items-center gap-3 rounded-[14px] border border-black/50 bg-transparent p-1.5 shadow-none focus-within:border-black/70 dark:border-white/50 dark:focus-within:border-white/70",
          className
        )}
      >
        <PublicIcon name="search" className="ml-3 size-4 text-foreground/50" />
        <Input
          type="text"
          placeholder={isTestnet ? "Search testnet transactions, addresses, and blocks" : "Search transactions, addresses, domains, and blocks"}
          aria-label={t("searchAria")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setOpen(true)}
          className="h-7 flex-1 border-0 bg-transparent px-0 text-[15px] text-foreground shadow-none outline-none placeholder:text-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-7 shrink-0 items-center gap-1 rounded-lg bg-transparent px-2.5 text-xs text-foreground/50 transition-colors hover:bg-foreground/10 hover:text-foreground"
          aria-label="Open command search"
        >
          <PublicIcon name="command" className="size-3.5" />
          <span>K</span>
        </button>
      </form>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder={isTestnet ? "Search testnet transactions, addresses, and blocks" : "Search transactions, addresses, domains, and blocks"}
          value={paletteQuery}
          onValueChange={setPaletteQuery}
          onKeyDown={(event) => {
            if (event.key === "Enter" && paletteQuery.trim()) {
              event.preventDefault()
              handlePaletteSearch()
            }
          }}
        />
        <CommandList>
          <CommandEmpty>{t("searchInvalid")}</CommandEmpty>
          <CommandGroup heading="Popular">
            {(isTestnet ? [{ title: "Example testnet transaction", detail: "Blockstream reference", value: "3fa35efd27803c8bcacea1b15da8aa86a97f203ced6bd7e6dd39b3c93f7e5e2f", href: "/testnet/tx/3fa35efd27803c8bcacea1b15da8aa86a97f203ced6bd7e6dd39b3c93f7e5e2f", icon: "txs" as const }, { title: "Testnet genesis block", detail: "Block height 0", value: "0", href: "/testnet/block/0", icon: "blocks" as const }] : popularTargets).map((target) => (
              <CommandItem
                key={target.href}
                value={`${target.title} ${target.detail} ${target.value}`}
                onSelect={() => goToTarget(target.href)}
                className="cursor-pointer"
              >
                <PublicIcon name={target.icon} className="size-4 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{target.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{target.detail}</span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          {paletteQuery.trim() && (
            <CommandGroup heading="Search">
              <CommandItem value={paletteQuery} onSelect={handlePaletteSearch} className="cursor-pointer">
                <PublicIcon name="search" className="size-4 text-muted-foreground" />
                <span className="truncate">{paletteQuery}</span>
              </CommandItem>
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}

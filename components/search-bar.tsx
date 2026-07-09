"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"
import { toast } from "sonner"
import { apiFetch } from "@/lib/mempool"

export function SearchBar() {
  const [query, setQuery] = useState("")
  const router = useRouter()

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    const trimmedQuery = query.trim()

    if (trimmedQuery.length === 64 && /^[a-fA-F0-9]+$/.test(trimmedQuery)) {
      try {
        await apiFetch(`/block/${trimmedQuery}`)
        router.push(`/block/${trimmedQuery}`)
      } catch {
        router.push(`/tx/${trimmedQuery}`)
      }
    } else if (/^\d+$/.test(trimmedQuery)) {
      router.push(`/block/${trimmedQuery}`)
    } else if (
      /^(1|3|bc1|BC1)/.test(trimmedQuery) &&
      trimmedQuery.length >= 26 &&
      trimmedQuery.length <= 90
    ) {
      router.push(`/address/${encodeURIComponent(trimmedQuery)}`)
    } else {
      toast.error("Enter a valid transaction ID, Bitcoin address, or block height")
    }
  }

  return (
    <form onSubmit={handleSearch} className="flex gap-2">
      <Input
        type="text"
        placeholder="Search block, transaction, or address"
        aria-label="Search the Bitcoin explorer"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-10 flex-1"
      />
      <Button type="submit" size="icon" className="size-10 shrink-0" aria-label="Search">
        <Search className="size-4" />
      </Button>
    </form>
  )
}

"use client"

import { formatDistanceToNow } from "date-fns"
import { useRouter } from "next/navigation"

import { useLanguage } from "@/lib/i18n"

interface RecentBlock {
  height: number
  hash: string
  transactions: number
  size: string
  timestamp: string
  miner: string
}

interface RecentBlockStripProps {
  blocks: RecentBlock[]
}

export function RecentBlockStrip({ blocks }: RecentBlockStripProps) {
  const router = useRouter()
  const { dateLocale, t } = useLanguage()

  if (blocks.length === 0) return null

  return (
    <div className="py-4" aria-label={t("recentlyMinedBlocks")}>
      <div className="flex w-full gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {blocks.map((block) => (
          <button
            key={block.height}
            type="button"
            className="group flex h-28 min-w-36 flex-1 shrink-0 flex-col justify-between rounded-sm border border-foreground/10 bg-white p-3 text-left text-black shadow-sm transition-transform hover:-translate-y-0.5 hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:border-white dark:bg-white dark:text-black"
            onClick={() => router.push(`/block/${block.height}`)}
          >
            <span className="font-mono text-sm font-semibold leading-none">
              {block.height.toLocaleString()}
            </span>

            <span className="space-y-1 text-[10px] leading-tight text-black/65">
              <span className="block truncate font-medium text-black">
                {block.miner}
              </span>
              <span className="block">
                {block.transactions.toLocaleString()} tx
              </span>
              <span className="block">
                {block.size} MB
              </span>
              <span className="block truncate">
                {formatDistanceToNow(new Date(block.timestamp), { addSuffix: true, locale: dateLocale })}
              </span>
            </span>

            <span className="h-1 w-full rounded-full bg-black/10 transition-colors group-hover:bg-black/25" />
          </button>
        ))}
      </div>
    </div>
  )
}

"use client"

import { formatDistanceToNow } from "date-fns"
import { useRouter } from "next/navigation"

import { PublicIcon } from "@/components/public-icon"

interface Block {
  height: number
  hash: string
  transactions: number
  size: string
  timestamp: string
  miner: string
}

interface BlockListProps {
  blocks: Block[]
  detailed?: boolean
}

export function BlockList({ blocks, detailed = false }: BlockListProps) {
  const router = useRouter()

  return (
    <div className="divide-y">
      {blocks.map((block, index) => (
        <button
          key={block.height}
          type="button"
          className="group grid w-full grid-cols-[1fr_auto] items-center gap-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          onClick={() => router.push(`/block/${block.height}`)}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-medium">
                {block.height.toLocaleString()}
              </span>
              {index === 0 && (
                <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
                  latest
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {detailed && `${block.hash.slice(0, 12)}… · `}
              {block.transactions.toLocaleString()} tx · {block.size} MB · {block.miner}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="whitespace-nowrap">
              {formatDistanceToNow(new Date(block.timestamp), { addSuffix: true })}
            </span>
            <PublicIcon name="chevronRight" className="size-4 transition-transform group-hover:translate-x-0.5" />
          </div>
        </button>
      ))}
    </div>
  )
}

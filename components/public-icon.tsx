"use client"

import { cn } from "@/lib/utils"

const iconPaths = {
  "arrow-left": "/arrow-left.svg",
  "arrow-right": "/arrow-right.svg",
  bitcoin: "/bitcoin.svg",
  blocks: "/blocks.svg",
  check: "/check.svg",
  chevronLeft: "/chevronLeft.svg",
  chevronRight: "/chevronRight.svg",
  clock: "/clock.svg",
  close: "/close.svg",
  command: "/command.svg",
  coins: "/coins.svg",
  copy: "/copy.svg",
  "dashed-square": "/dashed-square.svg",
  externalLink: "/externalLink.svg",
  flash: "/flash.svg",
  hash: "/hash.svg",
  "hard-drive": "/hard-drive.svg",
  info: "/info.svg",
  "miner-users": "/miner-users.svg",
  moon: "/moon.svg",
  received: "/received.svg",
  refresh: "/refresh.svg",
  save: "/save.svg",
  "save-remove": "/save-remove.svg",
  search: "/search.svg",
  sent: "/sent.svg",
  status: "/status.svg",
  sun: "/sun.svg",
  trendingDown: "/trendingDown.svg",
  trendingUp: "/trendingUp.svg",
  txs: "/txs.svg",
  wallet: "/wallet.svg",
} as const

export type PublicIconName = keyof typeof iconPaths

interface PublicIconProps {
  name: PublicIconName
  className?: string
  "aria-hidden"?: boolean | "true" | "false"
}

export function PublicIcon({ name, className, "aria-hidden": ariaHidden = true }: PublicIconProps) {
  const path = iconPaths[name]

  return (
    <span
      aria-hidden={ariaHidden}
      data-public-icon=""
      className={cn("inline-block size-4 shrink-0 bg-current", className)}
      style={{
        maskImage: `url(${path})`,
        WebkitMaskImage: `url(${path})`,
        maskPosition: "center",
        WebkitMaskPosition: "center",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskSize: "contain",
        WebkitMaskSize: "contain",
      }}
    />
  )
}

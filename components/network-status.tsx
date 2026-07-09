"use client"

import { useEffect, useState } from "react"

import { apiFetch } from "@/lib/mempool"

interface MiningStats {
  currentHashrate: number
  currentDifficulty: number
}

interface DifficultyAdjustment {
  progressPercent: number
  difficultyChange: number
  estimatedRetargetDate: number
  remainingBlocks: number
  remainingTime: number
}

function formatHashrate(hashrate: number) {
  const units = [
    { threshold: 1e18, suffix: "EH/s" },
    { threshold: 1e15, suffix: "PH/s" },
    { threshold: 1e12, suffix: "TH/s" },
  ]
  const unit = units.find(({ threshold }) => hashrate >= threshold) ?? units[units.length - 1]
  return `${(hashrate / unit.threshold).toFixed(1)} ${unit.suffix}`
}

function formatDifficulty(difficulty: number) {
  if (difficulty >= 1e12) return `${(difficulty / 1e12).toFixed(2)} T`
  if (difficulty >= 1e9) return `${(difficulty / 1e9).toFixed(2)} B`
  return difficulty.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

function formatRemainingTime(milliseconds: number) {
  const totalHours = Math.max(0, Math.round(milliseconds / 3_600_000))
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  if (days === 0) return `${hours}h`
  return `${days}d ${hours}h`
}

export function NetworkStatus() {
  const [mining, setMining] = useState<MiningStats | null>(null)
  const [adjustment, setAdjustment] = useState<DifficultyAdjustment | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        const [miningData, adjustmentData] = await Promise.all([
          apiFetch<MiningStats>("/v1/mining/hashrate/3d"),
          apiFetch<DifficultyAdjustment>("/v1/difficulty-adjustment"),
        ])
        if (!active) return
        setMining(miningData)
        setAdjustment(adjustmentData)
        setError("")
      } catch (requestError) {
        if (!active) return
        setError(requestError instanceof Error ? requestError.message : "Unable to load network status")
      }
    }

    load()
    const interval = window.setInterval(load, 60_000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

  const metrics = [
    {
      label: "Hashrate",
      value: mining ? formatHashrate(mining.currentHashrate) : "—",
      detail: "3-day estimate",
    },
    {
      label: "Difficulty",
      value: mining ? formatDifficulty(mining.currentDifficulty) : "—",
      detail: "Current target",
    },
    {
      label: "Expected adjustment",
      value: adjustment
        ? `${adjustment.difficultyChange >= 0 ? "+" : ""}${adjustment.difficultyChange.toFixed(2)}%`
        : "—",
      detail: adjustment ? `${adjustment.progressPercent.toFixed(1)}% through epoch` : "Calculating",
    },
    {
      label: "Until retarget",
      value: adjustment ? formatRemainingTime(adjustment.remainingTime) : "—",
      detail: adjustment
        ? `${adjustment.remainingBlocks.toLocaleString()} blocks · ${new Date(adjustment.estimatedRetargetDate).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}`
        : "Calculating",
    },
  ]

  return (
    <section className="mt-12" aria-labelledby="network-heading">
      <div className="flex items-end justify-between pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="network-heading" className="text-sm font-semibold">Network status</h2>
            {!error && mining && adjustment && <span className="size-1.5 bg-emerald-500" />}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {error ? `Live data unavailable: ${error}` : "Mining and difficulty retarget"}
          </p>
        </div>
        <p className="text-[10px] text-muted-foreground">refreshes every minute</p>
      </div>

      <div className="grid grid-cols-2 border sm:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="border-b p-3 even:border-l last:border-b-0 sm:border-b-0 sm:border-l sm:first:border-l-0"
          >
            <p className="text-[10px] text-muted-foreground">{metric.label}</p>
            <p className="mt-1 text-sm font-semibold tabular-nums">{metric.value}</p>
            <p className="mt-0.5 truncate text-[9px] text-muted-foreground">{metric.detail}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

"use client"

import { PointerEvent, useCallback, useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"
import { apiFetch } from "@/lib/mempool"

const CELL_SIZE = 8
const CELL_GAP = 2
const CANVAS_HEIGHT = 210
const TRANSACTIONS_PER_PIXEL = 150

const tiers = [
  { label: "Priority", color: "#fb7185" },
  { label: "High", color: "#fbbf24" },
  { label: "Medium", color: "#34d399" },
  { label: "Low", color: "#38bdf8" },
] as const

type Pixel = {
  tier: number
  transactions: number
  vsize: number
}

type HoveredPixel = Pixel & {
  x: number
  y: number
}

function seededValue(index: number, salt: number) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453
  return value - Math.floor(value)
}

function createPixels(total: number): Pixel[] {
  return Array.from({ length: total }, (_, index) => {
    const position = index / total
    const tier = position < 0.15 ? 0 : position < 0.36 ? 1 : position < 0.68 ? 2 : 3

    return {
      tier,
      transactions: 92 + Math.floor(seededValue(index, 1) * 116),
      vsize: 18 + Math.floor(seededValue(index, 2) * 56),
    }
  })
}

export function MempoolCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pixelsRef = useRef<Pixel[]>([])
  const dimensionsRef = useRef({ columns: 0, total: 0 })
  const pulseRef = useRef(-1)
  const { resolvedTheme } = useTheme()
  const [transactionCount, setTransactionCount] = useState<number | null>(null)
  const [mempoolVsize, setMempoolVsize] = useState<number | null>(null)
  const [nextBlockFee, setNextBlockFee] = useState<number | null>(null)
  const [hovered, setHovered] = useState<HoveredPixel | null>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const wrapper = canvas?.parentElement
    if (!canvas || !wrapper) return

    const width = wrapper.clientWidth
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const columns = Math.floor((width + CELL_GAP) / (CELL_SIZE + CELL_GAP))
    const rows = Math.floor((CANVAS_HEIGHT + CELL_GAP) / (CELL_SIZE + CELL_GAP))
    const total = columns * rows

    if (pixelsRef.current.length !== total) pixelsRef.current = createPixels(total)
    dimensionsRef.current = { columns, total }

    canvas.width = width * dpr
    canvas.height = CANVAS_HEIGHT * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${CANVAS_HEIGHT}px`

    const context = canvas.getContext("2d")
    if (!context) return

    context.scale(dpr, dpr)
    context.clearRect(0, 0, width, CANVAS_HEIGHT)

    pixelsRef.current.forEach((pixel, index) => {
      const column = index % columns
      const row = Math.floor(index / columns)
      const x = column * (CELL_SIZE + CELL_GAP)
      const y = row * (CELL_SIZE + CELL_GAP)

      context.fillStyle = tiers[pixel.tier].color
      context.globalAlpha = index === pulseRef.current ? 1 : 0.68 + seededValue(index, 3) * 0.24
      context.fillRect(x, y, CELL_SIZE, CELL_SIZE)
    })

    // The first 1 vMB is a rough projection of the next block.
    const cutoffRow = Math.max(2, Math.round(rows * 0.18))
    const cutoffY = cutoffRow * (CELL_SIZE + CELL_GAP) - CELL_GAP / 2
    context.globalAlpha = 0.8
    context.strokeStyle = resolvedTheme === "dark" ? "#fafafa" : "#0f172a"
    context.setLineDash([3, 4])
    context.beginPath()
    context.moveTo(0, cutoffY)
    context.lineTo(width, cutoffY)
    context.stroke()
    context.setLineDash([])
    context.globalAlpha = 1
  }, [resolvedTheme])

  useEffect(() => {
    draw()

    const resizeObserver = new ResizeObserver(draw)
    const wrapper = canvasRef.current?.parentElement
    if (wrapper) resizeObserver.observe(wrapper)

    const interval = window.setInterval(() => {
      const { total } = dimensionsRef.current
      pulseRef.current = total ? Math.floor(Math.random() * total) : -1
      draw()
    }, 1400)

    return () => {
      resizeObserver.disconnect()
      window.clearInterval(interval)
    }
  }, [draw])

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const [mempool, fees] = await Promise.all([
          apiFetch<{ count: number; vsize: number }>("/mempool"),
          apiFetch<{ fastestFee: number }>("/v1/fees/recommended"),
        ])
        if (!active) return
        setTransactionCount(mempool.count)
        setMempoolVsize(mempool.vsize)
        setNextBlockFee(fees.fastestFee)
      } catch {
        // Keep the last verified values when the upstream service is temporarily unavailable.
      }
    }
    load()
    const interval = window.setInterval(load, 30_000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const bounds = canvas.getBoundingClientRect()
    const localX = event.clientX - bounds.left
    const localY = event.clientY - bounds.top
    const column = Math.floor(localX / (CELL_SIZE + CELL_GAP))
    const row = Math.floor(localY / (CELL_SIZE + CELL_GAP))
    const { columns } = dimensionsRef.current
    const pixel = pixelsRef.current[row * columns + column]

    if (!pixel) return setHovered(null)
    setHovered({
      ...pixel,
      x: Math.min(localX + 12, bounds.width - 150),
      y: Math.max(4, localY - 58),
    })
  }

  return (
    <section className="mt-12" aria-labelledby="mempool-heading">
      <div className="flex flex-wrap items-end justify-between gap-3 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="mempool-heading" className="text-sm font-semibold">
              Mempool
            </h2>
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping bg-emerald-500 opacity-60" />
              <span className="relative inline-flex size-1.5 bg-emerald-500" />
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {transactionCount == null ? "Loading live mempool…" : `${transactionCount.toLocaleString()} unconfirmed transactions`}
          </p>
        </div>

        <div className="flex gap-4 text-right">
          <div>
            <p className="text-xs font-medium">{mempoolVsize == null ? "—" : `${(mempoolVsize / 1_000_000).toFixed(1)} vMB`}</p>
            <p className="text-[10px] text-muted-foreground">waiting</p>
          </div>
          <div>
            <p className="text-xs font-medium">{nextBlockFee == null ? "—" : `${nextBlockFee} sat/vB`}</p>
            <p className="text-[10px] text-muted-foreground">next block</p>
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden border-y py-3">
        <div className="pointer-events-none absolute left-2 top-[17px] z-10 bg-background/90 px-1 text-[9px] text-muted-foreground">
          next block
        </div>
        <canvas
          ref={canvasRef}
          className="block w-full cursor-crosshair"
          role="img"
          aria-label={`Illustrative fee-tier map of ${transactionCount?.toLocaleString() ?? "the"} unconfirmed Bitcoin transactions`}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHovered(null)}
        />

        {hovered && (
          <div
            className="pointer-events-none absolute z-20 w-[142px] border bg-popover px-2.5 py-2 text-[10px] shadow-md"
            style={{ left: hovered.x, top: hovered.y + 12 }}
          >
            <p className="font-medium text-popover-foreground">
              ~{hovered.transactions} transactions
            </p>
            <p className="mt-0.5 text-muted-foreground">
              {tiers[hovered.tier].label} fee tier · illustrative cell
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          {[...tiers].reverse().map((tier) => (
            <span key={tier.label} className="flex items-center gap-1.5">
              <span className="size-1.5" style={{ backgroundColor: tier.color }} />
              {tier.label}
            </span>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Visualization is illustrative · totals above are live
        </p>
      </div>
    </section>
  )
}

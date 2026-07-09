"use client"

import { PointerEvent, useCallback, useEffect, useRef, useState } from "react"

import { apiFetch } from "@/lib/mempool"

const CELL_SIZE = 8
const CELL_GAP = 2
const CANVAS_HEIGHT = 210
const MIN_VBYTES_PER_CELL = 100_000

interface MempoolStats {
  count: number
  vsize: number
  total_fee: number
  fee_histogram: Array<[number, number]>
}

interface FeeRecommendations {
  fastestFee: number
  halfHourFee: number
  hourFee: number
  economyFee: number
  minimumFee: number
}

interface Cell {
  feeHigh: number
  feeLow: number
  vsize: number
}

interface HoveredCell extends Cell {
  x: number
  y: number
}

const colors = ["#fb7185", "#fbbf24", "#34d399", "#38bdf8"] as const

function makeCells(histogram: Array<[number, number]>, capacity: number) {
  const totalVsize = histogram.reduce((sum, [, vsize]) => sum + vsize, 0)
  const vbytesPerCell = Math.max(
    MIN_VBYTES_PER_CELL,
    Math.ceil(totalVsize / Math.max(1, capacity) / 10_000) * 10_000,
  )
  const cells: Cell[] = []
  let current: Cell | null = null

  for (const [feeRate, bucketVsize] of histogram) {
    let remaining = bucketVsize
    while (remaining > 0) {
      if (!current) current = { feeHigh: feeRate, feeLow: feeRate, vsize: 0 }
      const amount = Math.min(remaining, vbytesPerCell - current.vsize)
      current.vsize += amount
      current.feeLow = feeRate
      remaining -= amount
      if (current.vsize >= vbytesPerCell) {
        cells.push(current)
        current = null
      }
    }
  }
  if (current) cells.push(current)
  return { cells, vbytesPerCell }
}

function tierForFee(fee: number, recommendations: FeeRecommendations) {
  if (fee >= recommendations.fastestFee) return 0
  if (fee >= recommendations.halfHourFee) return 1
  if (fee >= recommendations.hourFee) return 2
  return 3
}

function formatFee(value: number) {
  return value < 1 ? value.toFixed(2) : value.toFixed(1)
}

export function MempoolCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cellsRef = useRef<Cell[]>([])
  const dimensionsRef = useRef({ columns: 0, rows: 0 })
  const [stats, setStats] = useState<MempoolStats | null>(null)
  const [fees, setFees] = useState<FeeRecommendations | null>(null)
  const [vbytesPerCell, setVbytesPerCell] = useState(MIN_VBYTES_PER_CELL)
  const [hovered, setHovered] = useState<HoveredCell | null>(null)
  const [error, setError] = useState("")

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const wrapper = canvas?.parentElement
    if (!canvas || !wrapper || !stats || !fees) return

    const width = wrapper.clientWidth
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const columns = Math.max(1, Math.floor((width + CELL_GAP) / (CELL_SIZE + CELL_GAP)))
    const rows = Math.floor((CANVAS_HEIGHT + CELL_GAP) / (CELL_SIZE + CELL_GAP))
    const result = makeCells(stats.fee_histogram, columns * rows)
    cellsRef.current = result.cells
    dimensionsRef.current = { columns, rows }
    setVbytesPerCell(result.vbytesPerCell)

    canvas.width = width * dpr
    canvas.height = CANVAS_HEIGHT * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${CANVAS_HEIGHT}px`

    const context = canvas.getContext("2d")
    if (!context) return
    context.scale(dpr, dpr)
    context.clearRect(0, 0, width, CANVAS_HEIGHT)

    const nextBlockCells = Math.ceil(1_000_000 / result.vbytesPerCell)
    result.cells.forEach((cell, index) => {
      const column = index % columns
      const row = Math.floor(index / columns)
      const x = column * (CELL_SIZE + CELL_GAP)
      const y = row * (CELL_SIZE + CELL_GAP)
      const fillRatio = Math.min(1, cell.vsize / result.vbytesPerCell)

      context.globalAlpha = 0.88
      context.fillStyle = colors[tierForFee(cell.feeLow, fees)]
      context.fillRect(x, y, Math.max(1, CELL_SIZE * fillRatio), CELL_SIZE)

      if (index < nextBlockCells) {
        context.globalAlpha = 1
        context.strokeStyle = "#ffffff"
        context.lineWidth = 1
        context.strokeRect(x - 0.5, y - 0.5, CELL_SIZE + 1, CELL_SIZE + 1)
      }
    })
    context.globalAlpha = 1
  }, [fees, stats])

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const [nextStats, nextFees] = await Promise.all([
          apiFetch<MempoolStats>("/mempool"),
          apiFetch<FeeRecommendations>("/v1/fees/recommended"),
        ])
        if (!active) return
        setStats(nextStats)
        setFees(nextFees)
        setError("")
      } catch (requestError) {
        if (!active) return
        setError(requestError instanceof Error ? requestError.message : "Unable to load mempool")
      }
    }
    load()
    const interval = window.setInterval(load, 30_000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    draw()
    const observer = new ResizeObserver(draw)
    const wrapper = canvasRef.current?.parentElement
    if (wrapper) observer.observe(wrapper)
    return () => observer.disconnect()
  }, [draw])

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const bounds = canvas.getBoundingClientRect()
    const localX = event.clientX - bounds.left
    const localY = event.clientY - bounds.top
    const column = Math.floor(localX / (CELL_SIZE + CELL_GAP))
    const row = Math.floor(localY / (CELL_SIZE + CELL_GAP))
    const cell = cellsRef.current[row * dimensionsRef.current.columns + column]
    if (!cell) return setHovered(null)
    setHovered({
      ...cell,
      x: Math.min(localX + 12, bounds.width - 180),
      y: Math.max(4, localY - 66),
    })
  }

  const legend = fees
    ? [
        { label: `≥ ${fees.fastestFee} sat/vB`, color: colors[0] },
        { label: `≥ ${fees.halfHourFee} sat/vB`, color: colors[1] },
        { label: `≥ ${fees.hourFee} sat/vB`, color: colors[2] },
        { label: `< ${fees.hourFee} sat/vB`, color: colors[3] },
      ]
    : []

  return (
    <section className="mt-12" aria-labelledby="mempool-heading">
      <div className="flex flex-wrap items-end justify-between gap-3 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="mempool-heading" className="text-sm font-semibold">Mempool</h2>
            {!error && <span className="size-1.5 bg-emerald-500" />}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {error
              ? `Live data unavailable: ${error}`
              : stats
                ? `${stats.count.toLocaleString()} unconfirmed transactions`
                : "Loading live mempool…"}
          </p>
        </div>

        <div className="flex gap-4 text-right">
          <div>
            <p className="text-xs font-medium">{stats ? `${(stats.vsize / 1_000_000).toFixed(1)} vMB` : "—"}</p>
            <p className="text-[10px] text-muted-foreground">waiting</p>
          </div>
          <div>
            <p className="text-xs font-medium">{fees ? `${fees.fastestFee} sat/vB` : "—"}</p>
            <p className="text-[10px] text-muted-foreground">next block</p>
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden border-y py-3">
        <p className="pointer-events-none absolute left-2 top-4 z-10 bg-background/90 px-1 text-[9px] text-muted-foreground">
          white outline = highest-fee 1 vMB
        </p>
        <canvas
          ref={canvasRef}
          className="block w-full cursor-crosshair"
          role="img"
          aria-label="Live Bitcoin mempool virtual-size distribution grouped by fee rate"
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHovered(null)}
        />
        {hovered && (
          <div
            className="pointer-events-none absolute z-20 w-[170px] border bg-popover px-2.5 py-2 text-[10px] shadow-md"
            style={{ left: hovered.x, top: hovered.y + 12 }}
          >
            <p className="font-medium text-popover-foreground">
              {formatFee(hovered.feeLow)}–{formatFee(hovered.feeHigh)} sat/vB
            </p>
            <p className="mt-0.5 text-muted-foreground">
              {(hovered.vsize / 1_000).toFixed(1)} kvB queued
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
          {legend.map((item) => (
            <span key={`${item.label}-${item.color}`} className="flex items-center gap-1.5">
              <span className="size-1.5" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">
          1 cell = {(vbytesPerCell / 1_000).toLocaleString()} kvB · live fee histogram
        </p>
      </div>
    </section>
  )
}

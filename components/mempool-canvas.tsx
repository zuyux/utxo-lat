"use client"

import { PointerEvent, useCallback, useEffect, useRef, useState } from "react"

import { PublicIcon } from "@/components/public-icon"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { apiFetch } from "@/lib/mempool"
import { useLanguage } from "@/lib/i18n"

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
  feeHigh: number | null
  feeLow: number
  vsize: number
  portions: Array<{ feeRate: number; vsize: number }>
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
  let previousFeeRate: number | null = null

  for (const [feeRate, bucketVsize] of histogram) {
    let remaining = bucketVsize
    while (remaining > 0) {
      if (!current) {
        current = {
          feeHigh: previousFeeRate,
          feeLow: feeRate,
          vsize: 0,
          portions: [],
        }
      }
      const amount = Math.min(remaining, vbytesPerCell - current.vsize)
      current.vsize += amount
      current.feeLow = feeRate
      const lastPortion = current.portions[current.portions.length - 1]
      if (lastPortion?.feeRate === feeRate) {
        lastPortion.vsize += amount
      } else {
        current.portions.push({ feeRate, vsize: amount })
      }
      remaining -= amount
      if (current.vsize >= vbytesPerCell) {
        cells.push(current)
        current = null
      }
    }
    previousFeeRate = feeRate
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

function formatFeeBand(cell: Cell) {
  if (cell.feeHigh === null) return `> ${formatFee(cell.feeLow)} sat/vB`
  if (cell.feeHigh === cell.feeLow) return `~ ${formatFee(cell.feeLow)} sat/vB`
  return `${formatFee(cell.feeLow)}–${formatFee(cell.feeHigh)} sat/vB`
}

export function MempoolCanvas() {
  const { locale, t } = useLanguage()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cellsRef = useRef<Cell[]>([])
  const dimensionsRef = useRef({ columns: 0, rows: 0 })
  const [stats, setStats] = useState<MempoolStats | null>(null)
  const [fees, setFees] = useState<FeeRecommendations | null>(null)
  const [vbytesPerCell, setVbytesPerCell] = useState(MIN_VBYTES_PER_CELL)
  const [hovered, setHovered] = useState<HoveredCell | null>(null)
  const [error, setError] = useState("")
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const wrapper = canvas?.parentElement
    if (!canvas || !wrapper || !stats || !fees) return

    const width = wrapper.clientWidth
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const columns = Math.max(1, Math.floor((width + CELL_GAP) / (CELL_SIZE + CELL_GAP)))
    const rows = Math.floor((CANVAS_HEIGHT + CELL_GAP) / (CELL_SIZE + CELL_GAP))
    const result = makeCells(stats.fee_histogram, columns * rows)
    const populatedRows = Math.max(1, Math.ceil(result.cells.length / columns))
    const canvasHeight = populatedRows * (CELL_SIZE + CELL_GAP) - CELL_GAP
    cellsRef.current = result.cells
    dimensionsRef.current = { columns, rows }
    setVbytesPerCell(result.vbytesPerCell)

    canvas.width = width * dpr
    canvas.height = canvasHeight * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${canvasHeight}px`

    const context = canvas.getContext("2d")
    if (!context) return
    context.scale(dpr, dpr)
    context.clearRect(0, 0, width, canvasHeight)

    result.cells.forEach((cell, index) => {
      const column = index % columns
      const row = Math.floor(index / columns)
      const x = column * (CELL_SIZE + CELL_GAP)
      const y = row * (CELL_SIZE + CELL_GAP)
      context.globalAlpha = 0.88
      let portionX = x
      cell.portions.forEach((portion) => {
        const portionWidth = CELL_SIZE * (portion.vsize / result.vbytesPerCell)
        context.fillStyle = colors[tierForFee(portion.feeRate, fees)]
        context.fillRect(portionX, y, portionWidth, CELL_SIZE)
        portionX += portionWidth
      })

      const outlinedVsize = Math.min(
        cell.vsize,
        Math.max(0, 1_000_000 - index * result.vbytesPerCell),
      )
      if (outlinedVsize > 0) {
        const outlineWidth = CELL_SIZE * (outlinedVsize / result.vbytesPerCell)
        context.globalAlpha = 1
        context.strokeStyle = "#ffffff"
        context.lineWidth = 1
        context.strokeRect(x - 0.5, y - 0.5, outlineWidth + 1, CELL_SIZE + 1)
      }
    })
    context.globalAlpha = 1
  }, [fees, stats])

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const [statsResult, feesResult] = await Promise.allSettled([
          apiFetch<MempoolStats>("/mempool"),
          apiFetch<FeeRecommendations>("/v1/fees/precise"),
        ])
        if (!active) return
        if (statsResult.status === "rejected") throw statsResult.reason
        if (feesResult.status === "rejected") throw feesResult.reason
        setStats(statsResult.value)
        setFees(feesResult.value)
        setLastUpdated(new Date())
        setError("")
      } catch (requestError) {
        if (!active) return
        setError(requestError instanceof Error ? requestError.message : t("unableMempool"))
      }
    }
    load()
    const interval = window.setInterval(load, 30_000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [t])

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
    const cellX = localX % (CELL_SIZE + CELL_GAP)
    const cellY = localY % (CELL_SIZE + CELL_GAP)
    if (cellX >= CELL_SIZE || cellY >= CELL_SIZE) return setHovered(null)
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
      ].filter((item, index, items) =>
        index === items.findIndex((candidate) => candidate.label === item.label),
      )
    : []
  const feeEstimates = fees
    ? [
        { label: t("mempoolNextBlock"), value: fees.fastestFee, detail: t("highestPriority") },
        { label: t("minutes30"), value: fees.halfHourFee, detail: t("about3Blocks") },
        { label: t("hour1"), value: fees.hourFee, detail: t("about6Blocks") },
        { label: t("economy"), value: fees.economyFee, detail: t("noTimeTarget") },
        { label: t("minimumRelay"), value: fees.minimumFee, detail: t("providerMinimum") },
      ]
    : []

  return (
    <section className="mt-12" aria-labelledby="mempool-heading">
      <div className="flex flex-wrap items-end justify-between gap-3 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="mempool-heading" className="text-sm font-semibold">{t("mempool")}</h2>
            {!error && lastUpdated && (
              <span className="size-1.5 bg-emerald-500" title={`${t("updated")} ${lastUpdated.toLocaleTimeString(locale)}`} />
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {error
              ? `${t("liveDataUnavailable")}: ${error}`
              : stats
                ? `${stats.count.toLocaleString(locale)} ${t("unconfirmedTransactions")}`
                : t("loadingMempool")}
          </p>
        </div>

        <div className="flex gap-4 text-right">
          <div>
            <p className="text-xs font-medium">{stats ? `${(stats.vsize / 1_000_000).toFixed(1)} vMB` : "—"}</p>
            <p className="text-[10px] text-muted-foreground">{t("waiting")}</p>
          </div>
          <div>
            <p className="text-xs font-medium">{stats ? `${(stats.total_fee / 100_000_000).toFixed(4)} BTC` : "—"}</p>
            <p className="text-[10px] text-muted-foreground">{t("queuedFees")}</p>
          </div>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 border sm:grid-cols-5">
        {fees
          ? feeEstimates.map((estimate) => (
              <div key={estimate.label} className="border-b p-3 last:border-b-0 even:border-l sm:border-b-0 sm:border-l sm:first:border-l-0">
                <p className="text-[10px] text-muted-foreground">{estimate.label}</p>
                <p className="mt-1 text-sm font-semibold">{formatFee(estimate.value)} sat/vB</p>
                <p className="mt-0.5 text-[9px] text-muted-foreground">{estimate.detail}</p>
              </div>
            ))
          : Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="h-[70px] animate-pulse border-b bg-muted/40 even:border-l sm:border-b-0 sm:border-l sm:first:border-l-0" />
            ))}
      </div>

      <div className="relative overflow-hidden border-y py-3">
        <p className="mb-2 px-1 text-[9px] text-muted-foreground">
          {t("whiteOutline")}
        </p>
        <canvas
          ref={canvasRef}
          className="block w-full cursor-crosshair"
          role="img"
          aria-label={t("mempoolCanvasAria")}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHovered(null)}
        />
        {hovered && (
          <div
            className="pointer-events-none absolute z-20 w-[170px] border bg-popover px-2.5 py-2 text-[10px] shadow-md"
            style={{ left: hovered.x, top: hovered.y + 12 }}
          >
            <p className="font-medium text-popover-foreground">
              {formatFeeBand(hovered)}
            </p>
            <p className="mt-0.5 text-muted-foreground">
              {(hovered.vsize / 1_000).toFixed(1)} kvB {t("queued")}
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
        <div className="flex items-center gap-2">
          <p className="text-[10px] text-muted-foreground">
            1 cell = {(vbytesPerCell / 1_000).toLocaleString(locale)} kvB · {t("cellLiveHistogram")}
          </p>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]">
                <PublicIcon name="info" />
                {t("aboutGraph")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{t("understandingMempool")}</DialogTitle>
                <DialogDescription>
                  {t("understandingMempoolDesc")}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                <div>
                  <h4 className="font-medium text-foreground">{t("whatMempool")}</h4>
                  <p className="mt-1">
                    {t("whatMempoolText")}
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-foreground">{t("graphShows")}</h4>
                  <p className="mt-1">
                    {t("graphShowsText")}
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-foreground">{t("colorsOutline")}</h4>
                  <p className="mt-1">
                    {t("colorsOutlineText")}
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-foreground">{t("limitation")}</h4>
                  <p className="mt-1">
                    {t("limitationText")}
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <p className="pt-1 text-[9px] text-muted-foreground">
        {t("histogramCaveat")}
      </p>

    </section>
  )
}

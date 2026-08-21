import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const MEMPOOL = process.env.MEMPOOL_API_URL?.replace(/\/$/, "") || "https://mempool.space/api"
const BLOCKSTREAM = "https://blockstream.info/api"
const DIFFICULTY_PERIOD = 2_016
const TARGET_BLOCK_TIME_SECONDS = 600

interface ProviderRequest {
  base: string
  path: string
  timeout?: number
  transform?: (response: Response) => Promise<Response>
}

function getProviders(path: string): ProviderRequest[] {
  if (path === "v1/blocks") {
    return [
      { base: BLOCKSTREAM, path: "blocks" },
      { base: MEMPOOL, path },
    ]
  }

  if (path.startsWith("v1/blocks/")) {
    return [
      { base: BLOCKSTREAM, path: path.replace(/^v1\//, "") },
      { base: MEMPOOL, path },
    ]
  }

  if (path.startsWith("v1/block/")) {
    return [
      { base: BLOCKSTREAM, path: path.replace(/^v1\//, "") },
      { base: MEMPOOL, path },
    ]
  }

  if (path === "v1/fees/precise") {
    return [
      { base: BLOCKSTREAM, path: "fee-estimates", transform: transformFeeEstimates },
      { base: MEMPOOL, path },
      { base: MEMPOOL, path: "v1/fees/recommended" },
    ]
  }

  if (path.startsWith("address/")) {
    return [
      { base: BLOCKSTREAM, path },
      { base: MEMPOOL, path },
    ]
  }

  if (!path.startsWith("v1/")) {
    return [
      { base: BLOCKSTREAM, path },
      { base: MEMPOOL, path },
    ]
  }

  return [{ base: MEMPOOL, path }]
}

interface EsploraBlock {
  id: string
  height: number
  timestamp: number
  difficulty: number
}

async function fetchJson<T>(provider: ProviderRequest, search = ""): Promise<T> {
  const response = await requestUpstream(provider, search)
  if (!response.ok) throw new Error(`Provider returned ${response.status}`)
  return response.json() as Promise<T>
}

async function fetchText(provider: ProviderRequest, search = ""): Promise<string> {
  const response = await requestUpstream(provider, search)
  if (!response.ok) throw new Error(`Provider returned ${response.status}`)
  return response.text()
}

async function fetchBlockHashAtHeight(height: number) {
  return fetchText({ base: BLOCKSTREAM, path: `block-height/${height}` })
}

async function fetchBlockByHeight(height: number) {
  const hash = await fetchBlockHashAtHeight(height)
  return fetchJson<EsploraBlock>({ base: BLOCKSTREAM, path: `block/${hash.trim()}` })
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

async function transformFeeEstimates(response: Response) {
  const estimates = await response.json() as Record<string, number>
  const feeFor = (target: string, fallback = 1) => {
    const fee = estimates[target]
    return Number.isFinite(fee) ? Math.max(fallback, Math.ceil(fee)) : fallback
  }

  return NextResponse.json({
    fastestFee: feeFor("1"),
    halfHourFee: feeFor("3", feeFor("2")),
    hourFee: feeFor("6", feeFor("4")),
    economyFee: feeFor("144", feeFor("25")),
    minimumFee: Math.max(1, Math.floor(feeFor("504", 1))),
  })
}

async function fallbackDifficultyAdjustment() {
  const tipHeight = await fetchJson<number>({ base: BLOCKSTREAM, path: "blocks/tip/height" })
  const epochStartHeight = tipHeight - (tipHeight % DIFFICULTY_PERIOD)
  const remainingBlocks = DIFFICULTY_PERIOD - (tipHeight % DIFFICULTY_PERIOD)
  const [tipBlock, epochStartBlock] = await Promise.all([
    fetchBlockByHeight(tipHeight),
    fetchBlockByHeight(epochStartHeight),
  ])
  const completedBlocks = Math.max(1, tipHeight - epochStartHeight)
  const elapsedSeconds = Math.max(1, tipBlock.timestamp - epochStartBlock.timestamp)
  const averageBlockTimeSeconds = elapsedSeconds / completedBlocks
  const expectedElapsedSeconds = completedBlocks * TARGET_BLOCK_TIME_SECONDS
  const difficultyChange = clamp((expectedElapsedSeconds / elapsedSeconds - 1) * 100, -75, 300)
  const remainingTime = Math.round(remainingBlocks * averageBlockTimeSeconds * 1000)

  return NextResponse.json({
    progressPercent: ((tipHeight % DIFFICULTY_PERIOD) / DIFFICULTY_PERIOD) * 100,
    difficultyChange,
    estimatedRetargetDate: Date.now() + remainingTime,
    remainingBlocks,
    remainingTime,
  })
}

async function fallbackHashrate() {
  const tipHeight = await fetchJson<number>({ base: BLOCKSTREAM, path: "blocks/tip/height" })
  const windowStartHeight = Math.max(0, tipHeight - 432)
  const [tipBlock, windowStartBlock] = await Promise.all([
    fetchBlockByHeight(tipHeight),
    fetchBlockByHeight(windowStartHeight),
  ])
  const completedBlocks = Math.max(1, tipHeight - windowStartHeight)
  const elapsedSeconds = Math.max(1, tipBlock.timestamp - windowStartBlock.timestamp)
  const averageBlockTimeSeconds = elapsedSeconds / completedBlocks

  return NextResponse.json({
    currentHashrate: tipBlock.difficulty * 2 ** 32 / averageBlockTimeSeconds,
    currentDifficulty: tipBlock.difficulty,
  })
}

async function requestUpstream(provider: ProviderRequest, search: string) {
  return fetch(`${provider.base}/${provider.path}${search}`, {
    cache: "no-store",
    headers: { Accept: "application/json, text/plain" },
    signal: AbortSignal.timeout(provider.timeout ?? 3_500),
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: pathParts } = await params
  const path = pathParts.join("/")
  const search = request.nextUrl.search
  const providers = getProviders(path)

  let lastStatus = 502
  for (const provider of providers) {
    try {
      const response = await requestUpstream(provider, search)
      lastStatus = response.status
      if (!response.ok) {
        if (response.status === 404) break
        continue
      }
      if (provider.transform) return provider.transform(response)
      return new NextResponse(await response.arrayBuffer(), {
        status: response.status,
        headers: {
          "Content-Type": response.headers.get("content-type") || "application/json",
          "Cache-Control": "no-store",
        },
      })
    } catch {
      // Try the next public indexer when one is unavailable.
    }
  }

  try {
    if (path === "v1/difficulty-adjustment") return await fallbackDifficultyAdjustment()
    if (path === "v1/mining/hashrate/3d") return await fallbackHashrate()
  } catch {
    // Return the same provider-unavailable shape below when derived fallbacks fail.
  }

  return NextResponse.json(
    { error: lastStatus === 404 ? "Not found" : "Bitcoin data providers are unavailable" },
    { status: lastStatus === 404 ? 404 : 502 },
  )
}

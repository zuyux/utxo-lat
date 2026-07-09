import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const MEMPOOL = process.env.MEMPOOL_API_URL?.replace(/\/$/, "") || "https://mempool.space/api"
const BLOCKSTREAM = "https://blockstream.info/api"

async function requestUpstream(base: string, path: string, search: string) {
  return fetch(`${base}/${path}${search}`, {
    cache: "no-store",
    headers: { Accept: "application/json, text/plain" },
    signal: AbortSignal.timeout(path === "v1/fees/mempool-blocks" ? 15_000 : 8_000),
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const path = params.path.join("/")
  const search = request.nextUrl.search
  const supportsEsploraFallback = !path.startsWith("v1/")
  const providers = path.startsWith("address/")
    ? [BLOCKSTREAM, MEMPOOL]
    : supportsEsploraFallback
      ? [MEMPOOL, BLOCKSTREAM]
      : [MEMPOOL]

  let lastStatus = 502
  for (const provider of providers) {
    try {
      const response = await requestUpstream(provider, path, search)
      lastStatus = response.status
      if (!response.ok) {
        if (response.status === 404) break
        continue
      }
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

  return NextResponse.json(
    { error: lastStatus === 404 ? "Not found" : "Bitcoin data providers are unavailable" },
    { status: lastStatus === 404 ? 404 : 502 },
  )
}

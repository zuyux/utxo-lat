import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"
const providers = [
  "https://blockstream.info/testnet/api",
  "https://mempool.space/testnet/api",
]

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params
  const endpoint = path.join("/")
  // Only expose explorer reads; every provider is on the same testnet network.
  if (
    !/^(blocks(?:\/.*)?|block\/[^/]+(?:\/.*)?|block-height\/\d+|tx\/[a-fA-F0-9]{64}(?:\/.*)?|address\/[^/]+(?:\/.*)?|mempool(?:\/recent)?|fee-estimates|v1\/(?:blocks(?:\/.*)?|block\/[^/]+|cpfp\/[a-fA-F0-9]{64}|tx\/[a-fA-F0-9]{64}\/rbf))$/.test(
      endpoint,
    )
  ) {
    return NextResponse.json(
      { error: "Unsupported testnet endpoint" },
      { status: 400 },
    )
  }
  let notFound = false
  const orderedProviders = endpoint.startsWith("v1/") ? [...providers].reverse() : providers
  for (const base of orderedProviders) {
    const upstreamPath = base.includes("blockstream")
      ? endpoint.replace(/^v1\/(blocks|block)\b/, "$1")
      : endpoint
    try {
      const response = await fetch(
        `${base}/${upstreamPath}${request.nextUrl.search}`,
        { cache: "no-store", signal: AbortSignal.timeout(8_000) },
      )
      if (!response.ok) {
        notFound ||= response.status === 404
        continue
      }
      return new NextResponse(await response.arrayBuffer(), {
        headers: {
          "Content-Type":
            response.headers.get("content-type") || "application/json",
          "Cache-Control": "no-store",
        },
      })
    } catch {
      /* Try the other testnet indexer. */
    }
  }
  return NextResponse.json(
    {
      error: notFound
        ? "Not found on testnet"
        : "Testnet data providers are unavailable",
    },
    { status: notFound ? 404 : 502 },
  )
}

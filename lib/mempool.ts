export const MEMPOOL_API =
  process.env.NEXT_PUBLIC_MEMPOOL_API_URL?.replace(/\/$/, "") ||
  "/api/bitcoin"

export async function apiFetch<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${MEMPOOL_API}${path}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  })

  if (!response.ok) {
    const message = response.status === 404 ? "Not found" : `Data provider returned ${response.status}`
    throw new Error(message)
  }

  return response.json() as Promise<T>
}

export async function apiFetchText(path: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(`${MEMPOOL_API}${path}`, {
    cache: "no-store",
    headers: { Accept: "text/plain" },
    signal,
  })
  if (!response.ok) throw new Error(response.status === 404 ? "Not found" : `Data provider returned ${response.status}`)
  return response.text()
}

export const satsToBtc = (sats: number) => (sats / 100_000_000).toFixed(8)

export interface TxStatus {
  confirmed: boolean
  block_height?: number
  block_hash?: string
  block_time?: number
}

export interface MempoolTransaction {
  txid: string
  version: number
  locktime: number
  size: number
  weight: number
  fee: number
  vin: Array<{
    txid: string
    vout: number
    is_coinbase: boolean
    prevout: null | {
      scriptpubkey: string
      scriptpubkey_asm: string
      scriptpubkey_type: string
      scriptpubkey_address?: string
      value: number
    }
    sequence: number
    witness?: string[]
  }>
  vout: Array<{
    scriptpubkey: string
    scriptpubkey_asm: string
    scriptpubkey_type: string
    scriptpubkey_address?: string
    value: number
  }>
  status: TxStatus
}

export interface BlockApi {
  id: string
  height: number
  version: number
  timestamp: number
  bits: number
  nonce: number
  difficulty: number
  merkle_root: string
  tx_count: number
  size: number
  weight: number
  previousblockhash?: string
  extras?: {
    reward?: number
    totalFees?: number
    medianFee?: number
    avgFeeRate?: number
    feeRange?: number[]
    totalInputs?: number
    totalOutputs?: number
    totalOutputAmt?: number
    virtualSize?: number
    pool?: { name?: string }
  }
}

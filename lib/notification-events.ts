import type { TxStatus } from "@/lib/mempool"

export const notificationEvents = ["received", "spent", "confirmed", "balance"] as const
export type NotificationEvent = typeof notificationEvents[number]
export interface AddressSnapshot {
  received: number
  balance: number
  utxos: Array<{ txid: string; vout: number; value: number; status: TxStatus }>
}
export interface AddressTotals {
  chain_stats: { funded_txo_sum: number; spent_txo_sum: number }
  mempool_stats: { funded_txo_sum: number; spent_txo_sum: number }
}
export function addressSnapshot(stats: AddressTotals, utxos: AddressSnapshot["utxos"]): AddressSnapshot {
  const received = stats.chain_stats.funded_txo_sum + stats.mempool_stats.funded_txo_sum
  return { received, balance: received - stats.chain_stats.spent_txo_sum - stats.mempool_stats.spent_txo_sum, utxos }
}
export function changedAddressEvents(previous: AddressSnapshot, current: AddressSnapshot): NotificationEvent[] {
  const events: NotificationEvent[] = []
  if (current.received > previous.received) events.push("received")
  if (current.balance !== previous.balance) events.push("balance")
  return events
}
export function missingOutputs(previous: AddressSnapshot, current: AddressSnapshot) {
  const present = new Set(current.utxos.map((utxo) => `${utxo.txid}:${utxo.vout}`))
  return previous.utxos.filter((utxo) => !present.has(`${utxo.txid}:${utxo.vout}`))
}

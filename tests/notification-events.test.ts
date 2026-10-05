import assert from "node:assert/strict"
import { test } from "node:test"
import { addressSnapshot, changedAddressEvents, missingOutputs } from "../lib/notification-events.ts"

const totals = (funded: number, spent = 0, mempoolFunded = 0, mempoolSpent = 0) => ({
  chain_stats: { funded_txo_sum: funded, spent_txo_sum: spent },
  mempool_stats: { funded_txo_sum: mempoolFunded, spent_txo_sum: mempoolSpent },
})
test("receiving funds emits received and balance events", () => {
  assert.deepEqual(changedAddressEvents(addressSnapshot(totals(100), []), addressSnapshot(totals(100, 0, 50), [])), ["received", "balance"])
})
test("confirmation moving funds from mempool to chain does not repeat receipt or balance", () => {
  assert.deepEqual(changedAddressEvents(addressSnapshot(totals(100, 0, 50), []), addressSnapshot(totals(150), [])), [])
})
test("a spend changes balance without emitting receipt", () => {
  assert.deepEqual(changedAddressEvents(addressSnapshot(totals(100), []), addressSnapshot(totals(100, 0, 0, 40), [])), ["balance"])
})
test("receipt is detected even when an equal spend leaves balance unchanged", () => {
  assert.deepEqual(changedAddressEvents(addressSnapshot(totals(100), []), addressSnapshot(totals(150, 50), [])), ["received"])
})
test("removed outpoints are identified by transaction ID and output index", () => {
  const output = { txid: "a".repeat(64), vout: 0, value: 100, status: { confirmed: false } }
  const other = { ...output, vout: 1 }
  const previous = addressSnapshot(totals(200), [output, other])
  assert.deepEqual(missingOutputs(previous, addressSnapshot(totals(200), [other])), [output])
  assert.deepEqual(missingOutputs(previous, addressSnapshot(totals(200), [{ ...output, status: { confirmed: true } }, other])), [])
})

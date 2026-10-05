import type { Metadata } from "next"
import type { ReactNode } from "react"
import { pageMetadata } from "@/lib/seo"

export const metadata: Metadata = pageMetadata(
  "Explorador de Bitcoin Testnet",
  "Explora transacciones, bloques, direcciones y UTXO de Bitcoin Testnet. Consulta confirmaciones, comisiones y actividad del mempool de la red de pruebas.",
  "/testnet",
)

export default function TestnetLayout({ children }: { children: ReactNode }) {
  return children
}

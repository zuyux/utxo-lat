import type { Metadata } from "next"
import type { ReactNode } from "react"
import { explorerMetadata } from "@/lib/seo"

export async function generateMetadata({ params }: { params: Promise<{ txid: string }> }): Promise<Metadata> {
  const { txid } = await params
  return explorerMetadata("tx", txid, true)
}

export default function DetailLayout({ children }: { children: ReactNode }) {
  return children
}

import type { Metadata } from "next"
import type { ReactNode } from "react"
import { explorerMetadata } from "@/lib/seo"

export async function generateMetadata({ params }: { params: Promise<{ address: string }> }): Promise<Metadata> {
  const { address } = await params
  return explorerMetadata("address", address, true)
}

export default function DetailLayout({ children }: { children: ReactNode }) {
  return children
}

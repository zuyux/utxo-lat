import type { Metadata } from "next"
import type { ReactNode } from "react"
import { explorerMetadata } from "@/lib/seo"

export async function generateMetadata({ params }: { params: Promise<{ identifier: string }> }): Promise<Metadata> {
  const { identifier } = await params
  return explorerMetadata("block", identifier, false)
}

export default function DetailLayout({ children }: { children: ReactNode }) {
  return children
}

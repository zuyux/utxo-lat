"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ComponentProps } from "react"
import { apiFetch, apiFetchText } from "@/lib/mempool"

async function testnetFetch<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/testnet${path}`, {
    cache: "no-store",
    signal,
  })
  if (!response.ok)
    throw new Error(
      response.status === 404
        ? "Not found on testnet"
        : "Testnet data providers are unavailable",
    )
  return response.json() as Promise<T>
}
async function testnetFetchText(
  path: string,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(`/api/testnet${path}`, {
    cache: "no-store",
    signal,
  })
  if (!response.ok)
    throw new Error(
      response.status === 404
        ? "Not found on testnet"
        : "Testnet data providers are unavailable",
    )
  return response.text()
}
export const testnetApi = {
  apiFetch: testnetFetch,
  apiFetchText: testnetFetchText,
}
const mainnetApi = { apiFetch, apiFetchText }
export function useExplorerNetwork() {
  const isTestnet = usePathname().startsWith("/testnet")
  return {
    isTestnet,
    prefix: isTestnet ? "/testnet" : "",
    ...(isTestnet ? testnetApi : mainnetApi),
  }
}
export function ExplorerLink(props: ComponentProps<typeof Link>) {
  const { prefix } = useExplorerNetwork()
  const href =
    typeof props.href === "string" && /^\/(tx|block|address)\//.test(props.href)
      ? `${prefix}${props.href}`
      : props.href
  return <Link {...props} href={href} />
}

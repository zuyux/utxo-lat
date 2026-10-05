import type { Metadata } from "next"

export const siteUrl = "https://utxo.lat"
export const siteName = "UTXO.LAT"
export const siteTitle = "UTXO.LAT — Explorador de Bitcoin y UTXO"
export const siteDescription = "Explora transacciones, bloques, direcciones y UTXO de Bitcoin. Consulta saldos, confirmaciones, comisiones y mempool en tiempo real con alertas del navegador."
export const socialImage = {
  url: "/utxo-lat-og.png?v=9bc6198d9963",
  width: 1600,
  height: 840,
  alt: "utxo.lat — EASY EXPLORER, con letras blancas y el símbolo de Bitcoin sobre fondo oscuro",
  type: "image/png",
}

export function pageMetadata(title: string, description: string, path: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName,
      locale: "es_ES",
      title: title.includes(siteName) ? title : `${title} | ${siteName}`,
      description,
      url: path,
      images: [socialImage],
    },
    twitter: {
      card: "summary_large_image",
      title: title.includes(siteName) ? title : `${title} | ${siteName}`,
      description,
      images: [socialImage],
    },
  }
}

export function explorerMetadata(kind: "address" | "tx" | "block", identifier: string, testnet = false): Metadata {
  const network = testnet ? "Bitcoin Testnet" : "Bitcoin"
  const label = kind === "address" ? "Dirección" : kind === "tx" ? "Transacción" : "Bloque"
  const shortId = identifier.length > 24 ? `${identifier.slice(0, 12)}…${identifier.slice(-8)}` : identifier
  const detail = kind === "address"
    ? "Consulta su saldo, historial de transacciones y salidas sin gastar (UTXO)."
    : kind === "tx"
      ? "Consulta sus entradas, salidas, comisiones y estado de confirmación."
      : "Consulta sus transacciones, altura, tamaño y datos de minería."
  const metadata = pageMetadata(`${label} ${shortId} — ${network}`, `${label} ${identifier} en ${network}. ${detail}`, `${testnet ? "/testnet" : ""}/${kind}/${encodeURIComponent(identifier)}`)
  const valid = kind === "tx" ? /^[a-fA-F0-9]{64}$/.test(identifier)
    : kind === "block" ? /^(?:\d{1,10}|[a-fA-F0-9]{64})$/.test(identifier)
    : (testnet ? /^(?:[mn2][a-zA-Z0-9]{25,61}|tb1[a-zA-Z0-9]{11,87})$/i : /^(?:[13][a-zA-Z0-9]{25,61}|bc1[a-zA-Z0-9]{11,87})$/i).test(identifier)
  if (!valid) metadata.robots = { index: false, follow: true }
  return metadata
}

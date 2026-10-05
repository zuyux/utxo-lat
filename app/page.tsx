import { BitcoinIntro } from "@/components/bitcoin-intro"
import BitcoinExplorer from "@/components/bitcoin-explorer"
import { siteDescription, siteName, siteUrl } from "@/lib/seo"

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": `${siteUrl}/#website`, name: siteName, url: siteUrl, description: siteDescription, inLanguage: "es" },
    { "@type": "WebApplication", "@id": `${siteUrl}/#app`, name: siteName, url: siteUrl, description: siteDescription, applicationCategory: "UtilitiesApplication", operatingSystem: "Web browser", browserRequirements: "Requires JavaScript", isAccessibleForFree: true, featureList: ["Explorador de Bitcoin", "Consulta de UTXO y saldos", "Seguimiento de transacciones", "Notificaciones del navegador", "Explorador de Bitcoin Testnet"] },
  ],
}

export default function HomePage() {
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    <BitcoinExplorer><BitcoinIntro /></BitcoinExplorer>
  </>
}

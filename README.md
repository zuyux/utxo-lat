# utxo.lat

**Rastreador de UTXO de Bitcoin — creado para precisión watch-only**

`utxo.lat` es una herramienta ligera para monitorear la red Bitcoin.

## Funcionalidades

- Monitorea cualquier dirección de Bitcoin (Legacy, SegWit, Taproot)
- Rastrea UTXO individuales: valor, confirmaciones y estado
- Modo watch-only por diseño
- Frontend minimalista y modo CLI opcional
- Soporte de WebSocket para actualizaciones en tiempo real
- Backend listo para API e integraciones personalizadas

## Stack

- Backend: Node.js + ElectrumX or Bitcoin Core RPC
- Frontend: React + Tailwind (or headless CLI)
- Base de datos: almacén JSON o SQLite
- Tiempo real: WebSockets

## Primeros pasos

```bash
git clone https://github.com/zuyux/utxo-lat.git
cd utxo-lat

npm install
npm run dev
```

Como alternativa temporal, ejecuta `pnpm dev:poll`. El polling evita agotar inotify, pero
usa más CPU, por lo que no debería ser la opción predeterminada.

## Uso

1. Agrega una dirección de Bitcoin para monitorear
2. Visualiza sus UTXO con confirmaciones y estado
3. Recibe actualizaciones cuando los UTXO se confirmen o se gasten
4. Exporta o integra los datos según sea necesario

## Casos de uso

* Monitorear saldos de almacenamiento en frío
* Rastrear actividad de direcciones multisig o vaults
* Integrar datos de UTXO en bots o dashboards
* Crear listas de seguimiento personalizadas sin comprometer la privacidad

## Roadmap

* Etiquetado y agrupación de direcciones
* Sistema de notificaciones (webhooks, email)
* Mejor soporte para Taproot
* Listas de seguimiento multi-wallet

## Licencia

Licencia MIT

## Autor

@fabohax - [github.com/fabohax](https://github.com/fabohax)

### Testnet explorer

Open `/testnet` (or use the Testnet footer link) to explore Bitcoin Testnet3, matching Blockstream’s `/testnet` network. The dashboard shows recent blocks, mempool activity, fee estimates, and fee distribution, refreshing every 15 seconds. Search transactions, block hashes or heights, and testnet addresses (`m`, `n`, `2`, `tb1`).

Detail routes are `/testnet/tx/[txid]`, `/testnet/block/[identifier]`, and `/testnet/address/[address]`. Testnet data is fetched through `/api/testnet` with Blockstream and mempool.space testnet providers; watchlists are stored separately from mainnet. Amounts use `tBTC` without fiat conversion. Provider failures are displayed as unavailable data.

### Browser notifications

Use the bell in the header to enable browser notifications and choose alerts for **address received funds**, **UTXO spent**, **transaction confirmed**, and **balance changed**. Addresses come from the saved watchlist; add transaction IDs in the notification dialog to watch confirmations separately. Use “Send test notification” to check browser delivery. Settings and transaction IDs are saved locally, separately for mainnet and testnet.

Monitoring checks every 30 seconds while the app is open on the selected network. The first successful check establishes a baseline without replaying historical activity. Confirmation alerts fire when a transaction observed as unconfirmed becomes confirmed. Missing outputs are checked against their spending transaction before a spent alert is sent. Failed checks preserve the previous baseline and retry. Alerts link to the relevant address or transaction.

A supported browser, notification permission, and HTTPS (or localhost for development) are required. This initial version uses browser notifications; background delivery with the app closed and webhook delivery are not included. Browser timers may be throttled in background tabs; each open tab monitors independently. Short-lived activity between polls can be missed.

Notification event regression tests: `node --test tests/notification-events.test.ts` (Node.js 22.18+).

### SEO and social previews

Production metadata uses `https://utxo.lat`. The homepage and explorer detail routes have canonical URLs, individual titles and descriptions, and Open Graph / Twitter large-image previews using `public/utxo-lat-og.png` (1600 × 840, user-updated artwork). The original image generation prompt and current asset details are recorded in `docs/og-image-prompt.md`.

The homepage includes crawlable introductory text and WebSite / WebApplication structured data. `/sitemap.xml` lists the mainnet and testnet landing pages; individual blockchain pages are discovered through links rather than enumerating the entire chain. `/robots.txt` permits public pages and excludes API crawling. Address and block shortcuts redirect permanently to their canonical detail routes. Syntactically invalid detail identifiers receive `noindex` metadata.

Deploy the updated build to publish these changes. After deployment, submit `https://utxo.lat/sitemap.xml` in Google Search Console and request a fresh social preview if an earlier card is cached.

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

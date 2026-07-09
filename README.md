# utxo.watch

**Bitcoin UTXO Tracker — Built for Watch-Only Precision**

`utxo.watch` is a lightweight tool for monitoring Bitcoin Network.

## Features

- Monitor any Bitcoin address (Legacy, SegWit, Taproot)
- Track individual UTXOs: value, confirmations, status
- Watch-only mode by design
- Minimalist frontend and optional CLI mode
- WebSocket support for real-time updates
- API-ready backend for custom integrations

## Stack

- Backend: Node.js + ElectrumX or Bitcoin Core RPC
- Frontend: React + Tailwind (or headless CLI)
- Database: JSON store or SQLite
- Realtime: WebSockets

## Getting Started

```bash
git clone https://github.com/zuyux/utxo-watch.git
cd utxo.watch

npm install
npm run dev
```

### Linux file watcher limits

If development fails with `ENOSPC: System limit for number of file watchers reached`,
first close editor windows opened at a broad directory such as `/home`, then raise the
per-user inotify limits:

```bash
sudo tee /etc/sysctl.d/99-inotify.conf >/dev/null <<'EOF'
fs.inotify.max_user_watches=524288
fs.inotify.max_user_instances=512
fs.inotify.max_queued_events=32768
EOF
sudo sysctl --system
```

As a temporary fallback, run `pnpm dev:poll`. Polling avoids inotify exhaustion but
uses more CPU, so it should not be the default.

## Usage

1. Add a Bitcoin address to watch
2. View its UTXOs with confirmation and status
3. Receive updates when UTXOs are confirmed or spent
4. Export or integrate data as needed

## Use Cases

* Monitor cold storage balances
* Track multisig or vault address activity
* Integrate UTXO data into bots or dashboards
* Build custom watchlists without compromising privacy

## Roadmap

* Address labeling and grouping
* Notification system (webhooks, email)
* Better taproot support
* Multi-wallet watchlists

## License

MIT License

## Author

@fabohax - [github.com/fabohax](https://github.com/fabohax)

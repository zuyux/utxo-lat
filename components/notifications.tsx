"use client"

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Bell } from "lucide-react"
import { toast } from "sonner"
import { useExplorerNetwork } from "@/lib/explorer-network"
import { useLanguage } from "@/lib/i18n"
import type { MempoolTransaction, TxStatus } from "@/lib/mempool"
import { addressSnapshot, changedAddressEvents, missingOutputs, notificationEvents, type AddressSnapshot, type AddressTotals, type NotificationEvent } from "@/lib/notification-events"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

interface Settings { enabled: boolean; events: Record<NotificationEvent, boolean>; transactions: string[] }
const defaults: Settings = { enabled: false, events: { received: true, spent: true, confirmed: true, balance: true }, transactions: [] }
const copy = {
  en: { title: "Notifications", description: "Browser alerts for saved watchlist addresses and watched transactions. Checks every 30 seconds while this app is open on this network. The first check establishes a baseline; past activity is not replayed.", enable: "Enable browser notifications", received: "Address received funds", spent: "UTXO spent", confirmed: "Transaction confirmed", balance: "Balance changed", watch: "Watch a transaction", add: "Add", remove: "Remove", test: "Send test notification", testBody: "Browser notifications are working.", invalid: "Enter a valid 64-character transaction ID.", denied: "Allow notifications in your browser’s site settings, then try again.", unsupported: "Browser notifications require a supported browser and HTTPS.", error: "Some notification checks failed. Retrying in 30 seconds.", storage: "Settings could not be saved in this browser.", active: "Monitoring", paused: "Paused", waiting: "Waiting for first check", checked: "Last checked", tx: "Transaction ID" },
  es: { title: "Notificaciones", description: "Alertas del navegador para direcciones guardadas y transacciones seguidas. Se revisan cada 30 segundos mientras la app está abierta en esta red. La primera revisión establece una referencia; no se repite la actividad pasada.", enable: "Activar notificaciones del navegador", received: "Dirección recibió fondos", spent: "UTXO gastado", confirmed: "Transacción confirmada", balance: "Saldo cambiado", watch: "Seguir una transacción", add: "Agregar", remove: "Eliminar", test: "Enviar notificación de prueba", testBody: "Las notificaciones del navegador funcionan.", invalid: "Ingresa un ID de transacción válido de 64 caracteres.", denied: "Permite las notificaciones en la configuración del sitio del navegador e inténtalo de nuevo.", unsupported: "Las notificaciones requieren un navegador compatible y HTTPS.", error: "Algunas revisiones fallaron. Se reintentará en 30 segundos.", storage: "No se pudo guardar la configuración en este navegador.", active: "Monitoreando", paused: "Pausado", waiting: "Esperando la primera revisión", checked: "Última revisión", tx: "ID de transacción" },
  pt: { title: "Notificações", description: "Alertas do navegador para endereços salvos e transações acompanhadas. Verificação a cada 30 segundos enquanto o app estiver aberto nesta rede. A primeira verificação estabelece uma referência; atividades anteriores não são repetidas.", enable: "Ativar notificações do navegador", received: "Endereço recebeu fundos", spent: "UTXO gasto", confirmed: "Transação confirmada", balance: "Saldo alterado", watch: "Acompanhar uma transação", add: "Adicionar", remove: "Remover", test: "Enviar notificação de teste", testBody: "As notificações do navegador funcionam.", invalid: "Insira um ID de transação válido de 64 caracteres.", denied: "Permita notificações nas configurações do site do navegador e tente novamente.", unsupported: "As notificações exigem um navegador compatível e HTTPS.", error: "Algumas verificações falharam. Nova tentativa em 30 segundos.", storage: "Não foi possível salvar as configurações neste navegador.", active: "Monitorando", paused: "Pausado", waiting: "Aguardando a primeira verificação", checked: "Última verificação", tx: "ID da transação" },
}
function readSettings(key: string): Settings {
  try {
    const stored = JSON.parse(localStorage.getItem(key) || "null")
    return { enabled: stored?.enabled === true, events: Object.fromEntries(notificationEvents.map((event) => [event, typeof stored?.events?.[event] === "boolean" ? stored.events[event] : true])) as Settings["events"], transactions: Array.isArray(stored?.transactions) ? [...new Set<string>(stored.transactions.filter((id: unknown) => typeof id === "string" && /^[a-f0-9]{64}$/.test(id)))] : [] }
  } catch { return defaults }
}
interface NotificationContextValue {
  settings: Settings; update: (settings: Settings) => void; permission: NotificationPermission | "unsupported"; enable: (enabled: boolean) => Promise<void>; lastCheck: number; failed: boolean; ready: boolean
}
const NotificationContext = createContext<NotificationContextValue | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { apiFetch, isTestnet } = useExplorerNetwork()
  const { language } = useLanguage()
  const words = copy[language]
  const key = `utxo-notifications${isTestnet ? "-testnet" : ""}`
  const [settings, setSettings] = useState<Settings>(defaults)
  const router = useRouter()
  const [loadedKey, setLoadedKey] = useState("")
  const ready = loadedKey === key
  const [permission, setPermission] = useState<NotificationContextValue["permission"]>("unsupported")
  const [lastCheck, setLastCheck] = useState(0)
  const [failed, setFailed] = useState(false)
  const latest = useRef({ settings, words })
  useEffect(() => { latest.current = { settings, words } }, [settings, words])
  useEffect(() => {
    setSettings(readSettings(key))
    setLoadedKey(key)
    setLastCheck(0)
    setFailed(false)
    setPermission("Notification" in window && window.isSecureContext ? Notification.permission : "unsupported")
  }, [key])
  const update = (next: Settings) => {
    setSettings(next)
    try { localStorage.setItem(key, JSON.stringify(next)) } catch { toast.error(words.storage) }
  }
  const enable = async (enabled: boolean) => {
    if (!enabled) { update({ ...settings, enabled: false }); return }
    if (!("Notification" in window) || !window.isSecureContext) { toast.error(words.unsupported); return }
    let result: NotificationPermission
    try { result = await Notification.requestPermission() } catch { toast.error(words.denied); return }
    setPermission(result)
    if (result !== "granted") { toast.error(words.denied); return }
    update({ ...settings, enabled: true })
  }
  useEffect(() => {
    if (!ready || !settings.enabled || !("Notification" in window) || !window.isSecureContext) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    const addresses = new Map<string, AddressSnapshot>()
    const pending = new Set<string>()
    const owners = new Map<string, Set<string>>()
    const confirmed = new Set<string>()
    const explicit = new Set<string>()
    const sent = new Set<string>()
    const notify = (event: NotificationEvent, body: string, tag: string, path: string) => {
      if (controller.signal.aborted || sent.has(tag)) return
      if (event === "spent" || event === "confirmed") sent.add(tag)
      if (!latest.current.settings.events[event] || Notification.permission !== "granted") return
      const notification = new Notification(`utxo.lat · ${latest.current.words[event]}`, { body, tag: `${key}:${tag}`, icon: "/android-chrome-192x192.png" })
      notification.onclick = () => { window.focus(); router.push(`${isTestnet ? "/testnet" : ""}${path}`); notification.close() }
    }
    const check = async () => {
      let errors = false
      try {
        const stored: unknown = JSON.parse(localStorage.getItem(isTestnet ? "utxo-watchlist-testnet" : "utxo-watchlist") || "[]")
        const watched = Array.isArray(stored) ? stored.filter((item): item is { address: string; label?: string } => typeof item?.address === "string") : []
        const active = new Set(watched.map((item) => item.address))
        for (const address of addresses.keys()) if (!active.has(address)) addresses.delete(address)
        for (const [id, sources] of owners) {
          for (const source of sources) if (!active.has(source)) sources.delete(source)
          if (sources.size === 0) {
            owners.delete(id)
            if (!latest.current.settings.transactions.includes(id)) pending.delete(id)
          }
        }
        const results = await Promise.allSettled(watched.map(async (item) => {
          const path = `/address/${encodeURIComponent(item.address)}`
          const [stats, utxos, txs] = await Promise.all([
            apiFetch<AddressTotals>(path, controller.signal),
            apiFetch<AddressSnapshot["utxos"]>(`${path}/utxo`, controller.signal),
            apiFetch<MempoolTransaction[]>(`${path}/txs`, controller.signal),
          ])
          if (controller.signal.aborted) return
          const current = addressSnapshot(stats, utxos)
          const previous = addresses.get(item.address)
          if (previous) {
            for (const output of missingOutputs(previous, current)) {
              const spent = await apiFetch<{ spent: boolean; txid?: string }>(`/tx/${output.txid}/outspend/${output.vout}`, controller.signal)
              if (!spent.spent) current.utxos.push(output)
              if (spent.spent) notify("spent", `${item.label || item.address}\n${output.txid}:${output.vout}`, `spent:${output.txid}:${output.vout}`, spent.txid ? `/tx/${spent.txid}` : path)
            }
            for (const event of changedAddressEvents(previous, current)) {
              // Balance transitions may repeat later; they are distinct events.
              notify(event, `${item.label || item.address}\n${event === "received" ? current.received - previous.received : current.balance} SAT`, `${item.address}:${event}:${Date.now()}`, path)
            }
          }
          for (const tx of txs) {
            if (!tx.status.confirmed) {
              pending.add(tx.txid)
              const sources = owners.get(tx.txid) || new Set<string>()
              sources.add(item.address)
              owners.set(tx.txid, sources)
            }
            else if (pending.has(tx.txid)) {
              notify("confirmed", tx.txid, `confirmed:${tx.txid}`, `/tx/${tx.txid}`)
              pending.delete(tx.txid)
              confirmed.add(tx.txid)
            }
          }
          addresses.set(item.address, current)
        }))
        errors = results.some((result) => result.status === "rejected")
        const selected = latest.current.settings.transactions
        for (const id of explicit) if (!selected.includes(id)) { explicit.delete(id); if (!owners.has(id)) pending.delete(id); confirmed.delete(id) }
        const txResults = await Promise.allSettled([...new Set([...pending, ...selected.filter((id) => !confirmed.has(id))])].map(async (id) => {
          const status = await apiFetch<TxStatus>(`/tx/${id}/status`, controller.signal)
          if (controller.signal.aborted) return
          if (status.confirmed) {
            if (pending.has(id)) notify("confirmed", id, `confirmed:${id}`, `/tx/${id}`)
            pending.delete(id)
            confirmed.add(id)
          } else pending.add(id)
          if (selected.includes(id)) explicit.add(id)
        }))
        errors ||= txResults.some((result) => result.status === "rejected")
      } catch { errors = true }
      if (!controller.signal.aborted) {
        setPermission(Notification.permission)
        setFailed(errors)
        setLastCheck(Date.now())
        timer = setTimeout(check, 30_000)
      }
    }
    void check()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [apiFetch, isTestnet, key, ready, router, settings.enabled])
  return <NotificationContext.Provider value={{ settings, update, permission, enable, lastCheck, failed, ready }}>{children}</NotificationContext.Provider>
}

export function Notifications() {
  const context = useContext(NotificationContext)
  const { language, locale } = useLanguage()
  const { isTestnet } = useExplorerNetwork()
  const [txid, setTxid] = useState("")
  if (!context) return null
  const { settings, update, permission, enable, lastCheck, failed, ready } = context
  const words = copy[language]
  return <Dialog>
    <DialogTrigger asChild><Button variant="ghost" size="icon" aria-label={words.title} title={words.title}><Bell className="size-4" /></Button></DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader><DialogTitle>{words.title} · {isTestnet ? "Testnet" : "Bitcoin"}</DialogTitle><DialogDescription>{words.description}</DialogDescription></DialogHeader>
      <div className="flex items-center justify-between gap-4"><Label htmlFor="notifications-enabled">{words.enable}</Label><Switch id="notifications-enabled" checked={settings.enabled} disabled={!ready || permission === "unsupported"} onCheckedChange={(value) => void enable(value)} /></div>
      {permission === "unsupported" && <p className="text-sm text-muted-foreground">{words.unsupported}</p>}
      {permission === "denied" && <p className="text-sm text-destructive">{words.denied}</p>}
      <div className="space-y-3 rounded-lg border p-4">{notificationEvents.map((event) => <div key={event} className="flex items-center justify-between gap-4"><Label htmlFor={`notification-${event}`}>{words[event]}</Label><Switch id={`notification-${event}`} checked={settings.events[event]} onCheckedChange={(value) => update({ ...settings, events: { ...settings.events, [event]: value } })} /></div>)}</div>
      <form className="space-y-2" onSubmit={(event) => {
        event.preventDefault()
        const id = txid.trim().toLowerCase()
        if (!/^[a-f0-9]{64}$/.test(id)) { toast.error(words.invalid); return }
        update({ ...settings, transactions: [...new Set([...settings.transactions, id])] })
        setTxid("")
      }}><Label htmlFor="notification-tx">{words.watch}</Label><div className="flex gap-2"><Input id="notification-tx" value={txid} onChange={(event) => setTxid(event.target.value)} placeholder={words.tx} autoComplete="off" /><Button type="submit">{words.add}</Button></div></form>
      {settings.transactions.length > 0 && <ul className="space-y-2">{settings.transactions.map((id) => <li key={id} className="flex min-w-0 items-center gap-2"><span className="min-w-0 flex-1 truncate font-mono text-xs" title={id}>{id}</span><Button size="sm" variant="ghost" aria-label={`${words.remove} ${id}`} onClick={() => update({ ...settings, transactions: settings.transactions.filter((tx) => tx !== id) })}>{words.remove}</Button></li>)}</ul>}
      <p className="text-xs text-muted-foreground" role="status">{settings.enabled && permission === "granted" ? `${words.active} · ${lastCheck ? `${words.checked}: ${new Date(lastCheck).toLocaleTimeString(locale)}` : words.waiting}` : words.paused}</p>
      {failed && settings.enabled && <p role="alert" className="text-xs text-destructive">{words.error}</p>}
      <Button variant="outline" disabled={permission !== "granted"} onClick={() => { new Notification(`utxo.lat · ${words.title}`, { body: words.testBody, icon: "/android-chrome-192x192.png" }) }}>{words.test}</Button>
    </DialogContent>
  </Dialog>
}

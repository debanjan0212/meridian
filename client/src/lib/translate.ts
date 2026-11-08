/**
 * Page translation without rewriting every screen: text nodes and a few attributes are swapped in place
 * (only nodeValue/attributes change, never the DOM structure, so React keeps working).
 * Translations come from /api/translate and are kept in localStorage per language.
 */
// Inputs are not skipped: they have no text nodes, but their placeholder should translate.
const SKIP = "script, style, textarea, select, code, pre, [translate='no'], .notranslate"
const ATTRS = ["placeholder", "aria-label", "title"] as const
const RTL = new Set(["ar", "he", "fa", "ur"])

let lang = "en"
let cache: Record<string, string> = {}
const originals = new WeakMap<Text, string>()
const applied = new WeakMap<Text, string>()
const attrOriginals = new WeakMap<Element, Partial<Record<(typeof ATTRS)[number], string>>>()
const tracked = new Set<Text>()
const trackedEls = new Set<Element>()
let pending = new Set<string>()
let timer = 0
let observer: MutationObserver | null = null

const worth = (s: string) => /\p{L}/u.test(s) && s.trim().length > 1 && s.length <= 500
const storeKey = () => `meridian.tr.${lang}`

function loadCache() {
  try {
    cache = JSON.parse(localStorage.getItem(storeKey()) || "{}")
  } catch {
    cache = {}
  }
}
function saveCache() {
  try {
    localStorage.setItem(storeKey(), JSON.stringify(cache))
  } catch {
    // Storage full or blocked: translations still work for this visit.
  }
}

function applyText(node: Text) {
  const source = originals.get(node)
  if (!source) return
  const key = source.trim()
  const next = lang === "en" ? source : cache[key] ? source.replace(key, cache[key]) : null
  if (next == null) return void pending.add(key)
  if (node.nodeValue !== next) {
    applied.set(node, next)
    node.nodeValue = next
  }
}

function applyAttrs(el: Element) {
  const saved = attrOriginals.get(el) || {}
  for (const a of ATTRS) {
    const source = saved[a]
    if (!source) continue
    const next = lang === "en" ? source : cache[source.trim()]
    if (next == null) pending.add(source.trim())
    else if (el.getAttribute(a) !== next) el.setAttribute(a, next)
  }
}

function visit(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) return trackText(root as Text)
  if (!(root instanceof Element) || root.closest(SKIP)) return
  trackAttrs(root)
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) trackText(n as Text)
    else if ((n as Element).matches(SKIP)) continue
    else trackAttrs(n as Element)
  }
}

function trackText(node: Text) {
  const value = node.nodeValue || ""
  if (applied.get(node) === value) return // our own write
  if (node.parentElement?.closest(SKIP) || !worth(value)) return
  originals.set(node, value)
  tracked.add(node)
  applyText(node)
}

function trackAttrs(el: Element) {
  const saved = attrOriginals.get(el) || {}
  let any = false
  for (const a of ATTRS) {
    const v = el.getAttribute(a)
    if (v && worth(v) && v !== (lang === "en" ? undefined : cache[saved[a]?.trim() || ""])) {
      saved[a] = v
      any = true
    }
  }
  if (!any) return
  attrOriginals.set(el, saved)
  trackedEls.add(el)
  applyAttrs(el)
}

function flushSoon() {
  window.clearTimeout(timer)
  timer = window.setTimeout(flush, 120)
}

async function flush() {
  if (lang === "en" || !pending.size) return
  const want = [...pending].filter((t) => !cache[t])
  pending = new Set()
  for (let i = 0; i < want.length; i += 80) {
    try {
      const res = await fetch("/api/translate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lang, texts: want.slice(i, i + 80) }) })
      if (!res.ok) continue
      Object.assign(cache, ((await res.json()) as { translations: Record<string, string> }).translations)
    } catch {
      // Offline or failed: leave English in place.
    }
  }
  saveCache()
  tracked.forEach((n) => (n.isConnected ? applyText(n) : tracked.delete(n)))
  trackedEls.forEach((el) => (el.isConnected ? applyAttrs(el) : trackedEls.delete(el)))
  pending.clear()
}

export function setLanguage(next: string) {
  lang = next.toLowerCase().split("-")[0] || "en"
  document.documentElement.lang = lang
  document.documentElement.dir = RTL.has(lang) ? "rtl" : "ltr"
  loadCache()
  tracked.forEach((n) => (n.isConnected ? applyText(n) : tracked.delete(n)))
  trackedEls.forEach((el) => (el.isConnected ? applyAttrs(el) : trackedEls.delete(el)))
  if (!observer) {
    observer = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === "characterData") trackText(r.target as Text)
        else if (r.type === "attributes") trackAttrs(r.target as Element)
        else r.addedNodes.forEach(visit)
      }
      flushSoon()
    })
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] })
    visit(document.body)
  }
  flushSoon()
}

export const currentLanguage = () => lang

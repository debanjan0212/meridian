import { useId, useMemo, useState, type KeyboardEvent } from "react"

export type Suggestion = { name: string; hint?: string }

/**
 * Combobox with suggestions from the first focus (no typing needed). With `multi`, each pick is added
 * after a comma, so "Kazakhstan, Uz" offers Uzbekistan next.
 */
export function PlaceInput({ id, label, value, onChange, options, featured, placeholder, multi, inputStyle }: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
  featured: Suggestion[]
  placeholder?: string
  multi?: boolean
  inputStyle?: React.CSSProperties
}) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const cut = multi ? value.lastIndexOf(",") : -1
  const head = cut >= 0 ? `${value.slice(0, cut + 1).trimEnd()} ` : ""
  const token = (cut >= 0 ? value.slice(cut + 1) : value).trim().toLowerCase()
  const taken = new Set(value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean))

  const items: Suggestion[] = useMemo(() => {
    if (!token) return featured.filter((f) => !taken.has(f.name.toLowerCase())).slice(0, 8)
    const starts = options.filter((o) => o.toLowerCase().startsWith(token))
    const contains = options.filter((o) => !o.toLowerCase().startsWith(token) && o.toLowerCase().includes(token))
    return [...starts, ...contains].filter((o) => !taken.has(o.toLowerCase()) || o.toLowerCase() === token).slice(0, 8).map((name) => ({ name, hint: featured.find((f) => f.name === name)?.hint }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, options, featured, value])

  const pick = (s: Suggestion) => {
    onChange(head + s.name + (multi ? ", " : ""))
    setActive(0)
    if (!multi) setOpen(false)
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") (e.preventDefault(), setOpen(true), setActive((a) => Math.min(items.length - 1, a + 1)))
    else if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => Math.max(0, a - 1)))
    else if (e.key === "Enter" && open && items[active]) (e.preventDefault(), pick(items[active]))
    else if (e.key === "Escape") setOpen(false)
  }
  const show = open && items.length > 0

  return (
    <div className="combo">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        role="combobox"
        aria-expanded={show}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={show ? `${listId}-${active}` : undefined}
        autoComplete="off"
        className="input"
        style={inputStyle}
        value={value}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(e) => (onChange(e.target.value), setOpen(true), setActive(0))}
        onKeyDown={onKey}
      />
      {show && (
        <ul id={listId} role="listbox" className="combo-list">
          {!token && <li className="combo-head" aria-hidden="true">Suggestions</li>}
          {items.map((s, i) => (
            <li key={s.name} id={`${listId}-${i}`} role="option" aria-selected={i === active} className="combo-item" onMouseDown={(e) => (e.preventDefault(), pick(s))} onMouseEnter={() => setActive(i)}>
              <span>{s.name}</span>
              {s.hint && <span className="combo-hint">{s.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

import { useEffect, useState, type CSSProperties } from "react"

type Credit = { credit: string; link: string }
const memo = new Map<string, Promise<({ url: string } & Credit) | null>>()

function unsplash(q: string) {
  if (!memo.has(q)) memo.set(q, fetch(`/api/photo?q=${encodeURIComponent(q)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null))
  return memo.get(q)!
}

/**
 * A real photo: our own file in /images first, then Unsplash (with the credit their licence asks for),
 * then a soft gradient if both fail.
 */
export function Photo({ file, q, alt = "", className = "", style, src: direct, small }: { file?: string; q?: string; alt?: string; className?: string; style?: CSSProperties; src?: string | null; small?: boolean }) {
  const [src, setSrc] = useState<string | null>(direct || (file ? `/images/${file}` : null))
  const [credit, setCredit] = useState<Credit | null>(null)

  const fallback = () => {
    setSrc(null)
    if (q) unsplash(q).then((p) => {
      if (p) {
        setSrc(p.url)
        setCredit(p)
      }
    })
  }

  useEffect(() => {
    setCredit(null)
    if (direct) setSrc(direct)
    else if (file) setSrc(`/images/${file}`)
    else fallback()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, q, direct])

  return (
    <div className={`photo ${className}`} style={style} title={small && credit ? `Photo: ${credit.credit} / Unsplash` : undefined}>
      {src && <img src={src} alt={alt} loading="lazy" onError={credit || direct ? () => setSrc(null) : fallback} />}
      {credit && !small && (
        <span className="credit">
          Photo: <a href={credit.link} target="_blank" rel="noopener noreferrer">{credit.credit}</a> / <a href="https://unsplash.com/?utm_source=meridian&utm_medium=referral" target="_blank" rel="noopener noreferrer">Unsplash</a>
        </span>
      )}
    </div>
  )
}

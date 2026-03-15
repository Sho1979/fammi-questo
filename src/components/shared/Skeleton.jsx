/**
 * Skeleton — Shimmer loading placeholder generico.
 * Usato in Dashboard, Calendar, Tasks, Expenses, Dispensa durante il primo caricamento.
 *
 * Varianti:
 *   <Skeleton />              — riga singola (testo)
 *   <Skeleton w="60%" />      — riga più corta
 *   <Skeleton h={80} />       — block più alto (es. card)
 *   <Skeleton circle size={40} /> — avatar circolare
 *   <Skeleton.Card />         — card skeleton predefinita
 *   <Skeleton.List count={5} /> — lista di righe skeleton
 */

export default function Skeleton({ w, h, circle, size, className = '' }) {
  const style = {}
  if (circle) {
    style.width = size || 40
    style.height = size || 40
    style.borderRadius = '50%'
  } else {
    style.width = w || '100%'
    style.height = h || 16
    style.borderRadius = 12
  }

  return (
    <div
      className={`animate-pulse bg-gray-200 ${className}`}
      style={style}
    />
  )
}

/** Card skeleton: icona + 2 righe testo */
Skeleton.Card = function SkeletonCard({ className = '' }) {
  return (
    <div className={`rounded-2xl bg-white p-4 shadow-sm border border-gray-100 ${className}`}>
      <div className="flex items-center gap-3">
        <Skeleton circle size={36} />
        <div className="flex-1 flex flex-col gap-2">
          <Skeleton w="70%" h={14} />
          <Skeleton w="45%" h={12} />
        </div>
      </div>
    </div>
  )
}

/** Lista skeleton: N righe shimmer */
Skeleton.List = function SkeletonList({ count = 4, className = '' }) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton.Card key={i} />
      ))}
    </div>
  )
}

/** Header skeleton: titolo + sottotitolo */
Skeleton.Header = function SkeletonHeader({ className = '' }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <Skeleton w="50%" h={20} />
      <Skeleton w="30%" h={14} />
    </div>
  )
}

/** Stats skeleton: banner gradient shimmer */
Skeleton.Banner = function SkeletonBanner({ className = '' }) {
  return (
    <div className={`rounded-2xl p-4 animate-pulse bg-gray-200 ${className}`} style={{ height: 120 }} />
  )
}

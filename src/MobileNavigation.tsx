import { useEffect, useMemo, useState } from 'react'

export type MobileNavigationItem<T extends string> = {
  id: T
  icon: string
  label: string
  mobileLabel?: string
}

export function MobileNavigation<T extends string>({
  items,
  page,
  quickIds,
  onSelect,
  identityLabel,
  onHome,
  onAccountAction,
  accountActionLabel,
}: {
  items: MobileNavigationItem<T>[]
  page: T
  quickIds: T[]
  onSelect: (page: T) => void
  identityLabel: string
  onHome: () => void
  onAccountAction: () => void | Promise<void>
  accountActionLabel: string
}) {
  const [open, setOpen] = useState(false)
  const quickItems = useMemo(() => quickIds.map((id) => items.find((item) => item.id === id)).filter((item): item is MobileNavigationItem<T> => Boolean(item)), [items, quickIds])

  useEffect(() => setOpen(false), [page])
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [open])

  function select(id: T) {
    onSelect(id)
    setOpen(false)
  }

  return <div className="mobile-navigation">
    {open && <button className="mobile-nav-backdrop" aria-label="關閉全部功能" onClick={() => setOpen(false)} />}
    {open && <section className="mobile-nav-sheet open" aria-label="全部功能">
      <header><div><strong>全部功能</strong><small>{identityLabel}</small></div><button type="button" onClick={() => setOpen(false)} aria-label="關閉全部功能">×</button></header>
      <div className="mobile-nav-grid">{items.map((item) => <button type="button" key={item.id} className={page === item.id ? 'active' : ''} onClick={() => select(item.id)}><span>{item.icon}</span><strong>{item.label}</strong></button>)}</div>
      <footer><button type="button" onClick={() => { setOpen(false); onHome() }}>返回網站首頁</button><button type="button" onClick={() => { setOpen(false); void onAccountAction() }}>{accountActionLabel}</button></footer>
    </section>}
    <nav className="mobile-bottom-nav" aria-label="手機主要導覽">
      {quickItems.map((item) => <button type="button" key={item.id} className={page === item.id ? 'active' : ''} aria-current={page === item.id ? 'page' : undefined} onClick={() => select(item.id)}><span>{item.icon}</span><small>{item.mobileLabel ?? item.label}</small></button>)}
      <button type="button" className={open ? 'active' : ''} aria-expanded={open} onClick={() => setOpen((value) => !value)}><span>☰</span><small>全部</small></button>
    </nav>
  </div>
}


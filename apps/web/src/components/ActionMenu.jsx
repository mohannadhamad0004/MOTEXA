import { useEffect, useRef, useState } from 'react'
import styles from './ActionMenu.module.css'

/**
 * The "⋯" actions menu of a table row. Its clicks never reach the row (so the row doesn't open).
 * The menu is fixed-positioned from the button, so a scrolling table can't clip it.
 * @param {{ label: string, items: { label: string, onSelect: () => void, danger?: boolean, separated?: boolean }[] }} props
 *   label: names the button for screen readers, e.g. "Actions for Sami"
 */
export default function ActionMenu({ label, items }) {
  const [position, setPosition] = useState(null) // { top, right } while open
  const buttonRef = useRef(null)
  const menuRef = useRef(null)
  const open = position !== null
  const close = () => setPosition(null)

  useEffect(() => {
    if (!open) return undefined
    menuRef.current?.querySelector('button')?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') {
        close()
        buttonRef.current?.focus()
      }
    }
    const onPointer = (event) => {
      if (!menuRef.current?.contains(event.target) && !buttonRef.current?.contains(event.target)) close()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  function toggle(event) {
    event.stopPropagation()
    if (open) return close()
    const rect = buttonRef.current.getBoundingClientRect()
    setPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
  }

  return (
    <span className={styles.wrap} data-no-row onClick={(event) => event.stopPropagation()} onKeyDown={(event) => {
        event.stopPropagation() // keys inside the menu must not reach the row (Enter opens a row)
        if (!open) return
        if (event.key === 'Escape') {
          close()
          buttonRef.current?.focus()
        } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault()
          const entries = [...menuRef.current.querySelectorAll('[role="menuitem"]')]
          const at = entries.indexOf(document.activeElement)
          const next = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: entries.length - 1 }[event.key]
          entries[(next + entries.length) % entries.length].focus()
        } else if (event.key === 'Tab') close()
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className={styles.button}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open && (
        <ul ref={menuRef} role="menu" className={styles.menu} style={{ top: position.top, right: position.right }}>
          {items.map((item) => (
            <li key={item.label} role="none" className={item.separated ? styles.separated : undefined}>
              <button
                type="button"
                role="menuitem"
                className={`${styles.item} ${item.danger ? styles.danger : ''}`}
                onClick={() => {
                  close()
                  item.onSelect()
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </span>
  )
}

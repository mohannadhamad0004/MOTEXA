import { useEffect, useRef, useState } from 'react'
import styles from './SearchBar.module.css'

const DEBOUNCE_MS = 250

// Search input used by the marketplace and the mechanic / tow company directories.
// Calls onChange once typing pauses for DEBOUNCE_MS (or right away on Enter), not on every key.
export default function SearchBar({
  value,
  onChange,
  id = 'part-search',
  quiet = false, // a flat underlined field for toolbars
  label = 'Search by part number, name or car',
  placeholder = 'Search by part number, name or car - e.g. steering wheel hyundai accent',
}) {
  const [text, setText] = useState(value)
  const committed = useRef(value) // last value sent to onChange
  // Latest onChange, so a parent re-render doesn't restart the debounce timer
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  const commit = (next) => {
    committed.current = next
    onChangeRef.current(next)
  }

  // The value changed from outside (filter chip removed, "Did you mean" clicked, ...)
  useEffect(() => {
    if (value !== committed.current) {
      committed.current = value
      setText(value)
    }
  }, [value])

  useEffect(() => {
    if (text === committed.current) return
    const timer = setTimeout(() => commit(text), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [text])

  return (
    <form
      role="search"
      className={`${styles.form} ${quiet ? styles.quiet : ''}`}
      onSubmit={(event) => {
        event.preventDefault()
        if (text !== committed.current) commit(text)
      }}
    >
      <label htmlFor={id} className={styles.visuallyHidden}>
        {label}
      </label>
      <input
        id={id}
        type="search"
        className={styles.input}
        placeholder={placeholder}
        value={text}
        onChange={(event) => setText(event.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
    </form>
  )
}

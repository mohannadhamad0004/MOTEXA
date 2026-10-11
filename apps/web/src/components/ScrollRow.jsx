import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import styles from './ScrollRow.module.css'

// A titled row that scrolls sideways: "View all" link and left / right arrows on desktop; on
// phones and touch screens the arrows are hidden and the row is swiped. `children` are <li>s.
// `editorial`: a heavy rule above, a bigger title and square arrows (public catalog pages).
export default function ScrollRow({ title, viewAllTo, viewAllLabel = 'View all', editorial = false, children }) {
  const titleId = useId()
  const trackRef = useRef(null)
  const [edges, setEdges] = useState({ start: true, end: false })

  const update = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    setEdges({
      start: track.scrollLeft <= 2,
      end: track.scrollLeft + track.clientWidth >= track.scrollWidth - 2,
    })
  }, [])

  useEffect(() => {
    update()
    const track = trackRef.current
    const observer = new ResizeObserver(update)
    observer.observe(track)
    return () => observer.disconnect()
  }, [update, children])

  const scrollBy = (direction) => {
    const track = trackRef.current
    track.scrollBy({ left: direction * track.clientWidth * 0.9, behavior: 'smooth' })
  }

  return (
    <section className={`${styles.row} ${editorial ? styles.editorial : ''}`} aria-labelledby={titleId}>
      <div className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <div className={styles.controls}>
          {viewAllTo && (
            <Link to={viewAllTo} className={styles.viewAll}>
              {viewAllLabel}
              <span className={styles.srOnly}>: {title}</span>
            </Link>
          )}
          <div className={styles.arrows}>
            <button
              type="button"
              className={styles.arrow}
              onClick={() => scrollBy(-1)}
              disabled={edges.start}
              aria-label={`Scroll ${title} left`}
            >
              ‹
            </button>
            <button
              type="button"
              className={styles.arrow}
              onClick={() => scrollBy(1)}
              disabled={edges.end}
              aria-label={`Scroll ${title} right`}
            >
              ›
            </button>
          </div>
        </div>
      </div>
      <ul ref={trackRef} className={styles.track} onScroll={update}>
        {children}
      </ul>
    </section>
  )
}

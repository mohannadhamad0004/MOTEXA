import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useMediaQuery } from '../../../hooks/useMediaQuery.js'
import styles from './OfferCarousel.module.css'

const AUTO_ADVANCE_MS = 5000
const SWIPE_PX = 40

// Discount banners (catalog.offerBanners): 2 visible on desktop, 1 on phones. Arrows, dots for the
// current position, swipe on touch screens. Advances every 5 seconds, pauses while hovered or
// focused, and doesn't move on its own (or animate) when the user prefers reduced motion.
// Each banner opens its category filtered to offers.
export default function OfferCarousel({ banners }) {
  const isPhone = useMediaQuery('(max-width: 767px)')
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const visible = isPhone ? 1 : 2
  const positions = Math.max(1, banners.length - visible + 1)
  const [rawIndex, setIndex] = useState(0)
  const index = Math.min(rawIndex, positions - 1)
  const [paused, setPaused] = useState(false)
  const swipeStart = useRef(null)

  const go = (next) => setIndex(((next % positions) + positions) % positions)

  useEffect(() => {
    if (paused || reducedMotion || positions < 2) return undefined
    const timer = setInterval(() => setIndex((current) => (Math.min(current, positions - 1) + 1) % positions), AUTO_ADVANCE_MS)
    return () => clearInterval(timer)
  }, [paused, reducedMotion, positions])

  if (banners.length === 0) return null

  function handlePointerDown(event) {
    if (event.pointerType === 'mouse') return
    swipeStart.current = event.clientX
  }

  function handlePointerUp(event) {
    if (swipeStart.current === null) return
    const distance = event.clientX - swipeStart.current
    swipeStart.current = null
    if (Math.abs(distance) > SWIPE_PX) go(index + (distance < 0 ? 1 : -1))
  }

  return (
    <section
      className={styles.carousel}
      aria-roledescription="carousel"
      aria-label="Offers"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => !event.currentTarget.contains(event.relatedTarget) && setPaused(false)}
    >
      <div className={styles.header}>
        <h2 className={styles.kicker}>Offers</h2>
        {positions > 1 && (
          <div className={styles.controls}>
            <button type="button" className={styles.arrow} onClick={() => go(index - 1)} aria-label="Previous offers">
              ‹
            </button>
            <div className={styles.dots}>
              {Array.from({ length: positions }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`${styles.dot} ${i === index ? styles.dotActive : ''}`}
                  onClick={() => go(i)}
                  aria-label={`Show offers ${i + 1} of ${positions}`}
                  aria-current={i === index ? 'true' : undefined}
                />
              ))}
            </div>
            <button type="button" className={styles.arrow} onClick={() => go(index + 1)} aria-label="Next offers">
              ›
            </button>
          </div>
        )}
      </div>

      <div className={styles.viewport}>
        <ul
          className={`${styles.track} ${reducedMotion ? styles.still : ''}`}
          style={{ '--visible': visible, '--index': index }}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            swipeStart.current = null
          }}
          aria-live={paused ? 'polite' : 'off'}
        >
          {banners.map((banner, i) => {
            const shown = i >= index && i < index + visible
            return (
              <li
                key={banner.id}
                className={styles.slide}
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${banners.length}`}
                aria-hidden={!shown}
                inert={!shown}
              >
                <Link to={banner.to} className={`${styles.banner} ${banner.image ? styles.withPhoto : styles.noPhoto}`} draggable="false">
                  {banner.image && (
                    <img className={styles.photo} src={banner.image} alt="" width={1600} height={600} loading="lazy" decoding="async" />
                  )}
                  <span className={styles.badge}>{banner.badge}</span>
                  <span className={styles.title}>{banner.title}</span>
                  <span className={styles.subtitle}>{banner.subtitle}</span>
                  <span className={styles.cta}>Shop the offer →</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

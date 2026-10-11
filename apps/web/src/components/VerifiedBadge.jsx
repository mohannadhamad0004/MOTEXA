import styles from './VerifiedBadge.module.css'

// "Verified by MOTEXA": an admin checked this account's documents and approved it.
export default function VerifiedBadge() {
  return (
    <span className={styles.badge} title="An admin checked this account's certificates and documents">
      <svg viewBox="0 0 16 16" className={styles.icon} aria-hidden="true">
        <path
          d="M8 1 2.5 3v4.5C2.5 11 5 13.8 8 15c3-1.2 5.5-4 5.5-7.5V3L8 1Z"
          fill="currentColor"
          opacity="0.2"
        />
        <path
          d="m5.5 8 1.8 1.8L10.8 6.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Verified by MOTEXA
    </span>
  )
}

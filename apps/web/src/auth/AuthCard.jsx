import Card from '../components/Card.jsx'
import styles from './AuthCard.module.css'

const BENEFITS = [
  { title: 'Verified providers', text: 'Mechanics, shops and tow companies are checked by our team.' },
  { title: 'AI-assisted triage', text: 'Know what is wrong before you pick up the phone.' },
  { title: 'Help on the road', text: 'Towing and on-site mechanics when you need them.' },
]

// Card used by the login, signup, password and approval pages. On desktop the narrow version sits
// beside a MOTEXA value panel (a split screen); `wide` fits longer content such as the signup
// steps and has no panel. Phones get the card alone.
export default function AuthCard({ title, subtitle, wide = false, footer, children }) {
  const card = (
    <Card
      as="section"
      padding="lg"
      elevated={wide}
      className={`${styles.card} ${wide ? styles.wide : ''}`}
      aria-labelledby="auth-card-title"
    >
      <header className={styles.header}>
        <h1 id="auth-card-title" className={styles.title}>
          {title}
        </h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </header>
      {children}
      {footer && <footer className={styles.footer}>{footer}</footer>}
    </Card>
  )

  if (wide) return <div className={styles.wrapper}>{card}</div>

  return (
    <div className={`${styles.wrapper} ${styles.split}`}>
      <aside className={styles.brand} aria-label="Why MOTEXA">
        <p className={styles.brandTitle}>
          Car care you can <span className={styles.brandAccent}>trust</span>.
        </p>
        <ul className={styles.benefits}>
          {BENEFITS.map((benefit) => (
            <li key={benefit.title}>
              <p className={styles.benefitTitle}>
                <span aria-hidden="true">✓ </span>
                {benefit.title}
              </p>
              <p className={styles.benefitText}>{benefit.text}</p>
            </li>
          ))}
        </ul>
      </aside>
      <div className={styles.formSide}>{card}</div>
    </div>
  )
}

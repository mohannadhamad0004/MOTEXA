import { SKILL_PHOTOS } from '../skills.js'
import styles from './SkillIndex.module.css'

const pad = (n) => String(n).padStart(2, '0')

/**
 * "Browse by skill": every skill as a numbered line with how many mechanics have it. Choosing one
 * filters the directory by it; choosing it again clears it.
 * @param {{ counts: Object<string, number>, skill: string, onPick: (skill: string) => void }} props
 */
export default function SkillIndex({ counts, skill, onPick }) {
  return (
    <ul className={styles.index} aria-label="Skills">
      {SKILL_PHOTOS.map(({ skill: name, slug }, i) => {
        const count = counts[name] ?? 0
        return (
          <li key={slug}>
            <button type="button" className={styles.skill} aria-pressed={skill === name} onClick={() => onPick(name)}>
              <span className={styles.no} aria-hidden="true">
                {pad(i + 1)}
              </span>
              <span className={styles.name}>{name}</span>
              <span className={styles.count}>
                {count} {count === 1 ? 'mechanic' : 'mechanics'}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

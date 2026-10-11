import styles from './Card.module.css'

/**
 * Surface for grouped content: a bordered, rounded panel.
 * @param {Object} props
 * @param {React.ElementType} [props.as]  element to render: 'div' (default), 'article', 'section', 'li'...
 * @param {'none' | 'sm' | 'md' | 'lg'} [props.padding]
 * @param {boolean} [props.interactive]   hover lift and border, for cards that link somewhere.
 *   Make the whole card clickable with a link that has the `Card.cover` class (see MechanicCard).
 * @param {boolean} [props.elevated]      a stronger shadow, for hero and highlighted cards
 * @param {boolean} [props.flat]          no box: a section on a thin rule. For ordinary information and
 *   forms; cards stay for real objects (products, providers, vehicles).
 */
export default function Card({
  as: Element = 'div',
  padding = 'md',
  interactive = false,
  elevated = false,
  flat = false,
  className = '',
  ...props
}) {
  const classes = [
    styles.card,
    styles[`padding-${padding}`],
    interactive && styles.interactive,
    elevated && styles.elevated,
    flat && styles.flat,
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return <Element className={classes} {...props} />
}

// Put this class on the card's main link to make the whole card clickable.
Card.cover = styles.cover

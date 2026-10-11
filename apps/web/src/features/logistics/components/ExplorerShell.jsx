import styles from './ExplorerShell.module.css'

/**
 * The map workspace shared by /mechanics/map and /tow-companies/map: a list rail on the left and the map
 * filling the rest of the screen under the navbar. On phones it shows one at a time (a List | Map
 * switch). The selected provider's panel (`inspector`) floats over the map on desktop and is a slim
 * bar at the bottom on phones; while it is open the list keeps room under its last row.
 * The pages build the rail's contents (see the rail styles in ExplorerShell.module.css) and the map.
 * @param {Object} props
 * @param {'list' | 'map'} props.view            phones only
 * @param {(view: 'list' | 'map') => void} props.onViewChange
 * @param {boolean} props.hasSelection          a provider is selected (an inspector is shown)
 * @param {string} props.railLabel
 * @param {React.ReactNode} props.rail
 * @param {React.ReactNode} props.map
 * @param {React.ReactNode} [props.inspector]
 */
export default function ExplorerShell({ view, onViewChange, hasSelection, railLabel, rail, map, inspector = null }) {
  return (
    <div className={styles.workspace} data-view={view} data-selected={hasSelection ? '' : undefined}>
      <div className={styles.switch} role="group" aria-label="Results view">
        <button type="button" className={styles.switchButton} aria-pressed={view === 'list'} onClick={() => onViewChange('list')}>
          List
        </button>
        <button type="button" className={styles.switchButton} aria-pressed={view === 'map'} onClick={() => onViewChange('map')}>
          Map
        </button>
      </div>

      <section className={styles.rail} aria-label={railLabel}>
        {rail}
      </section>

      <div className={styles.mapPane}>
        <div className={styles.mapHost}>{map}</div>
      </div>

      {inspector && <div className={styles.inspector}>{inspector}</div>}
    </div>
  )
}

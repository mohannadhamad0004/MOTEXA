import EmptyState from './EmptyState.jsx'
import styles from './FlatDataList.module.css'

// A flat operational list: a quiet header, then one grid row per record with hairlines between rows
// and no vertical lines. Put the primary value first and its detail beneath it in the same cell.
// columns: [{ key, header, render: (row) => node, align?: 'end' }]
// widths: CSS grid-template-columns for the desktop layout. Below 900px of list width the cells stack: the
//   first column becomes the row title and the others wrap beneath it (labelled by `header`).
// cellClassName: an extra class on the column's cells, for page-specific compact placement.
// optional: true marks a column that is hidden when the list is narrower than 1040px (the row still
//   has it in the drawer); mediumWidths is the grid for the 900-1039px band, without those columns.
// onRowOpen(row): the row is clickable and Enter opens it; clicks on links, buttons and anything
//   marked data-no-row (components/ActionMenu) don't. selectedKey marks the row with a copper edge.
// groupOf(row): optional section label (Today / Yesterday ...) shown when it changes.
export default function FlatDataList({
  columns,
  widths,
  mediumWidths,
  rows,
  rowKey = (row) => row.id,
  label,
  emptyText = 'Nothing to show.',
  onRowOpen = null,
  selectedKey = null,
  groupOf = null,
}) {
  if (rows.length === 0) return <EmptyState compact headingLevel="p" title={emptyText} />

  return (
    <div role="table" aria-label={label} className={styles.list} style={{ '--cols': widths, '--cols-medium': mediumWidths ?? widths }}>
      <div role="row" className={`${styles.row} ${styles.head}`}>
        {columns.map((column) => (
          <span key={column.key} role="columnheader" data-optional={column.optional || undefined} className={column.align === 'end' ? styles.end : undefined}>
            {column.header}
          </span>
        ))}
      </div>
      {rows.map((row, index) => (
        <div key={rowKey(row)} role="rowgroup" className={styles.group}>
          {groupOf && (index === 0 || groupOf(row) !== groupOf(rows[index - 1])) && (
            <p className={styles.section}>{groupOf(row)}</p>
          )}
          <div
            role="row"
            className={[styles.row, styles.body, onRowOpen && styles.clickable, rowKey(row) === selectedKey && styles.selected]
              .filter(Boolean)
              .join(' ')}
            tabIndex={onRowOpen ? 0 : undefined}
            onClick={
              onRowOpen
                ? (event) => {
                    if (!event.target.closest('a, button, input, select, textarea, [data-no-row]')) onRowOpen(row)
                  }
                : undefined
            }
            onKeyDown={
              onRowOpen
                ? (event) => {
                    if (event.key === 'Enter' && event.target === event.currentTarget) {
                      event.preventDefault() // else the same keypress lands on the drawer's focused Close button
                      onRowOpen(row)
                    }
                  }
                : undefined
            }
          >
            {columns.map((column) => (
              <div
                key={column.key}
                role="cell"
                data-col={column.key}
                data-label={column.header}
                data-optional={column.optional || undefined}
                className={[column.align === 'end' && styles.end, column.full && styles.full, column.cellClassName].filter(Boolean).join(' ') || undefined}
              >
                {column.render(row)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

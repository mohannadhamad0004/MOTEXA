import EmptyState from './EmptyState.jsx'
import styles from './DataList.module.css'

// Simple data table for the admin pages. Scrolls sideways on narrow screens.
// columns: [{ key, header, render: (row) => node, align?: 'right', nowrap?: boolean }]
// onRowOpen(row): makes the rows clickable. Enter on a focused row opens it too. Clicks on links and
// buttons inside a row (or anything marked data-no-row, like components/ActionMenu) don't open the row.
export default function DataList({
  columns,
  rows,
  rowKey = (row) => row.id,
  caption,
  emptyText = 'Nothing to show.',
  onRowOpen = null,
  selectedKey = null,
  groupOf = null,
}) {
  if (rows.length === 0) return <EmptyState compact headingLevel="p" title={emptyText} />

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        {caption && <caption className={styles.caption}>{caption}</caption>}
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={column.align === 'right' ? styles.right : undefined}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => [
            groupOf && (index === 0 || groupOf(row) !== groupOf(rows[index - 1])) && (
              <tr key={`group-${groupOf(row)}`} className={styles.groupRow}>
                <th scope="rowgroup" colSpan={columns.length}>
                  {groupOf(row)}
                </th>
              </tr>
            ),
            <tr
              key={rowKey(row)}
              className={[onRowOpen && styles.clickable, selectedKey !== null && rowKey(row) === selectedKey && styles.selected]
                .filter(Boolean)
                .join(' ')}              tabIndex={onRowOpen ? 0 : undefined}
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
                      if (event.key === 'Enter' && event.target === event.currentTarget) onRowOpen(row)
                    }
                  : undefined
              }
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={[column.align === 'right' && styles.right, column.nowrap && styles.nowrap]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>,
          ])}
        </tbody>
      </table>
    </div>
  )
}

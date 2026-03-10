import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SlidersHorizontal, ChevronUp, ChevronDown, Search } from 'lucide-react'

export default function DataTable({ columns, data, loading, onRowClick, searchable = true }) {
  const { t } = useTranslation()
  const [visibleCols, setVisibleCols] = useState(() => {
    const saved = localStorage.getItem(`table_cols_${columns.map(c=>c.key).join('_')}`)
    if (saved) return JSON.parse(saved)
    return columns.reduce((acc, col) => ({ ...acc, [col.key]: col.defaultVisible !== false }), {})
  })
  const [showColMenu, setShowColMenu] = useState(false)
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [search, setSearch] = useState('')

  function toggleCol(key) {
    const updated = { ...visibleCols, [key]: !visibleCols[key] }
    setVisibleCols(updated)
    localStorage.setItem(`table_cols_${columns.map(c=>c.key).join('_')}`, JSON.stringify(updated))
  }

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const visibleColumns = columns.filter(c => visibleCols[c.key])

  let filteredData = data || []
  if (search) {
    const q = search.toLowerCase()
    filteredData = filteredData.filter(row =>
      visibleColumns.some(col => String(row[col.key] || '').toLowerCase().includes(q))
    )
  }

  if (sortKey) {
    filteredData = [...filteredData].sort((a, b) => {
      const va = a[sortKey] ?? ''
      const vb = b[sortKey] ?? ''
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-3">
        {searchable && (
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute left-3 top-2.5 text-surface-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('common.search')}
              className="w-full bg-surface-800 border border-surface-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-primary-500"
            />
          </div>
        )}
        <div className="relative ml-auto">
          <button
            onClick={() => setShowColMenu(!showColMenu)}
            className="flex items-center gap-2 px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm text-surface-300 hover:text-white transition-colors"
          >
            <SlidersHorizontal size={14} />
            {t('common.columns')}
          </button>
          {showColMenu && (
            <div className="absolute right-0 top-10 bg-surface-800 border border-surface-700 rounded-xl shadow-xl z-50 p-2 min-w-40 animate-fade-in">
              {columns.map(col => (
                <label key={col.key} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleCols[col.key] !== false}
                    onChange={() => toggleCol(col.key)}
                    className="accent-primary-500"
                  />
                  <span className="text-sm text-surface-300">{col.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-surface-800">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-800 bg-surface-900">
              {visibleColumns.map(col => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  className={`px-4 py-3 text-left text-xs font-medium text-surface-400 uppercase tracking-wide whitespace-nowrap ${col.sortable !== false ? 'cursor-pointer hover:text-white' : ''}`}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key && (
                      sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-800">
            {loading ? (
              <tr><td colSpan={visibleColumns.length} className="text-center py-12">
                <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </td></tr>
            ) : filteredData.length === 0 ? (
              <tr><td colSpan={visibleColumns.length} className="text-center py-12 text-surface-500">{t('common.noData')}</td></tr>
            ) : (
              filteredData.map((row, i) => (
                <tr
                  key={row.id || i}
                  onClick={() => onRowClick?.(row)}
                  className={`bg-surface-950 hover:bg-surface-900 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  {visibleColumns.map(col => (
                    <td key={col.key} className="px-4 py-3 text-sm text-surface-200 whitespace-nowrap">
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '-')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-2 text-xs text-surface-500">
        <span>{filteredData.length} / {data?.length || 0} {t('common.total')}</span>
      </div>
    </div>
  )
}

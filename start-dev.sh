import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { C } from './UI'
import { exportToExcel, importFromExcel, downloadTemplate } from '../utils/excel'

export default function ExcelBar({ 
  onExport,           // () => data[] to export
  onImport,           // (rows[]) => void
  templateHeaders,    // string[]
  templateName,       // string
  exportFilename,     // string
  showToast,
}) {
  const { t } = useTranslation()
  const fileRef = useRef()
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const data = await onExport()
      if (!data?.length) { showToast?.('Nema podataka za izvoz', 'info'); return }
      await exportToExcel(data, exportFilename)
      showToast?.(t('common.export_success'), 'success')
    } catch(e) { showToast?.(e.message, 'error') }
    finally { setExporting(false) }
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const rows = await importFromExcel(file)
      await onImport(rows)
      showToast?.(`✓ ${rows.length} ${t('common.rows_imported')}`, 'success')
    } catch(e) { showToast?.(t('common.import_error') + ': ' + e.message, 'error') }
    finally { setImporting(false); e.target.value = '' }
  }

  const btn = (icon, label, onClick, loading, color) => (
    <button onClick={onClick} disabled={loading}
      style={{ display:'flex',alignItems:'center',gap:6,padding:'8px 13px',borderRadius:9,border:`1px solid ${color}44`,background:`${color}10`,color,fontSize:11,cursor:loading?'wait':'pointer',transition:'all .2s',fontFamily:"'Chakra Petch',sans-serif",fontWeight:500,opacity:loading?.6:1 }}
      onMouseOver={e=>{if(!loading)e.currentTarget.style.background=`${color}20`}}
      onMouseOut={e=>e.currentTarget.style.background=`${color}10`}
    >
      <span style={{ fontSize:13 }}>{icon}</span>
      {loading ? '...' : label}
    </button>
  )

  return (
    <div style={{ display:'flex',alignItems:'center',gap:6 }}>
      {btn('↓', t('common.export_excel'), handleExport, exporting, C.green)}
      {btn('↑', t('common.import_excel'), () => fileRef.current?.click(), importing, C.teal)}
      {btn('⬚', 'Template', () => downloadTemplate(templateHeaders, templateName), false, C.muted2)}
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }} onChange={handleImport}/>
    </div>
  )
}

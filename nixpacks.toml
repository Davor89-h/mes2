// Excel import/export utility using SheetJS (xlsx)
// Dynamically imported to avoid bundle bloat

export async function exportToExcel(data, filename, sheetName = 'Sheet1') {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  
  // Auto column widths
  const cols = Object.keys(data[0] || {}).map(key => ({
    wch: Math.max(key.length, ...data.map(r => String(r[key] ?? '').length)) + 2
  }))
  ws['!cols'] = cols

  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0,10)}.xlsx`)
}

export async function importFromExcel(file) {
  const XLSX = await import('xlsx')
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' })
        resolve(data)
      } catch(err) { reject(err) }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

export async function downloadTemplate(headers, filename) {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.aoa_to_sheet([headers])
  ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length, 15) + 2 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Template')
  XLSX.writeFile(wb, `${filename}_template.xlsx`)
}

// Map Excel row to fixture object
export function mapExcelToFixture(row) {
  const TYPE_MAP = {
    'manualna':'manual','manual':'manual','manuell':'manual',
    'hidraulična':'hydraulic','hydraulic':'hydraulic','hydraulisch':'hydraulic',
    'pneumatska':'pneumatic','pneumatic':'pneumatic','pneumatisch':'pneumatic',
    'magnetska':'magnetic','magnetic':'magnetic','magnetisch':'magnetic',
    'ostalo':'other','other':'other','sonstige':'other',
  }
  const STATUS_MAP = {
    'aktivna':'active','active':'active','aktiv':'active',
    'u produkciji':'in_production','in production':'in_production','in produktion':'in_production',
    'servis':'maintenance','maintenance':'maintenance','wartung':'maintenance',
    'arhivirana':'retired','retired':'retired','archiviert':'retired',
  }
  const keys = Object.keys(row)
  const get = (...names) => {
    for (const n of names) {
      const k = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g,'').includes(n.toLowerCase().replace(/[^a-z0-9]/g,'')))
      if (k && row[k] !== '') return String(row[k])
    }
    return ''
  }
  const typeRaw = get('vrsta','type','typ').toLowerCase()
  const statusRaw = get('status').toLowerCase()
  return {
    internalId: get('internalni','internal','interne'),
    name: get('naziv','name'),
    description: get('opis','description','beschreibung'),
    type: TYPE_MAP[typeRaw] || 'manual',
    status: STATUS_MAP[statusRaw] || 'active',
    material: get('materijal','material'),
    weight: get('tezina','weight','gewicht'),
    dimensions: get('dimenzije','dimensions','abmessungen'),
    clampingPoints: get('steznih','clamping','spann') || '',
    maxForce: get('maks','max'),
    estimatedValue: get('vrijednost','value','wert') || '',
    notes: get('napomene','notes','notizen'),
  }
}

// Map fixture to export row (HR labels by default)
export function mapFixtureToExcel(fixture, lang = 'hr') {
  const labels = {
    hr: { id:'Interni ID', name:'Naziv', desc:'Opis', type:'Vrsta', status:'Status', material:'Materijal', weight:'Težina', dims:'Dimenzije', points:'Stez. točke', force:'Maks. sila', value:'Vrijednost (€)', notes:'Napomene', location:'Lokacija', created:'Kreirano' },
    de: { id:'Interne ID', name:'Name', desc:'Beschreibung', type:'Typ', status:'Status', material:'Material', weight:'Gewicht', dims:'Abmessungen', points:'Spannpunkte', force:'Max. Kraft', value:'Wert (€)', notes:'Notizen', location:'Standort', created:'Erstellt' },
    en: { id:'Internal ID', name:'Name', desc:'Description', type:'Type', status:'Status', material:'Material', weight:'Weight', dims:'Dimensions', points:'Clamping Points', force:'Max Force', value:'Value (€)', notes:'Notes', location:'Location', created:'Created' },
  }
  const l = labels[lang] || labels.hr
  return {
    [l.id]: fixture.internal_id || '',
    [l.name]: fixture.name || '',
    [l.desc]: fixture.description || '',
    [l.type]: fixture.type || '',
    [l.status]: fixture.status || '',
    [l.material]: fixture.material || '',
    [l.weight]: fixture.weight || '',
    [l.dims]: fixture.dimensions || '',
    [l.points]: fixture.clamping_points || '',
    [l.force]: fixture.max_force || '',
    [l.value]: fixture.estimated_value || '',
    [l.location]: fixture.hall ? `${fixture.hall}/${fixture.rack||''}/${fixture.shelf||''}` : '',
    [l.notes]: fixture.notes || '',
    [l.created]: fixture.created_at ? new Date(fixture.created_at).toLocaleDateString() : '',
  }
}

export function mapToolToExcel(tool, lang = 'hr') {
  return {
    'Interni ID': tool.internal_id || '',
    'Naziv / Name': tool.name || '',
    'Kategorija / Category': tool.category || '',
    'Namjena / Purpose': tool.purpose || '',
    'Dimenzije / Dimensions': tool.dimensions || '',
    'Spoj / Connection': tool.connection_type || '',
    'Lokacija / Location': tool.storage_location || '',
    'Količina / Qty': tool.current_quantity || 0,
    'Min. količina / Min. Qty': tool.min_quantity || 0,
    'Status': tool.status || '',
    'Napomene / Notes': tool.notes || '',
  }
}

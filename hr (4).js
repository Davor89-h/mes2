import { useState, useEffect, useCallback } from 'react'
import { C, useToast } from '../components/UI'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'
import { Users, Plus, X, Save, Edit2, Shield, Key, UserCheck, UserX, CheckCircle, Lock } from 'lucide-react'

const S = {
  card:  { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 },
  input: { background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', color: C.gray, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' },
  label: { fontSize: 11, color: C.muted, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4, display: 'block' },
  btn:   (col=C.accent) => ({ background: col, border: 'none', borderRadius: 8, padding: '8px 16px', color: col===C.accent?'#1a2a28':C.gray, fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }),
  ghost: { background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 14px', color: C.muted, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
  th:    { padding: '10px 14px', fontSize: 10, color: C.muted, letterSpacing: 1.4, textTransform: 'uppercase', textAlign: 'left', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' },
  td:    { padding: '11px 14px', fontSize: 13, color: C.gray, borderBottom: `1px solid ${C.border}22`, verticalAlign: 'middle' },
}

const ROLE_COLORS = { admin: C.red, manager: C.orange, operator: C.teal, maintenance: C.blue, quality: C.green, warehouse: C.accent }

function RoleBadge({ name, label }) {
  const color = ROLE_COLORS[name] || C.muted
  return (
    <span style={{ background: color+'22', color, border: `1px solid ${color}44`, borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>
      {label || name}
    </span>
  )
}

// ── User Modal ────────────────────────────────────────────────────────────────
function UserModal({ user: editUser, roles, onClose, onSaved }) {
  const isNew = !editUser?.id
  const [form, setForm] = useState({
    username: editUser?.username || '',
    first_name: editUser?.first_name || '',
    last_name: editUser?.last_name || '',
    email: editUser?.email || '',
    role: editUser?.role || 'operator',
    active: editUser?.active !== undefined ? editUser.active : 1,
    password: '',
  })
  const [selectedRoles, setSelectedRoles] = useState(editUser?.roles || [])
  const [tab, setTab] = useState('info')
  const [loading, setLoading] = useState(false)
  const F = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    setLoading(true)
    try {
      let userId = editUser?.id
      if (isNew) {
        const r = await api.post('/users', form)
        userId = r.data.id
      } else {
        await api.put(`/users/${editUser.id}`, form)
        if (form.password) await api.patch(`/users/${editUser.id}/password`, { password: form.password })
      }
      // Sync roles
      if (userId && !isNew) {
        const currentRoles = editUser?.roles || []
        for (const r of selectedRoles) {
          if (!currentRoles.includes(r)) {
            const role = roles.find(x => x.name === r)
            if (role) await api.post(`/users/${userId}/roles`, { role_id: role.id }).catch(() => {})
          }
        }
        for (const r of currentRoles) {
          if (!selectedRoles.includes(r)) {
            const role = roles.find(x => x.name === r)
            if (role) await api.delete(`/users/${userId}/roles/${role.id}`).catch(() => {})
          }
        }
      }
      onSaved()
      onClose()
    } catch (e) { alert(e.response?.data?.error || e.message) }
    setLoading(false)
  }

  const toggleRole = (roleName) => {
    setSelectedRoles(r => r.includes(roleName) ? r.filter(x => x !== roleName) : [...r, roleName])
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Users size={18} color={C.accent}/>
            <span style={{ color: C.gray, fontWeight: 700 }}>{isNew ? 'Novi korisnik' : `Uredi: ${editUser.first_name} ${editUser.last_name}`}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}><X size={18}/></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: '12px 22px 0', borderBottom: `1px solid ${C.border}` }}>
          {[{id:'info',label:'Informacije'},{id:'roles',label:'Uloge & Dozvole'},{id:'security',label:'Sigurnost'}].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '8px 14px',
              color: tab === t.id ? C.accent : C.muted, fontSize: 12, fontWeight: tab === t.id ? 700 : 400,
              borderBottom: `2px solid ${tab === t.id ? C.accent : 'transparent'}`, marginBottom: -1
            }}>{t.label}</button>
          ))}
        </div>

        <div style={{ overflowY: 'auto', padding: '20px 22px', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {tab === 'info' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={S.label}>Ime</label><input value={form.first_name} onChange={e => F('first_name', e.target.value)} style={S.input}/></div>
                <div><label style={S.label}>Prezime</label><input value={form.last_name} onChange={e => F('last_name', e.target.value)} style={S.input}/></div>
              </div>
              <div><label style={S.label}>Korisničko ime *</label><input value={form.username} onChange={e => F('username', e.target.value)} style={S.input} disabled={!isNew}/></div>
              <div><label style={S.label}>Email</label><input type="email" value={form.email} onChange={e => F('email', e.target.value)} style={S.input}/></div>
              <div>
                <label style={S.label}>Osnovna uloga</label>
                <select value={form.role} onChange={e => F('role', e.target.value)} style={S.input}>
                  <option value="company_admin">Administrator sustava</option>
                  <option value="operator">Operater</option>
                  <option value="manager">Manager</option>
                  <option value="technician">Tehničar</option>
                  <option value="viewer">Preglednik</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div onClick={() => F('active', form.active ? 0 : 1)} style={{
                  width: 40, height: 22, borderRadius: 11, background: form.active ? C.green : C.surface3,
                  cursor: 'pointer', position: 'relative', transition: 'background .2s', border: `1px solid ${C.border}`
                }}>
                  <div style={{ position: 'absolute', top: 2, left: form.active ? 20 : 2, width: 16, height: 16, borderRadius: '50%', background: form.active ? '#1a2a28' : C.muted, transition: 'left .2s' }}/>
                </div>
                <span style={{ fontSize: 13, color: form.active ? C.green : C.muted }}>{form.active ? 'Aktivan korisnik' : 'Neaktivan korisnik'}</span>
              </div>
            </>
          )}

          {tab === 'roles' && (
            <div>
              <div style={{ marginBottom: 16, color: C.muted, fontSize: 12 }}>Odaberite RBAC uloge za korisnika. Svaka uloga nosi set dozvola.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {roles.map(role => {
                  const active = selectedRoles.includes(role.name)
                  const color = ROLE_COLORS[role.name] || C.muted
                  return (
                    <div key={role.id} onClick={() => toggleRole(role.name)} style={{
                      background: active ? color+'18' : C.surface2,
                      border: `1px solid ${active ? color : C.border}`,
                      borderRadius: 10, padding: '12px 16px', cursor: 'pointer', transition: 'all .2s'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Shield size={14} color={active ? color : C.muted}/>
                          <span style={{ color: active ? color : C.gray, fontWeight: 700, fontSize: 13 }}>{role.label}</span>
                        </div>
                        <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${active ? color : C.border}`, background: active ? color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {active && <CheckCircle size={12} color="#1a2a28"/>}
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: C.muted }}>{role.description}</div>
                      <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {role.permissions?.slice(0,6).map(p => (
                          <span key={p.name} style={{ fontSize: 9, background: C.surface3, color: C.muted2, padding: '1px 6px', borderRadius: 4 }}>{p.name}</span>
                        ))}
                        {role.permissions?.length > 6 && <span style={{ fontSize: 9, color: C.muted }}>+{role.permissions.length-6} više</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {tab === 'security' && (
            <>
              <div>
                <label style={S.label}>{isNew ? 'Lozinka *' : 'Nova lozinka (ostavite prazno za bez promjene)'}</label>
                <input type="password" value={form.password} onChange={e => F('password', e.target.value)} style={S.input} placeholder={isNew ? 'Min. 4 znaka' : '••••••••'}/>
              </div>
              {!isNew && (
                <div style={{ background: C.surface2, borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>Informacije o računu</div>
                  <div style={{ fontSize: 12, color: C.gray }}>Kreiran: <span style={{ color: C.muted }}>{editUser.created_at?.slice(0,10)}</span></div>
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, padding: '16px 22px', borderTop: `1px solid ${C.border}` }}>
          <button onClick={save} disabled={loading} style={{ ...S.btn(), flex: 1, justifyContent: 'center', opacity: loading ? .6 : 1 }}>
            <Save size={14}/>{loading ? 'Sprema...' : 'Spremi korisnika'}
          </button>
          <button onClick={onClose} style={S.ghost}><X size={14}/> Odustani</button>
        </div>
      </div>
    </div>
  )
}

// ── Permissions viewer ────────────────────────────────────────────────────────
function PermissionsModal({ userId, userName, onClose }) {
  const [perms, setPerms] = useState([])
  const [roles, setRoles] = useState([])
  useEffect(() => {
    api.get(`/users/${userId}`).then(r => {
      setPerms(r.data.permissions || [])
      setRoles(r.data.roles || [])
    })
  }, [userId])

  const byModule = {}
  perms.forEach(p => { if (!byModule[p.module]) byModule[p.module] = []; byModule[p.module].push(p) })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, width: '100%', maxWidth: 500, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <div>
            <div style={{ color: C.gray, fontWeight: 700 }}>Dozvole: {userName}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Uloge: {roles.map(r => r.label).join(', ') || 'Nema'}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}><X size={18}/></button>
        </div>
        <div style={{ overflowY: 'auto', padding: 20 }}>
          {Object.entries(byModule).map(([mod, ps]) => (
            <div key={mod} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: C.accent, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 6 }}>{mod}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {ps.map(p => (
                  <div key={p.name} style={{ background: C.green+'18', border: `1px solid ${C.green}44`, borderRadius: 6, padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <CheckCircle size={10} color={C.green}/>
                    <span style={{ fontSize: 11, color: C.green }}>{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {Object.keys(byModule).length === 0 && <div style={{ color: C.muted, textAlign: 'center', padding: 20 }}>Nema dodijeljenih dozvola</div>}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function UserManagementPage() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [permModal, setPermModal] = useState(null)
  const [search, setSearch] = useState('')
  const [, showToast] = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    const [u, r] = await Promise.all([api.get('/users'), api.get('/users/roles/all').catch(() => ({ data: [] }))])
    setUsers(u.data)
    setRoles(r.data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const deactivate = async (id) => {
    if (!confirm('Deaktivirati korisnika?')) return
    await api.delete(`/users/${id}`)
    load()
  }

  const filtered = users.filter(u =>
    !search || `${u.first_name} ${u.last_name} ${u.username} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.gray, letterSpacing: 1 }}>Upravljanje korisnicima</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>RBAC uloge · Dozvole · Kreiranje korisnika</div>
        </div>
        <button onClick={() => setModal('new')} style={S.btn()}>
          <Plus size={15}/> Novi korisnik
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
        <div style={{ ...S.card, borderTop: `3px solid ${C.teal}`, padding: '14px 18px' }}>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1.2, textTransform: 'uppercase' }}>Ukupno korisnika</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: C.teal }}>{users.length}</div>
        </div>
        <div style={{ ...S.card, borderTop: `3px solid ${C.green}`, padding: '14px 18px' }}>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1.2, textTransform: 'uppercase' }}>Aktivni</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: C.green }}>{users.filter(u => u.active).length}</div>
        </div>
        <div style={{ ...S.card, borderTop: `3px solid ${C.accent}`, padding: '14px 18px' }}>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1.2, textTransform: 'uppercase' }}>Uloge</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: C.accent }}>{roles.length}</div>
        </div>
      </div>

      {/* Table */}
      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${C.border}` }}>
          <Users size={15} color={C.accent}/>
          <span style={{ color: C.gray, fontWeight: 600 }}>Korisnici</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pretraži..." style={{ ...S.input, width: 200, padding: '6px 10px', marginLeft: 'auto' }}/>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: C.surface2 }}>
            <tr>
              {['Korisnik', 'Korisničko ime', 'Email', 'Osnovna uloga', 'RBAC uloge', 'Status', ''].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', padding: 30 }}>Učitavanje...</td></tr>}
            {filtered.map(u => (
              <tr key={u.id} style={{ transition: 'background .15s' }}
                onMouseOver={e => e.currentTarget.style.background = C.surface2}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                <td style={S.td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${C.accent}22`, border: `1px solid ${C.accent}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>{(u.first_name?.[0] || '?').toUpperCase()}</span>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: C.gray }}>{u.first_name} {u.last_name}</div>
                    </div>
                  </div>
                </td>
                <td style={{ ...S.td, color: C.muted, fontFamily: 'monospace', fontSize: 12 }}>{u.username}</td>
                <td style={{ ...S.td, fontSize: 12 }}>{u.email || '—'}</td>
                <td style={S.td}>
                  <span style={{ background: C.surface3, color: C.muted, borderRadius: 6, padding: '2px 8px', fontSize: 11 }}>{u.role}</span>
                </td>
                <td style={S.td}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {u.roles?.length > 0
                      ? u.roles.map((r, i) => <RoleBadge key={i} name={r} label={u.roles_labels?.[i] || r}/>)
                      : <span style={{ fontSize: 11, color: C.muted }}>—</span>}
                  </div>
                </td>
                <td style={S.td}>
                  {u.active
                    ? <span style={{ color: C.green, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}><UserCheck size={13}/> Aktivan</span>
                    : <span style={{ color: C.muted, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}><UserX size={13}/> Neaktivan</span>}
                </td>
                <td style={{ ...S.td }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => setPermModal(u)} title="Dozvole" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 3 }}
                      onMouseOver={e => e.currentTarget.style.color = C.blue} onMouseOut={e => e.currentTarget.style.color = C.muted}>
                      <Shield size={13}/>
                    </button>
                    <button onClick={() => setModal(u)} title="Uredi" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 3 }}
                      onMouseOver={e => e.currentTarget.style.color = C.accent} onMouseOut={e => e.currentTarget.style.color = C.muted}>
                      <Edit2 size={13}/>
                    </button>
                    {u.id !== me?.id && (
                      <button onClick={() => deactivate(u.id)} title="Deaktiviraj" style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 3 }}
                        onMouseOver={e => e.currentTarget.style.color = C.red} onMouseOut={e => e.currentTarget.style.color = C.muted}>
                        <Lock size={13}/>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {modal && (
        <UserModal
          user={modal === 'new' ? null : modal}
          roles={roles}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}
      {permModal && (
        <PermissionsModal
          userId={permModal.id}
          userName={`${permModal.first_name} ${permModal.last_name}`}
          onClose={() => setPermModal(null)}
        />
      )}
    </div>
  )
}

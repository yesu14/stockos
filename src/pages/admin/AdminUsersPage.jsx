import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import {
  CheckCircle, Trash2, ChevronDown, ChevronRight,
  Clock, Search, Pencil, X, Save, Shield,
  Monitor, MapPin, Wifi
} from 'lucide-react'
import toast from 'react-hot-toast'

const ROLES = ['viewer', 'manager', 'admin']
const ROLE_LABELS = { viewer: '일반사용자', manager: '매니저', admin: '관리자', pending: '대기중' }
const ROLE_COLORS = { viewer: 'text-surface-300 bg-surface-700', manager: 'text-blue-400 bg-blue-500/20', admin: 'text-purple-400 bg-purple-500/20', pending: 'text-yellow-400 bg-yellow-500/20' }

function parseUA(ua = '') {
  if (!ua) return { device: '알수없음', browser: '', os: '' }
  let device = '데스크탑', os = '', browser = ''
  if (/iPhone/.test(ua)) device = 'iPhone'
  else if (/iPad/.test(ua)) device = 'iPad'
  else if (/Android/.test(ua)) device = 'Android'
  if (/Windows NT/.test(ua)) os = 'Windows'
  else if (/Mac OS X/.test(ua)) os = 'macOS'
  else if (/Linux/.test(ua)) os = 'Linux'
  else if (/Android/.test(ua)) os = 'Android'
  else if (/iOS|iPhone|iPad/.test(ua)) os = 'iOS'
  if (/Chrome\//.test(ua) && !/Chromium|Edg/.test(ua)) browser = 'Chrome'
  else if (/Edg\//.test(ua)) browser = 'Edge'
  else if (/Firefox\//.test(ua)) browser = 'Firefox'
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = 'Safari'
  return { device, os, browser }
}

// IP → 한글 위치 변환 (ip-api.com 무료, HTTP)
const geoCache = {}
async function geocodeIP(ip) {
  if (!ip || ['localhost', '127.0.0.1', '::1', ''].includes(ip)) return null
  if (geoCache[ip] !== undefined) return geoCache[ip]
  try {
    // ip-api.com 는 http만 무료 지원 (https는 유료)
    const res = await fetch(`http://ip-api.com/json/${ip}?lang=ko&fields=status,regionName,city`)
    if (!res.ok) { geoCache[ip] = null; return null }
    const d = await res.json()
    if (d.status === 'success') {
      const loc = [d.regionName, d.city].filter(Boolean).join(' ')
      geoCache[ip] = loc || null
    } else {
      geoCache[ip] = null
    }
  } catch {
    geoCache[ip] = null
  }
  return geoCache[ip]
}

async function enrichLogsWithLocation(logs) {
  const enriched = [...logs]
  for (const log of enriched) {
    if (!log.location && log.ip_address) {
      const loc = await geocodeIP(log.ip_address)
      if (loc) {
        log.location = loc
        // 백그라운드로 DB 저장
        supabase.from('login_logs').update({ location: loc }).eq('id', log.id).then(() => {})
      }
    }
  }
  return enriched
}

function LogRow({ log }) {
  const { device, os, browser } = parseUA(log.device_info)
  const dt = new Date(log.created_at)
  const dateStr = dt.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
  const timeStr = dt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return (
    <div className="grid grid-cols-12 gap-2 px-3 py-2.5 border-b border-surface-700/30 last:border-0 hover:bg-surface-700/20 transition-colors text-xs">
      <div className="col-span-2 text-surface-300">
        <div className="font-medium">{dateStr}</div>
        <div className="text-surface-500">{timeStr}</div>
      </div>
      <div className="col-span-2 flex items-start gap-1 text-surface-300 pt-0.5">
        {log.ip_address
          ? <><Wifi size={10} className="text-surface-500 shrink-0 mt-0.5" /><span className="font-mono break-all">{log.ip_address}</span></>
          : <span className="text-surface-600">-</span>}
      </div>
      <div className="col-span-3 flex items-center gap-1 text-surface-300">
        {log.location
          ? <><MapPin size={10} className="text-rose-400 shrink-0" /><span className="text-emerald-300">{log.location}</span></>
          : <span className="text-surface-600 text-[10px]">위치 없음</span>}
      </div>
      <div className="col-span-3 text-surface-300">
        <div className="flex items-center gap-1">
          <Monitor size={10} className="text-surface-500 shrink-0" />
          <span>{device}</span>
          {os && <span className="text-surface-500">/ {os}</span>}
        </div>
        {browser && <div className="text-surface-500 ml-4">{browser}</div>}
      </div>
      <div className="col-span-2 flex items-center justify-end">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${log.success !== false ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
          {log.success !== false ? '성공' : '실패'}
        </span>
      </div>
    </div>
  )
}

function EditModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState({ name: user.name || '', role: user.role || 'viewer', is_approved: user.is_approved || false })
  const [saving, setSaving] = useState(false)
  async function save() {
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ name: form.name, role: form.role, is_approved: form.is_approved }).eq('id', user.id)
    setSaving(false)
    if (error) toast.error(error.message)
    else { toast.success('저장됨'); onSaved() }
  }
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-900 border border-surface-700 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">사용자 편집</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-white"><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-surface-400 mb-1 block">이름</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500" />
          </div>
          <div>
            <label className="text-xs text-surface-400 mb-1 block">이메일</label>
            <input value={user.email || ''} disabled className="w-full bg-surface-800/50 border border-surface-700 rounded-xl px-3 py-2 text-sm text-surface-500 cursor-not-allowed" />
          </div>
          <div>
            <label className="text-xs text-surface-400 mb-1 block">권한</label>
            <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
              className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500">
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_approved} onChange={e => setForm(p => ({ ...p, is_approved: e.target.checked }))} className="w-4 h-4 accent-primary-500" />
            <span className="text-sm text-surface-300">승인됨</span>
          </label>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 bg-surface-700 hover:bg-surface-600 text-surface-300 rounded-xl text-sm font-medium">취소</button>
          <button onClick={save} disabled={saving} className="flex-1 flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold">
            <Save size={14} />{saving ? '...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [loginLogs, setLoginLogs] = useState([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [editUser, setEditUser] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [allLogs, setAllLogs] = useState([])
  const [allLogsLoading, setAllLogsLoading] = useState(false)
  const [viewMode, setViewMode] = useState('users')

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
      if (error) toast.error('사용자 목록 로드 실패')
      setUsers(data || [])
    } catch(err) { console.error(err) }
    setLoading(false)
  }

  async function approveUser(userId, approve) {
    const { error } = await supabase.from('profiles').update({ is_approved: approve, role: approve ? 'manager' : 'pending' }).eq('id', userId)
    if (error) toast.error(error.message)
    else { toast.success(approve ? '승인 완료' : '거절 완료'); loadUsers() }
  }

  async function deleteUser(userId) {
    const { error } = await supabase.from('profiles').delete().eq('id', userId)
    if (error) toast.error(error.message)
    else { toast.success('삭제 완료'); setConfirmDelete(null); loadUsers() }
  }

  async function loadLogs(userId) {
    if (expandedId === userId) { setExpandedId(null); return }
    setExpandedId(userId); setLogsLoading(true)
    try {
      const { data } = await supabase.from('login_logs').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50)
      const enriched = await enrichLogsWithLocation(data || [])
      setLoginLogs(enriched)
    } catch(err) { console.error(err) }
    setLogsLoading(false)
  }

  async function loadAllLogs() {
    setAllLogsLoading(true)
    try {
      // Step 1: login_logs만 조회 (profiles JOIN 오류 방지)
      const { data: logData, error: logErr } = await supabase
        .from('login_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
      if (logErr) { toast.error('로그 로드 실패: ' + logErr.message); setAllLogsLoading(false); return }

      // Step 2: profiles 별도 조회 후 매핑
      const userIds = [...new Set((logData || []).map(l => l.user_id).filter(Boolean))]
      let profileMap = {}
      if (userIds.length > 0) {
        const { data: profData } = await supabase.from('profiles').select('id, name, email').in('id', userIds)
        ;(profData || []).forEach(p => { profileMap[p.id] = p })
      }
      const logs = (logData || []).map(l => ({ ...l, _profile: profileMap[l.user_id] || null }))

      // Step 3: IP → 한글 위치 변환
      const enriched = await enrichLogsWithLocation(logs)
      setAllLogs(enriched)
    } catch(err) { console.error(err); toast.error('오류: ' + err.message) }
    setAllLogsLoading(false)
  }

  useEffect(() => { if (viewMode === 'all-logs') loadAllLogs() }, [viewMode])

  const filtered = users.filter(u => {
    if (search && !u.email?.toLowerCase().includes(search.toLowerCase()) && !u.name?.toLowerCase().includes(search.toLowerCase())) return false
    if (filterStatus === 'pending' && u.is_approved) return false
    if (filterStatus === 'approved' && !u.is_approved) return false
    return true
  })
  const pendingCount = users.filter(u => !u.is_approved).length

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Shield size={22} className="text-purple-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">사용자 관리</h1>
            <p className="text-surface-400 text-sm mt-0.5">전체 {users.length}명 {pendingCount > 0 && <span className="text-yellow-400">· {pendingCount}명 승인 대기</span>}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setViewMode('users')} className={'px-4 py-2 rounded-xl text-sm font-medium transition-colors ' + (viewMode === 'users' ? 'bg-primary-500 text-white' : 'bg-surface-800 text-surface-400 hover:text-white')}>
            사용자 목록
          </button>
          <button onClick={() => setViewMode('all-logs')} className={'px-4 py-2 rounded-xl text-sm font-medium transition-colors ' + (viewMode === 'all-logs' ? 'bg-primary-500 text-white' : 'bg-surface-800 text-surface-400 hover:text-white')}>
            전체 로그인 기록
          </button>
          <a href="/admin/menus" className="px-4 py-2 rounded-xl text-sm font-medium transition-colors bg-surface-800 text-surface-400 hover:text-white">
            메뉴 관리
          </a>
        </div>
      </div>

      {pendingCount > 0 && viewMode === 'users' && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-yellow-300 text-sm font-medium">⚠️ {pendingCount}명의 회원가입 승인이 필요합니다</span>
          <button onClick={() => setFilterStatus('pending')} className="ml-auto px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 rounded-lg text-xs font-medium transition-colors">대기 목록 보기</button>
        </div>
      )}

      {/* ── 전체 로그인 기록 ── */}
      {viewMode === 'all-logs' && (
        <div className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-800 flex items-center justify-between">
            <h2 className="font-semibold text-white text-sm">전체 로그인 기록 (최근 200건)</h2>
            <button onClick={loadAllLogs} className="text-xs text-primary-400 hover:text-primary-300">새로고침</button>
          </div>
          <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-surface-800/40 text-xs font-semibold text-surface-500 uppercase tracking-wide border-b border-surface-800">
            <div className="col-span-2">사용자</div>
            <div className="col-span-2">날짜/시간</div>
            <div className="col-span-2">IP 주소</div>
            <div className="col-span-3">위치</div>
            <div className="col-span-3">디바이스</div>
          </div>
          {allLogsLoading ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : allLogs.length === 0 ? (
            <p className="text-center py-8 text-surface-500 text-sm">로그인 기록이 없습니다</p>
          ) : (
            <div className="max-h-[65vh] overflow-y-auto">
              {allLogs.map(log => {
                const { device, os, browser } = parseUA(log.device_info)
                const dt = new Date(log.created_at)
                return (
                  <div key={log.id} className="grid grid-cols-12 gap-2 px-3 py-2.5 border-b border-surface-800/40 hover:bg-surface-800/20 transition-colors text-xs">
                    <div className="col-span-2 text-surface-300">
                      <div className="font-medium truncate">{log._profile?.name || '-'}</div>
                      <div className="text-surface-500 truncate">{log._profile?.email || '-'}</div>
                    </div>
                    <div className="col-span-2 text-surface-300">
                      <div>{dt.toLocaleDateString('ko-KR')}</div>
                      <div className="text-surface-500">{dt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                    </div>
                    <div className="col-span-2 flex items-start gap-1 text-surface-300 pt-0.5">
                      {log.ip_address ? <><Wifi size={10} className="text-surface-500 shrink-0 mt-0.5" /><span className="font-mono break-all">{log.ip_address}</span></> : <span className="text-surface-600">-</span>}
                    </div>
                    <div className="col-span-3 flex items-center gap-1 text-surface-300">
                      {log.location
                        ? <><MapPin size={10} className="text-rose-400 shrink-0" /><span className="text-emerald-300">{log.location}</span></>
                        : <span className="text-surface-600 text-[10px]">-</span>}
                    </div>
                    <div className="col-span-2 text-surface-300">
                      <div>{device}{os ? ` / ${os}` : ''}</div>
                      {browser && <div className="text-surface-500">{browser}</div>}
                    </div>
                    <div className="col-span-1 flex items-center justify-end">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${log.success !== false ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        {log.success !== false ? '성공' : '실패'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 사용자 목록 ── */}
      {viewMode === 'users' && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="이름 또는 이메일 검색..."
                className="w-full bg-surface-800 border border-surface-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-primary-500" />
            </div>
            {['all', 'pending', 'approved'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={'px-3 py-2 rounded-xl text-xs font-medium transition-colors ' + (filterStatus === s ? 'bg-primary-500 text-white' : 'bg-surface-800 text-surface-400 hover:text-white')}>
                {s === 'all' ? '전체' : s === 'pending' ? '대기중' : '승인됨'}
              </button>
            ))}
          </div>

          <div className="bg-surface-900 border border-surface-800 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-surface-800/50 border-b border-surface-800 text-xs font-semibold text-surface-400 uppercase tracking-wide">
              <div className="col-span-3">이름 / 이메일</div>
              <div className="col-span-2">상태</div>
              <div className="col-span-2">권한</div>
              <div className="col-span-2">가입일</div>
              <div className="col-span-3 text-right">작업</div>
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10 text-surface-500 text-sm">사용자가 없습니다</div>
            ) : (
              <div>
                {filtered.map(u => (
                  <div key={u.id} className="border-b border-surface-800 last:border-0">
                    <div className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-surface-800/20 items-center transition-colors">
                      <div className="col-span-3">
                        <p className="text-sm font-medium text-white">{u.name || '-'}</p>
                        <p className="text-xs text-surface-400 truncate">{u.email}</p>
                      </div>
                      <div className="col-span-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.is_approved ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                          {u.is_approved ? '승인됨' : '대기중'}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role] || ROLE_COLORS.pending}`}>
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </div>
                      <div className="col-span-2 text-xs text-surface-400">{new Date(u.created_at).toLocaleDateString('ko-KR')}</div>
                      <div className="col-span-3 flex items-center justify-end gap-1 flex-wrap">
                        {!u.is_approved && (
                          <button onClick={() => approveUser(u.id, true)}
                            className="flex items-center gap-1 px-2 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-xs font-medium transition-colors">
                            <CheckCircle size={11} /> 승인
                          </button>
                        )}
                        <button onClick={() => loadLogs(u.id)}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${expandedId === u.id ? 'bg-primary-500/20 text-primary-400' : 'bg-surface-700 hover:bg-surface-600 text-surface-400'}`}>
                          <Clock size={11} /> 로그인 기록
                          {expandedId === u.id ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                        </button>
                        <button onClick={() => setEditUser(u)}
                          className="flex items-center gap-1 px-2 py-1.5 bg-surface-700 hover:bg-surface-600 text-surface-400 hover:text-white rounded-lg text-xs font-medium transition-colors">
                          <Pencil size={11} /> 편집
                        </button>
                        <button onClick={() => setConfirmDelete(u)}
                          className="p-1.5 hover:bg-red-500/10 text-surface-500 hover:text-red-400 rounded-lg transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {expandedId === u.id && (
                      <div className="border-t border-surface-800/50 bg-surface-800/10">
                        <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-surface-800/30 text-[10px] font-semibold text-surface-500 uppercase tracking-wide border-b border-surface-700/30">
                          <div className="col-span-2">날짜/시간</div>
                          <div className="col-span-2">IP 주소</div>
                          <div className="col-span-3">위치</div>
                          <div className="col-span-3">디바이스</div>
                          <div className="col-span-2 text-right">결과</div>
                        </div>
                        {logsLoading ? (
                          <div className="flex justify-center py-3"><div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
                        ) : loginLogs.length === 0 ? (
                          <p className="text-xs text-surface-500 px-4 py-3">로그인 기록 없음</p>
                        ) : (
                          <div className="max-h-60 overflow-y-auto">
                            {loginLogs.map(log => <LogRow key={log.id} log={log} />)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {editUser && <EditModal user={editUser} onClose={() => setEditUser(null)} onSaved={() => { setEditUser(null); loadUsers() }} />}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-900 border border-surface-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center"><Trash2 size={18} className="text-red-400" /></div>
              <p className="text-white font-semibold">사용자 삭제</p>
            </div>
            <p className="text-surface-300 text-sm mb-1"><span className="text-white font-semibold">{confirmDelete.name}</span> ({confirmDelete.email})</p>
            <p className="text-surface-500 text-xs mb-6">이 사용자를 삭제하면 복구할 수 없습니다.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 bg-surface-700 hover:bg-surface-600 text-surface-300 rounded-xl text-sm font-medium">취소</button>
              <button onClick={() => deleteUser(confirmDelete.id)} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium">삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

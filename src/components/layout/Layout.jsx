import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { THEMES } from '../../context/ThemeContext'
import {
  LayoutDashboard, Package, Boxes, Shield, Menu as MenuIcon,
  LogOut, X, Bell, BellRing, PanelLeftClose, PanelLeftOpen,
  RotateCcw, ShoppingCart, ArrowDownCircle, ArrowUpCircle,
  Settings, Star, FileText, Bell as BellIcon, Tag, Layers,
  Palette, BarChart2
} from 'lucide-react'

const ROLE_LABELS = { admin: '관리자', manager: '매니저', viewer: '일반사용자', pending: '승인대기' }
const ICON_MAP = {
  LayoutDashboard, Package, Boxes, Shield,
  RotateCcw, ShoppingCart, ArrowDownCircle, ArrowUpCircle,
  Settings, Star, FileText, Bell: BellIcon, Tag, Layers, BarChart2
}
function getIcon(name) { return ICON_MAP[name] || Package }

const FALLBACK_MENUS = [
  { id: 'f1', menu_key: 'dashboard', label: '대시보드', url: '/dashboard', icon_name: 'LayoutDashboard', required_role: 'viewer',  sort_order: 1 },
  { id: 'f2', menu_key: 'products',  label: '상품관리',  url: '/products',  icon_name: 'Package',         required_role: 'manager', sort_order: 2 },
  { id: 'f3', menu_key: 'inventory', label: '재고관리',  url: '/inventory', icon_name: 'Boxes',           required_role: 'viewer',  sort_order: 3 },
  { id: 'f4', menu_key: 'inbound',   label: '입고관리',  url: '/inbound',   icon_name: 'ArrowDownCircle', required_role: 'manager', sort_order: 4 },
  { id: 'f5', menu_key: 'outbound',  label: '납품관리',  url: '/outbound',  icon_name: 'ArrowUpCircle',   required_role: 'manager', sort_order: 5 },
  { id: 'f6', menu_key: 'returns',   label: '반품관리',  url: '/returns',   icon_name: 'RotateCcw',       required_role: 'manager', sort_order: 6 },
  { id: 'f7', menu_key: 'sales',     label: '오늘판매',  url: '/sales',     icon_name: 'ShoppingCart',    required_role: 'viewer',  sort_order: 7 },
  { id: 'f8', menu_key: 'charts',    label: '차트',      url: '/charts',    icon_name: 'BarChart2',       required_role: 'viewer',  sort_order: 8 },
]
const ROLE_LVL = { admin: 3, manager: 2, viewer: 1 }

// ── Cyan SVG 로고 ─────────────────────────────────────────
function StockOSLogo({ collapsed }) {
  return collapsed ? (
    <div className="w-8 h-8 shrink-0 flex items-center justify-center">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="cg1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4"/>
            <stop offset="100%" stopColor="#0e7490"/>
          </linearGradient>
          <filter id="glow1">
            <feGaussianBlur stdDeviation="1.5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        {/* Hexagon bg */}
        <path d="M16 2 L28 9 L28 23 L16 30 L4 23 L4 9 Z" fill="url(#cg1)" opacity="0.15"/>
        <path d="M16 2 L28 9 L28 23 L16 30 L4 23 L4 9 Z" fill="none" stroke="#06b6d4" strokeWidth="1.2" opacity="0.8"/>
        {/* S shape */}
        <text x="16" y="21" textAnchor="middle" fill="#06b6d4" fontSize="14" fontWeight="800" fontFamily="system-ui" filter="url(#glow1)">S</text>
        {/* Corner accent dots */}
        <circle cx="16" cy="3.5" r="1.2" fill="#06b6d4" opacity="0.9"/>
        <circle cx="27" cy="9.5" r="1.2" fill="#06b6d4" opacity="0.6"/>
        <circle cx="27" cy="22.5" r="1.2" fill="#06b6d4" opacity="0.6"/>
        <circle cx="16" cy="28.5" r="1.2" fill="#06b6d4" opacity="0.9"/>
      </svg>
    </div>
  ) : (
    <div className="flex items-center gap-2.5 shrink-0">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="cg2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee"/>
            <stop offset="100%" stopColor="#0891b2"/>
          </linearGradient>
          <linearGradient id="cg3" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#cffafe"/>
            <stop offset="100%" stopColor="#06b6d4"/>
          </linearGradient>
          <filter id="glow2">
            <feGaussianBlur stdDeviation="1.5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="shadow2" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#06b6d4" floodOpacity="0.4"/>
          </filter>
        </defs>
        {/* Hexagon bg glow */}
        <path d="M16 1.5 L29 8.75 L29 23.25 L16 30.5 L3 23.25 L3 8.75 Z" fill="url(#cg2)" opacity="0.12" filter="url(#shadow2)"/>
        {/* Hexagon border */}
        <path d="M16 1.5 L29 8.75 L29 23.25 L16 30.5 L3 23.25 L3 8.75 Z" fill="none" stroke="url(#cg2)" strokeWidth="1.5" opacity="0.9"/>
        {/* Inner highlight */}
        <path d="M16 5 L26 11 L26 21 L16 27 L6 21 L6 11 Z" fill="none" stroke="#22d3ee" strokeWidth="0.5" opacity="0.3"/>
        {/* Center S letter */}
        <text x="16" y="22" textAnchor="middle" fill="url(#cg3)" fontSize="15" fontWeight="900"
          fontFamily="system-ui, -apple-system, sans-serif" filter="url(#glow2)" letterSpacing="-0.5">S</text>
        {/* Vertex accent dots */}
        <circle cx="16" cy="1.5"  r="1.5" fill="#22d3ee" opacity="1"/>
        <circle cx="29" cy="8.75" r="1.2" fill="#22d3ee" opacity="0.7"/>
        <circle cx="29" cy="23.25" r="1.2" fill="#22d3ee" opacity="0.7"/>
        <circle cx="16" cy="30.5" r="1.5" fill="#22d3ee" opacity="1"/>
        <circle cx="3"  cy="23.25" r="1.2" fill="#22d3ee" opacity="0.7"/>
        <circle cx="3"  cy="8.75" r="1.2" fill="#22d3ee" opacity="0.7"/>
        {/* Scan line */}
        <line x1="8" y1="16" x2="24" y2="16" stroke="#22d3ee" strokeWidth="0.6" opacity="0.25" strokeDasharray="2 2"/>
      </svg>
      <div className="flex flex-col leading-none">
        <span className="font-black text-[15px] tracking-wider" style={{
          background: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 50%, #0891b2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          letterSpacing: '0.08em'
        }}>STOCK</span>
        <span className="font-black text-[15px] tracking-wider" style={{
          background: 'linear-gradient(135deg, #67e8f9 0%, #22d3ee 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          letterSpacing: '0.12em',
          marginTop: '-1px'
        }}>OS</span>
      </div>
    </div>
  )
}

export default function Layout() {
  const { profile, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar_collapsed') === 'true' } catch { return false }
  })
  const [alertCount, setAlertCount] = useState(0)
  const [dbMenus, setDbMenus] = useState(null)
  const [theme, setThemeState] = useState(() => {
    try { return localStorage.getItem('stockos_theme') || 'dark' } catch { return 'dark' }
  })
  const [showThemePicker, setShowThemePicker] = useState(false)

  useEffect(() => { loadAlertCount() }, [location.pathname])
  useEffect(() => { loadMenus() }, [])
  useEffect(() => { applyTheme(theme) }, [])

  useEffect(() => {
    if (!showThemePicker) return
    function handle(e) { if (!e.target.closest('[data-theme-picker]')) setShowThemePicker(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [showThemePicker])

  function applyTheme(t) {
    const root = document.documentElement
    Object.values(THEMES).forEach(td => root.classList.remove(td.classes))
    const themeData = THEMES[t] || THEMES.dark
    root.classList.add(themeData.classes)
    try { localStorage.setItem('stockos_theme', t) } catch {}
  }
  function setTheme(t) { setThemeState(t); applyTheme(t) }

  async function loadMenus() {
    try {
      const { data } = await supabase.from('menus').select('*').eq('is_active', true).order('sort_order')
      setDbMenus(data && data.length > 0 ? data : null)
    } catch { setDbMenus(null) }
  }

  async function loadAlertCount() {
    try {
      const { data: alerts } = await supabase.from('stock_alerts').select('product_sku_id, threshold').eq('is_active', true)
      if (!alerts?.length) { setAlertCount(0); return }
      const skuIds = alerts.map(a => a.product_sku_id).filter(Boolean)
      if (!skuIds.length) { setAlertCount(0); return }
      const { data: skus } = await supabase.from('product_skus').select('id, stock').in('id', skuIds).eq('is_active', true)
      const stockMap = Object.fromEntries((skus || []).map(s => [s.id, s.stock]))
      setAlertCount(alerts.filter(a => (stockMap[a.product_sku_id] ?? 0) <= a.threshold).length)
    } catch { setAlertCount(0) }
  }

  function toggleCollapse() {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem('sidebar_collapsed', String(next)) } catch {}
  }
  async function handleLogout() { await logout(); navigate('/login') }

  const role = profile?.role || 'viewer'
  const userLvl = ROLE_LVL[role] || 0
  const sourceMenus = dbMenus || FALLBACK_MENUS
  const visibleMenus = sourceMenus.filter(m => (ROLE_LVL[m.required_role] || 1) <= userLvl)
  const adminMenu = role === 'admin'
    ? [{ id: '_admin', label: '관리자', url: '/admin/users', icon_name: 'Shield', required_role: 'admin' }]
    : []
  const allMenus = [...visibleMenus, ...adminMenu]

  // ── 테마 선택기 ──────────────────────────────────────────
  function ThemePicker({ isMobile = false }) {
    const isIconOnly = collapsed && !isMobile
    return (
      <div className="relative" data-theme-picker>
        <button onClick={() => setShowThemePicker(p => !p)} title="테마 변경"
          className={isIconOnly
            ? 'flex items-center justify-center p-2.5 rounded-xl transition-colors text-surface-400 hover:bg-primary-500/10 hover:text-surface-50 w-full'
            : 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors w-full text-surface-300 hover:bg-primary-500/10 hover:text-surface-50'}>
          <Palette size={isIconOnly ? 18 : 17} className="shrink-0" />
          {!isIconOnly && <>테마 변경<span className="ml-auto text-xs text-surface-500">{THEMES[theme]?.name || ''}</span></>}
        </button>
        {showThemePicker && (
          <div className={`absolute ${isIconOnly ? 'left-full ml-2 bottom-0' : 'bottom-full left-0 mb-1'} w-52 bg-surface-900 border border-surface-700 rounded-xl shadow-2xl z-50 p-1.5`}>
            <p className="text-[10px] text-surface-500 px-2 py-1 font-medium uppercase tracking-wide">테마 선택</p>
            {Object.entries(THEMES).map(([key, td]) => (
              <button key={key} onClick={() => { setTheme(key); setShowThemePicker(false) }}
                className={'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ' +
                  (theme === key ? 'bg-primary-500/20 text-primary-400 font-semibold' : 'text-surface-300 hover:bg-primary-500/10 hover:text-surface-50')}>
                <div className="w-4 h-4 rounded-full border border-surface-600 shrink-0" style={{ background: td.primary }} />
                {td.name}
                {theme === key && <span className="ml-auto">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  function SidebarContent({ onNav, isMobile = false }) {
    const isIconOnly = collapsed && !isMobile
    return (
      <div className="flex flex-col h-full">

        {/* ── 로고 헤더 ── */}
        <div className={`flex items-center shrink-0 ${isIconOnly ? 'px-3 py-4 justify-center' : 'px-4 py-4'}`} style={{borderBottom:'1px solid rgba(6,182,212,0.35)',background:'rgba(6,182,212,0.07)'}}>
          <StockOSLogo collapsed={isIconOnly} />
          <div className="flex-1" />
          {!isMobile && (
            <button onClick={toggleCollapse} title={isIconOnly ? '메뉴 펼치기' : '메뉴 접기'}
              className="text-surface-500 hover:text-surface-200 transition-colors ml-1 shrink-0">
              {isIconOnly ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
            </button>
          )}
          {isMobile && (
            <button onClick={() => setMobileSidebarOpen(false)} className="text-surface-400 hover:text-surface-50 ml-1"><X size={18} /></button>
          )}
        </div>

        {/* ── 메뉴 ── */}
        <nav className={`flex-1 py-3 overflow-y-auto overflow-x-hidden space-y-0.5 ${isIconOnly ? 'px-2' : 'px-3'}`}>
          {allMenus.map(menu => {
            const Icon = getIcon(menu.icon_name)
            if (isIconOnly) {
              return (
                <NavLink key={menu.id} to={menu.url} onClick={onNav} title={menu.label}
                  className={({ isActive }) =>
                    'flex items-center justify-center p-2.5 rounded-xl transition-colors ' +
                    (isActive ? 'bg-primary-500/20 text-primary-400' : 'text-surface-400 hover:bg-primary-500/10 hover:text-surface-50')
                  }>
                  <Icon size={18} />
                </NavLink>
              )
            }
            return (
              <NavLink key={menu.id} to={menu.url} onClick={onNav}
                className={({ isActive }) =>
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ' +
                  (isActive ? 'bg-primary-500/20 text-primary-400' : 'text-surface-300 hover:bg-primary-500/10 hover:text-surface-50')
                }>
                <Icon size={17} className="shrink-0" />
                {menu.label}
              </NavLink>
            )
          })}
        </nav>


      </div>
    )
  }

  // ── 헤더 오른쪽 유저 아바타 ───────────────────────────────
  function UserAvatar() {
    const [showMenu, setShowMenu] = useState(false)
    useEffect(() => {
      if (!showMenu) return
      function h(e) { if (!e.target.closest('[data-user-menu]')) setShowMenu(false) }
      document.addEventListener('mousedown', h)
      return () => document.removeEventListener('mousedown', h)
    }, [showMenu])
    return (
      <div className="relative" data-user-menu>
        <button onClick={() => setShowMenu(p => !p)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-primary-500/10 transition-colors group">
          <div className="relative">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md"
              style={{ background: 'linear-gradient(135deg, #22d3ee, #0891b2)' }}>
              {profile?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            {alertCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full flex items-center justify-center text-white text-[8px] font-bold shadow">
                {alertCount > 9 ? '9+' : alertCount}
              </span>
            )}
          </div>
          <div className="hidden sm:block text-left leading-none">
            <p className="text-xs font-semibold text-white">{profile?.name || '사용자'}</p>
            <p className="text-[10px] text-surface-400 mt-0.5">{ROLE_LABELS[profile?.role] || role}</p>
          </div>
        </button>
        {showMenu && (
          <div className="absolute right-0 top-full mt-1 w-44 bg-surface-900 rounded-xl shadow-2xl z-50 p-1.5 border-cyber">
            <div className="px-3 py-2 border-b border-surface-800 mb-1">
              <p className="text-xs font-semibold text-white truncate">{profile?.name}</p>
              <p className="text-[10px] text-surface-400 truncate">{profile?.email}</p>
            </div>
            <button onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-colors">
              <LogOut size={13} /> 로그아웃
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-surface-950 text-white overflow-hidden">
      <aside className={`hidden lg:flex flex-col sidebar-bg shrink-0 transition-all duration-300 ${collapsed ? 'w-14' : 'w-64'}`}>
        <SidebarContent onNav={() => {}} />
      </aside>
      {mobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setMobileSidebarOpen(false)} />
          <aside className="relative w-64 flex flex-col sidebar-bg h-full z-50 shadow-2xl">
            <SidebarContent onNav={() => setMobileSidebarOpen(false)} isMobile />
          </aside>
        </div>
      )}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative" style={{background:'rgb(var(--surface-950))'}}>
        {/* ── 상단 헤더 ── */}
        <header className="flex items-center gap-2 px-5 py-3 header-bg shrink-0">
          <button onClick={() => setMobileSidebarOpen(true)} className="lg:hidden text-surface-400 hover:text-primary-500">
            <MenuIcon size={22} />
          </button>
          <div className="flex-1" />
          {/* 재고부족 알림 */}
          {alertCount > 0 && (
            <button onClick={() => navigate('/stock-alerts')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all hover:scale-105" style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',color:'#f87171',boxShadow:'0 0 10px rgba(239,68,68,0.15)'}}>
              <Bell size={12} />
              <span>재고부족 {alertCount}개</span>
            </button>
          )}
          {/* 테마 버튼 */}
          <div className="relative" data-theme-picker>
            <button onClick={() => setShowThemePicker(p => !p)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all hover:scale-105 text-surface-400 hover:text-primary-400 border-cyber bg-surface-800/50"
              title="테마 변경">
              <Palette size={14} />
              <span className="hidden sm:inline">{THEMES[theme]?.name || '테마'}</span>
            </button>
            {showThemePicker && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-surface-900 rounded-xl shadow-2xl z-50 p-1.5 border-cyber">
                <p className="text-[10px] text-surface-500 px-2 py-1 font-medium uppercase tracking-wide">테마 선택</p>
                {Object.entries(THEMES).map(([key, td]) => (
                  <button key={key} onClick={() => { setTheme(key); setShowThemePicker(false) }}
                    className={'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ' +
                      (theme === key ? 'bg-primary-500/20 text-primary-400 font-semibold' : 'text-surface-300 hover:bg-primary-500/10 hover:text-surface-50')}>
                    <div className="w-4 h-4 rounded-full border border-surface-600 shrink-0" style={{ background: td.primary }} />
                    {td.name}
                    {theme === key && <span className="ml-auto">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* 유저 아바타 */}
          <UserAvatar />
        </header>
        <main className="flex-1 overflow-y-auto relative">
          <div className="p-4 md:p-6 max-w-7xl mx-auto animate-fade-in"><Outlet /></div>
        </main>
      </div>
    </div>
  )
}

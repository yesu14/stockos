import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { THEMES } from '../../context/ThemeContext'
import {
  LayoutDashboard, Package, Boxes, Shield, Menu as MenuIcon,
  LogOut, X, Bell, BellRing, PanelLeftClose, PanelLeftOpen,
  RotateCcw, ShoppingCart, ArrowDownCircle, ArrowUpCircle,
  Settings, Star, FileText, Bell as BellIcon, Tag, Layers, Palette
} from 'lucide-react'

const ROLE_LABELS = { admin: '관리자', manager: '매니저', viewer: '일반사용자', pending: '승인대기' }

const ICON_MAP = {
  LayoutDashboard, Package, Boxes, Shield,
  RotateCcw, ShoppingCart, ArrowDownCircle, ArrowUpCircle,
  Settings, Star, FileText, Bell: BellIcon, Tag, Layers
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
]

const ROLE_LVL = { admin: 3, manager: 2, viewer: 1 }

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

  // Close theme picker when clicking outside
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

  // ── 테마 선택기 컴포넌트 ──────────────────────────────
  function ThemePicker({ isMobile = false }) {
    if (collapsed && !isMobile) {
      return (
        <div className="relative" data-theme-picker>
          <button onClick={() => setShowThemePicker(p => !p)}
            title="테마 변경"
            className="flex items-center justify-center p-2.5 rounded-xl transition-colors text-surface-400 hover:bg-surface-800 hover:text-white w-full">
            <Palette size={18} />
          </button>
          {showThemePicker && (
            <div className="absolute left-full ml-2 bottom-0 w-52 bg-surface-900 border border-surface-700 rounded-xl shadow-2xl z-50 p-1.5">
              <p className="text-[10px] text-surface-500 px-2 py-1 font-medium uppercase tracking-wide">테마 선택</p>
              {Object.entries(THEMES).map(([key, td]) => (
                <button key={key} onClick={() => { setTheme(key); setShowThemePicker(false) }}
                  className={'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ' +
                    (theme === key ? 'bg-primary-500/20 text-primary-400 font-semibold' : 'text-surface-300 hover:bg-surface-800 hover:text-white')}>
                  <div className="w-4 h-4 rounded-full border border-surface-600 shrink-0"
                    style={{ background: td.primary }} />
                  {td.name}
                  {theme === key && <span className="ml-auto">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )
    }
    return (
      <div className="relative" data-theme-picker>
        <button onClick={() => setShowThemePicker(p => !p)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors w-full text-surface-300 hover:bg-surface-800 hover:text-white">
          <Palette size={17} className="shrink-0" />
          테마 변경
          <span className="ml-auto text-xs text-surface-500">{THEMES[theme]?.name || ''}</span>
        </button>
        {showThemePicker && (
          <div className="absolute bottom-full left-0 mb-1 w-52 bg-surface-900 border border-surface-700 rounded-xl shadow-2xl z-50 p-1.5">
            <p className="text-[10px] text-surface-500 px-2 py-1 font-medium uppercase tracking-wide">테마 선택</p>
            {Object.entries(THEMES).map(([key, td]) => (
              <button key={key} onClick={() => { setTheme(key); setShowThemePicker(false) }}
                className={'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ' +
                  (theme === key ? 'bg-primary-500/20 text-primary-400 font-semibold' : 'text-surface-300 hover:bg-surface-800 hover:text-white')}>
                <div className="w-4 h-4 rounded-full border border-surface-600 shrink-0"
                  style={{ background: td.primary }} />
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
    return (
      <div className="flex flex-col h-full">
        {/* 로고 */}
        <div className={`flex items-center border-b border-surface-800 shrink-0 ${collapsed && !isMobile ? 'px-3 py-4 justify-center' : 'px-4 py-4'}`}>
          {(!collapsed || isMobile) && (
            <>
              <div className="w-7 h-7 bg-primary-500 rounded-lg flex items-center justify-center shrink-0">
                <Boxes size={16} className="text-white" />
              </div>
              <span className="font-bold text-white text-base tracking-tight ml-2.5 flex-1">StockOS</span>
            </>
          )}
          {collapsed && !isMobile && (
            <div className="w-7 h-7 bg-primary-500 rounded-lg flex items-center justify-center">
              <Boxes size={16} className="text-white" />
            </div>
          )}
          {!isMobile && (
            <button onClick={toggleCollapse} title={collapsed ? '메뉴 펼치기' : '메뉴 접기'}
              className={`text-surface-400 hover:text-white transition-colors ${collapsed ? 'mt-0' : 'ml-1'}`}>
              {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
          )}
          {isMobile && (
            <button onClick={() => setMobileSidebarOpen(false)} className="text-surface-400 hover:text-white ml-1"><X size={18} /></button>
          )}
        </div>

        {/* 사용자 정보 */}
        {(!collapsed || isMobile) && (
          <div className="px-4 py-3.5 border-b border-surface-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center text-white font-bold text-sm shadow">
                  {profile?.name?.[0]?.toUpperCase() || 'U'}
                </div>
                {alertCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold leading-none px-1 shadow">
                    {alertCount > 99 ? '99+' : alertCount}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate leading-tight">{profile?.name || '사용자'}</p>
                <p className="text-xs text-surface-400 mt-0.5">{ROLE_LABELS[profile?.role] || profile?.role}</p>
              </div>
              <button onClick={handleLogout} title="로그아웃"
                className="p-1.5 text-surface-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0">
                <LogOut size={13} />
              </button>
            </div>
          </div>
        )}
        {collapsed && !isMobile && (
          <div className="flex flex-col items-center py-3 border-b border-surface-800 shrink-0 gap-2">
            <div className="relative">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center text-white font-bold text-xs shadow" title={profile?.name}>
                {profile?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              {alertCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-[9px] font-bold leading-none px-0.5 shadow">
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
            </div>
            <button onClick={handleLogout} title="로그아웃" className="p-1 text-surface-500 hover:text-red-400 transition-colors">
              <LogOut size={12} />
            </button>
          </div>
        )}

        {/* 메뉴 */}
        <nav className={`flex-1 py-3 overflow-y-auto overflow-x-hidden space-y-0.5 ${collapsed && !isMobile ? 'px-2' : 'px-3'}`}>
          {allMenus.map(menu => {
            const Icon = getIcon(menu.icon_name)
            if (collapsed && !isMobile) {
              return (
                <NavLink key={menu.id} to={menu.url} onClick={onNav} title={menu.label}
                  className={({ isActive }) =>
                    'flex items-center justify-center p-2.5 rounded-xl transition-colors ' +
                    (isActive ? 'bg-primary-500/20 text-primary-400' : 'text-surface-400 hover:bg-surface-800 hover:text-white')
                  }>
                  <Icon size={18} />
                </NavLink>
              )
            }
            return (
              <NavLink key={menu.id} to={menu.url} onClick={onNav}
                className={({ isActive }) =>
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ' +
                  (isActive ? 'bg-primary-500/20 text-primary-400' : 'text-surface-300 hover:bg-surface-800 hover:text-white')
                }>
                <Icon size={17} className="shrink-0" />
                {menu.label}
              </NavLink>
            )
          })}
        </nav>

        {/* 하단: 재고부족 알리미 + 테마 변경 */}
        <div className={`border-t border-surface-800 py-2 space-y-0.5 ${collapsed && !isMobile ? 'px-2' : 'px-3'}`}>
          {['admin', 'manager'].includes(profile?.role) && (
            collapsed && !isMobile ? (
              <NavLink to="/stock-alerts" onClick={onNav} title="재고부족 알리미"
                className={({ isActive }) =>
                  'flex items-center justify-center p-2.5 rounded-xl transition-colors relative ' +
                  (isActive ? 'bg-red-500/20 text-red-400' : 'text-surface-400 hover:bg-surface-800 hover:text-white')
                }>
                <BellRing size={18} />
                {alertCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />}
              </NavLink>
            ) : (
              <NavLink to="/stock-alerts" onClick={onNav}
                className={({ isActive }) =>
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ' +
                  (isActive ? 'bg-red-500/20 text-red-400' : 'text-surface-300 hover:bg-surface-800 hover:text-white')
                }>
                <BellRing size={17} className="shrink-0" />
                재고부족 알리미
                {alertCount > 0 && (
                  <span className="ml-auto px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] text-center">
                    {alertCount > 9 ? '9+' : alertCount}
                  </span>
                )}
              </NavLink>
            )
          )}
          <ThemePicker isMobile={isMobile} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-surface-950 text-white overflow-hidden">
      <aside className={`hidden lg:flex flex-col bg-surface-900 border-r border-surface-800 shrink-0 transition-all duration-200 ${collapsed ? 'w-14' : 'w-64'}`}>
        <SidebarContent onNav={() => {}} />
      </aside>
      {mobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setMobileSidebarOpen(false)} />
          <aside className="relative w-64 flex flex-col bg-surface-900 h-full z-50 shadow-2xl">
            <SidebarContent onNav={() => setMobileSidebarOpen(false)} isMobile />
          </aside>
        </div>
      )}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center gap-3 px-4 py-3 bg-surface-900 border-b border-surface-800 shrink-0">
          <button onClick={() => setMobileSidebarOpen(true)} className="lg:hidden text-surface-400 hover:text-white"><MenuIcon size={22} /></button>
          <div className="flex-1" />
          {alertCount > 0 && (
            <button onClick={() => navigate('/stock-alerts')}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm hover:bg-red-500/20 transition-colors">
              <Bell size={13} /> 재고부족 {alertCount}개
            </button>
          )}
          {/* 헤더 테마 버튼 */}
          <div className="relative" data-theme-picker>
            <button onClick={() => setShowThemePicker(p => !p)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-800 hover:bg-surface-700 text-surface-400 hover:text-white rounded-xl text-xs font-medium transition-colors"
              title="테마 변경">
              <Palette size={14} />
              <span className="hidden sm:inline">{THEMES[theme]?.name || '테마'}</span>
            </button>
            {showThemePicker && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-surface-900 border border-surface-700 rounded-xl shadow-2xl z-50 p-1.5">
                <p className="text-[10px] text-surface-500 px-2 py-1 font-medium uppercase tracking-wide">테마 선택</p>
                {Object.entries(THEMES).map(([key, td]) => (
                  <button key={key} onClick={() => { setTheme(key); setShowThemePicker(false) }}
                    className={'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ' +
                      (theme === key ? 'bg-primary-500/20 text-primary-400 font-semibold' : 'text-surface-300 hover:bg-surface-800 hover:text-white')}>
                    <div className="w-4 h-4 rounded-full border border-surface-600 shrink-0"
                      style={{ background: td.primary }} />
                    {td.name}
                    {theme === key && <span className="ml-auto">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 max-w-7xl mx-auto"><Outlet /></div>
        </main>
      </div>
    </div>
  )
}

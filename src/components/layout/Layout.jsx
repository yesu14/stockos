import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  LayoutDashboard, Package, PackageCheck, Boxes, Shield,
  Users, Menu as MenuIcon, MapPin, ChevronDown, ChevronRight,
  LogOut, X, Globe, Bell, BellRing, Building2, PanelLeftClose, PanelLeftOpen, AlertCircle
} from 'lucide-react'

const ICONS = { LayoutDashboard, Package, PackageCheck, Boxes, Shield, Users, MenuIcon, MapPin, Building2 }
const LANG_OPTIONS = [
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
]
const ROLE_LABELS = { admin: '관리자', manager: '매니저', viewer: '일반사용자', pending: '승인대기' }

export default function Layout() {
  const { i18n } = useTranslation()
  const { profile, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar_collapsed') === 'true' } catch { return false }
  })
  const [menus, setMenus] = useState([])
  const [expandedMenus, setExpandedMenus] = useState({})
  const [showLangMenu, setShowLangMenu] = useState(false)
  const [alertCount, setAlertCount] = useState(0)

  useEffect(() => { loadMenus() }, [profile])
  useEffect(() => { loadAlertCount() }, [location.pathname])

  function toggleCollapse() {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem('sidebar_collapsed', String(next)) } catch {}
  }

  async function loadMenus() {
    const { data } = await supabase.from('menus').select('*').eq('is_active', true).order('sort_order')
    if (!data) return
    const roleMap = { admin: 3, manager: 2, viewer: 1 }
    const userLevel = roleMap[profile?.role] || 0
    const permMap = { admin: 3, manager: 2, viewer: 1 }
    const filtered = data.filter(m => (permMap[m.permission_role] || 1) <= userLevel && m.url !== '/stock-alerts' && m.url !== '/categories')
    const roots = filtered.filter(m => !m.parent_id)
    const children = filtered.filter(m => m.parent_id)
    setMenus(roots.map(r => ({ ...r, children: children.filter(c => c.parent_id === r.id) })))
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

  function getMenuName(menu) {
    const lang = i18n.language
    return menu[`name_${lang}`] || menu.name_ko || menu.name_en
  }
  function changeLanguage(code) { i18n.changeLanguage(code); localStorage.setItem('lang', code); setShowLangMenu(false) }
  async function handleLogout() { await logout(); navigate('/login') }
  const currentLang = LANG_OPTIONS.find(l => l.code === i18n.language) || LANG_OPTIONS[0]

  function SidebarContent({ onNav, isMobile = false }) {
    return (
      <div className="flex flex-col h-full">
        {/* 로고 + 접기 버튼 */}
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

        {/* 접힌 상태 아바타 */}
        {collapsed && !isMobile && (
          <div className="flex flex-col items-center py-3 border-b border-surface-800 shrink-0 gap-2">
            <div className="relative">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center text-white font-bold text-xs shadow cursor-pointer" title={profile?.name}>
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
          {menus.filter(m => m.permission_role !== 'admin').map(menu => {
            const Icon = ICONS[menu.icon] || Package
            const hasChildren = menu.children?.length > 0
            const isExpanded = expandedMenus[menu.id]

            if (collapsed && !isMobile) {
              // Collapsed: icon only, no children expand
              return (
                <NavLink key={menu.id} to={hasChildren ? (menu.children[0]?.url || '#') : (menu.url || '#')}
                  onClick={onNav}
                  title={getMenuName(menu)}
                  className={({ isActive }) =>
                    'flex items-center justify-center p-2.5 rounded-xl transition-colors ' +
                    (isActive ? 'bg-primary-500/20 text-primary-400' : 'text-surface-400 hover:bg-surface-800 hover:text-white')
                  }>
                  <Icon size={18} />
                </NavLink>
              )
            }

            return (
              <div key={menu.id}>
                {hasChildren ? (
                  <>
                    <button onClick={() => setExpandedMenus(p => ({ ...p, [menu.id]: !p[menu.id] }))}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-surface-300 hover:bg-surface-800 hover:text-white transition-colors">
                      <Icon size={17} className="shrink-0" />
                      <span className="flex-1 text-sm font-medium text-left">{getMenuName(menu)}</span>
                      {isExpanded ? <ChevronDown size={13} className="text-surface-500 shrink-0" /> : <ChevronRight size={13} className="text-surface-500 shrink-0" />}
                    </button>
                    {isExpanded && (
                      <div className="ml-3 pl-3 border-l border-surface-700/50 my-0.5 space-y-0.5">
                        {menu.children.map(child => {
                          const CIcon = ICONS[child.icon] || Package
                          return (
                            <NavLink key={child.id} to={child.url || '#'} onClick={onNav}
                              className={({ isActive }) =>
                                'flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ' +
                                (isActive ? 'bg-primary-500/20 text-primary-400 font-medium' : 'text-surface-400 hover:bg-surface-800 hover:text-white')
                              }>
                              <CIcon size={15} className="shrink-0" />{getMenuName(child)}
                            </NavLink>
                          )
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <NavLink to={menu.url || '#'} onClick={onNav}
                    className={({ isActive }) =>
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ' +
                      (isActive ? 'bg-primary-500/20 text-primary-400' : 'text-surface-300 hover:bg-surface-800 hover:text-white')
                    }>
                    <Icon size={17} className="shrink-0" />{getMenuName(menu)}
                  </NavLink>
                )}
              </div>
            )
          })}

          {/* 재고부족 알리미 - 고정 메뉴 (admin 메뉴 위) */}
          {['admin','manager'].includes(profile?.role) && (
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

          {/* 관리자 전용 메뉴 */}
          {menus.filter(m => m.permission_role === 'admin').map(menu => {
            const Icon = ICONS[menu.icon] || Package
            const hasChildren = menu.children?.length > 0
            const isExpanded = expandedMenus[menu.id]
            if (collapsed && !isMobile) {
              return (
                <NavLink key={menu.id} to={hasChildren ? (menu.children[0]?.url || '#') : (menu.url || '#')}
                  onClick={onNav} title={getMenuName(menu)}
                  className={({ isActive }) =>
                    'flex items-center justify-center p-2.5 rounded-xl transition-colors ' +
                    (isActive ? 'bg-primary-500/20 text-primary-400' : 'text-surface-400 hover:bg-surface-800 hover:text-white')
                  }>
                  <Icon size={18} />
                </NavLink>
              )
            }
            return (
              <div key={menu.id}>
                {hasChildren ? (
                  <>
                    <button onClick={() => setExpandedMenus(p => ({ ...p, [menu.id]: !p[menu.id] }))}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-surface-300 hover:bg-surface-800 hover:text-white transition-colors">
                      <Icon size={17} className="shrink-0" />
                      <span className="flex-1 text-sm font-medium text-left">{getMenuName(menu)}</span>
                      {isExpanded ? <ChevronDown size={13} className="text-surface-500 shrink-0" /> : <ChevronRight size={13} className="text-surface-500 shrink-0" />}
                    </button>
                    {isExpanded && (
                      <div className="ml-3 pl-3 border-l border-surface-700/50 my-0.5 space-y-0.5">
                        {menu.children.map(child => {
                          const CIcon = ICONS[child.icon] || Package
                          return (
                            <NavLink key={child.id} to={child.url || '#'} onClick={onNav}
                              className={({ isActive }) =>
                                'flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ' +
                                (isActive ? 'bg-primary-500/20 text-primary-400 font-medium' : 'text-surface-400 hover:bg-surface-800 hover:text-white')
                              }>
                              <CIcon size={15} className="shrink-0" />{getMenuName(child)}
                            </NavLink>
                          )
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <NavLink to={menu.url || '#'} onClick={onNav}
                    className={({ isActive }) =>
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ' +
                      (isActive ? 'bg-primary-500/20 text-primary-400' : 'text-surface-300 hover:bg-surface-800 hover:text-white')
                    }>
                    <Icon size={17} className="shrink-0" />{getMenuName(menu)}
                  </NavLink>
                )}
              </div>
            )
          })}
        </nav>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-surface-950 text-white overflow-hidden">
      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex flex-col bg-surface-900 border-r border-surface-800 shrink-0 transition-all duration-200 ${collapsed ? 'w-14' : 'w-64'}`}>
        <SidebarContent onNav={() => {}} />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setMobileSidebarOpen(false)} />
          <aside className="relative w-64 flex flex-col bg-surface-900 h-full z-50 shadow-2xl">
            <SidebarContent onNav={() => setMobileSidebarOpen(false)} isMobile />
          </aside>
        </div>
      )}

      {/* Main area */}
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
          <div className="relative">
            <button onClick={() => setShowLangMenu(!showLangMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-800 hover:bg-surface-700 text-sm transition-colors">
              <Globe size={13} className="text-surface-400" />
              <span className="text-surface-300">{currentLang.flag} {currentLang.label}</span>
            </button>
            {showLangMenu && (
              <div className="absolute right-0 top-10 bg-surface-800 border border-surface-700 rounded-xl overflow-hidden shadow-xl z-50 w-36">
                {LANG_OPTIONS.map(lang => (
                  <button key={lang.code} onClick={() => changeLanguage(lang.code)}
                    className={'w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-surface-700 transition-colors ' + (i18n.language === lang.code ? 'text-primary-400' : 'text-surface-300')}>
                    {lang.flag} {lang.label}
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

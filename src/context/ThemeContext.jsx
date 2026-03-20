import { createContext, useContext, useState, useEffect } from 'react'

export const THEMES = {
  dark: {
    name: '다크 (기본)',
    primary: '#0ea5e9',
    classes: 'theme-dark'
  },
  light: {
    name: '라이트 (화이트)',
    primary: '#3b82f6',
    classes: 'theme-light'
  },
  midnight: {
    name: '미드나잇 블루',
    primary: '#8b5cf6',
    classes: 'theme-midnight'
  },
  forest: {
    name: '포레스트 그린',
    primary: '#22c55e',
    classes: 'theme-forest'
  }
}

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try { return localStorage.getItem('stockos_theme') || 'dark' } catch { return 'dark' }
  })

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Apply on mount
  useEffect(() => {
    applyTheme(theme)
  }, [])

  function applyTheme(t) {
    const root = document.documentElement
    // Remove all theme classes
    Object.values(THEMES).forEach(td => root.classList.remove(td.classes))
    const themeData = THEMES[t] || THEMES.dark
    root.classList.add(themeData.classes)
    try { localStorage.setItem('stockos_theme', t) } catch {}
  }

  function setTheme(t) {
    setThemeState(t)
    applyTheme(t)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

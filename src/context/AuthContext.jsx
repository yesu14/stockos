import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})
export const useAuth = () => useContext(AuthContext)

const ADMIN_EMAILS = ['tiger22567@gmail.com', 'kimmiyeon0421@naver.com']
const ADMIN_EMAIL = ADMIN_EMAILS[0]  // keep for backward compat

function getDeviceFingerprint() {
  const fp = [navigator.userAgent, navigator.language, `${screen.width}x${screen.height}`, new Date().getTimezoneOffset(), navigator.platform].join('|')
  let hash = 0
  for (let i = 0; i < fp.length; i++) { hash = ((hash << 5) - hash) + fp.charCodeAt(i); hash |= 0 }
  return Math.abs(hash).toString(36)
}

async function fetchIpInfo() {
  try {
    // Try multiple IP services
    const services = [
      'https://api.ipify.org?format=json',
      'https://api4.my-ip.io/v2/ip.json',
    ]
    for (const url of services) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
        if (res.ok) {
          const d = await res.json()
          const ip = d.ip || d.IPv4 || null
          if (ip) {
            // Get location from ip-api
            try {
              const locRes = await fetch(`https://ipwho.is/${ip}`, { signal: AbortSignal.timeout(4000) })
              if (locRes.ok) {
                const loc = await locRes.json()
                const location = [loc.city, loc.region, loc.country].filter(Boolean).join(', ')
                return { ip, location: location || null }
              }
            } catch {}
            return { ip, location: null }
          }
        }
      } catch {}
    }
  } catch {}
  return { ip: null, location: null }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const deviceFingerprint = getDeviceFingerprint()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) { setUser(session.user); await fetchProfile(session.user.id) }
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setProfile(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) setProfile(data)
    return data
  }

  async function login(email, password, rememberDevice) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    let prof = await fetchProfile(data.user.id)
    // Auto-upgrade admin emails if needed
    if (prof && ADMIN_EMAILS.includes(email.toLowerCase()) && (!prof.is_approved || prof.role !== 'admin')) {
      await supabase.from('profiles').update({ role: 'admin', is_approved: true }).eq('id', data.user.id)
      prof = await fetchProfile(data.user.id)
    }
    if (!prof?.is_approved) { await supabase.auth.signOut(); throw new Error('pending') }

    // Collect IP & location, then log (don't block login on failure)
    ;(async () => {
      try {
        const { ip, location } = await fetchIpInfo()
        await supabase.from('login_logs').insert({
          user_id: data.user.id,
          device_info: navigator.userAgent,
          device_fingerprint: deviceFingerprint,
          ip_address: ip,
          location: location,
          success: true
        })
      } catch {}
    })()

    if (rememberDevice) {
      try {
        await supabase.from('trusted_devices').upsert({
          user_id: data.user.id, device_fingerprint: deviceFingerprint,
          device_name: navigator.userAgent.split('(')[1]?.split(')')[0] || 'Unknown',
          last_used: new Date().toISOString()
        }, { onConflict: 'device_fingerprint' })
      } catch {}
    }

    const { data: trustedDevices } = await supabase.from('trusted_devices').select('*').eq('user_id', data.user.id)
    const isKnownDevice = trustedDevices?.some(d => d.device_fingerprint === deviceFingerprint)
    return { user: data.user, profile: prof, devices: trustedDevices || [], isKnownDevice }
  }

  async function register(email, password, name) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    if (!data.user) throw new Error('회원가입 실패')

    const uid = data.user.id
    const isAdminEmail = ADMIN_EMAILS.includes(email.toLowerCase())
    const profileData = {
      id: uid,
      email: email.toLowerCase(),
      name: name.trim(),
      role: isAdminEmail ? 'admin' : 'pending',
      is_approved: isAdminEmail,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // Wait briefly for any Supabase trigger
    await new Promise(r => setTimeout(r, 800))

    // Check if profile already exists (created by trigger)
    const { data: existing } = await supabase.from('profiles').select('id').eq('id', uid).single()

    let profError = null
    if (existing) {
      // Profile exists - update it
      const { error: upErr } = await supabase.from('profiles')
        .update({ name: profileData.name, role: profileData.role, is_approved: profileData.is_approved, updated_at: profileData.updated_at })
        .eq('id', uid)
      profError = upErr
    } else {
      // Profile doesn't exist - insert it
      const { error: insErr } = await supabase.from('profiles').insert(profileData)
      if (insErr) {
        // Last resort: upsert
        const { error: upErr2 } = await supabase.from('profiles')
          .upsert(profileData, { onConflict: 'id', ignoreDuplicates: false })
        profError = upErr2
      }
    }

    if (profError) {
      console.error('Profile creation failed:', profError)
    }

    if (!isAdminEmail) await supabase.auth.signOut()
  }

  async function logout() { await supabase.auth.signOut(); setUser(null); setProfile(null) }
  async function changePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
  }

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      login, register, logout, changePassword, fetchProfile, deviceFingerprint,
      isAdmin: profile?.role === 'admin',
      isManager: ['admin', 'manager'].includes(profile?.role),
    }}>
      {children}
    </AuthContext.Provider>
  )
}

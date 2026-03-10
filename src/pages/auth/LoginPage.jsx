import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { Boxes, Eye, EyeOff, Monitor, Clock, X, KeyRound, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'

export default function LoginPage() {
  const { t } = useTranslation()
  const { login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberDevice, setRememberDevice] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loginInfo, setLoginInfo] = useState(null)

  // 비밀번호 찾기
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)

  // 비밀번호 변경 강제
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [changeLoading, setChangeLoading] = useState(false)
  const [pendingProfile, setPendingProfile] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const result = await login(email, password, rememberDevice)
      // must_change_password 체크
      if (result.profile?.must_change_password) {
        setPendingProfile(result.profile)
        setShowChangePassword(true)
        setLoading(false)
        return
      }
      const { data: logs } = await supabase
        .from('login_logs').select('*').eq('user_id', result.user.id)
        .order('created_at', { ascending: false }).limit(5)
      setLoginInfo({ devices: result.devices || [], isKnownDevice: result.isKnownDevice, logs: logs || [] })
    } catch (err) {
      if (err.message === 'pending') toast.error('관리자 승인 대기 중입니다')
      else toast.error(err.message || '로그인 실패')
    } finally {
      setLoading(false)
    }
  }

  function handleClosePopup() {
    setLoginInfo(null)
    navigate('/dashboard')
  }

  // 비밀번호 찾기 처리
  async function handleForgotPassword(e) {
    e.preventDefault()
    if (!forgotEmail.trim()) return toast.error('이메일을 입력하세요')
    setForgotLoading(true)
    try {
      // 해당 유저 존재 확인
      const { data: prof } = await supabase.from('profiles').select('id, email').eq('email', forgotEmail).single()
      if (!prof) { toast.error('해당 이메일로 가입된 계정이 없습니다'); setForgotLoading(false); return }

      // 랜덤 비밀번호 생성
      const randomPw = Math.random().toString(36).slice(2, 8).toUpperCase() + Math.random().toString(36).slice(2, 6)

      // Supabase Admin API로 비밀번호 변경 (Edge Function 없이 reset email 사용)
      // 실제 환경에서는 Edge Function 필요. 여기서는 Supabase 기본 reset email 사용
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`
      })
      if (error) throw error

      // must_change_password 플래그 설정
      await supabase.from('profiles').update({ must_change_password: true }).eq('id', prof.id)

      toast.success('비밀번호 재설정 이메일이 발송됐습니다. 이메일을 확인하세요.')
      setShowForgot(false)
      setForgotEmail('')
    } catch (err) {
      toast.error(err.message || '오류가 발생했습니다')
    } finally {
      setForgotLoading(false)
    }
  }

  // 비밀번호 변경 처리
  async function handleChangePassword(e) {
    e.preventDefault()
    if (newPassword.length < 6) return toast.error('비밀번호는 6자 이상이어야 합니다')
    if (newPassword !== confirmNewPassword) return toast.error('비밀번호가 일치하지 않습니다')
    setChangeLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      // 플래그 해제
      if (pendingProfile) {
        await supabase.from('profiles').update({ must_change_password: false }).eq('id', pendingProfile.id)
      }
      toast.success('비밀번호가 변경됐습니다. 다시 로그인해주세요.')
      await supabase.auth.signOut()
      setShowChangePassword(false)
      setNewPassword(''); setConfirmNewPassword('')
      setEmail(''); setPassword('')
    } catch (err) {
      toast.error(err.message || '비밀번호 변경 실패')
    } finally {
      setChangeLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary-700/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-500 rounded-2xl mb-4">
            <Boxes size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">StockOS</h1>
          <p className="text-surface-400 text-sm mt-1">재고관리 시스템</p>
        </div>

        <div className="bg-surface-900 border border-surface-800 rounded-2xl p-8">
          <h2 className="text-xl font-semibold text-white mb-6">로그인</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-surface-400 mb-1.5">이메일</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full bg-surface-800 border border-surface-700 rounded-xl px-4 py-3 text-white placeholder-surface-500 focus:outline-none focus:border-primary-500 transition-colors"
                placeholder="email@example.com" />
            </div>
            <div>
              <label className="block text-sm text-surface-400 mb-1.5">비밀번호</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                  className="w-full bg-surface-800 border border-surface-700 rounded-xl px-4 py-3 pr-12 text-white placeholder-surface-500 focus:outline-none focus:border-primary-500 transition-colors"
                  placeholder="••••••••" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-surface-400 hover:text-white">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={rememberDevice} onChange={e => setRememberDevice(e.target.checked)} className="w-4 h-4 rounded border-surface-600 accent-primary-500" />
              <span className="text-sm text-surface-300">이 기기 기억하기</span>
            </label>
            <button type="submit" disabled={loading}
              className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors">
              {loading ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />로그인 중...</span> : '로그인'}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-between text-sm">
            <button onClick={() => setShowForgot(true)} className="text-surface-400 hover:text-primary-400 transition-colors flex items-center gap-1.5">
              <KeyRound size={13} /> 비밀번호 찾기
            </button>
            <Link to="/register" className="text-primary-400 hover:text-primary-300 transition-colors">
              회원가입 →
            </Link>
          </div>
        </div>
      </div>

      {/* 비밀번호 찾기 모달 */}
      {showForgot && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-900 border border-surface-800 rounded-2xl w-full max-w-sm p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <KeyRound size={18} className="text-primary-400" />
                <h3 className="font-semibold text-white">비밀번호 찾기</h3>
              </div>
              <button onClick={() => setShowForgot(false)} className="text-surface-400 hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-sm text-surface-400 mb-1.5">가입한 이메일 주소</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
                  <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required
                    placeholder="email@example.com"
                    className="w-full bg-surface-800 border border-surface-700 rounded-xl pl-9 pr-4 py-3 text-white placeholder-surface-500 focus:outline-none focus:border-primary-500" />
                </div>
              </div>
              <p className="text-xs text-surface-500">입력한 이메일로 비밀번호 재설정 링크가 발송됩니다.</p>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowForgot(false)} className="flex-1 py-2.5 bg-surface-700 hover:bg-surface-600 text-surface-300 rounded-xl text-sm font-medium transition-colors">취소</button>
                <button type="submit" disabled={forgotLoading} className="flex-1 py-2.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors">
                  {forgotLoading ? '발송 중...' : '이메일 발송'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 비밀번호 변경 강제 모달 */}
      {showChangePassword && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-900 border border-amber-500/30 rounded-2xl w-full max-w-sm p-6 animate-slide-up">
            <div className="flex items-center gap-2 mb-2">
              <KeyRound size={18} className="text-amber-400" />
              <h3 className="font-semibold text-white">새 비밀번호 설정 필요</h3>
            </div>
            <p className="text-sm text-surface-400 mb-5">보안을 위해 새 비밀번호를 설정해야 합니다.</p>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs text-surface-400 mb-1.5">새 비밀번호 (6자 이상)</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6}
                  className="w-full bg-surface-800 border border-surface-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary-500" />
              </div>
              <div>
                <label className="block text-xs text-surface-400 mb-1.5">비밀번호 확인</label>
                <input type="password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} required
                  className="w-full bg-surface-800 border border-surface-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-primary-500" />
              </div>
              <button type="submit" disabled={changeLoading}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl font-semibold transition-colors">
                {changeLoading ? '변경 중...' : '비밀번호 변경 후 재로그인'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 로그인 정보 팝업 */}
      {loginInfo && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-900 border border-surface-800 rounded-2xl w-full max-w-md p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">로그인 정보</h3>
              <button onClick={handleClosePopup} className="text-surface-400 hover:text-white"><X size={20} /></button>
            </div>
            {!loginInfo.isKnownDevice && loginInfo.devices?.length > 0 && (
              <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm">⚠️ 새로운 기기에서 로그인됐습니다</div>
            )}
            <div className="mb-4">
              <p className="text-xs text-surface-400 uppercase tracking-wide mb-2">등록된 기기</p>
              {loginInfo.devices?.length === 0 ? (
                <p className="text-sm text-surface-500">등록된 기기 없음</p>
              ) : (
                <div className="space-y-2">
                  {loginInfo.devices.map(d => (
                    <div key={d.id} className="flex items-center gap-3 p-2 bg-surface-800 rounded-lg">
                      <Monitor size={16} className="text-primary-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{d.device_name || 'Unknown'}</p>
                        <p className="text-xs text-surface-400">{new Date(d.last_used).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="mb-6">
              <p className="text-xs text-surface-400 uppercase tracking-wide mb-2">최근 로그인</p>
              <div className="space-y-1">
                {loginInfo.logs?.slice(0, 3).map(log => (
                  <div key={log.id} className="flex items-center gap-2 text-sm text-surface-400">
                    <Clock size={12} />{new Date(log.created_at).toLocaleString('ko-KR')}
                  </div>
                ))}
              </div>
            </div>
            <button onClick={handleClosePopup} className="w-full bg-primary-500 hover:bg-primary-600 text-white py-2.5 rounded-xl font-medium transition-colors">확인</button>
          </div>
        </div>
      )}
    </div>
  )
}

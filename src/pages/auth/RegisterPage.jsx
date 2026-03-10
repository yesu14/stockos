import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Boxes, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'

const ADMIN_EMAIL = 'tiger22567@gmail.com'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '', name: '', confirmPassword: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.password !== form.confirmPassword) return toast.error('비밀번호가 일치하지 않습니다')
    if (form.password.length < 6) return toast.error('비밀번호는 6자 이상이어야 합니다')
    setLoading(true)
    try {
      const isAdmin = form.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
      await register(form.email, form.password, form.name, isAdmin)

      if (isAdmin) {
        toast.success('관리자 계정으로 자동 승인됐습니다. 로그인하세요.')
      } else {
        toast.success('회원가입 완료! 관리자 승인 후 로그인 가능합니다.')
        // 관리자에게 승인 요청 이메일 발송 (Supabase 기본 이메일 사용)
        // 실제 운영환경에서는 Edge Function으로 커스텀 이메일 발송
        await supabase.auth.resetPasswordForEmail(ADMIN_EMAIL)
          .catch(() => {}) // 무시 - admin 알림은 best-effort
      }
      navigate('/login')
    } catch (err) {
      toast.error(err.message || '회원가입 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-500 rounded-2xl mb-4">
            <Boxes size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">StockOS</h1>
        </div>

        <div className="bg-surface-900 border border-surface-800 rounded-2xl p-8">
          <h2 className="text-xl font-semibold text-white mb-6">회원가입</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-surface-400 mb-1.5">이름</label>
              <input type="text" value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))} required
                className="w-full bg-surface-800 border border-surface-700 rounded-xl px-4 py-3 text-white placeholder-surface-500 focus:outline-none focus:border-primary-500" />
            </div>
            <div>
              <label className="block text-sm text-surface-400 mb-1.5">이메일</label>
              <input type="email" value={form.email} onChange={e => setForm(p=>({...p,email:e.target.value}))} required
                className="w-full bg-surface-800 border border-surface-700 rounded-xl px-4 py-3 text-white placeholder-surface-500 focus:outline-none focus:border-primary-500" />
            </div>
            <div>
              <label className="block text-sm text-surface-400 mb-1.5">비밀번호 (6자 이상)</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={form.password} onChange={e => setForm(p=>({...p,password:e.target.value}))} required
                  className="w-full bg-surface-800 border border-surface-700 rounded-xl px-4 py-3 pr-12 text-white focus:outline-none focus:border-primary-500" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-3.5 text-surface-400 hover:text-white">
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm text-surface-400 mb-1.5">비밀번호 확인</label>
              <input type="password" value={form.confirmPassword} onChange={e => setForm(p=>({...p,confirmPassword:e.target.value}))} required
                className="w-full bg-surface-800 border border-surface-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary-500" />
            </div>
            <div className="p-3 bg-primary-500/10 border border-primary-500/30 rounded-lg text-sm text-primary-300">
              ℹ️ 회원가입 후 관리자 승인 시 로그인 가능합니다
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors">
              {loading ? '처리 중...' : '회원가입'}
            </button>
          </form>
          <div className="mt-4 text-center">
            <Link to="/login" className="text-sm text-primary-400 hover:text-primary-300 transition-colors">← 로그인</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

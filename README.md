# StockOS - 재고관리 시스템

## 기술 스택
- **Frontend**: React + Vite + Tailwind CSS
- **DB / Auth**: Supabase (무료)
- **배포**: Vercel (무료)
- **PWA**: 모바일 앱처럼 사용 가능

---

## 1단계: Supabase 설정

1. [supabase.com](https://supabase.com) 접속 → 무료 계정 생성
2. **New project** 클릭 → 프로젝트 이름, DB 비밀번호 설정
3. **SQL Editor** 열기 → `supabase_schema.sql` 전체 복사 → 실행 (Run)
4. **Settings > API** 에서:
   - `Project URL` 복사
   - `anon public` 키 복사

### 이메일 알림 설정 (회원가입/디바이스 알림)
1. Supabase 대시보드 → **Edge Functions**
2. `send-device-alert` 함수 생성 (선택사항)
3. 또는 **Authentication > Email Templates** 에서 기본 이메일 설정

---

## 2단계: 프로젝트 설정

```bash
# 의존성 설치
npm install

# .env 파일 생성
cp .env.example .env
```

`.env` 파일 수정:
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

```bash
# 개발 서버 실행
npm run dev
```

---

## 3단계: 첫 관리자 계정 생성

1. `/register` 페이지에서 회원가입
2. Supabase SQL Editor에서 수동으로 관리자 승인:

```sql
UPDATE profiles 
SET is_approved = true, role = 'admin' 
WHERE email = 'your-email@example.com';
```

---

## 4단계: Vercel 배포

```bash
# Vercel CLI 설치
npm install -g vercel

# 배포
vercel

# 환경변수 설정
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY

# 프로덕션 배포
vercel --prod
```

또는 **GitHub 연동**:
1. GitHub에 코드 올리기
2. [vercel.com](https://vercel.com) → **New Project** → GitHub 리포지토리 선택
3. Environment Variables에 `.env` 값 입력
4. **Deploy** 클릭

---

## 5단계: 도메인 연결

### Cloudflare에서 도메인 구매
1. [cloudflare.com](https://cloudflare.com) → Registrar → 도메인 검색/구매
2. Vercel 대시보드 → 프로젝트 → **Settings > Domains**
3. 도메인 추가 → Cloudflare DNS에 CNAME 레코드 추가

---

## 주요 기능 요약

| 기능 | 설명 |
|------|------|
| **다국어** | 한국어 / 중국어 / 영어 전환 |
| **로그인** | 디바이스 기억, 로그인 기록, 새기기 알림 |
| **회원관리** | 관리자 승인 시스템 |
| **상품관리** | 1~2개 옵션, SKU 매트릭스 |
| **입고관리** | 입고번호 자동생성, 이력 조회 |
| **재고관리** | 실시간 조정, 그래프 (일/주/월) |
| **메뉴편집** | 다국어, 권한, URL 수정 가능 |
| **컬럼숨기기** | 각 테이블 컬럼 토글 (로컬 저장) |
| **PWA** | 홈화면 추가 → 앱처럼 사용 |

---

## 폴더 구조

```
src/
├── components/
│   ├── layout/Layout.jsx      # 사이드바 + 헤더
│   └── ui/DataTable.jsx       # 공통 테이블 (컬럼숨기기)
├── context/
│   └── AuthContext.jsx        # 인증 상태 관리
├── lib/
│   └── supabase.js            # Supabase 클라이언트
├── locales/
│   ├── ko/translation.json    # 한국어
│   ├── zh/translation.json    # 중국어
│   └── en/translation.json    # 영어
├── pages/
│   ├── auth/                  # 로그인, 회원가입
│   ├── dashboard/             # 대시보드 + TOP5 차트
│   ├── products/              # 상품 목록, 폼
│   ├── inbound/               # 입고관리
│   ├── inventory/             # 재고관리
│   └── admin/                 # 회원관리, 메뉴편집, 위치관리
├── i18n.js                    # 다국어 설정
└── App.jsx                    # 라우팅
```

---

## 향후 추가 가능한 기능

- 엑셀 내보내기 (xlsx 라이브러리)
- 바코드 스캔 (quagga.js)
- 상품 이미지 업로드 (Supabase Storage)
- 판매 기록 / 출고 기능
- 알림 센터 (low stock 자동 알림)

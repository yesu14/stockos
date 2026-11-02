import { lazy } from 'react'

// 페이지를 처음 열 때만 그 페이지 코드를 내려받음 (앱이 처음 열리는 속도가 빨라짐).
// 새 버전을 배포한 직후 예전 화면에서 이동하면 "예전 파일을 못 찾는" 오류가 날 수 있어, 그럴 땐 한 번만 자동 새로고침.
export function lazyRetry(importer) {
  return lazy(async () => {
    try { const m = await importer(); try { sessionStorage.removeItem('chunk_retry') } catch {} return m }
    catch (e) {
      let tried = false
      try { tried = !!sessionStorage.getItem('chunk_retry'); sessionStorage.setItem('chunk_retry', '1') } catch {}
      if (!tried) { window.location.reload(); return new Promise(() => {}) }
      throw e
    }
  })
}

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import ko from './locales/ko/translation.json'
import zh from './locales/zh/translation.json'
import en from './locales/en/translation.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { ko: { translation: ko }, zh: { translation: zh }, en: { translation: en } },
    fallbackLng: 'ko',
    lng: localStorage.getItem('lang') || 'ko',
    interpolation: { escapeValue: false },
  })

export default i18n

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import hr from './hr'
import de from './de'
import en from './en'

const savedLang = localStorage.getItem('deer_lang') || 'hr'

i18n.use(initReactI18next).init({
  resources: {
    hr: { translation: hr },
    de: { translation: de },
    en: { translation: en },
  },
  lng: savedLang,
  fallbackLng: 'hr',
  interpolation: { escapeValue: false },
})

export default i18n
export const LANGUAGES = [
  { code: 'hr', label: 'Hrvatski', flag: '🇭🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
]

import { useTranslation } from 'react-i18next'
import { Globe } from 'lucide-react'

interface Props {
  variant?: 'sidebar' | 'onLight'
  collapsed?: boolean
}

const LanguageToggle = ({ variant = 'sidebar', collapsed = false }: Props) => {
  const { i18n, t } = useTranslation()
  const current = i18n.language?.startsWith('es') ? 'es' : 'en'

  const change = (lng: 'en' | 'es') => {
    i18n.changeLanguage(lng)
  }

  if (variant === 'onLight') {
    return (
      <div className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white/90 backdrop-blur px-1 py-0.5 shadow-sm">
        <Globe className="w-4 h-4 text-gray-500 ml-1" aria-hidden />
        <button
          type="button"
          onClick={() => change('en')}
          aria-pressed={current === 'en'}
          className={`px-2 py-1 text-xs font-medium rounded-full transition-colors ${
            current === 'en' ? 'bg-orange-500 text-white' : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          EN
        </button>
        <button
          type="button"
          onClick={() => change('es')}
          aria-pressed={current === 'es'}
          className={`px-2 py-1 text-xs font-medium rounded-full transition-colors ${
            current === 'es' ? 'bg-orange-500 text-white' : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          ES
        </button>
      </div>
    )
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => change(current === 'en' ? 'es' : 'en')}
        title={t('language.label')}
        aria-label={t('language.label')}
        className="w-full flex items-center justify-center px-3 py-2 text-gray-400 hover:bg-gray-800 hover:text-white rounded-lg transition-colors"
      >
        <Globe size={18} />
        <span className="ml-1 text-[10px] font-bold uppercase">{current}</span>
      </button>
    )
  }

  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{t('language.label')}</label>
      <div className="inline-flex w-full rounded-lg bg-gray-800 border border-gray-700 overflow-hidden">
        <button
          type="button"
          onClick={() => change('en')}
          aria-pressed={current === 'en'}
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
            current === 'en' ? 'bg-orange-500 text-white' : 'text-gray-300 hover:bg-gray-700'
          }`}
        >
          English
        </button>
        <button
          type="button"
          onClick={() => change('es')}
          aria-pressed={current === 'es'}
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
            current === 'es' ? 'bg-orange-500 text-white' : 'text-gray-300 hover:bg-gray-700'
          }`}
        >
          Español
        </button>
      </div>
    </div>
  )
}

export default LanguageToggle

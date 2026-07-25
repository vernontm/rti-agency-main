import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const NotFoundPage = () => {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-7xl font-extrabold text-[#F97316]">404</h1>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('notFound.title')}</h2>
          <p className="mt-2 text-gray-600">{t('notFound.subtitle')}</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/dashboard"
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-[#F97316] text-white font-medium hover:bg-orange-600 transition-colors inline-block"
          >
            {t('common.goToDashboard')}
          </Link>
          <Link
            to="/"
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors inline-block"
          >
            {t('common.goToHome')}
          </Link>
        </div>
      </div>
    </div>
  )
}

export default NotFoundPage

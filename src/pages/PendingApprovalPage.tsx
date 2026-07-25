import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../stores/authStore'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import LanguageToggle from '../components/LanguageToggle'
import { Clock, LogOut } from 'lucide-react'

const PendingApprovalPage = () => {
  const { t } = useTranslation()
  const { signOut, profile } = useAuthStore()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4 relative">
      <div className="absolute top-4 right-4">
        <LanguageToggle variant="onLight" />
      </div>
      <Card className="w-full max-w-md text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t('pendingApproval.title')}</h1>
          <p className="text-gray-600 mt-2">{t('pendingApproval.subtitle')}</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-600">
            <strong>{t('pendingApproval.emailLabel')}</strong> {profile?.email}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            <strong>{t('pendingApproval.nameLabel')}</strong> {profile?.full_name}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            <strong>{t('pendingApproval.statusLabel')}</strong>{' '}
            <span className="inline-block px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
              {t('pendingApproval.pendingBadge')}
            </span>
          </p>
        </div>

        <p className="text-sm text-gray-500 mb-6">{t('pendingApproval.helpText')}</p>

        <Button variant="outline" onClick={handleSignOut} className="w-full">
          <LogOut className="w-4 h-4 mr-2" />
          {t('pendingApproval.signOut')}
        </Button>
      </Card>
    </div>
  )
}

export default PendingApprovalPage

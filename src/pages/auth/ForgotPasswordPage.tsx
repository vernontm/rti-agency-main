import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../stores/authStore'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Card from '../../components/ui/Card'
import LanguageToggle from '../../components/LanguageToggle'
import toast from 'react-hot-toast'
import { useState } from 'react'

const ForgotPasswordPage = () => {
  const { t } = useTranslation()
  const { resetPassword, loading } = useAuthStore()
  const [emailSent, setEmailSent] = useState(false)

  const forgotPasswordSchema = z.object({
    email: z.string().email(t('auth.errors.invalidEmail')),
  })

  type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  const onSubmit = async (data: ForgotPasswordFormData) => {
    const { error } = await resetPassword(data.email)
    if (error) {
      toast.error(error.message)
    } else {
      setEmailSent(true)
      toast.success(t('auth.resetEmailSent'))
    }
  }

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4 relative">
        <div className="absolute top-4 right-4">
          <LanguageToggle variant="onLight" />
        </div>
        <Card className="w-full max-w-md text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">{t('auth.checkEmailTitle')}</h2>
            <p className="text-gray-600 mt-2">{t('auth.checkEmailBody')}</p>
          </div>
          <Link to="/login">
            <Button variant="outline" className="w-full">
              {t('auth.backToSignIn')}
            </Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4 relative">
      <div className="absolute top-4 right-4">
        <LanguageToggle variant="onLight" />
      </div>
      <Card className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{t('auth.forgotPasswordTitle')}</h1>
          <p className="text-gray-600 mt-2">{t('auth.forgotPasswordSubtitle')}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            id="email"
            type="email"
            label={t('auth.email')}
            placeholder={t('auth.placeholders.email')}
            error={errors.email?.message}
            {...register('email')}
          />

          <Button type="submit" className="w-full" loading={loading}>
            {t('auth.sendResetLink')}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          {t('auth.rememberPassword')}{' '}
          <Link to="/login" className="text-blue-600 hover:text-blue-800 font-medium">
            {t('auth.signInButton')}
          </Link>
        </p>
      </Card>
    </div>
  )
}

export default ForgotPasswordPage

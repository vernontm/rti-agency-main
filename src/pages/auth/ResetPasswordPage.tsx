import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../stores/authStore'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Card from '../../components/ui/Card'
import LanguageToggle from '../../components/LanguageToggle'
import toast from 'react-hot-toast'

const ResetPasswordPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { updatePassword, loading } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)

  const resetPasswordSchema = z.object({
    password: z.string().min(6, t('auth.errors.passwordMin')),
    confirmPassword: z.string(),
  }).refine((data) => data.password === data.confirmPassword, {
    message: t('auth.errors.passwordsMustMatch'),
    path: ['confirmPassword'],
  })

  type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  })

  const onSubmit = async (data: ResetPasswordFormData) => {
    const { error } = await updatePassword(data.password)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(t('auth.passwordUpdated'))
      navigate('/login')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4 relative">
      <div className="absolute top-4 right-4">
        <LanguageToggle variant="onLight" />
      </div>
      <Card className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{t('auth.resetPasswordTitle')}</h1>
          <p className="text-gray-600 mt-2">{t('auth.resetPasswordSubtitle')}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              label={t('auth.newPassword')}
              placeholder={t('auth.placeholders.password')}
              error={errors.password?.message}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-8 text-gray-500 hover:text-gray-700"
            >
              {showPassword ? t('auth.hide') : t('auth.show')}
            </button>
          </div>

          <Input
            id="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            label={t('auth.confirmNewPassword')}
            placeholder={t('auth.placeholders.password')}
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />

          <Button type="submit" className="w-full" loading={loading}>
            {t('auth.updatePasswordButton')}
          </Button>
        </form>
      </Card>
    </div>
  )
}

export default ResetPasswordPage

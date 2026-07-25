import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../stores/authStore'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Card from '../../components/ui/Card'
import LanguageToggle from '../../components/LanguageToggle'
import toast from 'react-hot-toast'

const LoginPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { signIn, loading } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)

  const loginSchema = z.object({
    email: z.string().email(t('auth.errors.invalidEmail')),
    password: z.string().min(6, t('auth.errors.passwordMin')),
  })

  type LoginFormData = z.infer<typeof loginSchema>

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    const { error } = await signIn(data.email, data.password)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(t('auth.welcomeBack'))
      navigate('/dashboard')
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center relative"
      style={{ backgroundImage: "url('https://vernon-tech-media.s3.us-east-1.amazonaws.com/RTI-agency/website-images/slider-1.png')" }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#003d5c]/85 to-[#002840]/75" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(254,146,38,0.15),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(0,184,212,0.15),transparent_50%)]" />
      <div className="absolute top-4 right-4 z-20">
        <LanguageToggle variant="onLight" />
      </div>
      <Card className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{t('auth.brand')}</h1>
          <p className="text-gray-600 mt-2">{t('auth.signInTitle')}</p>
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

          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              label={t('auth.password')}
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

          <div className="flex items-center justify-between">
            <Link
              to="/forgot-password"
              className="text-sm text-orange-500 hover:text-orange-600"
            >
              {t('auth.forgotPasswordLink')}
            </Link>
          </div>

          <Button type="submit" className="w-full" loading={loading}>
            {t('auth.signInButton')}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="text-orange-500 hover:text-orange-600 font-medium">
            {t('auth.signUpButton')}
          </Link>
        </p>
      </Card>
    </div>
  )
}

export default LoginPage

import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import type { UserRole } from '../../types/database.types'
import { Loader2, AlertCircle } from 'lucide-react'
import PendingApprovalPage from '../../pages/PendingApprovalPage'
import { useEffect, useState, useCallback } from 'react'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
  allowPending?: boolean
}

const ProtectedRoute = ({ children, allowedRoles, allowPending = false }: ProtectedRouteProps) => {
  const { user, profile, initialized, fetchProfile, signOut } = useAuthStore()
  const location = useLocation()
  const [profileTimeout, setProfileTimeout] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  // Retry fetching profile if user exists but profile doesn't
  useEffect(() => {
    if (initialized && user && !profile && !profileTimeout) {
      const timer = setTimeout(() => {
        fetchProfile()
        setRetryCount(c => c + 1)
      }, 1500)

      // Set timeout after 8 seconds to prevent infinite loading
      const timeoutTimer = setTimeout(() => {
        setProfileTimeout(true)
      }, 8000)

      return () => {
        clearTimeout(timer)
        clearTimeout(timeoutTimer)
      }
    }
  }, [initialized, user, profile, profileTimeout, fetchProfile, retryCount])

  const handleRetry = useCallback(async () => {
    setProfileTimeout(false)
    setRetryCount(0)
    await fetchProfile()
    // Re-trigger timeout if still no profile
    if (!useAuthStore.getState().profile) {
      setTimeout(() => setProfileTimeout(true), 8000)
    }
  }, [fetchProfile])

  const handleSignOut = useCallback(async () => {
    await signOut()
  }, [signOut])

  // Wait for auth to be initialized
  if (!initialized) {
    return (
      <div className="h-screen flex items-center justify-center" role="status" aria-live="polite">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" aria-hidden="true" />
        <span className="sr-only">Loading...</span>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Wait for profile to load (with timeout)
  if (!profile && !profileTimeout) {
    return (
      <div className="h-screen flex items-center justify-center" role="status" aria-live="polite">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" aria-hidden="true" />
        <span className="sr-only">Loading your profile...</span>
      </div>
    )
  }

  // If profile failed to load after timeout, show error with retry option
  if (!profile && profileTimeout) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-orange-500 mx-auto" />
          <h2 className="text-xl font-semibold text-gray-900">Profile Not Found</h2>
          <p className="text-gray-600">
            We were able to sign you in, but couldn't load your profile. This can happen if your account is still being set up.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-orange-700 text-white rounded-lg hover:bg-orange-800 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Block pending users unless explicitly allowed
  if (profile && profile.status === 'pending' && !allowPending) {
    return <PendingApprovalPage />
  }

  // Block rejected users
  if (profile && profile.status === 'rejected') {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

export default ProtectedRoute

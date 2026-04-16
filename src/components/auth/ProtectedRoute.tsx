import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import type { UserRole } from '../../types/database.types'
import { Loader2 } from 'lucide-react'
import PendingApprovalPage from '../../pages/PendingApprovalPage'
import { useEffect, useState } from 'react'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
  allowPending?: boolean
}

const ProtectedRoute = ({ children, allowedRoles, allowPending = false }: ProtectedRouteProps) => {
  const { user, profile, initialized, fetchProfile } = useAuthStore()
  const location = useLocation()
  const [profileTimeout, setProfileTimeout] = useState(false)

  // Retry fetching profile if user exists but profile doesn't
  useEffect(() => {
    if (initialized && user && !profile && !profileTimeout) {
      const timer = setTimeout(() => {
        fetchProfile()
      }, 1000)
      
      // Set timeout after 5 seconds to prevent infinite loading
      const timeoutTimer = setTimeout(() => {
        setProfileTimeout(true)
      }, 5000)
      
      return () => {
        clearTimeout(timer)
        clearTimeout(timeoutTimer)
      }
    }
  }, [initialized, user, profile, profileTimeout, fetchProfile])

  // Wait for auth to be initialized
  if (!initialized) {
    return (
      <div className="h-screen flex items-center justify-center" role="status" aria-live="polite">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
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
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        <span className="sr-only">Loading...</span>
      </div>
    )
  }

  // If profile failed to load after timeout, redirect to login
  if (!profile && profileTimeout) {
    return <Navigate to="/login" state={{ from: location }} replace />
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

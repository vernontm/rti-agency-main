import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './stores/authStore'

import MainLayout from './components/layout/MainLayout'
import ProtectedRoute from './components/auth/ProtectedRoute'

import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'

import DashboardPage from './pages/DashboardPage'
import UsersPage from './pages/UsersPage'
import TrainingPage from './pages/TrainingPage'
import AnnouncementsPage from './pages/AnnouncementsPage'
import SettingsPage from './pages/SettingsPage'
import FormBuilderPage from './pages/admin/FormBuilderPage'
import VideoManagementPage from './pages/admin/VideoManagementPage'
import VideoSettingsPage from './pages/admin/VideoSettingsPage'
import PendingUsersPage from './pages/admin/PendingUsersPage'
import JobApplicationsPage from './pages/admin/JobApplicationsPage'
import JobPositionsManagementPage from './pages/admin/JobPositionsManagementPage'
import InboxPage from './pages/admin/InboxPage'
import AdvisoriesManagementPage from './pages/admin/AdvisoriesManagementPage'
import ArchivesPage from './pages/admin/ArchivesPage'
import EducatorAreaPage from './pages/EducatorAreaPage'
import AdvisoriesPage from './pages/AdvisoriesPage'
import CalendarPage from './pages/CalendarPage'
import LandingPage from './pages/LandingPage'
import JobsPage from './pages/JobsPage'
import ContactPage from './pages/ContactPage'

const ProtectedLayout = () => {
  const { initialized } = useAuthStore()

  if (!initialized) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <ProtectedRoute>
      <MainLayout />
    </ProtectedRoute>
  )
}

function App() {
  const { initialize } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/home" element={<LandingPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Protected routes */}
        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/training" element={<TrainingPage />} />
          <Route path="/announcements" element={<AnnouncementsPage />} />
          <Route path="/educator-area" element={<EducatorAreaPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/documents" element={<AdvisoriesPage />} />
          <Route path="/admin/forms" element={<FormBuilderPage />} />
          <Route path="/admin/videos" element={<VideoManagementPage />} />
          <Route path="/admin/video-settings" element={<VideoSettingsPage />} />
          <Route path="/admin/pending-users" element={<PendingUsersPage />} />
          <Route path="/admin/job-applications" element={<JobApplicationsPage />} />
          <Route path="/admin/job-positions" element={<JobPositionsManagementPage />} />
          <Route path="/admin/inbox" element={<InboxPage />} />
          <Route path="/admin/file-manager" element={<AdvisoriesManagementPage />} />
          <Route path="/admin/archives" element={<ArchivesPage />} />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="top-right" toastOptions={{ style: { marginTop: '70px' } }} />
    </BrowserRouter>
  )
}

export default App

import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { User, Lock, Bell, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import type { NotificationRecipients } from '../types/database.types'

interface NotificationSetting {
  id: string
  notification_type: string
  recipients: NotificationRecipients
  enabled: boolean
  updated_by: string | null
  updated_at: string
}

const NOTIFICATION_LABELS: Record<string, { label: string; description: string }> = {
  user_registration: { label: 'New User Registration', description: 'When a new user signs up' },
  form_submission: { label: 'Form Submissions', description: 'When a form is submitted' },
  job_application: { label: 'Job Applications', description: 'When a job application is received' },
  contact_submission: { label: 'Contact Form', description: 'When a contact form is submitted' },
  announcement: { label: 'Announcements', description: 'When a new announcement is created' },
  calendar_event: { label: 'Calendar Events', description: 'When a calendar note is added' },
}

const RECIPIENT_OPTIONS: { value: NotificationRecipients; label: string }[] = [
  { value: 'admin', label: 'Admins Only' },
  { value: 'employee', label: 'Employees Only' },
  { value: 'both', label: 'Admin & Employees' },
  { value: 'none', label: 'Nobody' },
]

const SettingsPage = () => {
  const { profile, updatePassword } = useAuthStore()
  const [activeTab, setActiveTab] = useState('profile')
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [loading, setLoading] = useState(false)
  const [notificationSettings, setNotificationSettings] = useState<NotificationSetting[]>([])
  const [notifLoading, setNotifLoading] = useState(false)

  const isAdmin = profile?.role === 'admin'

  // Fetch notification settings when tab is selected
  useEffect(() => {
    if (activeTab === 'notifications' && isAdmin) {
      fetchNotificationSettings()
    }
  }, [activeTab, isAdmin])

  const fetchNotificationSettings = async () => {
    setNotifLoading(true)
    try {
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .order('notification_type')
      if (error) throw error
      setNotificationSettings(data || [])
    } catch (error) {
      console.error('Error fetching notification settings:', error)
      toast.error('Failed to load notification settings')
    } finally {
      setNotifLoading(false)
    }
  }

  const updateNotificationSetting = async (
    id: string,
    updates: Partial<Pick<NotificationSetting, 'enabled' | 'recipients'>>
  ) => {
    // Optimistic update
    setNotificationSettings(prev =>
      prev.map(s => (s.id === id ? { ...s, ...updates } : s))
    )

    try {
      const { error } = await supabase
        .from('notification_settings')
        .update({ ...updates, updated_by: profile?.id, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      toast.success('Notification setting updated')
    } catch (error) {
      console.error('Error updating notification setting:', error)
      toast.error('Failed to update setting')
      // Revert on failure
      fetchNotificationSettings()
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("Passwords don't match")
      return
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    try {
      const { error } = await updatePassword(passwordForm.newPassword)
      if (error) throw error
      toast.success('Password updated successfully')
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (error) {
      toast.error('Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Lock },
    ...(isAdmin ? [{ id: 'notifications', label: 'Notifications', icon: Bell }] : []),
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your account settings</p>
      </div>

      <div className="flex gap-6">
        <Card className="w-64 h-fit" padding="sm">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </Card>

        <div className="flex-1">
          {activeTab === 'profile' && (
            <Card>
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Profile Information</h2>
              <div className="space-y-4">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-3xl font-bold text-blue-600">
                      {profile?.full_name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{profile?.full_name}</h3>
                    <p className="text-gray-600">{profile?.email}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded-full capitalize">
                      {profile?.role}
                    </span>
                  </div>
                </div>

                <Input
                  label="Full Name"
                  value={profile?.full_name || ''}
                  disabled
                />
                <Input
                  label="Email"
                  value={profile?.email || ''}
                  disabled
                />
                <Input
                  label="Role"
                  value={profile?.role || ''}
                  disabled
                />
                <p className="text-sm text-gray-500">
                  Contact an administrator to update your profile information.
                </p>
              </div>
            </Card>
          )}

          {activeTab === 'security' && (
            <Card>
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Change Password</h2>
              <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                <Input
                  label="Current Password"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                  }
                  required
                />
                <Input
                  label="New Password"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                  }
                  required
                />
                <Input
                  label="Confirm New Password"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                  }
                  required
                />
                <Button type="submit" loading={loading}>
                  Update Password
                </Button>
              </form>
            </Card>
          )}

          {activeTab === 'notifications' && isAdmin && (
            <Card>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Email Notification Settings</h2>
              <p className="text-sm text-gray-500 mb-6">
                Configure which roles receive email notifications for each event type.
              </p>

              {notifLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : notificationSettings.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No notification settings found.</p>
              ) : (
                <div className="space-y-3">
                  {notificationSettings.map((setting) => {
                    const info = NOTIFICATION_LABELS[setting.notification_type] || {
                      label: setting.notification_type,
                      description: '',
                    }
                    return (
                      <div
                        key={setting.id}
                        className={`flex items-center justify-between p-4 rounded-lg border ${
                          setting.enabled ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          {/* Enable/Disable toggle */}
                          <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={setting.enabled}
                              onChange={(e) =>
                                updateNotificationSetting(setting.id, { enabled: e.target.checked })
                              }
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>

                          <div className="min-w-0">
                            <h3 className={`font-medium ${setting.enabled ? 'text-gray-900' : 'text-gray-400'}`}>
                              {info.label}
                            </h3>
                            <p className={`text-sm ${setting.enabled ? 'text-gray-500' : 'text-gray-400'}`}>
                              {info.description}
                            </p>
                          </div>
                        </div>

                        {/* Recipients dropdown */}
                        <select
                          value={setting.recipients}
                          onChange={(e) =>
                            updateNotificationSetting(setting.id, {
                              recipients: e.target.value as NotificationRecipients,
                            })
                          }
                          disabled={!setting.enabled}
                          className={`ml-4 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            setting.enabled
                              ? 'border-gray-300 text-gray-700 bg-white'
                              : 'border-gray-200 text-gray-400 bg-gray-100 cursor-not-allowed'
                          }`}
                        >
                          {RECIPIENT_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export default SettingsPage

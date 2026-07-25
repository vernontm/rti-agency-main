import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { User, Lock, Bell, Loader2, Megaphone, Plus, Trash2, Edit2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import type { NotificationRecipients } from '../types/database.types'

interface SitePopup {
  id: string
  title: string
  message: string
  is_visible: boolean
  delay_seconds: number
  active_from: string | null
  active_until: string | null
}

interface NotificationSetting {
  id: string
  notification_type: string
  recipients: NotificationRecipients
  enabled: boolean
  updated_by: string | null
  updated_at: string
}

const RECIPIENT_KEYS: NotificationRecipients[] = ['admin', 'employee', 'both', 'none']

const SettingsPage = () => {
  const { t, i18n } = useTranslation()
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
  const [popups, setPopups] = useState<SitePopup[]>([])
  const [popupLoading, setPopupLoading] = useState(false)
  const [editingPopup, setEditingPopup] = useState<SitePopup | null>(null)
  const [showPopupModal, setShowPopupModal] = useState(false)
  const [popupForm, setPopupForm] = useState({
    title: '',
    message: '',
    is_visible: true,
    delay_seconds: 3,
    active_from: '',
    active_until: '',
  })

  const isAdmin = profile?.role === 'admin'

  const locale = i18n.language?.startsWith('es') ? 'es-ES' : 'en-US'

  const getNotificationInfo = (type: string): { label: string; description: string } => {
    const labelKey = `settings.notifications.types.${type}.label`
    const descKey = `settings.notifications.types.${type}.description`
    const label = t(labelKey)
    const description = t(descKey)
    return {
      label: label === labelKey ? type : label,
      description: description === descKey ? '' : description,
    }
  }

  // Fetch notification settings when tab is selected
  useEffect(() => {
    if (activeTab === 'notifications' && isAdmin) {
      fetchNotificationSettings()
    }
    if (activeTab === 'popups' && isAdmin) {
      fetchPopups()
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
      toast.error(t('settings.notifications.loadError'))
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
      toast.success(t('settings.notifications.updateSuccess'))
    } catch (error) {
      console.error('Error updating notification setting:', error)
      toast.error(t('settings.notifications.updateError'))
      // Revert on failure
      fetchNotificationSettings()
    }
  }

  const fetchPopups = async () => {
    setPopupLoading(true)
    try {
      const { data, error } = await supabase
        .from('site_popups')
        .select('*')
        .order('active_from', { ascending: true, nullsFirst: true })
      if (error) throw error
      setPopups(data || [])
    } catch (error) {
      console.error('Error fetching popups:', error)
      toast.error(t('settings.popups.loadError'))
    } finally {
      setPopupLoading(false)
    }
  }

  const openPopupModal = (popup?: SitePopup) => {
    if (popup) {
      setEditingPopup(popup)
      setPopupForm({
        title: popup.title,
        message: popup.message,
        is_visible: popup.is_visible,
        delay_seconds: popup.delay_seconds,
        active_from: popup.active_from ? popup.active_from.slice(0, 16) : '',
        active_until: popup.active_until ? popup.active_until.slice(0, 16) : '',
      })
    } else {
      setEditingPopup(null)
      setPopupForm({ title: '', message: '', is_visible: true, delay_seconds: 3, active_from: '', active_until: '' })
    }
    setShowPopupModal(true)
  }

  const handlePopupSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = {
        title: popupForm.title,
        message: popupForm.message,
        is_visible: popupForm.is_visible,
        delay_seconds: popupForm.delay_seconds,
        active_from: popupForm.active_from || null,
        active_until: popupForm.active_until || null,
      }

      if (editingPopup) {
        const { error } = await supabase.from('site_popups').update(payload).eq('id', editingPopup.id)
        if (error) throw error
        toast.success(t('settings.popups.updateSuccess'))
      } else {
        const { error } = await supabase.from('site_popups').insert(payload)
        if (error) throw error
        toast.success(t('settings.popups.createSuccess'))
      }
      setShowPopupModal(false)
      fetchPopups()
    } catch (error) {
      console.error('Error saving popup:', error)
      toast.error(t('settings.popups.saveError'))
    }
  }

  const togglePopupVisibility = async (popup: SitePopup) => {
    setPopups(prev => prev.map(p => p.id === popup.id ? { ...p, is_visible: !p.is_visible } : p))
    try {
      const { error } = await supabase.from('site_popups').update({ is_visible: !popup.is_visible }).eq('id', popup.id)
      if (error) throw error
      toast.success(popup.is_visible ? t('settings.popups.hiddenToast') : t('settings.popups.visibleToast'))
    } catch {
      toast.error(t('settings.popups.toggleError'))
      fetchPopups()
    }
  }

  const deletePopup = async (id: string) => {
    if (!confirm(t('settings.popups.deleteConfirm'))) return
    try {
      const { error } = await supabase.from('site_popups').delete().eq('id', id)
      if (error) throw error
      toast.success(t('settings.popups.deletedToast'))
      fetchPopups()
    } catch {
      toast.error(t('settings.popups.deleteError'))
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error(t('settings.passwordsDontMatch'))
      return
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error(t('settings.passwordMinLength'))
      return
    }

    setLoading(true)
    try {
      const { error } = await updatePassword(passwordForm.newPassword)
      if (error) throw error
      toast.success(t('settings.passwordUpdated'))
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (error) {
      toast.error(t('settings.updatePasswordError'))
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: 'profile', label: t('settings.profileSection'), icon: User },
    { id: 'security', label: t('settings.securitySection'), icon: Lock },
    ...(isAdmin ? [
      { id: 'notifications', label: t('settings.notificationsSection'), icon: Bell },
      { id: 'popups', label: t('settings.sitePopupsSection'), icon: Megaphone },
    ] : []),
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h1>
        <p className="text-gray-600 mt-1">{t('settings.subtitle')}</p>
      </div>

      <div className="flex gap-6">
        <Card className="w-64 h-fit" padding="sm">
          <nav role="tablist" aria-label={t('settings.tabsAriaLabel')} className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                id={`settings-tab-${tab.id}`}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`settings-tabpanel-${tab.id}`}
                tabIndex={activeTab === tab.id ? 0 : -1}
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

        <div className="flex-1" role="tabpanel" id={`settings-tabpanel-${activeTab}`} aria-labelledby={`settings-tab-${activeTab}`}>
          {activeTab === 'profile' && (
            <Card>
              <h2 className="text-lg font-semibold text-gray-900 mb-6">{t('settings.profileInformation')}</h2>
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
                  label={t('settings.fullNameField')}
                  value={profile?.full_name || ''}
                  disabled
                />
                <Input
                  label={t('settings.emailField')}
                  value={profile?.email || ''}
                  disabled
                />
                <Input
                  label={t('settings.roleField')}
                  value={profile?.role || ''}
                  disabled
                />
                <p className="text-sm text-gray-500">
                  {t('settings.contactAdminHint')}
                </p>
              </div>
            </Card>
          )}

          {activeTab === 'security' && (
            <Card>
              <h2 className="text-lg font-semibold text-gray-900 mb-6">{t('settings.changePasswordHeading')}</h2>
              <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                <Input
                  label={t('settings.currentPasswordField')}
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                  }
                  required
                />
                <Input
                  label={t('settings.newPasswordField')}
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                  }
                  required
                />
                <Input
                  label={t('settings.confirmPasswordField')}
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                  }
                  required
                />
                <Button type="submit" loading={loading}>
                  {t('settings.updatePassword')}
                </Button>
              </form>
            </Card>
          )}

          {activeTab === 'popups' && isAdmin && (
            <Card>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{t('settings.popups.heading')}</h2>
                  <p className="text-sm text-gray-500">{t('settings.popups.subheading')}</p>
                </div>
                <button
                  onClick={() => openPopupModal()}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  {t('settings.popups.newPopup')}
                </button>
              </div>

              {popupLoading ? (
                <div className="flex items-center justify-center py-12" role="status" aria-live="polite">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  <span className="sr-only">{t('settings.popups.loading')}</span>
                </div>
              ) : popups.length === 0 ? (
                <p className="text-gray-500 text-center py-8">{t('settings.popups.empty')}</p>
              ) : (
                <div className="space-y-3">
                  {popups.map((popup) => {
                    const now = new Date()
                    const from = popup.active_from ? new Date(popup.active_from) : null
                    const until = popup.active_until ? new Date(popup.active_until) : null
                    const isActive = popup.is_visible && (!from || now >= from) && (!until || now <= until)

                    return (
                      <div
                        key={popup.id}
                        className={`p-4 rounded-lg border ${isActive ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-gray-900">{popup.title}</h3>
                              {isActive && (
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">{t('settings.popups.activeNow')}</span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 line-clamp-2 mb-2">{popup.message}</p>
                            <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                              <span>{t('settings.popups.delayLabel', { seconds: popup.delay_seconds })}</span>
                              {popup.active_from && <span>{t('settings.popups.fromLabel', { date: new Date(popup.active_from).toLocaleDateString(locale) })}</span>}
                              {popup.active_until && <span>{t('settings.popups.untilLabel', { date: new Date(popup.active_until).toLocaleDateString(locale) })}</span>}
                              {!popup.active_from && !popup.active_until && <span>{t('settings.popups.alwaysActive')}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={popup.is_visible}
                                onChange={() => togglePopupVisibility(popup)}
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                            <button onClick={() => openPopupModal(popup)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg" aria-label={t('settings.popups.editAria')}>
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => deletePopup(popup.id)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg" aria-label={t('settings.popups.deleteAria')}>
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          )}

          {activeTab === 'notifications' && isAdmin && (
            <Card>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">{t('settings.notifications.heading')}</h2>
              <p className="text-sm text-gray-500 mb-6">
                {t('settings.notifications.subheading')}
              </p>

              {notifLoading ? (
                <div className="flex items-center justify-center py-12" role="status" aria-live="polite">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  <span className="sr-only">{t('settings.notifications.loading')}</span>
                </div>
              ) : notificationSettings.length === 0 ? (
                <p className="text-gray-500 text-center py-8">{t('settings.notifications.empty')}</p>
              ) : (
                <div className="space-y-3">
                  {notificationSettings.map((setting) => {
                    const info = getNotificationInfo(setting.notification_type)
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
                          {RECIPIENT_KEYS.map((value) => (
                            <option key={value} value={value}>
                              {t(`settings.notifications.recipients.${value}`)}
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

      {showPopupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onKeyDown={(e) => e.key === 'Escape' && setShowPopupModal(false)}>
          <Card className="w-full max-w-lg" role="dialog" aria-modal="true" aria-labelledby="popup-modal-title">
            <div className="flex items-center justify-between mb-6">
              <h2 id="popup-modal-title" className="text-xl font-bold text-gray-900">
                {editingPopup ? t('settings.popups.editModalTitle') : t('settings.popups.newModalTitle')}
              </h2>
              <button onClick={() => setShowPopupModal(false)} className="p-2 hover:bg-gray-100 rounded-lg" aria-label={t('common.closeDialog')}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePopupSubmit} className="space-y-4">
              <Input
                label={t('settings.popups.titleField')}
                value={popupForm.title}
                onChange={(e) => setPopupForm({ ...popupForm, title: e.target.value })}
                placeholder={t('settings.popups.titlePlaceholder')}
                required
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.popups.messageField')}</label>
                <textarea
                  value={popupForm.message}
                  onChange={(e) => setPopupForm({ ...popupForm, message: e.target.value })}
                  rows={5}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder={t('settings.popups.messagePlaceholder')}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.popups.delayField')}</label>
                  <input
                    type="number"
                    min="0"
                    value={popupForm.delay_seconds}
                    onChange={(e) => setPopupForm({ ...popupForm, delay_seconds: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={popupForm.is_visible}
                      onChange={(e) => setPopupForm({ ...popupForm, is_visible: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">{t('settings.popups.visibleLabel')}</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.popups.activeFromField')}</label>
                  <input
                    type="datetime-local"
                    value={popupForm.active_from}
                    onChange={(e) => setPopupForm({ ...popupForm, active_from: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.popups.activeUntilField')}</label>
                  <input
                    type="datetime-local"
                    value={popupForm.active_until}
                    onChange={(e) => setPopupForm({ ...popupForm, active_until: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">{t('settings.popups.dateRangeHint')}</p>

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowPopupModal(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" className="flex-1">
                  {editingPopup ? t('settings.popups.updateButton') : t('settings.popups.createButton')}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}

export default SettingsPage

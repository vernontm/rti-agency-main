import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import type { Tables, AnnouncementAudience } from '../types/database.types'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { Bell, Plus, X, Send, Users, Clock, Trash2, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'

interface AnnouncementWithReads extends Tables<'announcements'> {
  announcement_reads?: Tables<'announcement_reads'>[]
}

const AnnouncementsPage = () => {
  const { t, i18n } = useTranslation()
  const { profile } = useAuthStore()
  const [announcements, setAnnouncements] = useState<AnnouncementWithReads[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    target_audience: 'all' as AnnouncementAudience,
  })

  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    fetchAnnouncements()
  }, [])

  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select(`
          *,
          announcement_reads (*)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setAnnouncements(data || [])
    } catch (error) {
      console.error('Error fetching announcements:', error)
      toast.error(t('announcements.loadError'))
    } finally {
      setLoading(false)
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingId(null)
    setFormData({ title: '', content: '', target_audience: 'all' })
  }

  const openEdit = (announcement: AnnouncementWithReads) => {
    setEditingId(announcement.id)
    setFormData({
      title: announcement.title,
      content: announcement.content,
      target_audience: announcement.target_audience,
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    try {
      if (editingId) {
        const { error } = await supabase
          .from('announcements')
          .update({
            title: formData.title,
            content: formData.content,
            target_audience: formData.target_audience,
          })
          .eq('id', editingId)

        if (error) throw error
        toast.success(t('announcements.updated'))
      } else {
        const { error } = await supabase.from('announcements').insert({
          title: formData.title,
          content: formData.content,
          target_audience: formData.target_audience,
          created_by: profile.id,
          sent_at: new Date().toISOString(),
        })

        if (error) throw error
        toast.success(t('announcements.created'))
      }

      closeModal()
      fetchAnnouncements()
    } catch (error) {
      console.error('Error saving announcement:', error)
      toast.error(editingId ? t('announcements.updateError') : t('announcements.createError'))
    }
  }

  const handleDelete = async (announcementId: string, title: string) => {
    if (!confirm(t('announcements.deleteConfirm', { title }))) return

    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', announcementId)

      if (error) throw error

      setAnnouncements(prev => prev.filter(a => a.id !== announcementId))
      toast.success(t('announcements.deleted'))
    } catch (error) {
      console.error('Error deleting announcement:', error)
      toast.error(t('announcements.deleteError'))
    }
  }

  const markAsRead = async (announcementId: string) => {
    if (!profile) return

    try {
      await supabase.from('announcement_reads').upsert({
        announcement_id: announcementId,
        user_id: profile.id,
      }, { onConflict: 'announcement_id,user_id' })
      fetchAnnouncements()
    } catch (error) {
      console.error('Error marking as read:', error)
    }
  }

  const isRead = (announcement: AnnouncementWithReads) => {
    return announcement.announcement_reads?.some(r => r.user_id === profile?.id) || false
  }

  const getAudienceBadge = (audience: AnnouncementAudience) => {
    const badgeStyles: Record<string, string> = {
      all: 'bg-blue-100 text-blue-800',
      employees: 'bg-purple-100 text-purple-800',
      clients: 'bg-green-100 text-green-800',
      admins: 'bg-red-100 text-red-800',
      specific: 'bg-orange-100 text-orange-800',
    }
    const badgeLabels: Record<string, string> = {
      all: t('announcements.audienceBadges.all'),
      employees: t('announcements.audienceBadges.employees'),
      clients: t('announcements.audienceBadges.clients'),
      admins: t('announcements.audienceBadges.admins'),
      specific: t('announcements.audienceBadges.specific'),
    }
    const color = badgeStyles[audience] || badgeStyles.all
    const label = badgeLabels[audience] || badgeLabels.all
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>
        {label}
      </span>
    )
  }

  // Filter announcements based on user role and target audience
  const filteredAnnouncements = announcements.filter(announcement => {
    // Only show sent announcements to non-admins
    if (!isAdmin && !announcement.sent_at) return false

    const audience = announcement.target_audience

    // 'all' is visible to everyone
    if (audience === 'all') return true

    // Admins can see all announcements
    if (isAdmin) return true

    // Filter based on user role
    if (audience === 'employees' && profile?.role === 'employee') return true
    if (audience === 'clients' && profile?.role === 'client') return true
    if (audience === 'admins' && profile?.role === 'admin') return true

    return false
  })

  const locale = i18n.language?.startsWith('es') ? 'es-ES' : 'en-US'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="sr-only">{t('common.loadingSr')}</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('announcements.title')}</h1>
          <p className="text-gray-600 mt-1">{t('announcements.subtitle')}</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4 mr-1" />
            {t('announcements.newButton')}
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {filteredAnnouncements.map((announcement) => {
          const read = isRead(announcement)
          return (
            <Card
              key={announcement.id}
              className={`transition-all ${!read ? 'border-l-4 border-l-blue-500' : ''}`}
              onClick={() => !read && markAsRead(announcement.id)}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${read ? 'bg-gray-100' : 'bg-blue-100'}`}>
                  <Bell className={`w-6 h-6 ${read ? 'text-gray-500' : 'text-blue-600'}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{announcement.title}</h3>
                    {isAdmin && getAudienceBadge(announcement.target_audience)}
                    {!read && (
                      <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                        {t('announcements.newBadge')}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 mb-2">{announcement.content}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {new Date(announcement.created_at).toLocaleDateString(locale)}
                    </span>
                    {isAdmin && (
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {t('announcements.readCount', { count: announcement.announcement_reads?.length || 0 })}
                      </span>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        openEdit(announcement)
                      }}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      aria-label={t('announcements.editAria', { title: announcement.title })}
                      title={t('announcements.editTitleAttr')}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(announcement.id, announcement.title)
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      aria-label={t('announcements.deleteAria', { title: announcement.title })}
                      title={t('announcements.deleteTitleAttr')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </Card>
          )
        })}

        {filteredAnnouncements.length === 0 && (
          <Card className="text-center py-12 text-gray-500">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{t('announcements.empty')}</p>
          </Card>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onKeyDown={(e) => e.key === 'Escape' && closeModal()}>
          <Card className="w-full max-w-lg" role="dialog" aria-modal="true" aria-labelledby="announcement-modal-title">
            <div className="flex items-center justify-between mb-6">
              <h2 id="announcement-modal-title" className="text-xl font-bold text-gray-900">
                {editingId ? t('announcements.editTitle') : t('announcements.newTitle')}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-gray-100 rounded-lg"
                aria-label={t('common.closeDialog')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label={t('announcements.titleField')}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('announcements.contentField')}
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('announcements.audienceField')}
                </label>
                <select
                  value={formData.target_audience}
                  onChange={(e) =>
                    setFormData({ ...formData, target_audience: e.target.value as AnnouncementAudience })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">{t('announcements.audienceEveryone')}</option>
                  <option value="admins">{t('announcements.audienceAdmins')}</option>
                  <option value="employees">{t('announcements.audienceEmployees')}</option>
                  <option value="clients">{t('announcements.audienceClients')}</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={closeModal}
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit" className="flex-1">
                  <Send className="w-4 h-4 mr-1" />
                  {editingId ? t('announcements.saveChangesButton') : t('announcements.publishButton')}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}

export default AnnouncementsPage

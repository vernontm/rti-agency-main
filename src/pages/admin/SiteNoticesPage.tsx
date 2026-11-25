import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { Bell, Plus, X, Save, Trash2, Pencil, Eye, EyeOff, Clock, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface SiteNotice {
  id: string
  title: string | null
  message: string
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// Convert a UTC ISO timestamp to the string format a <input type="datetime-local"> wants (local time, no TZ).
const toLocalInputValue = (iso: string | null): string => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Convert a datetime-local string (user-local) back to a UTC ISO string for the DB.
const fromLocalInputValue = (local: string): string | null => {
  if (!local) return null
  const d = new Date(local)
  if (isNaN(d.getTime())) return null
  return d.toISOString()
}

const SiteNoticesPage = () => {
  const { profile } = useAuthStore()
  const isAdmin = profile?.role === 'admin'
  const [notices, setNotices] = useState<SiteNotice[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    message: '',
    starts_at: '',
    ends_at: '',
    is_active: true,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    fetchNotices()
  }, [isAdmin])

  const fetchNotices = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('site_notices')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setNotices((data as SiteNotice[]) || [])
    } catch (err) {
      console.error('Failed to load site notices:', err)
      toast.error('Failed to load site notices')
    } finally {
      setLoading(false)
    }
  }

  const openNew = () => {
    setEditingId(null)
    setForm({ title: '', message: '', starts_at: '', ends_at: '', is_active: true })
    setShowModal(true)
  }

  const openEdit = (notice: SiteNotice) => {
    setEditingId(notice.id)
    setForm({
      title: notice.title || '',
      message: notice.message,
      starts_at: toLocalInputValue(notice.starts_at),
      ends_at: toLocalInputValue(notice.ends_at),
      is_active: notice.is_active,
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingId(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.message.trim()) {
      toast.error('Message is required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim() || null,
        message: form.message.trim(),
        starts_at: fromLocalInputValue(form.starts_at),
        ends_at: fromLocalInputValue(form.ends_at),
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      }
      if (editingId) {
        const { error } = await supabase.from('site_notices').update(payload).eq('id', editingId)
        if (error) throw error
        toast.success('Notice updated')
      } else {
        const { error } = await supabase.from('site_notices').insert({
          ...payload,
          created_by: profile?.id,
        })
        if (error) throw error
        toast.success('Notice created')
      }
      closeModal()
      fetchNotices()
    } catch (err: any) {
      console.error('Failed to save notice:', err)
      toast.error(`Failed to save: ${err?.message || 'unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (notice: SiteNotice) => {
    try {
      const { error } = await supabase
        .from('site_notices')
        .update({ is_active: !notice.is_active, updated_at: new Date().toISOString() })
        .eq('id', notice.id)
      if (error) throw error
      setNotices(prev => prev.map(n => n.id === notice.id ? { ...n, is_active: !notice.is_active } : n))
      toast.success(notice.is_active ? 'Notice hidden' : 'Notice showing')
    } catch (err) {
      console.error('Failed to toggle:', err)
      toast.error('Failed to update')
    }
  }

  const deleteNotice = async (notice: SiteNotice) => {
    const label = notice.title?.trim() || notice.message.slice(0, 40)
    if (!confirm(`Delete "${label}"? This cannot be undone.`)) return
    try {
      const { error } = await supabase.from('site_notices').delete().eq('id', notice.id)
      if (error) throw error
      setNotices(prev => prev.filter(n => n.id !== notice.id))
      toast.success('Notice deleted')
    } catch (err) {
      console.error('Failed to delete:', err)
      toast.error('Failed to delete')
    }
  }

  // Describe the current display status of a notice: showing now, scheduled, expired, or hidden.
  const statusOf = (n: SiteNotice): { label: string; color: string } => {
    if (!n.is_active) return { label: 'Hidden', color: 'bg-gray-100 text-gray-600' }
    const now = Date.now()
    if (n.starts_at && new Date(n.starts_at).getTime() > now) {
      return { label: 'Scheduled', color: 'bg-blue-100 text-blue-800' }
    }
    if (n.ends_at && new Date(n.ends_at).getTime() <= now) {
      return { label: 'Expired', color: 'bg-gray-100 text-gray-600' }
    }
    return { label: 'Showing now', color: 'bg-green-100 text-green-800' }
  }

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'anytime'

  if (!isAdmin) {
    return <div className="p-8 text-center text-gray-500">Admins only.</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bell className="w-6 h-6 text-orange-500" />
            Site Notices
          </h1>
          <p className="text-gray-600 mt-1">
            Holiday banners and alerts shown on the public landing page. Add one for a date range and it appears automatically.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 mr-2" />
          New Notice
        </Button>
      </div>

      {loading ? (
        <Card className="text-center py-12 text-gray-500">Loading...</Card>
      ) : notices.length === 0 ? (
        <Card className="text-center py-12 text-gray-500">
          <AlertCircle className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p>No site notices yet.</p>
          <p className="text-xs text-gray-400 mt-1">Click "New Notice" to add one for the landing page.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {notices.map((n) => {
            const status = statusOf(n)
            return (
              <Card key={n.id} className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {fmtDate(n.starts_at)} to {fmtDate(n.ends_at)}
                      </span>
                    </div>
                    {n.title && <h3 className="font-semibold text-gray-900">{n.title}</h3>}
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{n.message}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => toggleActive(n)}
                      className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
                      title={n.is_active ? 'Hide this notice' : 'Show this notice'}
                    >
                      {n.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => openEdit(n)}
                      className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteNotice(n)}
                      className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto" onClick={closeModal}>
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                {editingId ? 'Edit Notice' : 'New Notice'}
              </h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Title (optional, shown in bold)"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Happy Thanksgiving!"
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  rows={4}
                  required
                  placeholder="Our office will be closed..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Show starting (optional)</label>
                  <input
                    type="datetime-local"
                    value={form.starts_at}
                    onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave blank to show immediately.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hide after (optional)</label>
                  <input
                    type="datetime-local"
                    value={form.ends_at}
                    onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave blank to show indefinitely.</p>
                </div>
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Active (uncheck to hide without deleting)</span>
              </label>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={closeModal}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" loading={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  {editingId ? 'Save Changes' : 'Create Notice'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}

export default SiteNoticesPage

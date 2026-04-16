import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import Button from '../../components/ui/Button'
import {
  Inbox,
  Mail,
  MailOpen,
  UserPlus,
  Briefcase,
  FileText,
  MessageSquare,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  Archive,
  Reply,
  Star,
  ShieldAlert,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react'
import toast from 'react-hot-toast'

type InboxCategory = 'all' | 'approvals' | 'applications' | 'forms' | 'contacts' | 'spam'

interface InboxItem {
  id: string
  type: 'approval' | 'application' | 'form' | 'contact'
  title: string
  subtitle: string
  preview: string
  status: string
  isRead: boolean
  createdAt: string
  data: Record<string, unknown>
}

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-orange-500', 'bg-emerald-500', 'bg-teal-500',
  'bg-rose-500', 'bg-sky-500', 'bg-amber-500', 'bg-indigo-500',
  'bg-pink-500', 'bg-cyan-500',
]

const getAvatarColor = (name: string) => {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

const getInitials = (name: string) => {
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
}

const InboxPage = () => {
  const { profile } = useAuthStore()
  const [items, setItems] = useState<InboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null)
  const [category, setCategory] = useState<InboxCategory>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchAllItems()
  }, [])

  const fetchAllItems = async () => {
    setLoading(true)
    try {
      const allItems: InboxItem[] = []

      const [
        { data: pendingUsers },
        { data: applications },
        { data: formSubmissions },
        { data: contacts },
      ] = await Promise.all([
        supabase
          .from('users')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
        supabase
          .from('job_applications')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('form_submissions')
          .select(`*, forms (form_name), users:submitted_by (full_name, email)`)
          .eq('status', 'pending')
          .order('submitted_at', { ascending: false }),
        supabase
          .from('contact_submissions')
          .select('*')
          .order('created_at', { ascending: false }),
      ])

      if (pendingUsers) {
        pendingUsers.forEach((user: any) => {
          allItems.push({
            id: user.id,
            type: 'approval',
            title: user.full_name,
            subtitle: `New ${user.role} registration`,
            preview: user.email,
            status: 'pending',
            isRead: false,
            createdAt: user.created_at,
            data: user,
          })
        })
      }

      if (applications) {
        applications.forEach((app: any) => {
          allItems.push({
            id: app.id,
            type: 'application',
            title: app.full_name,
            subtitle: `Applied for: ${app.position_applied}`,
            preview: app.email,
            status: app.status,
            isRead: app.status !== 'pending',
            createdAt: app.created_at,
            data: app,
          })
        })
      }

      if (formSubmissions) {
        formSubmissions.forEach((sub: any) => {
          allItems.push({
            id: sub.id,
            type: 'form',
            title: sub.forms?.form_name || 'Unknown Form',
            subtitle: `Submitted by: ${sub.users?.full_name || 'Unknown'}`,
            preview: sub.users?.email || '',
            status: sub.status,
            isRead: false,
            createdAt: sub.submitted_at,
            data: sub,
          })
        })
      }

      if (contacts) {
        contacts.forEach((contact: any) => {
          allItems.push({
            id: contact.id,
            type: 'contact',
            title: contact.name,
            subtitle: contact.subject,
            preview: contact.message.substring(0, 120) + (contact.message.length > 120 ? '...' : ''),
            status: contact.status,
            isRead: contact.status !== 'new',
            createdAt: contact.created_at,
            data: contact,
          })
        })
      }

      allItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setItems(allItems)
    } catch (error) {
      console.error('Error fetching inbox items:', error)
      toast.error('Failed to load inbox')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      new: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      reviewed: 'bg-gray-100 text-gray-800',
      hired: 'bg-green-100 text-green-800',
      read: 'bg-gray-100 text-gray-800',
      replied: 'bg-green-100 text-green-800',
      archived: 'bg-gray-100 text-gray-600',
      spam: 'bg-red-100 text-red-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  // --- Action handlers ---
  const handleApproveUser = async (userId: string) => {
    try {
      const { error } = await supabase.from('users').update({ status: 'approved' }).eq('id', userId)
      if (error) throw error
      toast.success('User approved')
      fetchAllItems()
      setSelectedItem(null)
    } catch { toast.error('Failed to approve user') }
  }

  const handleRejectUser = async (userId: string) => {
    try {
      const { error } = await supabase.from('users').update({ status: 'rejected' }).eq('id', userId)
      if (error) throw error
      toast.success('User rejected')
      fetchAllItems()
      setSelectedItem(null)
    } catch { toast.error('Failed to reject user') }
  }

  const handleUpdateApplicationStatus = async (appId: string, status: string) => {
    try {
      const { error } = await supabase.from('job_applications').update({ status, reviewed_by: profile?.id, reviewed_at: new Date().toISOString() }).eq('id', appId)
      if (error) throw error
      toast.success(`Application marked as ${status}`)
      fetchAllItems()
      setSelectedItem(null)
    } catch { toast.error('Failed to update application') }
  }

  const handleUpdateContactStatus = async (contactId: string, status: string) => {
    try {
      const { error } = await supabase.from('contact_submissions').update({ status, replied_by: status === 'replied' ? profile?.id : null, replied_at: status === 'replied' ? new Date().toISOString() : null }).eq('id', contactId)
      if (error) throw error
      toast.success('Contact updated')
      fetchAllItems()
      if (status === 'archived' || status === 'spam') setSelectedItem(null)
    } catch { toast.error('Failed to update contact') }
  }

  const handleApproveForm = async (submissionId: string) => {
    try {
      const { error } = await supabase.from('form_submissions').update({ status: 'approved', reviewed_by: profile?.id, reviewed_at: new Date().toISOString() }).eq('id', submissionId)
      if (error) throw error
      toast.success('Form approved')
      fetchAllItems()
      setSelectedItem(null)
    } catch { toast.error('Failed to approve form') }
  }

  const handleRejectForm = async (submissionId: string) => {
    try {
      const { error } = await supabase.from('form_submissions').update({ status: 'rejected', reviewed_by: profile?.id, reviewed_at: new Date().toISOString() }).eq('id', submissionId)
      if (error) throw error
      toast.success('Form rejected')
      fetchAllItems()
      setSelectedItem(null)
    } catch { toast.error('Failed to reject form') }
  }

  // --- Filtering ---
  const filteredItems = items.filter(item => {
    if (category === 'spam') {
      if (item.type !== 'contact' || item.status !== 'spam') return false
    } else {
      if (item.status === 'spam') return false
      if (category !== 'all') {
        const map: Record<string, string[]> = {
          approvals: ['approval'], applications: ['application'], forms: ['form'], contacts: ['contact'],
        }
        if (map[category] && !map[category].includes(item.type)) return false
      }
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q) || item.preview.toLowerCase().includes(q)
    }
    return true
  })

  const nonSpam = items.filter(i => i.status !== 'spam')
  const counts = {
    all: nonSpam.length,
    approvals: nonSpam.filter(i => i.type === 'approval').length,
    applications: nonSpam.filter(i => i.type === 'application').length,
    forms: nonSpam.filter(i => i.type === 'form').length,
    contacts: nonSpam.filter(i => i.type === 'contact').length,
    spam: items.filter(i => i.status === 'spam').length,
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  // --- Detail View ---
  const renderDetailView = () => {
    if (!selectedItem) return null
    const data = selectedItem.data as Record<string, any>

    return (
      <div className="-m-6 h-screen flex flex-col bg-white">
          {/* Header */}
          <div className="px-6 py-4 border-b flex items-center gap-4">
            <button
              onClick={() => setSelectedItem(null)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Back to list"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ${getAvatarColor(selectedItem.title)}`}>
              {getInitials(selectedItem.title)}
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-900">{selectedItem.title}</h2>
              <p className="text-sm text-gray-500">{selectedItem.subtitle}</p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${getStatusBadge(selectedItem.status)}`}>
              {selectedItem.status}
            </span>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                <Clock className="w-4 h-4" />
                {new Date(selectedItem.createdAt).toLocaleString()}
              </div>

              {/* Approval detail */}
              {selectedItem.type === 'approval' && (
                <div className="bg-gray-50 rounded-lg p-5 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div><p className="text-xs text-gray-500 mb-1">Email</p><p className="font-medium">{data.email}</p></div>
                    <div><p className="text-xs text-gray-500 mb-1">Role</p><p className="font-medium capitalize">{data.role}</p></div>
                  </div>
                </div>
              )}

              {/* Application detail */}
              {selectedItem.type === 'application' && (
                <div className="bg-gray-50 rounded-lg p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><p className="text-xs text-gray-500 mb-1">Email</p><p className="font-medium">{data.email}</p></div>
                    <div><p className="text-xs text-gray-500 mb-1">Phone</p><p className="font-medium">{data.phone}</p></div>
                    <div><p className="text-xs text-gray-500 mb-1">Position</p><p className="font-medium">{data.position_applied}</p></div>
                    <div><p className="text-xs text-gray-500 mb-1">Experience</p><p className="font-medium">{data.experience_years} years</p></div>
                  </div>
                  {data.cover_letter && (
                    <div><p className="text-xs text-gray-500 mb-1">Cover Letter</p><p className="text-gray-700 whitespace-pre-wrap">{data.cover_letter}</p></div>
                  )}
                  {data.resume_url && (
                    <a href={data.resume_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-orange-600 hover:text-orange-700 font-medium">
                      <FileText className="w-4 h-4" /> View Resume
                    </a>
                  )}
                </div>
              )}

              {/* Contact detail */}
              {selectedItem.type === 'contact' && (
                <div className="space-y-4">
                  {selectedItem.status === 'spam' && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-red-700 font-medium text-sm mb-1">
                        <ShieldAlert className="w-4 h-4" />
                        Flagged as Spam (score: {data.spam_score ?? 'N/A'}/100)
                      </div>
                      {Array.isArray(data.spam_reasons) && data.spam_reasons.length > 0 && (
                        <ul className="text-xs text-red-600 list-disc list-inside space-y-0.5">
                          {data.spam_reasons.map((r: string, i: number) => <li key={i}>{r}</li>)}
                        </ul>
                      )}
                    </div>
                  )}
                  <div className="bg-gray-50 rounded-lg p-5">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div><p className="text-xs text-gray-500 mb-1">Email</p><p className="font-medium">{data.email}</p></div>
                      {data.phone && <div><p className="text-xs text-gray-500 mb-1">Phone</p><p className="font-medium">{data.phone}</p></div>}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-2">Message</p>
                      <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{data.message}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Form detail */}
              {selectedItem.type === 'form' && (
                <div className="space-y-4">
                  {data.signed_pdf_url ? (
                    <div>
                      <p className="text-xs text-gray-500 mb-2">Signed Document</p>
                      <div className="border rounded-lg overflow-hidden bg-gray-50">
                        <iframe src={data.signed_pdf_url} className="w-full h-[500px]" title="Signed PDF Preview" />
                      </div>
                      <a href={data.signed_pdf_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-orange-600 hover:text-orange-700 mt-3 font-medium">
                        <FileText className="w-4 h-4" /> Open in New Tab
                      </a>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-5">
                      <p className="text-xs text-gray-500 mb-2">Submitted Data</p>
                      <pre className="text-sm overflow-x-auto">{JSON.stringify(data.data, null, 2)}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Actions bar */}
          <div className="px-6 py-4 border-t bg-gray-50 flex gap-2 flex-wrap">
            {selectedItem.type === 'approval' && selectedItem.status === 'pending' && (
              <>
                <Button onClick={() => handleApproveUser(selectedItem.id)}><CheckCircle className="w-4 h-4 mr-2" />Approve</Button>
                <Button variant="outline" onClick={() => handleRejectUser(selectedItem.id)}><XCircle className="w-4 h-4 mr-2" />Reject</Button>
              </>
            )}
            {selectedItem.type === 'application' && selectedItem.status === 'pending' && (
              <>
                <Button onClick={() => handleUpdateApplicationStatus(selectedItem.id, 'reviewed')}><CheckCircle className="w-4 h-4 mr-2" />Reviewed</Button>
                <Button variant="outline" onClick={() => handleUpdateApplicationStatus(selectedItem.id, 'interviewed')}>Interview</Button>
                <Button variant="outline" onClick={() => handleUpdateApplicationStatus(selectedItem.id, 'hired')}>Hire</Button>
                <Button variant="outline" onClick={() => handleUpdateApplicationStatus(selectedItem.id, 'rejected')}><XCircle className="w-4 h-4 mr-2" />Reject</Button>
              </>
            )}
            {selectedItem.type === 'contact' && selectedItem.status === 'spam' && (
              <Button onClick={() => handleUpdateContactStatus(selectedItem.id, 'new')}><CheckCircle className="w-4 h-4 mr-2" />Not Spam</Button>
            )}
            {selectedItem.type === 'contact' && selectedItem.status !== 'archived' && selectedItem.status !== 'spam' && (
              <>
                {selectedItem.status === 'new' && <Button onClick={() => handleUpdateContactStatus(selectedItem.id, 'read')}><MailOpen className="w-4 h-4 mr-2" />Mark Read</Button>}
                <Button variant="outline" onClick={() => handleUpdateContactStatus(selectedItem.id, 'replied')}><Reply className="w-4 h-4 mr-2" />Replied</Button>
                <Button variant="outline" onClick={() => handleUpdateContactStatus(selectedItem.id, 'spam')}><ShieldAlert className="w-4 h-4 mr-2" />Spam</Button>
                <Button variant="outline" onClick={() => handleUpdateContactStatus(selectedItem.id, 'archived')}><Archive className="w-4 h-4 mr-2" />Archive</Button>
              </>
            )}
            {selectedItem.type === 'form' && selectedItem.status === 'pending' && (
              <>
                <Button onClick={() => handleApproveForm(selectedItem.id)}><CheckCircle className="w-4 h-4 mr-2" />Approve</Button>
                <Button variant="outline" onClick={() => handleRejectForm(selectedItem.id)}><XCircle className="w-4 h-4 mr-2" />Reject</Button>
              </>
            )}
          </div>
      </div>
    )
  }

  // Show detail view when an item is selected
  if (selectedItem) return renderDetailView()

  // --- Main list view ---
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        <span className="sr-only">Loading...</span>
      </div>
    )
  }

  const categories: { key: InboxCategory; label: string; icon: typeof Inbox; count: number; color: string }[] = [
    { key: 'all', label: 'Inbox', icon: Inbox, count: counts.all, color: 'bg-blue-600' },
    { key: 'approvals', label: 'Approvals', icon: UserPlus, count: counts.approvals, color: 'bg-blue-600' },
    { key: 'applications', label: 'Applications', icon: Briefcase, count: counts.applications, color: 'bg-blue-600' },
    { key: 'forms', label: 'Forms', icon: FileText, count: counts.forms, color: 'bg-blue-600' },
    { key: 'contacts', label: 'Messages', icon: MessageSquare, count: counts.contacts, color: 'bg-blue-600' },
    { key: 'spam', label: 'Spam', icon: ShieldAlert, count: counts.spam, color: 'bg-red-500' },
  ]

  return (
    <div className="-m-6 h-[calc(100vh-0px)] flex flex-col bg-white">
      {/* Minimal header — title left, count right */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <h1 className="text-xl font-semibold text-gray-900">
          {categories.find(c => c.key === category)?.label || 'Inbox'}
        </h1>
        <span className="text-sm text-gray-400">{filteredItems.length} messages</span>
      </div>

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left sidebar */}
        <div className="w-56 border-r flex flex-col bg-gray-50/50">
          {/* Search */}
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
              />
            </div>
          </div>

          {/* Folders */}
          <nav className="flex-1 px-2 pb-3">
            {categories.map((cat, idx) => (
              <div key={cat.key}>
                {idx > 0 && <div className="mx-2 border-t border-gray-200" />}
                <button
                  onClick={() => setCategory(cat.key)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    category === cat.key
                      ? 'bg-orange-50 text-orange-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <cat.icon className="w-4 h-4" />
                    {cat.label}
                  </span>
                  {cat.count > 0 && (
                    <span className={`text-xs text-white font-bold rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1.5 ${cat.color}`}>
                      {cat.count}
                    </span>
                  )}
                </button>
              </div>
            ))}
          </nav>

          {/* Refresh at bottom */}
          <div className="p-3 border-t">
            <button
              onClick={fetchAllItems}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Refresh inbox"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
        </div>

        {/* Message rows */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <Mail className="w-12 h-12 mb-3 opacity-40" />
                <p className="text-sm">No messages</p>
              </div>
            ) : (
              filteredItems.map((item) => (
                <button
                  key={`${item.type}-${item.id}`}
                  onClick={() => setSelectedItem(item)}
                  className={`w-full flex items-center gap-4 px-5 py-3 border-b border-gray-100 text-left hover:bg-gray-50 transition-colors ${
                    !item.isRead ? 'bg-white' : 'bg-gray-50/30'
                  }`}
                >
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 ${getAvatarColor(item.title)}`}>
                    {getInitials(item.title)}
                  </div>

                  {/* Sender name — fixed width column */}
                  <span className={`w-40 flex-shrink-0 text-sm truncate ${!item.isRead ? 'font-bold text-gray-900' : 'font-medium text-gray-600'}`}>
                    {item.title}
                  </span>

                  {/* Subject + preview — single line */}
                  <div className="flex-1 min-w-0 text-sm truncate">
                    <span className={!item.isRead ? 'font-semibold text-gray-900' : 'font-normal text-gray-700'}>
                      {item.subtitle}
                    </span>
                    <span className="text-gray-400 mx-1.5">&mdash;</span>
                    <span className="text-gray-400 font-normal">{item.preview}</span>
                  </div>

                  {/* Star */}
                  <Star className="w-4 h-4 text-gray-300 hover:text-yellow-400 flex-shrink-0 transition-colors" />

                  {/* Time */}
                  <span className="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap w-16 text-right">
                    {formatDate(item.createdAt)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default InboxPage

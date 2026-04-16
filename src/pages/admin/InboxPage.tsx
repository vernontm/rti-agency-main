import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import {
  Inbox,
  Mail,
  MailOpen,
  UserPlus,
  Briefcase,
  FileText,
  MessageSquare,
  Search,
  Filter,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  Archive,
  Reply,
  Trash2,
  X,
  ShieldAlert
} from 'lucide-react'
import toast from 'react-hot-toast'

type InboxCategory = 'all' | 'approvals' | 'applications' | 'forms' | 'contacts' | 'spam'
type ItemStatus = 'unread' | 'read' | 'archived'

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

const InboxPage = () => {
  const { profile } = useAuthStore()
  const [items, setItems] = useState<InboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null)
  const [category, setCategory] = useState<InboxCategory>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ItemStatus | 'all'>('all')

  useEffect(() => {
    fetchAllItems()
  }, [])

  const fetchAllItems = async () => {
    setLoading(true)
    try {
      const allItems: InboxItem[] = []

      // Fetch all inbox data in parallel
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
        pendingUsers.forEach((user: { id: string; full_name: string; email: string; role: string; created_at: string }) => {
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
        applications.forEach((app: { id: string; full_name: string; position_applied: string; email: string; status: string; created_at: string }) => {
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
        formSubmissions.forEach((sub: { id: string; forms: { form_name: string } | null; users: { full_name: string; email: string } | null; status: string; submitted_at: string }) => {
          allItems.push({
            id: sub.id,
            type: 'form',
            title: (sub.forms as { form_name: string } | null)?.form_name || 'Unknown Form',
            subtitle: `Submitted by: ${(sub.users as { full_name: string } | null)?.full_name || 'Unknown'}`,
            preview: (sub.users as { email: string } | null)?.email || '',
            status: sub.status,
            isRead: false,
            createdAt: sub.submitted_at,
            data: sub,
          })
        })
      }

      if (contacts) {
        contacts.forEach((contact: { id: string; name: string; subject: string; message: string; status: string; spam_score?: number; spam_reasons?: string[]; created_at: string }) => {
          allItems.push({
            id: contact.id,
            type: 'contact',
            title: contact.name,
            subtitle: contact.subject,
            preview: contact.message.substring(0, 100) + (contact.message.length > 100 ? '...' : ''),
            status: contact.status,
            isRead: contact.status !== 'new',
            createdAt: contact.created_at,
            data: contact,
          })
        })
      }

      // Sort by date
      allItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setItems(allItems)
    } catch (error) {
      console.error('Error fetching inbox items:', error)
      toast.error('Failed to load inbox')
    } finally {
      setLoading(false)
    }
  }

  const getTypeIcon = (type: InboxItem['type']) => {
    switch (type) {
      case 'approval': return UserPlus
      case 'application': return Briefcase
      case 'form': return FileText
      case 'contact': return MessageSquare
    }
  }

  const getTypeColor = (type: InboxItem['type']) => {
    switch (type) {
      case 'approval': return 'bg-blue-100 text-blue-600'
      case 'application': return 'bg-purple-100 text-purple-600'
      case 'form': return 'bg-green-100 text-green-600'
      case 'contact': return 'bg-orange-100 text-orange-600'
    }
  }

  const getStatusBadge = (item: InboxItem) => {
    const statusColors: Record<string, string> = {
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
    return statusColors[item.status] || 'bg-gray-100 text-gray-800'
  }

  const handleApproveUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: 'approved' })
        .eq('id', userId)

      if (error) throw error
      toast.success('User approved')
      fetchAllItems()
      setSelectedItem(null)
    } catch (error) {
      console.error('Error approving user:', error)
      toast.error('Failed to approve user')
    }
  }

  const handleRejectUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: 'rejected' })
        .eq('id', userId)

      if (error) throw error
      toast.success('User rejected')
      fetchAllItems()
      setSelectedItem(null)
    } catch (error) {
      console.error('Error rejecting user:', error)
      toast.error('Failed to reject user')
    }
  }

  const handleUpdateApplicationStatus = async (appId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('job_applications')
        .update({ 
          status,
          reviewed_by: profile?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', appId)

      if (error) throw error
      toast.success(`Application marked as ${status}`)
      fetchAllItems()
      setSelectedItem(null)
    } catch (error) {
      console.error('Error updating application:', error)
      toast.error('Failed to update application')
    }
  }

  const handleUpdateContactStatus = async (contactId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('contact_submissions')
        .update({ 
          status,
          replied_by: status === 'replied' ? profile?.id : null,
          replied_at: status === 'replied' ? new Date().toISOString() : null
        })
        .eq('id', contactId)

      if (error) throw error
      toast.success('Contact updated')
      fetchAllItems()
      if (status === 'archived') setSelectedItem(null)
    } catch (error) {
      console.error('Error updating contact:', error)
      toast.error('Failed to update contact')
    }
  }

  const handleApproveForm = async (submissionId: string) => {
    try {
      const { error } = await supabase
        .from('form_submissions')
        .update({ 
          status: 'approved',
          reviewed_by: profile?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', submissionId)

      if (error) throw error
      toast.success('Form approved')
      fetchAllItems()
      setSelectedItem(null)
    } catch (error) {
      console.error('Error approving form:', error)
      toast.error('Failed to approve form')
    }
  }

  const handleRejectForm = async (submissionId: string) => {
    try {
      const { error } = await supabase
        .from('form_submissions')
        .update({ 
          status: 'rejected',
          reviewed_by: profile?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', submissionId)

      if (error) throw error
      toast.success('Form rejected')
      fetchAllItems()
      setSelectedItem(null)
    } catch (error) {
      console.error('Error rejecting form:', error)
      toast.error('Failed to reject form')
    }
  }

  const filteredItems = items.filter(item => {
    // Spam folder: only show spam contacts
    if (category === 'spam') {
      if (item.type !== 'contact' || item.status !== 'spam') return false
    } else {
      // All other folders: hide spam items
      if (item.status === 'spam') return false

      if (category !== 'all') {
        const categoryMap: Record<InboxCategory, InboxItem['type'][]> = {
          all: ['approval', 'application', 'form', 'contact'],
          approvals: ['approval'],
          applications: ['application'],
          forms: ['form'],
          contacts: ['contact'],
          spam: ['contact'],
        }
        if (!categoryMap[category].includes(item.type)) return false
      }
    }

    if (statusFilter === 'unread' && item.isRead) return false
    if (statusFilter === 'read' && !item.isRead) return false
    if (statusFilter === 'archived' && item.status !== 'archived') return false

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        item.title.toLowerCase().includes(query) ||
        item.subtitle.toLowerCase().includes(query) ||
        item.preview.toLowerCase().includes(query)
      )
    }

    return true
  })

  const getCounts = () => {
    const nonSpam = items.filter(i => i.status !== 'spam')
    return {
      all: nonSpam.length,
      approvals: nonSpam.filter(i => i.type === 'approval').length,
      applications: nonSpam.filter(i => i.type === 'application').length,
      forms: nonSpam.filter(i => i.type === 'form').length,
      contacts: nonSpam.filter(i => i.type === 'contact').length,
      spam: items.filter(i => i.status === 'spam').length,
      unread: nonSpam.filter(i => !i.isRead).length,
    }
  }

  const counts = getCounts()

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const renderDetailView = () => {
    if (!selectedItem) return null

    const data = selectedItem.data as Record<string, unknown>

    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${getTypeColor(selectedItem.type)}`}>
              {(() => { const Icon = getTypeIcon(selectedItem.type); return <Icon className="w-5 h-5" /> })()}
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">{selectedItem.title}</h2>
              <p className="text-sm text-gray-500">{selectedItem.subtitle}</p>
            </div>
          </div>
          <button
            onClick={() => setSelectedItem(null)}
            className="p-2 hover:bg-gray-100 rounded-lg"
            aria-label="Close detail panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              {new Date(selectedItem.createdAt).toLocaleString()}
            </div>

            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(selectedItem)}`}>
              {selectedItem.status}
            </span>

            {/* Type-specific content */}
            {selectedItem.type === 'approval' && (
              <div className="space-y-3 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">Email</label>
                    <p className="font-medium">{data.email as string}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Role</label>
                    <p className="font-medium capitalize">{data.role as string}</p>
                  </div>
                </div>
              </div>
            )}

            {selectedItem.type === 'application' && (
              <div className="space-y-3 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">Email</label>
                    <p className="font-medium">{data.email as string}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Phone</label>
                    <p className="font-medium">{data.phone as string}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Position</label>
                    <p className="font-medium">{data.position_applied as string}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Experience</label>
                    <p className="font-medium">{data.experience_years as number} years</p>
                  </div>
                </div>
                {data.cover_letter && (
                  <div>
                    <label className="text-xs text-gray-500">Cover Letter</label>
                    <p className="mt-1 text-gray-700 whitespace-pre-wrap">{data.cover_letter as string}</p>
                  </div>
                )}
                {data.resume_url && (
                  <a
                    href={data.resume_url as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-orange-600 hover:text-orange-700"
                  >
                    <FileText className="w-4 h-4" />
                    View Resume
                  </a>
                )}
              </div>
            )}

            {selectedItem.type === 'contact' && (
              <div className="space-y-3 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">Email</label>
                    <p className="font-medium">{data.email as string}</p>
                  </div>
                  {data.phone && (
                    <div>
                      <label className="text-xs text-gray-500">Phone</label>
                      <p className="font-medium">{data.phone as string}</p>
                    </div>
                  )}
                </div>
                {selectedItem.status === 'spam' && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-red-700 font-medium text-sm mb-1">
                      <ShieldAlert className="w-4 h-4" />
                      Flagged as Spam (score: {(data.spam_score as number) ?? 'N/A'}/100)
                    </div>
                    {Array.isArray(data.spam_reasons) && (data.spam_reasons as string[]).length > 0 && (
                      <ul className="text-xs text-red-600 list-disc list-inside space-y-0.5">
                        {(data.spam_reasons as string[]).map((reason, i) => (
                          <li key={i}>{reason}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                <div>
                  <label className="text-xs text-gray-500">Message</label>
                  <p className="mt-1 text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">
                    {data.message as string}
                  </p>
                </div>
              </div>
            )}

            {selectedItem.type === 'form' && (
              <div className="space-y-3 mt-4">
                {(data as { signed_pdf_url?: string }).signed_pdf_url ? (
                  <div>
                    <label className="text-xs text-gray-500 mb-2 block">Signed Document</label>
                    <div className="border rounded-lg overflow-hidden bg-gray-50">
                      <iframe
                        src={(data as { signed_pdf_url: string }).signed_pdf_url}
                        className="w-full h-[500px]"
                        title="Signed PDF Preview"
                      />
                    </div>
                    <a
                      href={(data as { signed_pdf_url: string }).signed_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-orange-600 hover:text-orange-700 mt-3"
                    >
                      <FileText className="w-4 h-4" />
                      Open in New Tab
                    </a>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs text-gray-500">Submitted Data</label>
                    <pre className="mt-1 text-sm bg-gray-50 p-4 rounded-lg overflow-x-auto">
                      {JSON.stringify(data.data, null, 2)}
                    </pre>
                  </div>
                )}
                              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t bg-gray-50">
          <div className="flex gap-2">
            {selectedItem.type === 'approval' && selectedItem.status === 'pending' && (
              <>
                <Button onClick={() => handleApproveUser(selectedItem.id)} className="flex-1">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve
                </Button>
                <Button variant="outline" onClick={() => handleRejectUser(selectedItem.id)} className="flex-1">
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </Button>
              </>
            )}

            {selectedItem.type === 'application' && selectedItem.status === 'pending' && (
              <>
                <Button onClick={() => handleUpdateApplicationStatus(selectedItem.id, 'reviewed')}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Mark Reviewed
                </Button>
                <Button variant="outline" onClick={() => handleUpdateApplicationStatus(selectedItem.id, 'interviewed')}>
                  Interview
                </Button>
                <Button variant="outline" onClick={() => handleUpdateApplicationStatus(selectedItem.id, 'hired')}>
                  Hire
                </Button>
                <Button variant="outline" onClick={() => handleUpdateApplicationStatus(selectedItem.id, 'rejected')}>
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </Button>
              </>
            )}

            {selectedItem.type === 'contact' && selectedItem.status === 'spam' && (
              <Button onClick={() => handleUpdateContactStatus(selectedItem.id, 'new')}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Not Spam — Move to Inbox
              </Button>
            )}

            {selectedItem.type === 'contact' && selectedItem.status !== 'archived' && selectedItem.status !== 'spam' && (
              <>
                {selectedItem.status === 'new' && (
                  <Button onClick={() => handleUpdateContactStatus(selectedItem.id, 'read')}>
                    <MailOpen className="w-4 h-4 mr-2" />
                    Mark Read
                  </Button>
                )}
                <Button variant="outline" onClick={() => handleUpdateContactStatus(selectedItem.id, 'replied')}>
                  <Reply className="w-4 h-4 mr-2" />
                  Mark Replied
                </Button>
                <Button variant="outline" onClick={() => handleUpdateContactStatus(selectedItem.id, 'spam')}>
                  <ShieldAlert className="w-4 h-4 mr-2" />
                  Spam
                </Button>
                <Button variant="outline" onClick={() => handleUpdateContactStatus(selectedItem.id, 'archived')}>
                  <Archive className="w-4 h-4 mr-2" />
                  Archive
                </Button>
              </>
            )}

            {selectedItem.type === 'form' && selectedItem.status === 'pending' && (
              <>
                <Button onClick={() => handleApproveForm(selectedItem.id)} className="flex-1">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve
                </Button>
                <Button variant="outline" onClick={() => handleRejectForm(selectedItem.id)} className="flex-1">
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        <span className="sr-only">Loading...</span>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-120px)]">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Inbox</h1>
        <p className="text-gray-600">Manage approvals, applications, and messages</p>
      </div>

      <div className="flex h-[calc(100%-80px)] bg-white rounded-xl shadow-sm border overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 border-r bg-gray-50 flex flex-col">
          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="pl-9"
              />
            </div>
          </div>

          <nav className="flex-1 p-2 space-y-1">
            {[
              { key: 'all', label: 'All Items', icon: Inbox, count: counts.all },
              { key: 'approvals', label: 'Approvals', icon: UserPlus, count: counts.approvals },
              { key: 'applications', label: 'Applications', icon: Briefcase, count: counts.applications },
              { key: 'forms', label: 'Form Submissions', icon: FileText, count: counts.forms },
              { key: 'contacts', label: 'Contact Messages', icon: MessageSquare, count: counts.contacts },
              { key: 'spam', label: 'Spam', icon: ShieldAlert, count: counts.spam },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => setCategory(item.key as InboxCategory)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                  category === item.key
                    ? 'bg-orange-100 text-orange-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="flex items-center gap-2">
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </span>
                {item.count > 0 && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    category === item.key ? 'bg-orange-200' : 'bg-gray-200'
                  }`}>
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ItemStatus | 'all')}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="all">All Status</option>
              <option value="unread">Unread ({counts.unread})</option>
              <option value="read">Read</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        {/* Message List */}
        <div className="w-96 border-r flex flex-col">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900">
              {category === 'all' ? 'All Items' : category.charAt(0).toUpperCase() + category.slice(1)}
            </h2>
            <p className="text-sm text-gray-500">{filteredItems.length} items</p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredItems.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Inbox className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No items found</p>
              </div>
            ) : (
              filteredItems.map((item) => {
                const Icon = getTypeIcon(item.type)
                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    onClick={() => setSelectedItem(item)}
                    className={`w-full p-4 border-b text-left hover:bg-gray-50 transition-colors ${
                      selectedItem?.id === item.id ? 'bg-orange-50' : ''
                    } ${!item.isRead ? 'bg-blue-50/50' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${getTypeColor(item.type)}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`font-medium truncate ${!item.isRead ? 'text-gray-900' : 'text-gray-700'}`}>
                            {item.title}
                          </span>
                          <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                            {formatDate(item.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 truncate">{item.subtitle}</p>
                        <p className="text-xs text-gray-400 truncate mt-1">{item.preview}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Detail View */}
        <div className="flex-1 bg-white">
          {selectedItem ? (
            renderDetailView()
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Mail className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>Select an item to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default InboxPage

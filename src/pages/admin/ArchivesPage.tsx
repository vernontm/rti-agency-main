import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'
import { Search, Trash2, FileText, Briefcase, Eye, X, Archive } from 'lucide-react'
import toast from 'react-hot-toast'

type ArchiveType = 'all' | 'form' | 'application'

interface ArchiveItem {
  id: string
  type: ArchiveType
  title: string
  subtitle: string
  status: string
  created_at: string
  data: Record<string, unknown>
}

const ArchivesPage = () => {
  const [items, setItems] = useState<ArchiveItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<ArchiveType>('all')
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [viewingItem, setViewingItem] = useState<ArchiveItem | null>(null)
  const location = useLocation()

  useEffect(() => {
    fetchArchives()
  }, [location.pathname])

  const fetchArchives = async () => {
    setLoading(true)
    try {
      const allItems: ArchiveItem[] = []

      // Fetch all form submissions
      const { data: formSubmissions, error: formError } = await supabase
        .from('form_submissions')
        .select(`*, forms (form_name), users:submitted_by (full_name, email)`)
        .order('submitted_at', { ascending: false })

      if (formError) {
        console.error('Error fetching form submissions:', formError)
      }

      if (formSubmissions) {
        formSubmissions.forEach((sub: any) => {
          allItems.push({
            id: sub.id,
            type: 'form',
            title: sub.forms?.form_name || 'Form Submission',
            subtitle: `${sub.users?.full_name || 'Unknown'} - ${sub.users?.email || ''}`,
            status: sub.status,
            created_at: sub.submitted_at,
            data: sub,
          })
        })
      }

      // Fetch processed job applications
      const { data: jobApplications } = await supabase
        .from('job_applications')
        .select('*')
        .in('status', ['reviewed', 'hired', 'rejected'])
        .order('created_at', { ascending: false })

      if (jobApplications) {
        jobApplications.forEach((app: any) => {
          allItems.push({
            id: app.id,
            type: 'application',
            title: `${app.full_name}`,
            subtitle: `${app.position_applied} - ${app.email}`,
            status: app.status,
            created_at: app.created_at,
            data: app,
          })
        })
      }

      // Sort all items by date
      allItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setItems(allItems)
    } catch (error) {
      console.error('Error fetching archives:', error)
      toast.error('Failed to load archives')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (item: ArchiveItem) => {
    if (!confirm(`Are you sure you want to permanently delete this ${item.type}?`)) return

    try {
      let tableName = ''
      switch (item.type) {
        case 'form':
          tableName = 'form_submissions'
          break
        case 'application':
          tableName = 'job_applications'
          break
              }

      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', item.id)

      if (error) throw error

      setItems(prev => prev.filter(i => i.id !== item.id))
      toast.success('Item deleted successfully')
    } catch (error) {
      console.error('Error deleting item:', error)
      toast.error('Failed to delete item')
    }
  }

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return
    if (!confirm(`Are you sure you want to permanently delete ${selectedItems.size} items?`)) return

    setDeleting(true)
    try {
      const itemsToDelete = items.filter(i => selectedItems.has(i.id))
      
      // Group by type for batch deletion
      const grouped: Record<string, string[]> = {}
      itemsToDelete.forEach(item => {
        let tableName = ''
        switch (item.type) {
          case 'form': tableName = 'form_submissions'; break
          case 'application': tableName = 'job_applications'; break
                  }
        if (!grouped[tableName]) grouped[tableName] = []
        grouped[tableName].push(item.id)
      })

      // Delete from each table
      for (const [tableName, ids] of Object.entries(grouped)) {
        const { error } = await supabase
          .from(tableName)
          .delete()
          .in('id', ids)

        if (error) throw error
      }

      setItems(prev => prev.filter(i => !selectedItems.has(i.id)))
      setSelectedItems(new Set())
      toast.success(`${itemsToDelete.length} items deleted`)
    } catch (error) {
      console.error('Error bulk deleting:', error)
      toast.error('Failed to delete some items')
    } finally {
      setDeleting(false)
    }
  }

  const toggleSelectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(filteredItems.map(i => i.id)))
    }
  }

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedItems)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedItems(newSet)
  }

  const getTypeIcon = (type: ArchiveType) => {
    switch (type) {
      case 'form': return <FileText className="w-4 h-4" />
      case 'application': return <Briefcase className="w-4 h-4" />
            default: return <FileText className="w-4 h-4" />
    }
  }

  const getTypeColor = (type: ArchiveType) => {
    switch (type) {
      case 'form': return 'bg-blue-100 text-blue-600'
      case 'application': return 'bg-purple-100 text-purple-600'
            default: return 'bg-gray-100 text-gray-600'
    }
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      reviewed: 'bg-blue-100 text-blue-700',
      hired: 'bg-green-100 text-green-700',
      replied: 'bg-blue-100 text-blue-700',
      archived: 'bg-gray-100 text-gray-700',
    }
    return colors[status] || 'bg-gray-100 text-gray-700'
  }

  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = typeFilter === 'all' || item.type === typeFilter
    return matchesSearch && matchesType
  })

  const typeCounts = {
    all: items.length,
    form: items.filter(i => i.type === 'form').length,
    application: items.filter(i => i.type === 'application').length,
      }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        <span className="sr-only">Loading...</span>
      </div>
    )
  }

  const AVATAR_COLORS = ['bg-violet-500','bg-orange-500','bg-emerald-500','bg-teal-500','bg-rose-500','bg-sky-500','bg-amber-500','bg-indigo-500']
  const getAvatarColor = (name: string) => { let h = 0; for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h); return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length] }
  const getInitials = (name: string) => name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()

  const archiveCategories = [
    { key: 'all', label: 'All Records', icon: Archive, count: typeCounts.all, color: 'bg-orange-500' },
    { key: 'form', label: 'Form Submissions', icon: FileText, count: typeCounts.form, color: 'bg-blue-500' },
    { key: 'application', label: 'Applications', icon: Briefcase, count: typeCounts.application, color: 'bg-purple-500' },
  ]

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Archives</h1>
          <p className="text-gray-500 text-sm">View and manage all completed submissions</p>
        </div>
        {selectedItems.size > 0 && (
          <Button variant="outline" onClick={handleBulkDelete} loading={deleting} className="text-red-600 border-red-300 hover:bg-red-50">
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Selected ({selectedItems.size})
          </Button>
        )}
      </div>

      <div className="flex flex-1 bg-white rounded-xl shadow-sm border overflow-hidden min-h-0">
        {/* Sidebar */}
        <div className="w-56 border-r flex flex-col bg-gray-50/50">
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
          <nav className="flex-1 px-2 pb-3 space-y-0.5">
            {archiveCategories.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setTypeFilter(cat.key as ArchiveType)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  typeFilter === cat.key ? 'bg-orange-50 text-orange-700 font-medium' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <cat.icon className="w-4 h-4" />
                  {cat.label}
                </span>
                {cat.count > 0 && (
                  <span className={`text-xs font-bold rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1.5 ${cat.color} text-white`}>
                    {cat.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* List */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-5 py-3 border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                onChange={toggleSelectAll}
                className="rounded border-gray-300"
              />
              <h2 className="font-semibold text-gray-900">
                {archiveCategories.find(c => c.key === typeFilter)?.label || 'All Records'}
              </h2>
            </div>
            <span className="text-sm text-gray-500">{filteredItems.length} records</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <Archive className="w-12 h-12 mb-3 opacity-40" />
                <p className="text-sm">No archived items found</p>
              </div>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className={`flex items-center gap-4 px-5 py-3.5 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    selectedItems.has(item.id) ? 'bg-orange-50' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedItems.has(item.id)}
                    onChange={() => toggleSelect(item.id)}
                    className="rounded border-gray-300 flex-shrink-0"
                  />
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 ${getAvatarColor(item.title)}`}>
                    {getInitials(item.title)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 truncate">{item.title}</span>
                      <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${getStatusBadge(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 truncate mt-0.5">{item.subtitle}</p>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{new Date(item.created_at).toLocaleDateString()}</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {(item.data.signed_pdf_url || item.data.resume_url) && (
                      <button onClick={() => setViewingItem(item)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors" aria-label="View document">
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => handleDelete(item)} className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors" aria-label="Delete permanently">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* PDF Viewer Modal */}
      {viewingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onKeyDown={(e) => e.key === 'Escape' && setViewingItem(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl h-[90vh] flex flex-col" role="dialog" aria-modal="true" aria-labelledby="archive-viewer-title">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 id="archive-viewer-title" className="text-lg font-semibold">{viewingItem.title}</h2>
                <p className="text-sm text-gray-500">{viewingItem.subtitle}</p>
              </div>
              <button
                onClick={() => setViewingItem(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe
                src={(viewingItem.data.signed_pdf_url as string) || (viewingItem.data.resume_url as string) || ''}
                className="w-full h-full"
                title="Document Viewer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ArchivesPage

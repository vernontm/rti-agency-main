import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import Button from '../../components/ui/Button'
import {
  FileText, Plus, Search, Eye, EyeOff, Trash2, X, Star,
  ClipboardList, CheckCircle, XCircle, Clock, ArrowLeft,
  Download, FolderOpen, Send, Filter,
} from 'lucide-react'
import toast from 'react-hot-toast'
import PDFFormBuilder from '../../components/pdf/PDFFormBuilder'
import AcroFormViewer from '../../components/pdf/AcroFormViewer'
import type { PDFFormField } from '../../components/pdf/PDFFormBuilder'
import { generateAcroFilledPDF, uint8ArrayToBlob } from '../../utils/pdfGenerator'
import type { FormStatus } from '../../types/database.types'

interface Form {
  id: string
  form_name: string
  form_type: string
  fields_schema: {
    type?: string
    pdf_url?: string
    pdfUrl?: string
    fields?: PDFFormField[]
    pdfRotation?: number
    acroForm?: boolean
  }
  show_in_educator_area: boolean
  created_at: string
}

interface FormSubmission {
  id: string
  form_id: string
  submitted_by: string
  data: Record<string, unknown>
  status: FormStatus
  review_comment: string | null
  signed_pdf_url: string | null
  submitted_at: string
  reviewed_at: string | null
  forms?: { form_name: string }
  submitter?: { full_name: string; email: string }
}

type SidebarView = 'forms' | 'submissions'
type SubmissionFilter = 'all' | 'pending' | 'approved' | 'rejected'

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-orange-500', 'bg-emerald-500', 'bg-teal-500',
  'bg-rose-500', 'bg-sky-500', 'bg-amber-500', 'bg-indigo-500',
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

const FormsManagementPage = () => {
  const { profile } = useAuthStore()
  const location = useLocation()
  const [forms, setForms] = useState<Form[]>([])
  const [submissions, setSubmissions] = useState<FormSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [sidebarView, setSidebarView] = useState<SidebarView>('forms')
  const [submissionFilter, setSubmissionFilter] = useState<SubmissionFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showBuilder, setShowBuilder] = useState(false)
  const [selectedForm, setSelectedForm] = useState<Form | null>(null)
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmission | null>(null)
  const [showManagerSign, setShowManagerSign] = useState(false)

  useEffect(() => {
    fetchData()
  }, [location.pathname])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [{ data: formsData }, { data: subsData }] = await Promise.all([
        supabase
          .from('forms')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('form_submissions')
          .select(`*, forms (form_name), submitter:users!form_submissions_submitted_by_fkey (full_name, email)`)
          .order('submitted_at', { ascending: false }),
      ])

      setForms((formsData as Form[]) || [])
      setSubmissions((subsData as FormSubmission[]) || [])
    } catch (error) {
      console.error('Error fetching forms data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveForm = async (
    pdfUrl: string,
    fields: PDFFormField[],
    formName: string,
    pdfRotation?: number,
    acroForm?: boolean
  ) => {
    try {
      // form_type has a UNIQUE constraint — use a slug of the form name + timestamp
      const formType = `pdf_${formName.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`

      const { error } = await supabase.from('forms').insert({
        form_name: formName,
        form_type: formType,
        fields_schema: {
          type: 'pdf',
          pdfUrl,
          fields,
          pdfRotation: pdfRotation || 0,
          acroForm: acroForm || false,
        },
        show_in_educator_area: false,
      })

      if (error) throw error

      toast.success('Form created successfully!')
      setShowBuilder(false)
      fetchData()
    } catch (error) {
      console.error('Error saving form:', error)
      toast.error('Failed to save form')
    }
  }

  const toggleVisibility = async (form: Form) => {
    try {
      const { error } = await supabase
        .from('forms')
        .update({ show_in_educator_area: !form.show_in_educator_area })
        .eq('id', form.id)

      if (error) throw error

      setForms(prev =>
        prev.map(f => f.id === form.id ? { ...f, show_in_educator_area: !f.show_in_educator_area } : f)
      )
      toast.success(form.show_in_educator_area ? 'Form hidden from employees' : 'Form visible to employees')
    } catch (error) {
      console.error('Error toggling visibility:', error)
      toast.error('Failed to update visibility')
    }
  }

  const deleteForm = async (form: Form) => {
    if (!confirm(`Delete "${form.form_name}"? This will also delete all submissions for this form.`)) return

    try {
      // Delete the PDF from storage if it exists
      const pdfUrl = form.fields_schema.pdfUrl || form.fields_schema.pdf_url
      if (pdfUrl) {
        const urlParts = pdfUrl.split('/forms/')
        if (urlParts.length > 1) {
          await supabase.storage.from('forms').remove([urlParts[1]])
        }
      }

      const { error } = await supabase.from('forms').delete().eq('id', form.id)
      if (error) throw error

      toast.success('Form deleted')
      if (selectedForm?.id === form.id) setSelectedForm(null)
      fetchData()
    } catch (error) {
      console.error('Error deleting form:', error)
      toast.error('Failed to delete form')
    }
  }

  const handleStatusUpdate = async (submissionId: string, newStatus: FormStatus, comment?: string) => {
    try {
      const { error } = await supabase
        .from('form_submissions')
        .update({
          status: newStatus,
          reviewed_by: profile?.id,
          review_comment: comment || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', submissionId)

      if (error) throw error
      toast.success(`Submission ${newStatus}`)
      setSelectedSubmission(null)
      fetchData()
    } catch (error) {
      console.error('Error updating submission:', error)
      toast.error('Failed to update status')
    }
  }

  // Manager sign & approve: re-generate PDF with manager signature, then approve
  const handleManagerSignAndApprove = async (managerValues: Record<string, string | boolean>) => {
    if (!selectedSubmission) return

    // Find the form template for this submission
    const form = forms.find(f => f.id === selectedSubmission.form_id)
    if (!form) {
      toast.error('Form template not found')
      return
    }

    const pdfUrl = form.fields_schema.pdfUrl || form.fields_schema.pdf_url
    if (!pdfUrl) {
      toast.error('No PDF template URL')
      return
    }

    try {
      toast.loading('Generating approved document with manager signature...', { id: 'mgr-sign' })

      // Merge employee submission data with manager signature values
      const allValues: Record<string, string | boolean> = {
        ...(selectedSubmission.data as Record<string, string | boolean>),
        ...managerValues,
        // Mark "Approved" checkbox
        Approved: true,
      }

      // Generate the PDF with both employee and manager data
      const pdfBytes = await generateAcroFilledPDF(pdfUrl, allValues)
      const pdfBlob = uint8ArrayToBlob(pdfBytes)

      // Upload the new signed PDF
      const fileName = `submissions/${Date.now()}_${form.form_name.replace(/\s+/g, '_')}_approved.pdf`
      const { error: uploadError } = await supabase.storage.from('forms').upload(fileName, pdfBlob)
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('forms').getPublicUrl(fileName)

      // Delete old signed PDF from storage if it exists
      if (selectedSubmission.signed_pdf_url) {
        const urlParts = selectedSubmission.signed_pdf_url.split('/forms/')
        if (urlParts.length > 1) {
          await supabase.storage.from('forms').remove([urlParts[1]]).catch(() => {})
        }
      }

      // Update submission: approve + new signed PDF
      const { error } = await supabase
        .from('form_submissions')
        .update({
          status: 'approved',
          reviewed_by: profile?.id,
          reviewed_at: new Date().toISOString(),
          signed_pdf_url: publicUrl,
          data: allValues,
        })
        .eq('id', selectedSubmission.id)

      if (error) throw error

      toast.dismiss('mgr-sign')
      toast.success('Form approved with manager signature!')
      setSelectedSubmission(null)
      setShowManagerSign(false)
      fetchData()
    } catch (error) {
      toast.dismiss('mgr-sign')
      console.error('Error signing and approving:', error)
      toast.error('Failed to sign and approve')
    }
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

  const getStatusBadge = (status: FormStatus) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
    }
    return colors[status] || 'bg-gray-100 text-gray-700'
  }

  // --- Builder view ---
  if (showBuilder) {
    return (
      <div className="-m-6 h-screen flex flex-col bg-white">
        <div className="flex items-center gap-4 px-6 py-4 border-b">
          <button
            onClick={() => setShowBuilder(false)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Back to forms"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-xl font-semibold text-gray-900">Upload New Form</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <PDFFormBuilder onSave={handleSaveForm} />
        </div>
      </div>
    )
  }

  // --- Manager sign & approve view ---
  if (selectedSubmission && showManagerSign) {
    const form = forms.find(f => f.id === selectedSubmission.form_id)
    const pdfUrl = form?.fields_schema.pdfUrl || form?.fields_schema.pdf_url

    return (
      <div className="-m-6 h-screen flex flex-col bg-white">
        <div className="flex items-center gap-4 px-6 py-4 border-b">
          <button
            onClick={() => setShowManagerSign(false)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Back to submission"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Sign & Approve</h1>
            <p className="text-sm text-gray-500">
              {selectedSubmission.forms?.form_name} — submitted by {selectedSubmission.submitter?.full_name}
            </p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {pdfUrl ? (
            <AcroFormViewer
              pdfUrl={pdfUrl}
              formName={selectedSubmission.forms?.form_name || 'Form'}
              mode="manager-review"
              initialValues={selectedSubmission.data as Record<string, string | boolean>}
              onSubmit={handleManagerSignAndApprove}
            />
          ) : (
            <div className="text-center text-gray-500 py-12">
              <p>Form template not found. Cannot sign.</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // --- Submission detail view ---
  if (selectedSubmission) {
    const signedPdfUrl = selectedSubmission.signed_pdf_url
    return (
      <div className="-m-6 h-screen flex flex-col bg-white">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedSubmission(null)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Back to list"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ${getAvatarColor(selectedSubmission.submitter?.full_name || 'U')}`}>
              {getInitials(selectedSubmission.submitter?.full_name || 'Unknown')}
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">
                {selectedSubmission.forms?.form_name || 'Form Submission'}
              </h2>
              <p className="text-sm text-gray-500">
                {selectedSubmission.submitter?.full_name} &middot; {new Date(selectedSubmission.submitted_at).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${getStatusBadge(selectedSubmission.status)}`}>
              {selectedSubmission.status}
            </span>
            {signedPdfUrl && (
              <a
                href={signedPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </a>
            )}
          </div>
        </div>

        {/* PDF preview */}
        <div className="flex-1 overflow-hidden">
          {signedPdfUrl ? (
            <iframe src={signedPdfUrl} className="w-full h-full" title="Signed PDF" />
          ) : (
            <div className="p-6">
              <div className="bg-gray-50 rounded-lg p-5">
                <p className="text-xs text-gray-500 mb-2">Submitted Data</p>
                <pre className="text-sm overflow-x-auto">{JSON.stringify(selectedSubmission.data, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        {selectedSubmission.status === 'pending' && (
          <div className="px-6 py-4 border-t bg-gray-50 flex gap-3">
            <Button
              onClick={() => setShowManagerSign(true)}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Sign & Approve
            </Button>
            <Button
              variant="outline"
              onClick={() => handleStatusUpdate(selectedSubmission.id, 'approved')}
            >
              Approve Without Signing
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const comment = prompt('Rejection reason (optional):')
                handleStatusUpdate(selectedSubmission.id, 'rejected', comment || undefined)
              }}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Reject
            </Button>
          </div>
        )}
      </div>
    )
  }

  // --- Form preview (shows PDF in right panel) ---
  if (selectedForm) {
    const pdfUrl = selectedForm.fields_schema.pdfUrl || selectedForm.fields_schema.pdf_url
    return (
      <div className="-m-6 h-screen flex flex-col bg-white">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedForm(null)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Back to forms"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h2 className="font-semibold text-gray-900">{selectedForm.form_name}</h2>
              <p className="text-sm text-gray-500">
                {selectedForm.fields_schema.acroForm ? 'AcroForm PDF' : 'PDF Form'}
                {' · '}
                {selectedForm.fields_schema.fields?.length || 0} fields
                {' · '}
                {selectedForm.show_in_educator_area ? 'Visible to employees' : 'Hidden from employees'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleVisibility(selectedForm)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedForm.show_in_educator_area
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {selectedForm.show_in_educator_area ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              {selectedForm.show_in_educator_area ? 'Visible' : 'Hidden'}
            </button>
            <button
              onClick={() => deleteForm(selectedForm)}
              className="p-2 rounded-lg text-red-600 hover:bg-red-100 transition-colors"
              aria-label="Delete form"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          {pdfUrl ? (
            <iframe src={pdfUrl} className="w-full h-full" title={selectedForm.form_name} />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <p>No PDF available</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // --- Loading ---
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        <span className="sr-only">Loading...</span>
      </div>
    )
  }

  // --- Filtering ---
  const filteredForms = forms.filter(f => {
    if (!searchQuery) return true
    return f.form_name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  const filteredSubmissions = submissions.filter(s => {
    const matchesFilter = submissionFilter === 'all' || s.status === submissionFilter
    if (!searchQuery) return matchesFilter
    const q = searchQuery.toLowerCase()
    return matchesFilter && (
      (s.forms?.form_name || '').toLowerCase().includes(q) ||
      (s.submitter?.full_name || '').toLowerCase().includes(q) ||
      (s.submitter?.email || '').toLowerCase().includes(q)
    )
  })

  const counts = {
    forms: forms.length,
    visible: forms.filter(f => f.show_in_educator_area).length,
    hidden: forms.filter(f => !f.show_in_educator_area).length,
    submissions: submissions.length,
    pending: submissions.filter(s => s.status === 'pending').length,
    approved: submissions.filter(s => s.status === 'approved').length,
    rejected: submissions.filter(s => s.status === 'rejected').length,
  }

  const sidebarItems = [
    { key: 'forms' as SidebarView, label: 'All Forms', icon: FolderOpen, count: counts.forms, color: 'bg-blue-600' },
    { key: 'submissions' as SidebarView, label: 'Submissions', icon: Send, count: counts.submissions, color: 'bg-blue-600' },
  ]

  const submissionFilters = [
    { key: 'all' as SubmissionFilter, label: 'All', count: counts.submissions },
    { key: 'pending' as SubmissionFilter, label: 'Pending', count: counts.pending },
    { key: 'approved' as SubmissionFilter, label: 'Approved', count: counts.approved },
    { key: 'rejected' as SubmissionFilter, label: 'Rejected', count: counts.rejected },
  ]

  return (
    <div className="-m-6 h-screen flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <h1 className="text-xl font-semibold text-gray-900">
          {sidebarView === 'forms' ? 'Forms' : 'Submissions'}
        </h1>
        <span className="text-sm text-gray-400">
          {sidebarView === 'forms'
            ? `${filteredForms.length} forms`
            : `${filteredSubmissions.length} submissions`
          }
        </span>
      </div>

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Sidebar */}
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

          {/* Nav */}
          <nav className="flex-1 px-2 pb-3">
            {sidebarItems.map((item, idx) => (
              <div key={item.key}>
                {idx > 0 && <div className="mx-2 border-t border-gray-200" />}
                <button
                  onClick={() => { setSidebarView(item.key); setSubmissionFilter('all') }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    sidebarView === item.key
                      ? 'bg-orange-50 text-orange-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </span>
                  {item.count > 0 && (
                    <span className={`text-xs text-white font-bold rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1.5 ${item.color}`}>
                      {item.count}
                    </span>
                  )}
                </button>
              </div>
            ))}

            {/* Submission status filters when on submissions view */}
            {sidebarView === 'submissions' && (
              <>
                <div className="mx-2 my-2 border-t border-gray-200" />
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Filter by Status</p>
                {submissionFilters.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setSubmissionFilter(f.key)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                      submissionFilter === f.key
                        ? 'bg-orange-50 text-orange-700 font-medium'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    <span>{f.label}</span>
                    {f.count > 0 && (
                      <span className="text-xs text-gray-400 font-medium">{f.count}</span>
                    )}
                  </button>
                ))}
              </>
            )}
          </nav>

          {/* Upload button */}
          <div className="p-3 border-t">
            <Button onClick={() => setShowBuilder(true)} className="w-full text-sm">
              <Plus className="w-3.5 h-3.5 mr-2" />
              Upload Form
            </Button>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto">
            {sidebarView === 'forms' ? (
              /* --- Forms list --- */
              filteredForms.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <FileText className="w-12 h-12 mb-3 opacity-40" />
                  <p className="text-sm">No forms yet</p>
                  <p className="text-xs mt-1">Upload a fillable PDF to get started</p>
                </div>
              ) : (
                filteredForms.map((form) => (
                  <button
                    key={form.id}
                    onClick={() => setSelectedForm(form)}
                    className="w-full flex items-center gap-4 px-5 py-3 border-b border-gray-100 text-left hover:bg-gray-50 transition-colors"
                  >
                    {/* Icon */}
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${form.show_in_educator_area ? 'bg-emerald-500 text-white' : 'bg-gray-400 text-white'}`}>
                      <FileText className="w-4 h-4" />
                    </div>

                    {/* Name */}
                    <span className="w-48 flex-shrink-0 text-sm font-semibold text-gray-900 truncate">
                      {form.form_name}
                    </span>

                    {/* Details */}
                    <div className="flex-1 min-w-0 text-sm truncate">
                      <span className="font-medium text-gray-700">
                        {form.fields_schema.acroForm ? 'AcroForm' : 'PDF'}
                      </span>
                      <span className="text-gray-300 mx-1.5">&mdash;</span>
                      <span className="text-gray-400">
                        {form.fields_schema.fields?.length || 0} fields
                      </span>
                    </div>

                    {/* Visibility */}
                    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded flex-shrink-0 ${form.show_in_educator_area ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {form.show_in_educator_area ? 'Visible' : 'Hidden'}
                    </span>

                    {/* Star */}
                    <Star className="w-4 h-4 text-gray-300 flex-shrink-0" />

                    {/* Time */}
                    <span className="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap w-16 text-right">
                      {formatDate(form.created_at)}
                    </span>
                  </button>
                ))
              )
            ) : (
              /* --- Submissions list --- */
              filteredSubmissions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <ClipboardList className="w-12 h-12 mb-3 opacity-40" />
                  <p className="text-sm">No submissions found</p>
                </div>
              ) : (
                filteredSubmissions.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => setSelectedSubmission(sub)}
                    className={`w-full flex items-center gap-4 px-5 py-3 border-b border-gray-100 text-left hover:bg-gray-50 transition-colors ${
                      sub.status === 'pending' ? 'bg-white' : 'bg-gray-50/30'
                    }`}
                  >
                    {/* Avatar */}
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 ${getAvatarColor(sub.submitter?.full_name || 'U')}`}>
                      {getInitials(sub.submitter?.full_name || 'Unknown')}
                    </div>

                    {/* Submitter name */}
                    <span className={`w-40 flex-shrink-0 text-sm truncate ${sub.status === 'pending' ? 'font-bold text-gray-900' : 'font-medium text-gray-600'}`}>
                      {sub.submitter?.full_name || 'Unknown'}
                    </span>

                    {/* Form name + email */}
                    <div className="flex-1 min-w-0 text-sm truncate">
                      <span className={sub.status === 'pending' ? 'font-semibold text-gray-900' : 'font-normal text-gray-700'}>
                        {sub.forms?.form_name || 'Form'}
                      </span>
                      <span className="text-gray-400 mx-1.5">&mdash;</span>
                      <span className="text-gray-400">{sub.submitter?.email}</span>
                    </div>

                    {/* Status */}
                    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded flex-shrink-0 ${getStatusBadge(sub.status)}`}>
                      {sub.status}
                    </span>

                    {/* Star */}
                    <Star className="w-4 h-4 text-gray-300 flex-shrink-0" />

                    {/* Time */}
                    <span className="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap w-16 text-right">
                      {formatDate(sub.submitted_at)}
                    </span>
                  </button>
                ))
              )
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default FormsManagementPage

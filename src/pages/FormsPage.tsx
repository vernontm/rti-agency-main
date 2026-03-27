import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import type { Tables, FormStatus } from '../types/database.types'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { FileText, Eye, CheckCircle, XCircle, Clock, Filter, Plus, X, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import PDFFormViewer from '../components/pdf/PDFFormViewer'
import type { PDFFormField } from '../components/pdf/PDFFormBuilder'
import { generateFilledPDF, uint8ArrayToBlob } from '../utils/pdfGenerator'

interface FormSubmissionWithForm extends Tables<'form_submissions'> {
  forms?: Tables<'forms'>
  users?: Tables<'users'>
}

interface FormSchema {
  type?: string
  pdfUrl?: string
  fields?: PDFFormField[]
  pdfRotation?: number
  acroForm?: boolean
}

const FormsPage = () => {
  const { profile } = useAuthStore()
  const [submissions, setSubmissions] = useState<FormSubmissionWithForm[]>([])
  const [availableForms, setAvailableForms] = useState<Tables<'forms'>[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<FormStatus | 'all'>('all')
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmissionWithForm | null>(null)
  const [selectedForm, setSelectedForm] = useState<Tables<'forms'> | null>(null)
  const [activeTab, setActiveTab] = useState<'submissions' | 'available'>('available')

  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    fetchSubmissions()
    fetchAvailableForms()
  }, [statusFilter])

  const fetchAvailableForms = async () => {
    try {
      const { data, error } = await supabase
        .from('forms')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setAvailableForms(data || [])
    } catch (error) {
      console.error('Error fetching forms:', error)
    }
  }

  const fetchSubmissions = async () => {
    try {
      let query = supabase
        .from('form_submissions')
        .select(`
          *,
          forms (*),
          submitter:users!form_submissions_submitted_by_fkey (*)
        `)
        .order('submitted_at', { ascending: false })

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      if (!isAdmin) {
        query = query.eq('submitted_by', profile?.id)
      }

      const { data, error } = await query

      if (error) throw error
      setSubmissions(data || [])
    } catch (error) {
      console.error('Error fetching submissions:', error)
      toast.error('Failed to load form submissions')
    } finally {
      setLoading(false)
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
      toast.success(`Form ${newStatus}`)
      setSelectedSubmission(null)
      fetchSubmissions()
    } catch (error) {
      console.error('Error updating submission:', error)
      toast.error('Failed to update form status')
    }
  }

  const getStatusBadge = (status: FormStatus) => {
    const badges = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      approved: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      rejected: { color: 'bg-red-100 text-red-800', icon: XCircle },
    }
    const badge = badges[status]
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <badge.icon className="w-3 h-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // PDF Form filling view
  if (selectedForm) {
    const schema = selectedForm.fields_schema as FormSchema
    if (schema?.type === 'pdf' && schema.pdfUrl && schema.fields) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedForm(null)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Fill Out Form</h1>
          </div>
          <PDFFormViewer
            pdfUrl={schema.pdfUrl}
            fields={schema.fields}
            formName={selectedForm.form_name}
            pdfRotation={schema.pdfRotation ?? 0}
            onSubmit={async (values) => {
              try {
                toast.loading('Generating signed document...', { id: 'pdf-gen' })
                
                // Generate the filled PDF
                const pdfBytes = await generateFilledPDF(
                  schema.pdfUrl!,
                  schema.fields!,
                  values,
                  schema.acroForm
                )
                const pdfBlob = uint8ArrayToBlob(pdfBytes)
                
                // Upload the filled PDF to Supabase Storage
                const fileName = `submissions/${Date.now()}_${selectedForm.form_name.replace(/\s+/g, '_')}_signed.pdf`
                const { error: uploadError } = await supabase.storage
                  .from('forms')
                  .upload(fileName, pdfBlob)
                
                if (uploadError) throw uploadError
                
                // Get the public URL
                const { data: { publicUrl } } = supabase.storage
                  .from('forms')
                  .getPublicUrl(fileName)
                
                // Save the submission with the signed PDF URL
                const { error } = await supabase.from('form_submissions').insert({
                  form_id: selectedForm.id,
                  submitted_by: profile?.id,
                  data: values,
                  status: 'pending',
                  signed_pdf_url: publicUrl,
                })
                if (error) throw error
                
                toast.dismiss('pdf-gen')
                toast.success('Form submitted successfully!')
                setSelectedForm(null)
                fetchSubmissions()
              } catch (error) {
                toast.dismiss('pdf-gen')
                console.error('Error submitting form:', error)
                toast.error('Failed to submit form')
              }
            }}
          />
        </div>
      )
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Forms</h1>
          <p className="text-gray-600 mt-1">
            {isAdmin ? 'Review submissions and manage forms' : 'Fill out and view your form submissions'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b">
        <button
          onClick={() => setActiveTab('available')}
          className={`pb-3 px-1 font-medium ${
            activeTab === 'available'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Available Forms ({availableForms.length})
        </button>
        <button
          onClick={() => setActiveTab('submissions')}
          className={`pb-3 px-1 font-medium ${
            activeTab === 'submissions'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          My Submissions ({submissions.length})
        </button>
      </div>

      {/* Available Forms Tab */}
      {activeTab === 'available' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableForms.map((form) => {
            const schema = form.fields_schema as FormSchema
            const isPdfForm = schema?.type === 'pdf'
            const fieldCount = schema?.fields?.length || 0

            return (
              <Card key={form.id} className="hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                  {isPdfForm && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                      PDF
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{form.form_name}</h3>
                <p className="text-sm text-gray-500 mb-3">{fieldCount} fields</p>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => setSelectedForm(form)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Fill Out Form
                </Button>
              </Card>
            )
          })}

          {availableForms.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No forms available</p>
            </div>
          )}
        </div>
      )}

      {/* Submissions Tab */}
      {activeTab === 'submissions' && (
        <Card>
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as FormStatus | 'all')}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

        <div className="space-y-4">
          {submissions.map((submission) => (
            <div
              key={submission.id}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">
                    {submission.forms?.form_name || 'Unknown Form'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {isAdmin && (submission as { submitter?: { full_name: string } }).submitter && `Submitted by ${(submission as { submitter?: { full_name: string } }).submitter?.full_name} • `}
                    {new Date(submission.submitted_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getStatusBadge(submission.status)}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedSubmission(submission)}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  View
                </Button>
              </div>
            </div>
          ))}

          {submissions.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No form submissions found</p>
            </div>
          )}
        </div>
        </Card>
      )}

      {selectedSubmission && (() => {
        const formSchema = selectedSubmission.forms?.fields_schema as FormSchema
        const isPdfSubmission = formSchema?.type === 'pdf' && formSchema.pdfUrl && formSchema.fields

        if (isPdfSubmission) {
          const signedPdfUrl = (selectedSubmission as { signed_pdf_url?: string }).signed_pdf_url
          return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg w-full max-w-6xl h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b">
                  <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-gray-900">
                      {selectedSubmission.forms?.form_name}
                    </h2>
                    {getStatusBadge(selectedSubmission.status)}
                    {signedPdfUrl && (
                      <a
                        href={signedPdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm font-medium"
                      >
                        <Download className="w-4 h-4" />
                        Download Signed PDF
                      </a>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedSubmission(null)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden p-4">
                  <PDFFormViewer
                    pdfUrl={formSchema.pdfUrl!}
                    fields={formSchema.fields!}
                    formName={selectedSubmission.forms?.form_name || ''}
                    onSubmit={() => {}}
                    readOnly={true}
                    initialValues={selectedSubmission.data as Record<string, string | boolean>}
                    pdfRotation={formSchema.pdfRotation ?? 0}
                  />
                </div>
                {isAdmin && selectedSubmission.status === 'pending' && (
                  <div className="flex gap-3 p-4 border-t">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setSelectedSubmission(null)}
                    >
                      Close
                    </Button>
                    <Button
                      variant="danger"
                      className="flex-1"
                      onClick={() => handleStatusUpdate(selectedSubmission.id, 'rejected')}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => handleStatusUpdate(selectedSubmission.id, 'approved')}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )
        }

        // Non-PDF form submission view (original)
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedSubmission.forms?.form_name}
                </h2>
                <button
                  onClick={() => setSelectedSubmission(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">Status:</span>
                  {getStatusBadge(selectedSubmission.status)}
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Submitted Data:</h3>
                  <pre className="bg-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
                    {JSON.stringify(selectedSubmission.data, null, 2)}
                  </pre>
                </div>

                {selectedSubmission.resume_url && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-600 mb-2">Resume:</h3>
                    <a
                      href={selectedSubmission.resume_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      View Resume
                    </a>
                  </div>
                )}

                {selectedSubmission.review_comment && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-600 mb-2">Review Comment:</h3>
                    <p className="text-gray-900">{selectedSubmission.review_comment}</p>
                  </div>
                )}
              </div>

              {isAdmin && selectedSubmission.status === 'pending' && (
                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setSelectedSubmission(null)}
                  >
                    Close
                  </Button>
                  <Button
                    variant="danger"
                    className="flex-1"
                    onClick={() => handleStatusUpdate(selectedSubmission.id, 'rejected')}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => handleStatusUpdate(selectedSubmission.id, 'approved')}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                </div>
              )}
            </Card>
          </div>
        )
      })()}
    </div>
  )
}

export default FormsPage

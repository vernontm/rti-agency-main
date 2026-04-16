import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { FileText, ExternalLink, X, Clock, CheckCircle, XCircle, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import PDFFormViewer from '../components/pdf/PDFFormViewer'
import AcroFormViewer from '../components/pdf/AcroFormViewer'
import type { PDFFormField } from '../components/pdf/PDFFormBuilder'
import { generateFilledPDF, generateAcroFilledPDF, uint8ArrayToBlob } from '../utils/pdfGenerator'
import type { Tables, FormStatus } from '../types/database.types'

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
}

interface FormSubmissionWithForm {
  id: string
  form_id: string
  submitted_by: string
  data: Record<string, unknown>
  status: FormStatus
  review_comment?: string | null
  submitted_at: string
  signed_pdf_url?: string | null
  forms?: Tables<'forms'>
}

const EducatorAreaPage = () => {
  const { profile, getEffectiveRole } = useAuthStore()
  const effectiveRole = getEffectiveRole()
  const isAdmin = effectiveRole === 'admin'
  const [forms, setForms] = useState<Form[]>([])
  const [submissions, setSubmissions] = useState<FormSubmissionWithForm[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedForm, setSelectedForm] = useState<Form | null>(null)
  const [activeTab, setActiveTab] = useState<'forms' | 'submissions'>('forms')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      // Fetch forms marked for educator area
      const { data: formsData, error: formsError } = await supabase
        .from('forms')
        .select('id, form_name, form_type, fields_schema')
        .eq('show_in_educator_area', true)
        .order('form_name')

      if (formsError) throw formsError

      // Fetch submissions - admin sees all, others see only their own
      let submissionsQuery = supabase
        .from('form_submissions')
        .select(`*, forms (*)`)
        .order('submitted_at', { ascending: false })
      
      if (profile?.role !== 'admin') {
        submissionsQuery = submissionsQuery.eq('submitted_by', profile?.id)
      }
      
      const { data: submissionsData, error: submissionsError } = await submissionsQuery

      if (submissionsError) throw submissionsError

      setForms((formsData as Form[]) || [])
      setSubmissions((submissionsData as FormSubmissionWithForm[]) || [])
    } catch (error) {
      console.error('Error fetching educator area data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSubmission = async (submissionId: string, signedPdfUrl?: string | null) => {
    if (!confirm('Are you sure you want to delete this submission? This action cannot be undone.')) {
      return
    }

    try {
      // Delete the signed PDF from storage if it exists
      if (signedPdfUrl) {
        const urlParts = signedPdfUrl.split('/forms/')
        if (urlParts.length > 1) {
          const filePath = urlParts[1]
          await supabase.storage.from('forms').remove([filePath])
        }
      }

      // Delete the submission record
      const { error } = await supabase
        .from('form_submissions')
        .delete()
        .eq('id', submissionId)

      if (error) throw error

      toast.success('Submission deleted')
      fetchData()
    } catch (error) {
      console.error('Error deleting submission:', error)
      toast.error('Failed to delete submission')
    }
  }

  const handleFormSubmit = async (values: Record<string, string | boolean | { text: string; font: string }>) => {
    if (!selectedForm || !profile) return

    const schema = selectedForm.fields_schema
    const pdfUrl = schema.pdf_url || schema.pdfUrl

    try {
      toast.loading('Generating signed document...', { id: 'pdf-gen' })

      // Generate the filled PDF
      let pdfBytes: Uint8Array
      if (schema.acroForm) {
        pdfBytes = await generateAcroFilledPDF(
          pdfUrl!,
          values as Record<string, string | boolean>
        )
      } else {
        pdfBytes = await generateFilledPDF(
          pdfUrl!,
          schema.fields!,
          values
        )
      }
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
        submitted_by: profile.id,
        data: values,
        status: 'pending',
        signed_pdf_url: publicUrl,
      } as any)
      if (error) throw error

      toast.dismiss('pdf-gen')
      toast.success('Form submitted successfully!')
      setSelectedForm(null)
      fetchData()
    } catch (error: any) {
      toast.dismiss('pdf-gen')
      console.error('Error submitting form:', error)
      const errorMessage = error?.message || error?.error_description || 'Failed to submit form'
      toast.error(errorMessage)
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
      <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        <span className="sr-only">Loading...</span>
      </div>
    )
  }

  // PDF Form filling view
  if (selectedForm) {
    const schema = selectedForm.fields_schema
    const pdfUrl = schema.pdf_url || schema.pdfUrl

    if (schema?.type === 'pdf' && pdfUrl) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedForm(null)}
              className="p-2 hover:bg-gray-100 rounded-lg"
              aria-label="Close form"
            >
              <X className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{selectedForm.form_name}</h1>
              <p className="text-gray-600">Fill out the form below</p>
            </div>
          </div>
          {schema.acroForm ? (
            <AcroFormViewer
              pdfUrl={pdfUrl}
              formName={selectedForm.form_name}
              mode="employee"
              onSubmit={handleFormSubmit}
            />
          ) : (
            <PDFFormViewer
              pdfUrl={pdfUrl}
              fields={schema.fields!}
              formName={selectedForm.form_name}
              onSubmit={handleFormSubmit}
              pdfRotation={schema.pdfRotation ?? 0}
            />
          )}
        </div>
      )
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Educator Area</h1>
        <p className="text-gray-600">Access forms and view your submissions</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b" role="tablist" aria-label="Educator Area">
        <button
          id="educator-tab-forms"
          role="tab"
          aria-selected={activeTab === 'forms'}
          aria-controls="educator-tabpanel-forms"
          tabIndex={activeTab === 'forms' ? 0 : -1}
          onClick={() => setActiveTab('forms')}
          className={`pb-3 px-1 font-medium ${
            activeTab === 'forms'
              ? 'text-orange-600 border-b-2 border-orange-500'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Available Forms ({forms.length})
        </button>
        <button
          id="educator-tab-submissions"
          role="tab"
          aria-selected={activeTab === 'submissions'}
          aria-controls="educator-tabpanel-submissions"
          tabIndex={activeTab === 'submissions' ? 0 : -1}
          onClick={() => setActiveTab('submissions')}
          className={`pb-3 px-1 font-medium ${
            activeTab === 'submissions'
              ? 'text-orange-600 border-b-2 border-orange-500'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          My Submissions ({submissions.length})
        </button>
      </div>

      {/* Forms Tab */}
      {activeTab === 'forms' && (
        <div role="tabpanel" id="educator-tabpanel-forms" aria-labelledby="educator-tab-forms">
          {forms.length === 0 ? (
            <Card className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No forms available</p>
              <p className="text-sm text-gray-400 mt-1">Forms will appear here when made available by an administrator</p>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {forms.map(form => {
                const schema = form.fields_schema
                const pdfUrl = schema.pdf_url || schema.pdfUrl
                const isPdfForm = schema?.type === 'pdf'

                return (
                  <Card key={form.id} className="hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-6 h-6 text-orange-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{form.form_name}</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {isPdfForm ? 'PDF Form' : 'Digital Form'}
                        </p>
                        <div className="mt-3 flex gap-2">
                          {isPdfForm && pdfUrl && (schema.fields || schema.acroForm) ? (
                            <Button
                              size="sm"
                              onClick={() => setSelectedForm(form)}
                            >
                              Fill Out
                            </Button>
                          ) : (
                            <span className="text-sm text-gray-400">Form not available</span>
                          )}
                          {pdfUrl && (
                            <a
                              href={pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" />
                              View
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Submissions Tab */}
      {activeTab === 'submissions' && (
        <div role="tabpanel" id="educator-tabpanel-submissions" aria-labelledby="educator-tab-submissions">
          {submissions.length === 0 ? (
            <Card className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No submissions yet</p>
              <p className="text-sm text-gray-400 mt-1">Your submitted forms will appear here</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {submissions.map(submission => (
                <Card key={submission.id}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <FileText className="w-5 h-5 text-gray-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {(submission.forms as Tables<'forms'>)?.form_name || 'Unknown Form'}
                        </h3>
                        <p className="text-sm text-gray-500">
                          Submitted {new Date(submission.submitted_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(submission.status)}
                      {submission.signed_pdf_url && (
                        <a
                          href={submission.signed_pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View PDF
                        </a>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteSubmission(submission.id, submission.signed_pdf_url)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete submission"
                          aria-label="Delete submission"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  {submission.review_comment && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Review Comment:</span> {submission.review_comment}
                      </p>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default EducatorAreaPage

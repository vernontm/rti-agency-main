import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { FileText, ExternalLink, X, Clock, CheckCircle, XCircle, Trash2, Download, Inbox } from 'lucide-react'
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
  is_view_only?: boolean
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
  const { t, i18n } = useTranslation()
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
        .select('id, form_name, form_type, fields_schema, is_view_only')
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
      toast.error(t('educatorArea.loadError'))
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSubmission = async (submissionId: string, signedPdfUrl?: string | null) => {
    if (!confirm(t('educatorArea.deleteSubmissionConfirm'))) {
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

      toast.success(t('educatorArea.submissionDeleted'))
      fetchData()
    } catch (error) {
      console.error('Error deleting submission:', error)
      toast.error(t('educatorArea.deleteSubmissionError'))
    }
  }

  const handleFormDownload = async (values: Record<string, string | boolean | { text: string; font: string }>) => {
    if (!selectedForm) return

    const schema = selectedForm.fields_schema
    const pdfUrl = schema.pdf_url || schema.pdfUrl

    try {
      toast.loading(t('educatorArea.generatingPdf'), { id: 'pdf-dl' })

      let pdfBytes: Uint8Array
      if (schema.acroForm) {
        pdfBytes = await generateAcroFilledPDF(pdfUrl!, values as Record<string, string | boolean>)
      } else {
        pdfBytes = await generateFilledPDF(pdfUrl!, schema.fields!, values)
      }

      // Trigger browser download
      const pdfBlob = uint8ArrayToBlob(pdfBytes)
      const blobUrl = URL.createObjectURL(pdfBlob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `${selectedForm.form_name.replace(/\s+/g, '_')}_${Date.now()}.pdf`
      document.body.appendChild(link)
      link.click()
      // Delay removal/revoke to give the browser time to start the download
      setTimeout(() => {
        document.body.removeChild(link)
        URL.revokeObjectURL(blobUrl)
      }, 1000)

      toast.dismiss('pdf-dl')
      toast.success(t('educatorArea.downloadedPdf'))
    } catch (error) {
      toast.dismiss('pdf-dl')
      console.error('Error downloading form:', error)
      toast.error(t('educatorArea.downloadError'))
    }
  }

  const handleFormSubmit = async (values: Record<string, string | boolean | { text: string; font: string }>) => {
    if (!selectedForm || !profile) return

    const schema = selectedForm.fields_schema
    const pdfUrl = schema.pdf_url || schema.pdfUrl

    try {
      toast.loading(t('educatorArea.generatingSignedDoc'), { id: 'pdf-gen' })

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
      toast.success(t('educatorArea.formSubmitted'))
      setSelectedForm(null)
      fetchData()
    } catch (error: any) {
      toast.dismiss('pdf-gen')
      console.error('Error submitting form:', error)
      const errorMessage = error?.message || error?.error_description || t('educatorArea.submitError')
      toast.error(errorMessage)
    }
  }

  const getStatusBadge = (status: FormStatus) => {
    const badges = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: t('educatorArea.statusPending') },
      received: { color: 'bg-blue-100 text-blue-800', icon: Inbox, label: t('educatorArea.statusReceived') },
      approved: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: t('educatorArea.statusApproved') },
      rejected: { color: 'bg-red-100 text-red-800', icon: XCircle, label: t('educatorArea.statusRejected') },
    }
    const badge = badges[status]
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <badge.icon className="w-3 h-3" />
        {badge.label}
      </span>
    )
  }

  const locale = i18n.language?.startsWith('es') ? 'es-ES' : 'en-US'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        <span className="sr-only">{t('common.loadingSr')}</span>
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
              aria-label={t('educatorArea.closeForm')}
            >
              <X className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{selectedForm.form_name}</h1>
              <p className="text-gray-600">{t('educatorArea.fillOutFormSubtitle')}</p>
            </div>
          </div>
          {schema.acroForm ? (
            <AcroFormViewer
              pdfUrl={pdfUrl}
              formName={selectedForm.form_name}
              mode="employee"
              onSubmit={handleFormSubmit}
              onDownload={handleFormDownload}
            />
          ) : (
            <PDFFormViewer
              pdfUrl={pdfUrl}
              fields={schema.fields!}
              formName={selectedForm.form_name}
              onSubmit={handleFormSubmit}
              onDownload={handleFormDownload}
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
        <h1 className="text-2xl font-bold text-gray-900">{t('educatorArea.title')}</h1>
        <p className="text-gray-600">{t('educatorArea.subtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b" role="tablist" aria-label={t('educatorArea.tabsAriaLabel')}>
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
          {t('educatorArea.availableTab', { count: forms.length })}
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
          {t('educatorArea.submissionsTab', { count: submissions.length })}
        </button>
      </div>

      {/* Forms Tab */}
      {activeTab === 'forms' && (
        <div role="tabpanel" id="educator-tabpanel-forms" aria-labelledby="educator-tab-forms">
          {forms.length === 0 ? (
            <Card className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">{t('educatorArea.emptyFormsTitle')}</p>
              <p className="text-sm text-gray-400 mt-1">{t('educatorArea.emptyFormsBody')}</p>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {forms.map(form => {
                const schema = form.fields_schema
                const pdfUrl = schema.pdf_url || schema.pdfUrl
                const isPdfForm = schema?.type === 'pdf'
                const isViewOnly = !!form.is_view_only

                return (
                  <Card key={form.id} className="hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${isViewOnly ? 'bg-purple-100' : 'bg-orange-100'}`}>
                        <FileText className={`w-6 h-6 ${isViewOnly ? 'text-purple-600' : 'text-orange-600'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 truncate">{form.form_name}</h3>
                          {isViewOnly && (
                            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 flex-shrink-0">
                              {t('educatorArea.viewOnlyBadge')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {isViewOnly ? t('educatorArea.viewOnlyDescription') : isPdfForm ? t('educatorArea.fillablePdfDescription') : t('educatorArea.digitalFormDescription')}
                        </p>
                        <div className="mt-3 flex gap-2 flex-wrap">
                          {isViewOnly && pdfUrl ? (
                            <>
                              <a
                                href={pdfUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-1.5 font-medium"
                              >
                                <ExternalLink className="w-3 h-3" />
                                {t('educatorArea.openPrintButton')}
                              </a>
                              <a
                                href={pdfUrl}
                                download
                                className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1.5"
                              >
                                <Download className="w-3 h-3" />
                                {t('educatorArea.downloadButton')}
                              </a>
                            </>
                          ) : (
                            <>
                              {isPdfForm && pdfUrl && (schema.fields || schema.acroForm) ? (
                                <Button
                                  size="sm"
                                  onClick={() => setSelectedForm(form)}
                                >
                                  {t('educatorArea.fillFormButton')}
                                </Button>
                              ) : (
                                <span className="text-sm text-gray-400">{t('educatorArea.formNotAvailable')}</span>
                              )}
                              {pdfUrl && (
                                <a
                                  href={pdfUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  {t('educatorArea.viewButton')}
                                </a>
                              )}
                            </>
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
              <p className="text-gray-500">{t('educatorArea.emptySubmissionsTitle')}</p>
              <p className="text-sm text-gray-400 mt-1">{t('educatorArea.emptySubmissionsBody')}</p>
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
                          {(submission.forms as Tables<'forms'>)?.form_name || t('educatorArea.unknownForm')}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {t('educatorArea.submittedOn', { date: new Date(submission.submitted_at).toLocaleDateString(locale) })}
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
                          {t('educatorArea.viewPdfButton')}
                        </a>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteSubmission(submission.id, submission.signed_pdf_url)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title={t('educatorArea.deleteSubmissionTitle')}
                          aria-label={t('educatorArea.deleteSubmissionAria')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  {submission.review_comment && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">{t('educatorArea.reviewComment')}</span> {submission.review_comment}
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

import { useState, useRef, useEffect, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import Button from '../ui/Button'
import { Send, RefreshCw, ZoomIn, ZoomOut, Lock } from 'lucide-react'
import toast from 'react-hot-toast'

// Set worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

// Signature font options
const signatureFonts = [
  { name: 'Elegant', fontFamily: "'Dancing Script', cursive" },
  { name: 'Classic', fontFamily: "'Great Vibes', cursive" },
  { name: 'Modern', fontFamily: "'Pacifico', cursive" },
]

interface AnnotationField {
  id: string
  fieldName: string
  fieldType: string // 'Tx', 'Btn', 'Ch', 'Sig'
  subtype: string
  rect: number[] // [x1, y1, x2, y2] in PDF coordinates
  page: number
  checkBox?: boolean
  radioButton?: boolean
  multiLine?: boolean
  defaultValue?: string
}

// Field role detection helpers
const isManagerField = (name: string) => /manager/i.test(name) || /supervisor/i.test(name) || /admin.*sig/i.test(name)
const isEmployeeSignatureField = (name: string) => /sig/i.test(name) && !isManagerField(name)
const isEmployeeDateField = (name: string, allFields: AnnotationField[]) => {
  if (!(/date/i.test(name))) return false
  if (isManagerField(name)) return false
  // If the field name explicitly references employee, it's an employee date
  if (/employee/i.test(name)) return true
  // If it's just "Date" or "Date_N", check if it's NOT near a manager field
  // For simple heuristic: if there's a manager date field, this one is employee's
  const hasManagerDate = allFields.some(f => /date/i.test(f.fieldName) && isManagerField(f.fieldName))
  if (hasManagerDate) return true
  // If no manager date exists, all date fields near non-manager sig fields are employee dates
  return true
}

export type AcroFormMode = 'employee' | 'manager-review' | 'readonly'

interface AcroFormViewerProps {
  pdfUrl: string
  formName: string
  onSubmit: (values: Record<string, string | boolean>) => void
  readOnly?: boolean
  mode?: AcroFormMode
  initialValues?: Record<string, string | boolean>
}

const AcroFormViewer = ({ pdfUrl, formName, onSubmit, readOnly = false, mode = 'employee', initialValues }: AcroFormViewerProps) => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [scale, setScale] = useState(1.0)
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }[]>([])
  const [pageViewports, setPageViewports] = useState<pdfjsLib.PageViewport[]>([])
  const [annotationFields, setAnnotationFields] = useState<AnnotationField[]>([])
  const [values, setValues] = useState<Record<string, string | boolean>>(initialValues || {})
  const [submitting, setSubmitting] = useState(false)
  const [signatureText, setSignatureText] = useState('')
  const [signatureFont, setSignatureFont] = useState(signatureFonts[0].fontFamily)
  const [signatureDate, setSignatureDate] = useState(new Date().toISOString().split('T')[0])
  const [printName, setPrintName] = useState('')

  const viewerRef = useRef<HTMLDivElement>(null)
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const renderGenRef = useRef(0)

  const isEmployeeMode = mode === 'employee'
  const isManagerMode = mode === 'manager-review'
  const isReadonlyMode = mode === 'readonly' || readOnly

  // Load PDF
  useEffect(() => {
    if (!pdfUrl) return
    const loadPdf = async () => {
      try {
        const pdf = await pdfjsLib.getDocument(pdfUrl).promise
        setPdfDoc(pdf)
        setTotalPages(pdf.numPages)
      } catch (error) {
        console.error('Error loading PDF:', error)
        toast.error('Failed to load PDF')
      }
    }
    loadPdf()
  }, [pdfUrl])

  // Extract annotation fields and calculate dimensions
  useEffect(() => {
    if (!pdfDoc || totalPages === 0) return
    const extract = async () => {
      const dims: { width: number; height: number }[] = []
      const viewports: pdfjsLib.PageViewport[] = []
      const fields: AnnotationField[] = []

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum)
        const viewport = page.getViewport({ scale })
        dims.push({ width: viewport.width, height: viewport.height })
        viewports.push(viewport)

        const annotations = await page.getAnnotations()
        for (const ann of annotations) {
          if (ann.subtype === 'Widget' && ann.fieldName) {
            fields.push({
              id: ann.id,
              fieldName: ann.fieldName,
              fieldType: ann.fieldType || 'Tx',
              subtype: ann.subtype,
              rect: ann.rect,
              page: pageNum,
              checkBox: ann.checkBox,
              radioButton: ann.radioButton,
              multiLine: ann.multiLine,
              defaultValue: ann.fieldValue,
            })
          }
        }
      }

      setPageDimensions(dims)
      setPageViewports(viewports)
      setAnnotationFields(fields)

      // Set default values
      const defaults: Record<string, string | boolean> = {}
      for (const f of fields) {
        if (f.defaultValue) {
          if (f.checkBox) {
            defaults[f.fieldName] = f.defaultValue === 'Yes'
          } else {
            defaults[f.fieldName] = f.defaultValue
          }
        }
      }
      setValues(prev => ({ ...defaults, ...prev }))
    }
    extract()
  }, [pdfDoc, totalPages, scale])

  // Render pages to canvas
  useEffect(() => {
    if (!pdfDoc || totalPages === 0) return
    const generation = ++renderGenRef.current
    const renderPages = async () => {
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        if (renderGenRef.current !== generation) return
        const canvas = canvasRefs.current[pageNum - 1]
        if (!canvas) continue
        const page = await pdfDoc.getPage(pageNum)
        const viewport = page.getViewport({ scale })
        const context = canvas.getContext('2d')!
        canvas.height = viewport.height
        canvas.width = viewport.width
        if (renderGenRef.current !== generation) return
        try {
          await page.render({ canvasContext: context, viewport } as any).promise
        } catch (e: any) {
          if (e?.name === 'RenderingCancelledException') return
          throw e
        }
      }
    }
    renderPages()
  }, [pdfDoc, totalPages, scale])

  const handleValueChange = (fieldName: string, value: string | boolean) => {
    setValues(prev => ({ ...prev, [fieldName]: value }))
  }

  // Convert PDF rect to CSS position using viewport's built-in transform (handles rotation)
  const rectToStyle = (rect: number[], pageNum: number) => {
    const viewport = pageViewports[pageNum - 1]
    if (!viewport) return {}

    const [vx1, vy1, vx2, vy2] = viewport.convertToViewportRectangle(rect)
    const left = Math.min(vx1, vx2)
    const top = Math.min(vy1, vy2)
    const width = Math.abs(vx2 - vx1)
    const height = Math.abs(vy2 - vy1)

    return {
      left: Math.max(0, left),
      top: Math.max(0, top),
      width: Math.max(12, width),
      height: Math.max(12, height),
    }
  }

  const handleZoomIn = () => setScale(s => Math.min(s + 0.15, 3))
  const handleZoomOut = () => setScale(s => Math.max(s - 0.15, 0.4))

  const handleRealign = async () => {
    if (!pdfDoc || !viewerRef.current) return
    const viewer = viewerRef.current
    const page = await pdfDoc.getPage(1)
    const viewport = page.getViewport({ scale: 1 })
    const containerWidth = viewer.clientWidth - 48
    if (containerWidth <= 0) return
    const fitScale = Math.min(Math.max(containerWidth / viewport.width, 0.5), 2.5)
    setScale(fitScale + 0.001)
    requestAnimationFrame(() => setScale(fitScale))
    toast.success('Fields realigned')
  }

  // Determine field editability and role
  const getFieldRole = (field: AnnotationField): 'regular' | 'employee-sig' | 'employee-date' | 'manager' => {
    if (isManagerField(field.fieldName)) return 'manager'
    if (isEmployeeSignatureField(field.fieldName)) return 'employee-sig'
    if (isEmployeeDateField(field.fieldName, annotationFields)) return 'employee-date'
    return 'regular'
  }

  const isFieldDisabled = (field: AnnotationField): boolean => {
    if (isReadonlyMode) return true
    const role = getFieldRole(field)

    if (isEmployeeMode) {
      // Employee can't fill manager fields or employee sig/date fields (those come from the bottom section)
      if (role === 'manager') return true
      if (role === 'employee-sig' || role === 'employee-date') return true
      return false
    }

    if (isManagerMode) {
      // Manager can only fill manager fields
      if (role === 'manager') return false
      return true
    }

    return false
  }

  // Get display value for auto-filled fields
  const getDisplayValue = (field: AnnotationField): string | boolean | undefined => {
    const role = getFieldRole(field)
    const existing = values[field.fieldName]

    if (isEmployeeMode) {
      if (role === 'employee-sig' && signatureText) return signatureText
      if (role === 'employee-date' && signatureDate) return signatureDate
    }

    return existing
  }

  const handleSubmit = async () => {
    const allValues: Record<string, string | boolean> = { ...values }

    // Auto-fill employee signature/date fields into values
    if (isEmployeeMode) {
      for (const field of annotationFields) {
        const role = getFieldRole(field)
        if (role === 'employee-sig' && signatureText) {
          allValues[field.fieldName] = signatureText
        }
        if (role === 'employee-date' && signatureDate) {
          allValues[field.fieldName] = signatureDate
        }
      }
    }

    // Auto-fill manager signature/date fields
    if (isManagerMode) {
      for (const field of annotationFields) {
        if (isManagerField(field.fieldName)) {
          if (/sig/i.test(field.fieldName) && signatureText) {
            allValues[field.fieldName] = signatureText
          }
          if (/date/i.test(field.fieldName) && signatureDate) {
            allValues[field.fieldName] = signatureDate
          }
        }
      }
    }

    // Add signature metadata
    if (signatureText) {
      allValues['_signature_text'] = signatureText
      allValues['_signature_font'] = signatureFont
    }
    if (signatureDate) {
      allValues['_signature_date'] = signatureDate
    }
    if (printName) {
      allValues['_print_name'] = printName
    }

    // Tag the mode
    if (isManagerMode) {
      allValues['_manager_signature_text'] = signatureText
      allValues['_manager_signature_font'] = signatureFont
      allValues['_manager_signature_date'] = signatureDate
      allValues['_manager_print_name'] = printName
    }

    setSubmitting(true)
    try {
      await onSubmit(allValues)
    } catch (err) {
      console.error('Form submission failed:', err)
      toast.error('Failed to submit form')
    } finally {
      setSubmitting(false)
    }
  }

  // Get field overlay styles based on role
  const getFieldOverlayClasses = (field: AnnotationField): string => {
    const role = getFieldRole(field)
    const disabled = isFieldDisabled(field)

    if (disabled && role === 'manager' && isEmployeeMode) {
      return 'bg-gray-200/80 border border-gray-300 cursor-not-allowed'
    }
    if (disabled) {
      return 'bg-gray-100/60 border border-gray-200 cursor-not-allowed'
    }
    if (role === 'employee-sig' || (role === 'manager' && isManagerMode && /sig/i.test(field.fieldName))) {
      return 'bg-amber-50/70 border border-amber-300 focus:ring-1 focus:ring-amber-500 focus:bg-white/90'
    }
    return 'bg-blue-50/70 border border-blue-200 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white/90'
  }

  const signatureSectionTitle = isManagerMode ? 'Manager Signature & Date' : 'Employee Signature & Date'
  const signatureSectionSubtitle = isManagerMode
    ? 'Your signature will be applied to the Manager Signature and Date fields'
    : 'Your signature will be applied to the Employee Signature and Date fields on the form'

  // Count manager fields for showing the note
  const managerFieldCount = annotationFields.filter(f => isManagerField(f.fieldName)).length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-lg shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">{formName}</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {totalPages} page{totalPages !== 1 ? 's' : ''} &middot; {annotationFields.length} fields
          </span>
          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={handleZoomOut}
              className="p-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              title="Zoom out"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs text-gray-500 w-12 text-center">{Math.round(scale * 100)}%</span>
            <button
              onClick={handleZoomIn}
              className="p-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              title="Zoom in"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={handleRealign}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            title="Fit to width & realign fields"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Realign
          </button>
        </div>
      </div>

      {/* Manager fields notice for employees */}
      {isEmployeeMode && managerFieldCount > 0 && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-gray-100 rounded-lg text-sm text-gray-600">
          <Lock className="w-4 h-4 flex-shrink-0 text-gray-400" />
          <span>
            Manager Signature and Date fields are locked. They will be filled in by your manager after review.
          </span>
        </div>
      )}

      {/* PDF Viewer */}
      <div ref={viewerRef} className="flex-1 overflow-auto bg-gray-100 rounded-lg p-6">
        <div className="mx-auto space-y-4" style={{ width: 'fit-content', maxWidth: '100%' }}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
            const dim = pageDimensions[pageNum - 1]
            const pageFields = annotationFields.filter(f => f.page === pageNum)
            return (
              <div
                key={pageNum}
                className="relative"
                style={dim ? { width: dim.width, height: dim.height } : undefined}
              >
                <canvas
                  ref={(el) => { canvasRefs.current[pageNum - 1] = el }}
                  className="shadow-lg block"
                  style={dim ? { width: dim.width, height: dim.height } : undefined}
                />
                {/* AcroForm field overlays */}
                {dim && pageFields.map((field) => {
                  const style = rectToStyle(field.rect, pageNum)
                  const displayVal = getDisplayValue(field)
                  const disabled = isFieldDisabled(field)
                  const fieldRole = getFieldRole(field)
                  const overlayClasses = getFieldOverlayClasses(field)

                  // Manager field locked overlay for employees
                  if (disabled && fieldRole === 'manager' && isEmployeeMode) {
                    return (
                      <div
                        key={field.id}
                        className="absolute flex items-center justify-center bg-gray-200/80 border border-gray-300 rounded-sm"
                        style={style}
                        title="Manager will fill this field"
                      >
                        <Lock className="w-3 h-3 text-gray-400" />
                      </div>
                    )
                  }

                  // Employee sig/date fields — show auto-filled preview
                  if (isEmployeeMode && (fieldRole === 'employee-sig' || fieldRole === 'employee-date')) {
                    const previewText = fieldRole === 'employee-sig' ? (signatureText || '') : (signatureDate || '')
                    const fontStyle = fieldRole === 'employee-sig' ? signatureFont : undefined
                    return (
                      <div
                        key={field.id}
                        className="absolute px-1 bg-amber-50/70 border border-amber-300 rounded-sm flex items-center"
                        style={{
                          ...style,
                          fontFamily: fontStyle,
                          fontSize: Math.min((style.height as number) * 0.65, 11),
                          color: fieldRole === 'employee-sig' ? '#1e3a5f' : '#374151',
                        }}
                        title={fieldRole === 'employee-sig' ? 'Auto-filled from signature below' : 'Auto-filled from date below'}
                      >
                        <span className="truncate">{previewText || 'Will be filled from below ↓'}</span>
                      </div>
                    )
                  }

                  if (field.checkBox) {
                    return (
                      <div
                        key={field.id}
                        className="absolute flex items-center justify-center"
                        style={style}
                      >
                        <input
                          type="checkbox"
                          checked={!!(displayVal ?? false)}
                          onChange={(e) => handleValueChange(field.fieldName, e.target.checked)}
                          disabled={disabled}
                          className="w-full h-full cursor-pointer accent-blue-600"
                        />
                      </div>
                    )
                  }

                  if (field.multiLine) {
                    return (
                      <textarea
                        key={field.id}
                        value={(displayVal as string) || ''}
                        onChange={(e) => handleValueChange(field.fieldName, e.target.value)}
                        disabled={disabled}
                        className={`absolute px-1 rounded-sm resize-none focus:outline-none ${overlayClasses}`}
                        style={{
                          ...style,
                          fontSize: Math.min((style.height as number) * 0.6, 11),
                        }}
                      />
                    )
                  }

                  // Manager sig field in manager mode — show signature preview
                  if (isManagerMode && isManagerField(field.fieldName) && /sig/i.test(field.fieldName)) {
                    return (
                      <div
                        key={field.id}
                        className="absolute px-1 bg-amber-50/70 border border-amber-300 rounded-sm flex items-center"
                        style={{
                          ...style,
                          fontFamily: signatureFont,
                          fontSize: Math.min((style.height as number) * 0.65, 11),
                          color: '#1e3a5f',
                        }}
                        title="Auto-filled from manager signature below"
                      >
                        <span className="truncate">{signatureText || 'Will be filled from below ↓'}</span>
                      </div>
                    )
                  }

                  // Manager date field in manager mode — show date preview
                  if (isManagerMode && isManagerField(field.fieldName) && /date/i.test(field.fieldName)) {
                    return (
                      <div
                        key={field.id}
                        className="absolute px-1 bg-amber-50/70 border border-amber-300 rounded-sm flex items-center"
                        style={{
                          ...style,
                          fontSize: Math.min((style.height as number) * 0.65, 11),
                          color: '#374151',
                        }}
                        title="Auto-filled from manager date below"
                      >
                        <span className="truncate">{signatureDate || 'Will be filled from below ↓'}</span>
                      </div>
                    )
                  }

                  // Default: text input
                  return (
                    <input
                      key={field.id}
                      type="text"
                      value={(displayVal as string) || ''}
                      onChange={(e) => handleValueChange(field.fieldName, e.target.value)}
                      disabled={disabled}
                      className={`absolute px-1 rounded-sm focus:outline-none ${overlayClasses}`}
                      style={{
                        ...style,
                        fontSize: Math.min((style.height as number) * 0.65, 11),
                        lineHeight: 1,
                      }}
                    />
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Signature & Date Section — shown for employee mode and manager-review mode */}
      {!isReadonlyMode && (
        <div className="mt-4 bg-white p-4 rounded-lg shadow-sm space-y-4">
          <div>
            <h3 className="font-semibold text-gray-800">{signatureSectionTitle}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{signatureSectionSubtitle}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {/* Print Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Print Name</label>
              <input
                type="text"
                value={printName}
                onChange={(e) => setPrintName(e.target.value)}
                placeholder="Your full name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={signatureDate}
                onChange={(e) => setSignatureDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            {/* Signature */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Signature</label>
              <input
                type="text"
                value={signatureText}
                onChange={(e) => setSignatureText(e.target.value)}
                placeholder="Type your signature"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                style={{ fontFamily: signatureFont }}
              />
              <div className="flex gap-1 mt-1">
                {signatureFonts.map((font) => (
                  <button
                    key={font.name}
                    type="button"
                    onClick={() => setSignatureFont(font.fontFamily)}
                    className={`flex-1 px-2 py-1 text-xs rounded ${
                      signatureFont === font.fontFamily
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                    style={{ fontFamily: font.fontFamily }}
                  >
                    {font.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Signature Preview */}
          {signatureText && (
            <div className="p-3 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <p className="text-xs text-gray-500 mb-1">Signature Preview</p>
              <p className="text-2xl text-blue-900" style={{ fontFamily: signatureFont }}>
                {signatureText}
              </p>
            </div>
          )}

          {/* Submit / Approve Button */}
          <div className="flex justify-end">
            <Button onClick={handleSubmit} loading={submitting}>
              <Send className="w-4 h-4 mr-2" />
              {isManagerMode ? 'Sign & Approve' : 'Submit Form'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default AcroFormViewer

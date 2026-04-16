import { useState, useRef, useEffect, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import Button from '../ui/Button'
import { Send, RefreshCw, ZoomIn, ZoomOut, Lock, Download, Printer } from 'lucide-react'
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
const isParentField = (name: string) => /parent/i.test(name) || /guardian/i.test(name) || /client/i.test(name)
const isEmployeeSignatureField = (name: string) => /sig/i.test(name) && !isManagerField(name) && !isParentField(name)

export type AcroFormMode = 'employee' | 'manager-review' | 'readonly'

interface AcroFormViewerProps {
  pdfUrl: string
  formName: string
  onSubmit: (values: Record<string, string | boolean>) => void
  onDownload?: (values: Record<string, string | boolean>) => Promise<void> | void
  readOnly?: boolean
  mode?: AcroFormMode
  initialValues?: Record<string, string | boolean>
}

interface SignatureState {
  text: string
  font: string
  printName: string
}

const defaultSigState = (): SignatureState => ({
  text: '',
  font: signatureFonts[0].fontFamily,
  printName: '',
})

const AcroFormViewer = ({ pdfUrl, formName, onSubmit, onDownload, readOnly = false, mode = 'employee', initialValues }: AcroFormViewerProps) => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [scale, setScale] = useState(1.0)
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }[]>([])
  const [pageViewports, setPageViewports] = useState<pdfjsLib.PageViewport[]>([])
  const [annotationFields, setAnnotationFields] = useState<AnnotationField[]>([])
  const [values, setValues] = useState<Record<string, string | boolean>>(initialValues || {})
  const [submitting, setSubmitting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  // Multiple signature slots — keyed by group index (0, 1, 2...)
  const [signatures, setSignatures] = useState<Record<number, SignatureState>>({ 0: defaultSigState() })

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

  // --- Signature group detection ---
  // Each employee signature field gets its own group. Dates are independent (filled via date picker).
  const employeeSigFields = annotationFields.filter(f => isEmployeeSignatureField(f.fieldName))

  // Sort sig fields by page then Y position (top to bottom)
  const sortedSigFields = [...employeeSigFields].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page
    return b.rect[1] - a.rect[1] // Higher Y = higher on page in PDF coords
  })

  // Build a map: sig field name → group index
  const sigFieldGroupMap = new Map<string, number>()
  sortedSigFields.forEach((sf, idx) => {
    sigFieldGroupMap.set(sf.fieldName, idx)
  })

  const numSigGroups = sortedSigFields.length

  // Ensure we have signature state for all groups
  useEffect(() => {
    const needed = Math.max(numSigGroups, 1)
    if (needed > Object.keys(signatures).length) {
      setSignatures(prev => {
        const updated = { ...prev }
        for (let i = 0; i < needed; i++) {
          if (!updated[i]) updated[i] = defaultSigState()
        }
        return updated
      })
    }
  }, [numSigGroups])

  const updateSignature = (groupIdx: number, updates: Partial<SignatureState>) => {
    setSignatures(prev => ({
      ...prev,
      [groupIdx]: { ...(prev[groupIdx] || defaultSigState()), ...updates },
    }))
  }

  // Determine field editability and role
  const getFieldRole = (field: AnnotationField): 'regular' | 'employee-sig' | 'date' | 'manager' | 'parent' => {
    if (isManagerField(field.fieldName)) return 'manager'
    if (isParentField(field.fieldName)) return 'parent'
    if (isEmployeeSignatureField(field.fieldName)) return 'employee-sig'
    if (/date/i.test(field.fieldName)) return 'date'
    return 'regular'
  }

  const getFieldSigGroup = (field: AnnotationField): number => {
    return sigFieldGroupMap.get(field.fieldName) ?? 0
  }

  const isFieldDisabled = (field: AnnotationField): boolean => {
    if (isReadonlyMode) return true
    const role = getFieldRole(field)

    // Parent/client fields are always disabled — meant to be printed and filled by hand
    if (role === 'parent') return true

    if (isEmployeeMode) {
      if (role === 'manager') return true
      if (role === 'employee-sig') return true // filled via section below
      // date and regular are editable by employee
      return false
    }

    if (isManagerMode) {
      // Manager can edit manager fields only
      if (role === 'manager') return false
      return true
    }

    return false
  }

  // Get display value for auto-filled fields
  const getDisplayValue = (field: AnnotationField): string | boolean | undefined => {
    const role = getFieldRole(field)
    const existing = values[field.fieldName]
    const groupIdx = getFieldSigGroup(field)
    const sig = signatures[groupIdx] || defaultSigState()

    if (isEmployeeMode) {
      if (role === 'employee-sig' && sig.text) return sig.text
    }

    return existing
  }

  // Build the final values object for submit/download/approve
  const buildFinalValues = (): Record<string, string | boolean> => {
    const allValues: Record<string, string | boolean> = { ...values }

    if (isEmployeeMode) {
      // Only fill employee signature fields from their group. Dates were entered manually.
      for (const field of annotationFields) {
        const role = getFieldRole(field)
        if (role === 'parent') continue // never fill parent/client fields
        const groupIdx = getFieldSigGroup(field)
        const sig = signatures[groupIdx] || defaultSigState()

        if (role === 'employee-sig' && sig.text) {
          allValues[field.fieldName] = sig.text
        }
      }
      // Use first signature group for font metadata
      const primary = signatures[0] || defaultSigState()
      if (primary.text) {
        allValues['_signature_text'] = primary.text
        allValues['_signature_font'] = primary.font
      }
      if (primary.printName) allValues['_print_name'] = primary.printName
    }

    if (isManagerMode) {
      const mgrSig = signatures[0] || defaultSigState()
      const mgrDate = (values['_manager_sign_date'] as string) || ''
      for (const field of annotationFields) {
        if (isManagerField(field.fieldName)) {
          if (/sig/i.test(field.fieldName) && mgrSig.text) {
            allValues[field.fieldName] = mgrSig.text
          }
          if (/date/i.test(field.fieldName) && mgrDate) {
            allValues[field.fieldName] = mgrDate
          }
        }
      }
      allValues['_manager_signature_text'] = mgrSig.text
      allValues['_manager_signature_font'] = mgrSig.font
      allValues['_manager_signature_date'] = mgrDate
      allValues['_manager_print_name'] = mgrSig.printName
    }

    return allValues
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await onSubmit(buildFinalValues())
    } catch (err) {
      console.error('Form submission failed:', err)
      toast.error('Failed to submit form')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDownload = async () => {
    if (!onDownload) return
    setDownloading(true)
    try {
      await onDownload(buildFinalValues())
    } catch (err) {
      console.error('Form download failed:', err)
      toast.error('Failed to download form')
    } finally {
      setDownloading(false)
    }
  }

  // Get field overlay styles based on role
  const getFieldOverlayClasses = (field: AnnotationField): string => {
    const role = getFieldRole(field)
    const disabled = isFieldDisabled(field)

    if (role === 'parent') {
      return 'bg-purple-50/60 border border-purple-200 border-dashed cursor-not-allowed'
    }
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

  // Count fields for notices
  const managerFieldCount = annotationFields.filter(f => isManagerField(f.fieldName)).length
  const parentFieldCount = annotationFields.filter(f => isParentField(f.fieldName)).length

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

      {/* Parent/client fields notice */}
      {isEmployeeMode && parentFieldCount > 0 && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-purple-50 rounded-lg text-sm text-purple-700">
          <Printer className="w-4 h-4 flex-shrink-0" />
          <span>
            Parent/Client/Guardian signature fields will be left blank. Print the form and have them sign it by hand.
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
                  if (fieldRole === 'manager' && isEmployeeMode) {
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

                  // Parent/client fields — blank for printing
                  if (fieldRole === 'parent') {
                    return (
                      <div
                        key={field.id}
                        className="absolute flex items-center justify-center bg-purple-50/60 border border-purple-200 border-dashed rounded-sm"
                        style={style}
                        title="Print and have parent/client sign"
                      >
                        <Printer className="w-3 h-3 text-purple-400" />
                      </div>
                    )
                  }

                  // Employee sig fields — show auto-filled preview from their group
                  if (isEmployeeMode && fieldRole === 'employee-sig') {
                    const groupIdx = getFieldSigGroup(field)
                    const sig = signatures[groupIdx] || defaultSigState()
                    return (
                      <div
                        key={field.id}
                        className="absolute px-1 bg-amber-50/70 border border-amber-300 rounded-sm flex items-center"
                        style={{
                          ...style,
                          fontFamily: sig.font,
                          fontSize: Math.min((style.height as number) * 0.65, 11),
                          color: '#1e3a5f',
                        }}
                        title={`Auto-filled from Employee Signature #${groupIdx + 1} section below`}
                      >
                        <span className="truncate">{sig.text || `Signature #${groupIdx + 1} ↓`}</span>
                      </div>
                    )
                  }

                  // Date field — native date picker (employee mode, non-manager, non-parent)
                  if (fieldRole === 'date' && isEmployeeMode) {
                    return (
                      <input
                        key={field.id}
                        type="date"
                        value={(displayVal as string) || ''}
                        onChange={(e) => handleValueChange(field.fieldName, e.target.value)}
                        disabled={disabled}
                        className={`absolute px-1 rounded-sm focus:outline-none ${overlayClasses}`}
                        style={{
                          ...style,
                          fontSize: Math.min((style.height as number) * 0.6, 10),
                          lineHeight: 1,
                        }}
                      />
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
                    const mgrSig = signatures[0] || defaultSigState()
                    return (
                      <div
                        key={field.id}
                        className="absolute px-1 bg-amber-50/70 border border-amber-300 rounded-sm flex items-center"
                        style={{
                          ...style,
                          fontFamily: mgrSig.font,
                          fontSize: Math.min((style.height as number) * 0.65, 11),
                          color: '#1e3a5f',
                        }}
                        title="Auto-filled from manager signature below"
                      >
                        <span className="truncate">{mgrSig.text || 'Will be filled from below ↓'}</span>
                      </div>
                    )
                  }

                  // Manager date field in manager mode — native date picker
                  if (isManagerMode && isManagerField(field.fieldName) && /date/i.test(field.fieldName)) {
                    return (
                      <input
                        key={field.id}
                        type="date"
                        value={(values['_manager_sign_date'] as string) || ''}
                        onChange={(e) => setValues(prev => ({ ...prev, _manager_sign_date: e.target.value }))}
                        className="absolute px-1 bg-amber-50/70 border border-amber-300 rounded-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                        style={{
                          ...style,
                          fontSize: Math.min((style.height as number) * 0.6, 10),
                          lineHeight: 1,
                        }}
                      />
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

      {/* Signature Section — shown for employee mode (per group) and manager-review mode */}
      {!isReadonlyMode && (isEmployeeMode ? numSigGroups > 0 : true) && (
        <div className="mt-4 space-y-4">
          {(isManagerMode ? [0] : Array.from({ length: numSigGroups }, (_, i) => i)).map((groupIdx) => {
            const sig = signatures[groupIdx] || defaultSigState()
            const sectionTitle = isManagerMode
              ? 'Manager Signature'
              : numSigGroups > 1
                ? `Employee Signature (${groupIdx + 1} of ${numSigGroups})`
                : 'Employee Signature'
            const sectionSubtitle = isManagerMode
              ? 'Your signature will be applied to the Manager Signature field'
              : numSigGroups > 1
                ? `Fills Employee Signature #${groupIdx + 1} on the form. Date fields are filled directly in the form above.`
                : 'Fills the Employee Signature field on the form. Date fields are filled directly in the form above.'

            return (
              <div key={groupIdx} className="bg-white p-4 rounded-lg shadow-sm space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-800">{sectionTitle}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{sectionSubtitle}</p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Print Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Print Name</label>
                    <input
                      type="text"
                      value={sig.printName}
                      onChange={(e) => updateSignature(groupIdx, { printName: e.target.value })}
                      placeholder="Your full name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>

                  {/* Signature */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Signature</label>
                    <input
                      type="text"
                      value={sig.text}
                      onChange={(e) => updateSignature(groupIdx, { text: e.target.value })}
                      placeholder="Type your signature"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      style={{ fontFamily: sig.font }}
                    />
                    <div className="flex gap-1 mt-1">
                      {signatureFonts.map((font) => (
                        <button
                          key={font.name}
                          type="button"
                          onClick={() => updateSignature(groupIdx, { font: font.fontFamily })}
                          className={`flex-1 px-2 py-1 text-xs rounded ${
                            sig.font === font.fontFamily
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
                {sig.text && (
                  <div className="p-3 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <p className="text-xs text-gray-500 mb-1">Signature Preview</p>
                    <p className="text-2xl text-blue-900" style={{ fontFamily: sig.font }}>
                      {sig.text}
                    </p>
                  </div>
                )}
              </div>
            )
          })}

          {/* Submit / Download / Approve Buttons */}
          <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm gap-3">
            <div className="text-xs text-gray-500">
              {isEmployeeMode && 'Review the form above, then submit for manager approval.'}
              {isManagerMode && 'Review the employee\'s submission, then sign and approve below.'}
            </div>
            <div className="flex gap-2">
              {isEmployeeMode && onDownload && (
                <Button variant="outline" onClick={handleDownload} loading={downloading}>
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              )}
              <Button onClick={handleSubmit} loading={submitting}>
                <Send className="w-4 h-4 mr-2" />
                {isManagerMode ? 'Sign & Approve' : 'Submit Form'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AcroFormViewer

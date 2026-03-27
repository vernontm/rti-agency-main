import { useState, useRef, useEffect, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import Button from '../ui/Button'
import { Send } from 'lucide-react'
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

interface AcroFormViewerProps {
  pdfUrl: string
  formName: string
  onSubmit: (values: Record<string, string | boolean>) => void
  readOnly?: boolean
}

const AcroFormViewer = ({ pdfUrl, formName, onSubmit, readOnly = false }: AcroFormViewerProps) => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [scale, setScale] = useState(1.2)
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }[]>([])
  const [annotationFields, setAnnotationFields] = useState<AnnotationField[]>([])
  const [values, setValues] = useState<Record<string, string | boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [signatureText, setSignatureText] = useState('')
  const [signatureFont, setSignatureFont] = useState(signatureFonts[0].fontFamily)
  const [signatureDate, setSignatureDate] = useState(new Date().toISOString().split('T')[0])
  const [printName, setPrintName] = useState('')

  const viewerRef = useRef<HTMLDivElement>(null)
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const renderGenRef = useRef(0)

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

  // Calculate scale to fit width
  useEffect(() => {
    if (!pdfDoc || !viewerRef.current || totalPages === 0) return
    const calculateFitScale = async () => {
      const viewer = viewerRef.current
      if (!viewer) return
      await new Promise(resolve => requestAnimationFrame(resolve))
      const page = await pdfDoc.getPage(1)
      const viewport = page.getViewport({ scale: 1 })
      const containerWidth = viewer.clientWidth - 48
      if (containerWidth <= 0) return
      const newScale = containerWidth / viewport.width
      setScale(Math.min(Math.max(newScale, 0.5), 2.5))
    }
    calculateFitScale()
    const handleResize = () => calculateFitScale()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [pdfDoc, totalPages])

  // Extract annotation fields and calculate dimensions
  useEffect(() => {
    if (!pdfDoc || totalPages === 0) return
    const extract = async () => {
      const dims: { width: number; height: number }[] = []
      const fields: AnnotationField[] = []

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum)
        const viewport = page.getViewport({ scale })
        dims.push({ width: viewport.width, height: viewport.height })

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

  // Convert PDF rect [x1, y1, x2, y2] (bottom-left origin) to CSS position (top-left origin)
  const rectToStyle = (rect: number[], pageNum: number) => {
    const dim = pageDimensions[pageNum - 1]
    if (!dim) return {}

    const page1Viewport = scale // we use scale directly since viewport = page * scale
    const [x1, y1, x2, y2] = rect
    const left = x1 * scale
    const bottom = y1 * scale
    const width = (x2 - x1) * scale
    const height = (y2 - y1) * scale
    const top = dim.height - bottom - height

    return {
      left: Math.max(0, left),
      top: Math.max(0, top),
      width: Math.max(12, width),
      height: Math.max(12, height),
    }
  }

  const handleSubmit = async () => {
    const allValues: Record<string, string | boolean> = { ...values }

    // Add signature fields
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

    setSubmitting(true)
    try {
      await onSubmit(allValues)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-lg shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">{formName}</h2>
        <span className="text-sm text-gray-500">
          {totalPages} page{totalPages !== 1 ? 's' : ''} &middot; {annotationFields.length} fields
        </span>
      </div>

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
                  const val = values[field.fieldName]

                  if (field.checkBox) {
                    return (
                      <div
                        key={field.id}
                        className="absolute flex items-center justify-center"
                        style={style}
                      >
                        <input
                          type="checkbox"
                          checked={!!val}
                          onChange={(e) => handleValueChange(field.fieldName, e.target.checked)}
                          disabled={readOnly}
                          className="w-full h-full cursor-pointer accent-blue-600"
                        />
                      </div>
                    )
                  }

                  if (field.multiLine) {
                    return (
                      <textarea
                        key={field.id}
                        value={(val as string) || ''}
                        onChange={(e) => handleValueChange(field.fieldName, e.target.value)}
                        disabled={readOnly}
                        className="absolute px-1 text-xs bg-blue-50/70 border border-blue-200 rounded-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white/90"
                        style={{
                          ...style,
                          fontSize: Math.min((style.height as number) * 0.6, 11),
                        }}
                      />
                    )
                  }

                  // Default: text input
                  return (
                    <input
                      key={field.id}
                      type="text"
                      value={(val as string) || ''}
                      onChange={(e) => handleValueChange(field.fieldName, e.target.value)}
                      disabled={readOnly}
                      className="absolute px-1 bg-blue-50/70 border border-blue-200 rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white/90"
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

      {/* Signature & Date Section */}
      {!readOnly && (
        <div className="mt-4 bg-white p-4 rounded-lg shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-800">Signature & Date</h3>

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

          {/* Submit Button */}
          <div className="flex justify-end">
            <Button onClick={handleSubmit} loading={submitting}>
              <Send className="w-4 h-4 mr-2" />
              Submit Form
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default AcroFormViewer

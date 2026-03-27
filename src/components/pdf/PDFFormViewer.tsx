import { useState, useRef, useEffect } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import Button from '../ui/Button'
import { Send } from 'lucide-react'
import toast from 'react-hot-toast'
import type { PDFFormField } from './PDFFormBuilder'

// Set worker path - use local worker file
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

interface PDFFormViewerProps {
  pdfUrl: string
  fields: PDFFormField[]
  formName: string
  onSubmit: (values: Record<string, string | boolean | { text: string; font: string }>) => void
  readOnly?: boolean
  initialValues?: Record<string, string | boolean | { text: string; font: string }>
  pdfRotation?: number
}

// Signature font options
const signatureFonts = [
  { name: 'Elegant', fontFamily: "'Dancing Script', cursive" },
  { name: 'Classic', fontFamily: "'Great Vibes', cursive" },
  { name: 'Modern', fontFamily: "'Pacifico', cursive" },
]

type FieldValue = string | boolean | { text: string; font: string }

const PDFFormViewer = ({ pdfUrl, fields, formName, onSubmit, readOnly = false, initialValues = {}, pdfRotation = 0 }: PDFFormViewerProps) => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [scale, setScale] = useState(1.2)
  const [pageHeights, setPageHeights] = useState<number[]>([])
  const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number }[]>([])
  const [values, setValues] = useState<Record<string, FieldValue>>(initialValues as Record<string, FieldValue>)
  const [submitting, setSubmitting] = useState(false)
  const [activeSignatureField, setActiveSignatureField] = useState<string | null>(null)
  
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<HTMLDivElement>(null)

  // Load PDF
  useEffect(() => {
    if (!pdfUrl) return

    const loadPdf = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument(pdfUrl)
        const pdf = await loadingTask.promise
        setPdfDoc(pdf)
        setTotalPages(pdf.numPages)
      } catch (error) {
        console.error('Error loading PDF:', error)
        toast.error('Failed to load PDF')
      }
    }

    loadPdf()
  }, [pdfUrl])

  // Track render generation to prevent stale renders from overwriting fresh ones
  const renderGenRef = useRef(0)

  // Calculate scale to fit width
  useEffect(() => {
    if (!pdfDoc || !viewerRef.current || totalPages === 0) return

    const calculateFitScale = async () => {
      const viewer = viewerRef.current
      if (!viewer) return

      await new Promise(resolve => requestAnimationFrame(resolve))

      const page = await pdfDoc.getPage(1)
      const viewport = page.getViewport({ scale: 1, rotation: pdfRotation })
      const containerWidth = viewer.clientWidth - 48
      if (containerWidth <= 0) return
      const newScale = containerWidth / viewport.width
      setScale(Math.min(Math.max(newScale, 0.5), 2.5))
    }

    calculateFitScale()

    const handleResize = () => calculateFitScale()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [pdfDoc, totalPages, pdfRotation])

  // Calculate page dimensions (synchronous with viewport, no rendering needed)
  useEffect(() => {
    if (!pdfDoc || totalPages === 0) return

    const calcDimensions = async () => {
      const heights: number[] = []
      const dimensions: { width: number; height: number }[] = []

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum)
        const viewport = page.getViewport({ scale, rotation: pdfRotation })
        heights.push(viewport.height)
        dimensions.push({ width: viewport.width, height: viewport.height })
      }

      setPageHeights(heights)
      setPageDimensions(dimensions)
    }

    calcDimensions()
  }, [pdfDoc, totalPages, scale, pdfRotation])

  // Render all pages to canvas with cancellation support
  useEffect(() => {
    if (!pdfDoc || totalPages === 0) return

    const generation = ++renderGenRef.current

    const renderAllPages = async () => {
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        if (renderGenRef.current !== generation) return
        const canvas = canvasRefs.current[pageNum - 1]
        if (!canvas) continue

        const page = await pdfDoc.getPage(pageNum)
        const viewport = page.getViewport({ scale, rotation: pdfRotation })
        const context = canvas.getContext('2d')!

        canvas.height = viewport.height
        canvas.width = viewport.width

        if (renderGenRef.current !== generation) return
        const renderTask = page.render({
          canvasContext: context,
          viewport,
        } as unknown as Parameters<typeof page.render>[0])

        try {
          await renderTask.promise
        } catch (e: any) {
          if (e?.name === 'RenderingCancelledException') return
          throw e
        }
        if (renderGenRef.current !== generation) return
      }
    }

    renderAllPages()
  }, [pdfDoc, totalPages, scale, pdfRotation])

  const handleValueChange = (fieldId: string, value: FieldValue) => {
    setValues(prev => ({ ...prev, [fieldId]: value }))
  }

  const handleSignatureChange = (fieldId: string, text: string, font: string) => {
    setValues(prev => ({ ...prev, [fieldId]: { text, font } }))
  }

  const getSignatureValue = (fieldId: string): { text: string; font: string } => {
    const val = values[fieldId]
    if (val && typeof val === 'object' && 'text' in val) {
      return val
    }
    return { text: '', font: signatureFonts[0].fontFamily }
  }

  const handleSubmit = async () => {
    // Validate required fields
    const missingRequired = fields.filter(f => f.required && !values[f.id])
    if (missingRequired.length > 0) {
      toast.error(`Please fill in required fields: ${missingRequired.map(f => f.label).join(', ')}`)
      return
    }

    setSubmitting(true)
    try {
      await onSubmit(values)
    } finally {
      setSubmitting(false)
    }
  }

  // Calculate cumulative heights for field positioning
  const getCumulativeHeight = (pageNum: number) => {
    let height = 0
    for (let i = 0; i < pageNum - 1; i++) {
      height += (pageHeights[i] || 0) + 16 // 16px gap between pages
    }
    return height
  }

  const renderFieldInput = (field: PDFFormField) => {
    const value = values[field.id] || ''

    switch (field.type) {
      case 'checkbox':
        return (
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => handleValueChange(field.id, e.target.checked)}
            disabled={readOnly}
            className="w-full h-full cursor-pointer"
          />
        )
      case 'date':
        return (
          <input
            type="date"
            value={value as string}
            onChange={(e) => handleValueChange(field.id, e.target.value)}
            disabled={readOnly}
            className="w-full h-full px-1 text-sm border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        )
      case 'textarea':
        return (
          <textarea
            value={value as string}
            onChange={(e) => handleValueChange(field.id, e.target.value)}
            disabled={readOnly}
            className="w-full h-full px-1 text-sm border-0 bg-transparent resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        )
      case 'signature':
        const sigValue = getSignatureValue(field.id)
        return (
          <div className="w-full h-full flex flex-col">
            {activeSignatureField === field.id ? (
              <div className="flex flex-col h-full">
                <input
                  type="text"
                  value={sigValue.text}
                  onChange={(e) => handleSignatureChange(field.id, e.target.value, sigValue.font)}
                  disabled={readOnly}
                  placeholder="Type your name..."
                  className="flex-1 px-2 text-lg border-0 bg-transparent focus:outline-none"
                  style={{ fontFamily: sigValue.font }}
                  autoFocus
                />
                <div className="flex gap-1 p-1 bg-gray-100 border-t">
                  {signatureFonts.map((font) => (
                    <button
                      key={font.name}
                      type="button"
                      onClick={() => handleSignatureChange(field.id, sigValue.text, font.fontFamily)}
                      className={`flex-1 px-2 py-1 text-xs rounded ${
                        sigValue.font === font.fontFamily
                          ? 'bg-blue-500 text-white'
                          : 'bg-white hover:bg-gray-200'
                      }`}
                      style={{ fontFamily: font.fontFamily }}
                    >
                      {font.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setActiveSignatureField(null)}
                    className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => !readOnly && setActiveSignatureField(field.id)}
                className="w-full h-full flex items-center justify-center cursor-pointer hover:bg-blue-50"
              >
                {sigValue.text ? (
                  <span
                    className="text-xl text-gray-800"
                    style={{ fontFamily: sigValue.font }}
                  >
                    {sigValue.text}
                  </span>
                ) : (
                  <span className="text-gray-400 text-sm italic">Click to sign</span>
                )}
              </div>
            )}
          </div>
        )
      default:
        return (
          <input
            type={field.type}
            value={value as string}
            onChange={(e) => handleValueChange(field.id, e.target.value)}
            disabled={readOnly}
            className="w-full h-full px-1 text-sm border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        )
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-lg shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">{formName}</h2>
        <span className="text-sm text-gray-500">{totalPages} page{totalPages !== 1 ? 's' : ''}</span>
      </div>

      {/* PDF Viewer - All Pages */}
      <div ref={viewerRef} className="flex-1 overflow-auto bg-gray-100 rounded-lg p-6">
        <div
          ref={containerRef}
          className="mx-auto space-y-4"
          style={{ width: 'fit-content', maxWidth: '100%' }}
        >
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
            const pageFields = fields.filter(f => f.page === pageNum)
            const pageDim = pageDimensions[pageNum - 1]
            return (
              <div
                key={pageNum}
                className="relative"
                style={pageDim ? { width: pageDim.width, height: pageDim.height } : undefined}
              >
                <canvas
                  ref={(el) => { canvasRefs.current[pageNum - 1] = el }}
                  className="shadow-lg block"
                  style={pageDim ? { width: pageDim.width, height: pageDim.height } : undefined}
                />
                {/* Field inputs overlay for this page - only render when dimensions are ready */}
                {pageDim && pageDim.width > 1 && pageFields.map((field) => {
                  // Convert percentage coordinates to pixels using actual canvas dimensions
                  const pixelX = (field.x / 100) * pageDim.width
                  const pixelY = (field.y / 100) * pageDim.height
                  const pixelWidth = (field.width / 100) * pageDim.width
                  const pixelHeight = (field.height / 100) * pageDim.height

                  return (
                    <div
                      key={field.id}
                      className={`absolute bg-white/90 border ${
                        field.required && !values[field.id]
                          ? 'border-red-300'
                          : 'border-blue-300'
                      } rounded overflow-hidden`}
                      style={{
                        left: pixelX,
                        top: pixelY,
                        width: pixelWidth,
                        height: pixelHeight,
                      }}
                      title={`${field.label}${field.required ? ' (Required)' : ''}`}
                    >
                      {renderFieldInput(field)}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer with field list and submit */}
      {!readOnly && (
        <div className="mt-4 bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {fields.filter(f => values[f.id]).length} of {fields.length} fields completed
              {fields.some(f => f.required && !values[f.id]) && (
                <span className="text-red-500 ml-2">
                  ({fields.filter(f => f.required && !values[f.id]).length} required fields remaining)
                </span>
              )}
            </div>
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

export default PDFFormViewer

import { useState, useRef, useEffect, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { AnnotationLayer } from 'pdfjs-dist'
import 'pdfjs-dist/web/pdf_viewer.css'
import Button from '../ui/Button'
import { Send, Download } from 'lucide-react'
import toast from 'react-hot-toast'

// Set worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

// Signature font options
const signatureFonts = [
  { name: 'Elegant', fontFamily: "'Dancing Script', cursive" },
  { name: 'Classic', fontFamily: "'Great Vibes', cursive" },
  { name: 'Modern', fontFamily: "'Pacifico', cursive" },
]

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
  const [submitting, setSubmitting] = useState(false)
  const [signatureText, setSignatureText] = useState('')
  const [signatureFont, setSignatureFont] = useState(signatureFonts[0].fontFamily)
  const [signatureDate, setSignatureDate] = useState(new Date().toISOString().split('T')[0])
  const [printName, setPrintName] = useState('')

  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<HTMLDivElement[]>([])
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const annotationLayerRefs = useRef<HTMLDivElement[]>([])

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

  // Render pages with annotation layer
  useEffect(() => {
    if (!pdfDoc || totalPages === 0) return

    const renderPages = async () => {
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const canvas = canvasRefs.current[pageNum - 1]
        const annotationDiv = annotationLayerRefs.current[pageNum - 1]
        if (!canvas || !annotationDiv) continue

        const page = await pdfDoc.getPage(pageNum)
        const viewport = page.getViewport({ scale })
        const context = canvas.getContext('2d')!

        canvas.height = viewport.height
        canvas.width = viewport.width

        // Render the page content to canvas
        await page.render({
          canvasContext: context,
          viewport,
        } as any).promise

        // Clear previous annotation layer content
        annotationDiv.innerHTML = ''
        annotationDiv.style.width = `${viewport.width}px`
        annotationDiv.style.height = `${viewport.height}px`

        // Render annotation layer with form fields
        const annotations = await page.getAnnotations()

        if (annotations.length > 0) {
          const annotationLayer = new AnnotationLayer({
            div: annotationDiv,
            page,
            viewport,
            accessibilityManager: null,
            annotationCanvasMap: null,
            annotationEditorUIManager: null,
            structTreeLayer: null,
            commentManager: null,
            linkService: {
              getDestinationHash: () => '#',
              getAnchorUrl: () => '#',
              addLinkAttributes: () => {},
              isPageVisible: () => true,
              isPageCached: () => true,
              goToDestination: () => {},
              goToPage: () => {},
              navigateTo: () => {},
              getKeyboardFocusableElement: () => null,
            } as any,
            annotationStorage: pdfDoc.annotationStorage,
          } as any)

          await annotationLayer.render({
            viewport,
            div: annotationDiv,
            annotations,
            page,
            linkService: {
              getDestinationHash: () => '#',
              getAnchorUrl: () => '#',
              addLinkAttributes: () => {},
              isPageVisible: () => true,
              isPageCached: () => true,
              goToDestination: () => {},
              goToPage: () => {},
              navigateTo: () => {},
              getKeyboardFocusableElement: () => null,
            } as any,
            renderForms: !readOnly,
          } as any)
        }
      }
    }

    renderPages()
  }, [pdfDoc, totalPages, scale, readOnly])

  // Collect values from annotation layer inputs
  const collectFormValues = useCallback((): Record<string, string | boolean> => {
    const values: Record<string, string | boolean> = {}

    // Collect from annotation storage
    if (pdfDoc) {
      const storage = pdfDoc.annotationStorage
      // Get all annotation layer inputs
      annotationLayerRefs.current.forEach(div => {
        if (!div) return
        const inputs = div.querySelectorAll('input, textarea, select')
        inputs.forEach((el: Element) => {
          const input = el as HTMLInputElement
          const name = input.name || input.id
          if (!name) return

          if (input.type === 'checkbox' || input.type === 'radio') {
            if (input.checked) {
              values[name] = true
            }
          } else {
            if (input.value) {
              values[name] = input.value
            }
          }
        })
      })
    }

    // Add signature fields
    if (signatureText) {
      values['_signature_text'] = signatureText
      values['_signature_font'] = signatureFont
    }
    if (signatureDate) {
      values['_signature_date'] = signatureDate
    }
    if (printName) {
      values['_print_name'] = printName
    }

    return values
  }, [pdfDoc, signatureText, signatureFont, signatureDate, printName])

  const handleSubmit = async () => {
    const values = collectFormValues()
    setSubmitting(true)
    try {
      await onSubmit(values)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-lg shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">{formName}</h2>
        <span className="text-sm text-gray-500">{totalPages} page{totalPages !== 1 ? 's' : ''}</span>
      </div>

      {/* PDF Viewer with Annotation Layer */}
      <div ref={viewerRef} className="flex-1 overflow-auto bg-gray-100 rounded-lg p-6">
        <div
          ref={containerRef}
          className="mx-auto space-y-4"
          style={{ width: 'fit-content', maxWidth: '100%' }}
        >
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
            <div
              key={pageNum}
              ref={(el) => { if (el) pageRefs.current[pageNum - 1] = el }}
              className="relative shadow-lg bg-white"
            >
              <canvas
                ref={(el) => { canvasRefs.current[pageNum - 1] = el }}
                className="block"
              />
              <div
                ref={(el) => { if (el) annotationLayerRefs.current[pageNum - 1] = el }}
                className="annotationLayer absolute top-0 left-0"
              />
            </div>
          ))}
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

          {/* Preview */}
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

import { useState, useRef, useEffect, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { supabase } from '../../lib/supabase'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Input from '../ui/Input'
import { Upload, Trash2, Save, Type, CheckSquare, Calendar, Hash, Mail, Phone, FileText, X, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

// Set worker path - use local worker file
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

export interface PDFFormField {
  id: string
  name: string
  label: string
  type: 'text' | 'email' | 'tel' | 'number' | 'date' | 'checkbox' | 'signature' | 'textarea'
  // Coordinates are stored as percentages (0-100) relative to page dimensions
  x: number
  y: number
  width: number
  height: number
  page: number
  required: boolean
}

interface PDFFormBuilderProps {
  onSave: (pdfUrl: string, fields: PDFFormField[], formName: string) => void
  initialPdfUrl?: string
  initialFields?: PDFFormField[]
  initialFormName?: string
}

const fieldTypes = [
  { type: 'text', icon: Type, label: 'Text' },
  { type: 'email', icon: Mail, label: 'Email' },
  { type: 'tel', icon: Phone, label: 'Phone' },
  { type: 'number', icon: Hash, label: 'Number' },
  { type: 'date', icon: Calendar, label: 'Date' },
  { type: 'checkbox', icon: CheckSquare, label: 'Checkbox' },
  { type: 'signature', icon: FileText, label: 'Signature' },
  { type: 'textarea', icon: FileText, label: 'Text Area' },
] as const

const PDFFormBuilder = ({ onSave, initialPdfUrl, initialFields, initialFormName }: PDFFormBuilderProps) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(initialPdfUrl || null)
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [scale, setScale] = useState(1.2)
  const [fields, setFields] = useState<PDFFormField[]>([])
  const [fieldsInitialized, setFieldsInitialized] = useState(false)
  const [selectedField, setSelectedField] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isResizing, setIsResizing] = useState(false)
  const [formName, setFormName] = useState(initialFormName || '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 })
  const [pageDimensions, setPageDimensions] = useState<Record<number, { width: number; height: number }>>({})
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load PDF when URL changes
  useEffect(() => {
    if (!pdfUrl) return

    const loadPdf = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument(pdfUrl)
        const pdf = await loadingTask.promise
        setPdfDoc(pdf)
        setTotalPages(pdf.numPages)
        setCurrentPage(1)
      } catch (error) {
        console.error('Error loading PDF:', error)
        toast.error('Failed to load PDF')
      }
    }

    loadPdf()
  }, [pdfUrl])

  // Extract existing form fields from PDF (AcroForm fields + text pattern detection)
  const extractFormFields = async (pdf: pdfjsLib.PDFDocumentProxy) => {
    const detectedFields: PDFFormField[] = []
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const annotations = await page.getAnnotations()
      const viewport = page.getViewport({ scale, rotation: 0 })
      
      // First try to detect AcroForm fields
      for (const annotation of annotations) {
        if (annotation.subtype === 'Widget') {
          const fieldType = mapAnnotationType(annotation.fieldType)
          if (fieldType) {
            const rect = annotation.rect
            const [x1, y1, x2, y2] = rect
            const transformedX = x1 * scale
            const transformedY = viewport.height - (y2 * scale)
            const width = (x2 - x1) * scale
            const height = (y2 - y1) * scale
            
            detectedFields.push({
              id: `field_${Date.now()}_${detectedFields.length}`,
              name: annotation.fieldName || `field_${detectedFields.length + 1}`,
              label: annotation.alternativeText || annotation.fieldName || `Field ${detectedFields.length + 1}`,
              type: fieldType,
              x: Math.max(0, transformedX),
              y: Math.max(0, transformedY),
              width: Math.max(20, width),
              height: Math.max(20, height),
              page: pageNum,
              required: annotation.required || false,
            })
          }
        }
      }
      
      // If no AcroForm fields found, try text pattern detection
      if (detectedFields.length === 0) {
        const textContent = await page.getTextContent()
        const textItems = textContent.items as Array<{ str: string; transform: number[]; width: number; height: number }>
        
        // Common form field patterns
        const fieldPatterns = [
          { pattern: /name/i, type: 'text' as const, label: 'Name' },
          { pattern: /email/i, type: 'email' as const, label: 'Email' },
          { pattern: /phone|tel|mobile/i, type: 'tel' as const, label: 'Phone' },
          { pattern: /date|dob|birth/i, type: 'date' as const, label: 'Date' },
          { pattern: /signature/i, type: 'signature' as const, label: 'Signature' },
          { pattern: /address/i, type: 'text' as const, label: 'Address' },
          { pattern: /city/i, type: 'text' as const, label: 'City' },
          { pattern: /state/i, type: 'text' as const, label: 'State' },
          { pattern: /zip|postal/i, type: 'text' as const, label: 'Zip Code' },
          { pattern: /ssn|social security/i, type: 'text' as const, label: 'SSN' },
          { pattern: /employer/i, type: 'text' as const, label: 'Employer' },
          { pattern: /occupation|job|position/i, type: 'text' as const, label: 'Occupation' },
        ]
        
        for (const item of textItems) {
          const text = item.str.trim()
          if (text.length < 2) continue
          
          // Check if text matches any field pattern
          for (const { pattern, type, label } of fieldPatterns) {
            if (pattern.test(text)) {
              // Position field to the right of the label
              const x = (item.transform[4] * scale) + (item.width * scale) + 10
              const y = viewport.height - (item.transform[5] * scale) - 5
              
              // Avoid duplicates
              const isDuplicate = detectedFields.some(f => 
                Math.abs(f.y - y) < 20 && f.label.toLowerCase() === label.toLowerCase()
              )
              
              if (!isDuplicate) {
                detectedFields.push({
                  id: `field_${Date.now()}_${detectedFields.length}`,
                  name: label.toLowerCase().replace(/\s+/g, '_'),
                  label: label,
                  type: type,
                  x: Math.max(0, Math.min(x, viewport.width - 150)),
                  y: Math.max(0, y),
                  width: type === 'signature' ? 200 : 150,
                  height: type === 'signature' ? 50 : 24,
                  page: pageNum,
                  required: false,
                })
              }
              break
            }
          }
        }
      }
    }
    
    if (detectedFields.length > 0) {
      setFields(detectedFields)
      toast.success(`Auto-detected ${detectedFields.length} form fields`)
    } else {
      toast('No fields detected. Add fields manually using the buttons above.', { icon: 'ℹ️' })
    }
  }

  // Map PDF annotation field types to our field types
  const mapAnnotationType = (fieldType: string): PDFFormField['type'] | null => {
    switch (fieldType) {
      case 'Tx': return 'text'
      case 'Btn': return 'checkbox'
      case 'Ch': return 'text' // Choice/dropdown -> text
      case 'Sig': return 'signature'
      default: return 'text'
    }
  }

  // Render current page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return

    const renderPage = async () => {
      const page = await pdfDoc.getPage(currentPage)
      const viewport = page.getViewport({ scale, rotation: 0 })
      const canvas = canvasRef.current!
      const context = canvas.getContext('2d')!

      canvas.height = viewport.height
      canvas.width = viewport.width
      setCanvasDimensions({ width: viewport.width, height: viewport.height })
      setPageDimensions(prev => ({ ...prev, [currentPage]: { width: viewport.width, height: viewport.height } }))
      
      // Convert initial fields from percentages to pixels once canvas is ready
      if (!fieldsInitialized && initialFields && initialFields.length > 0) {
        // Load all page dimensions first for accurate conversion
        const allPageDims: Record<number, { width: number; height: number }> = {}
        for (let p = 1; p <= pdfDoc.numPages; p++) {
          const pg = await pdfDoc.getPage(p)
          const vp = pg.getViewport({ scale, rotation: pg.rotate })
          allPageDims[p] = { width: vp.width, height: vp.height }
        }
        setPageDimensions(allPageDims)
        
        const pixelFields = initialFields.map(field => {
          const dims = allPageDims[field.page] || { width: viewport.width, height: viewport.height }
          return {
            ...field,
            x: (field.x / 100) * dims.width,
            y: (field.y / 100) * dims.height,
            width: (field.width / 100) * dims.width,
            height: (field.height / 100) * dims.height,
          }
        })
        setFields(pixelFields)
        setFieldsInitialized(true)
      }

      await page.render({
        canvasContext: context,
        viewport,
        canvas: canvas,
      } as unknown as Parameters<typeof page.render>[0]).promise
    }

    renderPage()
  }, [pdfDoc, currentPage, scale])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file')
      return
    }

    setUploading(true)
    try {
      const fileName = `${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage
        .from('forms')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('forms')
        .getPublicUrl(fileName)

      setPdfUrl(publicUrl)
      setFields([])
      toast.success('PDF uploaded successfully')
    } catch (error) {
      console.error('Error uploading PDF:', error)
      toast.error('Failed to upload PDF')
    } finally {
      setUploading(false)
    }
  }

  const addField = (type: PDFFormField['type']) => {
    const newField: PDFFormField = {
      id: `field_${Date.now()}`,
      name: `field_${fields.length + 1}`,
      label: `Field ${fields.length + 1}`,
      type,
      x: 50,
      y: 50,
      width: type === 'checkbox' ? 20 : type === 'textarea' || type === 'signature' ? 200 : 150,
      height: type === 'checkbox' ? 20 : type === 'textarea' || type === 'signature' ? 60 : 24,
      page: currentPage,
      required: false,
    }
    setFields([...fields, newField])
    setSelectedField(newField.id)
  }

  const updateField = (id: string, updates: Partial<PDFFormField>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f))
  }

  const deleteField = (id: string) => {
    setFields(fields.filter(f => f.id !== id))
    if (selectedField === id) setSelectedField(null)
  }

  const duplicateField = (id: string) => {
    const field = fields.find(f => f.id === id)
    if (!field) return
    
    const newField: PDFFormField = {
      ...field,
      id: `field_${Date.now()}`,
      name: `${field.name}_copy`,
      label: `${field.label} (Copy)`,
      x: field.x + 20,
      y: field.y + 20,
    }
    setFields([...fields, newField])
    setSelectedField(newField.id)
  }

  const handleMouseDown = useCallback((e: React.MouseEvent, fieldId: string, isResize = false) => {
    e.stopPropagation()
    const field = fields.find(f => f.id === fieldId)
    if (!field) return

    setSelectedField(fieldId)
    
    if (isResize) {
      setIsResizing(true)
    } else {
      setIsDragging(true)
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        setDragOffset({
          x: e.clientX - rect.left - field.x,
          y: e.clientY - rect.top - field.y,
        })
      }
    }
  }, [fields])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!selectedField || (!isDragging && !isResizing)) return

    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return

    const field = fields.find(f => f.id === selectedField)
    if (!field) return

    if (isDragging) {
      const newX = Math.max(0, e.clientX - rect.left - dragOffset.x)
      const newY = Math.max(0, e.clientY - rect.top - dragOffset.y)
      updateField(selectedField, { x: newX, y: newY })
    } else if (isResizing) {
      const newWidth = Math.max(20, e.clientX - rect.left - field.x)
      const newHeight = Math.max(20, e.clientY - rect.top - field.y)
      updateField(selectedField, { width: newWidth, height: newHeight })
    }
  }, [selectedField, isDragging, isResizing, dragOffset, fields])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setIsResizing(false)
  }, [])

  const handleSave = async () => {
    if (!pdfUrl) {
      toast.error('Please upload a PDF first')
      return
    }
    if (!formName.trim()) {
      toast.error('Please enter a form name')
      return
    }
    if (fields.length === 0) {
      toast.error('Please add at least one field')
      return
    }
    if (canvasDimensions.width === 0 || canvasDimensions.height === 0) {
      toast.error('PDF not fully loaded')
      return
    }

    setSaving(true)
    try {
      // Convert pixel coordinates to percentages for storage using per-page dimensions
      const normalizedFields = fields.map(field => {
        const dims = pageDimensions[field.page] || canvasDimensions
        return {
          ...field,
          x: (field.x / dims.width) * 100,
          y: (field.y / dims.height) * 100,
          width: (field.width / dims.width) * 100,
          height: (field.height / dims.height) * 100,
        }
      })
      await onSave(pdfUrl, normalizedFields, formName)
    } finally {
      setSaving(false)
    }
  }

  const currentPageFields = fields.filter(f => f.page === currentPage)
  const selectedFieldData = fields.find(f => f.id === selectedField)

  return (
    <div className="flex gap-6 h-[calc(100vh-200px)]">
      {/* Left sidebar - Field types */}
      <div className="w-64 flex-shrink-0 space-y-4">
        <Card>
          <h3 className="font-semibold text-gray-900 mb-3">Form Details</h3>
          <Input
            label="Form Name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="e.g., W-4 Tax Form"
          />
        </Card>

        <Card>
          <h3 className="font-semibold text-gray-900 mb-3">Add Fields</h3>
          <div className="grid grid-cols-2 gap-2">
            {fieldTypes.map(({ type, icon: Icon, label }) => (
              <button
                key={type}
                onClick={() => addField(type)}
                disabled={!pdfUrl}
                className="flex flex-col items-center gap-1 p-3 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Icon className="w-5 h-5 text-gray-600" />
                <span className="text-xs text-gray-700">{label}</span>
              </button>
            ))}
          </div>
          {pdfUrl && pdfDoc && (
            <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
              <button
                onClick={() => extractFormFields(pdfDoc)}
                className="w-full px-3 py-2 text-sm bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
              >
                Re-detect Fields
              </button>
              {fields.length > 0 && (
                <button
                  onClick={() => {
                    setFields([])
                    setSelectedField(null)
                  }}
                  className="w-full px-3 py-2 text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                >
                  Clear All Fields
                </button>
              )}
            </div>
          )}
        </Card>

        {selectedFieldData && (
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Field Properties</h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => duplicateField(selectedFieldData.id)}
                  className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                  title="Duplicate field"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                </button>
                <button
                  onClick={() => deleteField(selectedFieldData.id)}
                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                  title="Delete field"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="space-y-3">
              <Input
                label="Field Name"
                value={selectedFieldData.name}
                onChange={(e) => updateField(selectedFieldData.id, { name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
              />
              <Input
                label="Label"
                value={selectedFieldData.label}
                onChange={(e) => updateField(selectedFieldData.id, { label: e.target.value })}
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedFieldData.required}
                  onChange={(e) => updateField(selectedFieldData.id, { required: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Required</span>
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                <div>X: {Math.round(selectedFieldData.x)}</div>
                <div>Y: {Math.round(selectedFieldData.y)}</div>
                <div>W: {Math.round(selectedFieldData.width)}</div>
                <div>H: {Math.round(selectedFieldData.height)}</div>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Main PDF viewer */}
      <div className="flex-1 flex flex-col">
        {!pdfUrl ? (
          <Card className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload a PDF</h3>
              <p className="text-gray-600 mb-4">Upload a PDF document to start adding fillable fields</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button onClick={() => fileInputRef.current?.click()} loading={uploading}>
                <Upload className="w-4 h-4 mr-2" />
                Select PDF
              </Button>
            </div>
          </Card>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-lg shadow-sm">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-2 hover:bg-gray-100 rounded disabled:opacity-50"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-2 hover:bg-gray-100 rounded disabled:opacity-50"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                >
                  <option value={0.75}>75%</option>
                  <option value={1}>100%</option>
                  <option value={1.2}>120%</option>
                  <option value={1.5}>150%</option>
                </select>
                <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="sm">
                  <Upload className="w-4 h-4 mr-1" />
                  Replace PDF
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* PDF Canvas with fields overlay */}
            <div className="flex-1 overflow-auto bg-gray-100 rounded-lg p-4">
              <div
                ref={containerRef}
                className="relative inline-block"
                style={canvasDimensions.width > 0 ? { width: canvasDimensions.width, height: canvasDimensions.height } : undefined}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <canvas
                  ref={canvasRef}
                  className="shadow-lg block"
                  style={canvasDimensions.width > 0 ? { width: canvasDimensions.width, height: canvasDimensions.height } : undefined}
                />
                
                {/* Field overlays */}
                {currentPageFields.map((field) => (
                  <div
                    key={field.id}
                    className={`absolute border-2 cursor-move ${
                      selectedField === field.id
                        ? 'border-blue-500 bg-blue-100/50'
                        : 'border-blue-300 bg-blue-50/30 hover:border-blue-400'
                    }`}
                    style={{
                      left: field.x,
                      top: field.y,
                      width: field.width,
                      height: field.height,
                    }}
                    onMouseDown={(e) => handleMouseDown(e, field.id)}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedField(field.id)
                    }}
                  >
                    <div className="absolute -top-5 left-0 text-xs bg-blue-500 text-white px-1 rounded whitespace-nowrap">
                      {field.label}
                    </div>
                    {selectedField === field.id && (
                      <div
                        className="absolute bottom-0 right-0 w-3 h-3 bg-blue-500 cursor-se-resize"
                        onMouseDown={(e) => handleMouseDown(e, field.id, true)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Save button */}
        {pdfUrl && (
          <div className="flex justify-end mt-4">
            <Button onClick={handleSave} loading={saving}>
              <Save className="w-4 h-4 mr-2" />
              Save Form Template
            </Button>
          </div>
        )}
      </div>

      {/* Right sidebar - Fields list */}
      <div className="w-64 flex-shrink-0">
        <Card className="h-full">
          <h3 className="font-semibold text-gray-900 mb-3">
            Fields ({fields.length})
          </h3>
          {fields.length === 0 ? (
            <p className="text-sm text-gray-500">No fields added yet</p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {fields.map((field) => (
                <div
                  key={field.id}
                  className={`p-2 rounded-lg cursor-pointer flex items-center justify-between ${
                    selectedField === field.id
                      ? 'bg-blue-100 border border-blue-300'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                  onClick={() => {
                    setSelectedField(field.id)
                    setCurrentPage(field.page)
                  }}
                >
                  <div>
                    <div className="text-sm font-medium text-gray-900">{field.label}</div>
                    <div className="text-xs text-gray-500">
                      {field.type} • Page {field.page}
                      {field.required && ' • Required'}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteField(field.id)
                    }}
                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

export default PDFFormBuilder

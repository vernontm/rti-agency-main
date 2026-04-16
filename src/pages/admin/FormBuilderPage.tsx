import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Tables } from '../../types/database.types'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { Plus, Trash2, GripVertical, Save, ArrowLeft, FileText, Upload, GraduationCap } from 'lucide-react'
import toast from 'react-hot-toast'
import PDFFormBuilder, { type PDFFormField } from '../../components/pdf/PDFFormBuilder'

interface FormField {
  name: string
  type: 'text' | 'email' | 'tel' | 'number' | 'date' | 'select' | 'textarea' | 'file'
  label: string
  required: boolean
  options?: string[]
}

type BuilderMode = 'list' | 'manual' | 'pdf'

interface EditingPDFForm {
  id: string
  pdfUrl: string
  fields: PDFFormField[]
  formName: string
  pdfRotation?: number
}

const FormBuilderPage = () => {
  const [forms, setForms] = useState<Tables<'forms'>[]>([])
  const [loading, setLoading] = useState(true)
  const [editingForm, setEditingForm] = useState<Tables<'forms'> | null>(null)
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState('')
  const [fields, setFields] = useState<FormField[]>([])
  const [saving, setSaving] = useState(false)
  const [builderMode, setBuilderMode] = useState<BuilderMode>('list')
  const [editingPDFForm, setEditingPDFForm] = useState<EditingPDFForm | null>(null)

  useEffect(() => {
    fetchForms()
  }, [])

  const fetchForms = async () => {
    try {
      const { data, error } = await supabase
        .from('forms')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setForms(data || [])
    } catch (error) {
      console.error('Error fetching forms:', error)
      toast.error('Failed to load forms')
    } finally {
      setLoading(false)
    }
  }

  const startNewForm = (mode: 'manual' | 'pdf') => {
    setEditingForm(null)
    setFormName('')
    setFormType('')
    setFields([])
    setBuilderMode(mode)
  }

  const handlePDFFormSave = async (pdfUrl: string, pdfFields: PDFFormField[], name: string, pdfRotation?: number, acroForm?: boolean) => {
    try {
      const formData = {
        form_name: name,
        form_type: name.toLowerCase().replace(/\s+/g, '_'),
        fields_schema: {
          type: 'pdf',
          pdfUrl,
          fields: pdfFields,
          pdfRotation: pdfRotation ?? 0,
          ...(acroForm ? { acroForm: true } : {}),
        },
      }

      if (editingPDFForm) {
        // Update existing PDF form
        const { error } = await supabase
          .from('forms')
          .update(formData)
          .eq('id', editingPDFForm.id)
        if (error) throw error
        toast.success('PDF form updated!')
      } else {
        // Create new PDF form
        const { error } = await supabase.from('forms').insert(formData)
        if (error) throw error
        toast.success('PDF form created!')
      }
      
      setEditingPDFForm(null)
      setBuilderMode('list')
      fetchForms()
    } catch (error) {
      console.error('Error saving PDF form:', error)
      toast.error('Failed to save PDF form')
    }
  }

  const resetToList = () => {
    setEditingForm(null)
    setEditingPDFForm(null)
    setFormName('')
    setFormType('')
    setFields([])
    setBuilderMode('list')
  }

  const editForm = (form: Tables<'forms'>) => {
    const schema = form.fields_schema as { type?: string; fields?: FormField[] | PDFFormField[]; pdfUrl?: string; pdfRotation?: number }

    // Check if it's a PDF form
    if (schema?.type === 'pdf') {
      setEditingPDFForm({
        id: form.id,
        pdfUrl: schema.pdfUrl || '',
        fields: (schema.fields as PDFFormField[]) || [],
        formName: form.form_name,
        pdfRotation: schema.pdfRotation ?? 0,
      })
      setBuilderMode('pdf')
      return
    }
    
    // Manual form
    setEditingForm(form)
    setFormName(form.form_name)
    setFormType(form.form_type)
    setFields((schema?.fields as FormField[]) || [])
    setBuilderMode('manual')
  }

  const addField = () => {
    setFields([
      ...fields,
      { name: '', type: 'text', label: '', required: false },
    ])
  }

  const updateField = (index: number, updates: Partial<FormField>) => {
    const newFields = [...fields]
    newFields[index] = { ...newFields[index], ...updates }
    // Auto-generate name from label
    if (updates.label) {
      newFields[index].name = updates.label.toLowerCase().replace(/\s+/g, '_')
    }
    setFields(newFields)
  }

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index))
  }

  const saveForm = async () => {
    if (!formName || !formType) {
      toast.error('Please fill in form name and type')
      return
    }

    if (fields.length === 0) {
      toast.error('Please add at least one field')
      return
    }

    setSaving(true)
    try {
      const formData = {
        form_name: formName,
        form_type: formType.toLowerCase().replace(/\s+/g, '_'),
        fields_schema: { fields },
      }

      if (editingForm) {
        const { error } = await supabase
          .from('forms')
          .update(formData)
          .eq('id', editingForm.id)
        if (error) throw error
        toast.success('Form updated!')
      } else {
        const { error } = await supabase.from('forms').insert(formData)
        if (error) throw error
        toast.success('Form created!')
      }

      setEditingForm(null)
      setFormName('')
      setFormType('')
      setFields([])
      fetchForms()
    } catch (error) {
      console.error('Error saving form:', error)
      toast.error('Failed to save form')
    } finally {
      setSaving(false)
    }
  }

  const deleteForm = async (id: string) => {
    if (!confirm('Are you sure you want to delete this form?')) return

    try {
      const { error } = await supabase.from('forms').delete().eq('id', id)
      if (error) throw error
      toast.success('Form deleted')
      fetchForms()
    } catch (error) {
      console.error('Error deleting form:', error)
      toast.error('Failed to delete form')
    }
  }

  const toggleEducatorArea = async (id: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from('forms')
        .update({ show_in_educator_area: !currentValue })
        .eq('id', id)
      if (error) throw error
      toast.success(currentValue ? 'Removed from Educator Area' : 'Added to Educator Area')
      fetchForms()
    } catch (error) {
      console.error('Error toggling educator area:', error)
      toast.error('Failed to update form')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // PDF Form Builder view
  if (builderMode === 'pdf') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={resetToList}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {editingPDFForm ? 'Edit PDF Form' : 'Create PDF Form'}
            </h1>
            <p className="text-gray-600">
              {editingPDFForm ? 'Modify fields on your PDF form' : 'Upload a PDF and add fillable fields'}
            </p>
          </div>
        </div>
        <PDFFormBuilder
          onSave={handlePDFFormSave}
          initialPdfUrl={editingPDFForm?.pdfUrl}
          initialFields={editingPDFForm?.fields}
          initialFormName={editingPDFForm?.formName}
          initialRotation={editingPDFForm?.pdfRotation}
        />
      </div>
    )
  }

  // Manual form editor view
  if (builderMode === 'manual' || editingForm !== null) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={resetToList}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {editingForm ? 'Edit Form' : 'Create New Form'}
            </h1>
            <p className="text-gray-600">Design your form fields</p>
          </div>
        </div>

        <Card>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Form Name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Employee Onboarding"
              />
              <Input
                label="Form Type (unique identifier)"
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                placeholder="e.g., employee_onboarding"
              />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Form Fields</h2>
            <Button size="sm" onClick={addField}>
              <Plus className="w-4 h-4 mr-1" />
              Add Field
            </Button>
          </div>

          {fields.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No fields yet. Click "Add Field" to start building your form.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {fields.map((field, index) => (
                <div
                  key={index}
                  className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg"
                >
                  <GripVertical className="w-5 h-5 text-gray-400 mt-2 cursor-move" />
                  <div className="flex-1 grid grid-cols-4 gap-4">
                    <Input
                      label="Label"
                      value={field.label}
                      onChange={(e) => updateField(index, { label: e.target.value })}
                      placeholder="Field label"
                    />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Type
                      </label>
                      <select
                        value={field.type}
                        onChange={(e) =>
                          updateField(index, { type: e.target.value as FormField['type'] })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="text">Text</option>
                        <option value="email">Email</option>
                        <option value="tel">Phone</option>
                        <option value="number">Number</option>
                        <option value="date">Date</option>
                        <option value="select">Dropdown</option>
                        <option value="textarea">Text Area</option>
                        <option value="file">File Upload</option>
                      </select>
                    </div>
                    {field.type === 'select' && (
                      <Input
                        label="Options (comma-separated)"
                        value={field.options?.join(', ') || ''}
                        onChange={(e) =>
                          updateField(index, {
                            options: e.target.value.split(',').map((o) => o.trim()),
                          })
                        }
                        placeholder="Option 1, Option 2"
                      />
                    )}
                    <div className="flex items-end gap-4">
                      <label className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) =>
                            updateField(index, { required: e.target.checked })
                          }
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">Required</span>
                      </label>
                    </div>
                  </div>
                  <button
                    onClick={() => removeField(index)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg mt-6"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setEditingForm(null)
              setFormName('')
              setFormType('')
              setFields([])
              setBuilderMode('list')
            }}
          >
            Cancel
          </Button>
          <Button onClick={saveForm} loading={saving}>
            <Save className="w-4 h-4 mr-1" />
            {editingForm ? 'Update Form' : 'Create Form'}
          </Button>
        </div>
      </div>
    )
  }

  // Forms list view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Form Builder</h1>
          <p className="text-gray-600">Create and manage form templates</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => startNewForm('manual')}>
            <Plus className="w-4 h-4 mr-1" />
            Manual Form
          </Button>
          <Button onClick={() => startNewForm('pdf')}>
            <Upload className="w-4 h-4 mr-1" />
            PDF Form
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {forms.map((form) => {
          const schema = form.fields_schema as { type?: string; fields?: FormField[]; pdfUrl?: string }
          const fieldCount = schema?.fields?.length || 0
          const isPdfForm = schema?.type === 'pdf'

          return (
            <Card key={form.id} className="hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-1">
                <h3 className="font-semibold text-gray-900">{form.form_name}</h3>
                <div className="flex gap-1">
                  {(form as { show_in_educator_area?: boolean }).show_in_educator_area && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full flex items-center gap-1">
                      <GraduationCap className="w-3 h-3" />
                      Educator
                    </span>
                  )}
                  {isPdfForm && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                      PDF
                    </span>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-500 mb-3">Type: {form.form_type}</p>
              <p className="text-sm text-gray-600 mb-4">{fieldCount} fields</p>
              
              {/* Educator Area Toggle */}
              <label className="flex items-center gap-2 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={(form as { show_in_educator_area?: boolean }).show_in_educator_area || false}
                  onChange={() => toggleEducatorArea(form.id, (form as { show_in_educator_area?: boolean }).show_in_educator_area || false)}
                  className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                />
                <span className="text-sm text-gray-600">Show in Educator Area</span>
              </label>
              
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => editForm(form)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:bg-red-50"
                  onClick={() => deleteForm(form.id)}
                >
                  Delete
                </Button>
              </div>
            </Card>
          )
        })}

        {forms.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No forms created yet.</p>
            <p className="text-sm mt-1">Create a manual form or upload a PDF to get started.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default FormBuilderPage

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import type { Tables } from '../../types/database.types'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { Plus, Trash2, Edit2, Eye, EyeOff, Briefcase, X } from 'lucide-react'
import toast from 'react-hot-toast'

const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Flexible']

const emptyForm = {
  title: '',
  description: '',
  department: '',
  location: '',
  employment_type: '',
  is_visible: false,
}

const JobPositionsManagementPage = () => {
  const { profile } = useAuthStore()
  const [positions, setPositions] = useState<Tables<'job_positions'>[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingPosition, setEditingPosition] = useState<Tables<'job_positions'> | null>(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState(emptyForm)

  useEffect(() => {
    fetchPositions()
  }, [])

  const fetchPositions = async () => {
    try {
      const { data, error } = await supabase
        .from('job_positions')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })

      if (error) throw error
      setPositions(data || [])
    } catch (error) {
      console.error('Error fetching positions:', error)
      toast.error('Failed to load positions')
    } finally {
      setLoading(false)
    }
  }

  const openNewModal = () => {
    setEditingPosition(null)
    setFormData(emptyForm)
    setShowModal(true)
  }

  const openEditModal = (position: Tables<'job_positions'>) => {
    setEditingPosition(position)
    setFormData({
      title: position.title,
      description: position.description || '',
      department: position.department || '',
      location: position.location || '',
      employment_type: position.employment_type || '',
      is_visible: position.is_visible,
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title.trim()) {
      toast.error('Title is required')
      return
    }

    setSaving(true)
    try {
      if (editingPosition) {
        const { error } = await supabase
          .from('job_positions')
          .update({
            title: formData.title.trim(),
            description: formData.description.trim(),
            department: formData.department.trim() || null,
            location: formData.location.trim() || null,
            employment_type: formData.employment_type || null,
            is_visible: formData.is_visible,
          })
          .eq('id', editingPosition.id)

        if (error) throw error
        toast.success('Position updated')
      } else {
        const { error } = await supabase
          .from('job_positions')
          .insert({
            title: formData.title.trim(),
            description: formData.description.trim(),
            department: formData.department.trim() || null,
            location: formData.location.trim() || null,
            employment_type: formData.employment_type || null,
            is_visible: formData.is_visible,
            created_by: profile?.id || null,
          })

        if (error) throw error
        toast.success('Position created')
      }

      setShowModal(false)
      fetchPositions()
    } catch (error) {
      console.error('Error saving position:', error)
      toast.error('Failed to save position')
    } finally {
      setSaving(false)
    }
  }

  const deletePosition = async (id: string) => {
    if (!confirm('Are you sure you want to delete this position?')) return

    try {
      const { error } = await supabase
        .from('job_positions')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Position deleted')
      setPositions((prev) => prev.filter((p) => p.id !== id))
    } catch (error) {
      console.error('Error deleting position:', error)
      toast.error('Failed to delete position')
    }
  }

  const toggleVisibility = async (position: Tables<'job_positions'>) => {
    const newVisibility = !position.is_visible

    // Optimistic update
    setPositions((prev) =>
      prev.map((p) => (p.id === position.id ? { ...p, is_visible: newVisibility } : p))
    )

    try {
      const { error } = await supabase
        .from('job_positions')
        .update({ is_visible: newVisibility })
        .eq('id', position.id)

      if (error) throw error
      toast.success(newVisibility ? 'Position is now visible on jobs page' : 'Position hidden from jobs page')
    } catch (error) {
      console.error('Error toggling visibility:', error)
      toast.error('Failed to update visibility')
      // Revert on error
      setPositions((prev) =>
        prev.map((p) => (p.id === position.id ? { ...p, is_visible: !newVisibility } : p))
      )
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        <span className="sr-only">Loading...</span>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job Positions</h1>
          <p className="text-gray-500 mt-1">Manage positions displayed on the careers page</p>
        </div>
        <Button onClick={openNewModal}>
          <Plus className="w-4 h-4 mr-2" />
          Add Position
        </Button>
      </div>

      {/* Positions List */}
      {positions.length === 0 ? (
        <Card className="p-12 text-center">
          <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-500 mb-2">No positions yet</h3>
          <p className="text-gray-400 mb-6">Click "Add Position" to create your first job listing.</p>
          <Button onClick={openNewModal}>
            <Plus className="w-4 h-4 mr-2" />
            Add Position
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {positions.map((position) => (
            <Card key={position.id} className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">{position.title}</h3>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        position.is_visible
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {position.is_visible ? (
                        <>
                          <Eye className="w-3 h-3" /> Visible
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3 h-3" /> Hidden
                        </>
                      )}
                    </span>
                  </div>

                  {position.description && (
                    <p className="text-gray-600 text-sm line-clamp-2 mb-3">{position.description}</p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {position.department && (
                      <span className="bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-full">
                        {position.department}
                      </span>
                    )}
                    {position.location && (
                      <span className="bg-green-50 text-green-700 text-xs px-2.5 py-1 rounded-full">
                        {position.location}
                      </span>
                    )}
                    {position.employment_type && (
                      <span className="bg-purple-50 text-purple-700 text-xs px-2.5 py-1 rounded-full">
                        {position.employment_type}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => toggleVisibility(position)}
                    className={`p-2 rounded-lg transition-colors ${
                      position.is_visible
                        ? 'text-green-600 hover:bg-green-50'
                        : 'text-gray-400 hover:bg-gray-100'
                    }`}
                    title={position.is_visible ? 'Hide from jobs page' : 'Show on jobs page'}
                    aria-label={position.is_visible ? 'Hide from jobs page' : 'Show on jobs page'}
                  >
                    {position.is_visible ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => openEditModal(position)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit position"
                    aria-label="Edit position"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => deletePosition(position.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete position"
                    aria-label="Delete position"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onKeyDown={(e) => e.key === 'Escape' && setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="position-modal-title">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <h2 id="position-modal-title" className="text-xl font-bold text-gray-900">
                {editingPosition ? 'Edit Position' : 'Add New Position'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Direct Support Professional"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the role, responsibilities, and requirements..."
                  rows={5}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <Input
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    placeholder="e.g. Care Services"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g. Lancaster, CA"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employment Type</label>
                <select
                  value={formData.employment_type}
                  onChange={(e) => setFormData({ ...formData, employment_type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="">Select type</option>
                  {EMPLOYMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_visible"
                  checked={formData.is_visible}
                  onChange={(e) => setFormData({ ...formData, is_visible: e.target.checked })}
                  className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                />
                <label htmlFor="is_visible" className="text-sm font-medium text-gray-700">
                  Visible on jobs page
                </label>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={saving}>
                  {editingPosition ? 'Save Changes' : 'Create Position'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default JobPositionsManagementPage

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { Upload, Trash2, Eye, EyeOff, FileText, FolderOpen, Plus, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface Resource {
  id: string
  title: string
  description: string | null
  file_url: string
  file_type: string
  file_size: number | null
  category: string | null
  is_visible: boolean
  created_at: string
}

const CATEGORIES = ['General', 'Policies', 'Training Materials', 'Forms', 'Guidelines', 'Templates']

const EducatorResourcesPage = () => {
  const { profile } = useAuthStore()
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'General'
  })

  useEffect(() => {
    fetchResources()
  }, [])

  const fetchResources = async () => {
    try {
      const { data, error } = await supabase
        .from('educator_resources')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setResources((data as Resource[]) || [])
    } catch (error) {
      console.error('Error fetching resources:', error)
      toast.error('Failed to load resources')
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        toast.error('File size must be less than 50MB')
        return
      }
      setUploadFile(file)
      if (!formData.title) {
        setFormData(prev => ({ ...prev, title: file.name.replace(/\.[^/.]+$/, '') }))
      }
    }
  }

  const handleUpload = async () => {
    if (!uploadFile || !formData.title) {
      toast.error('Please select a file and enter a title')
      return
    }

    setUploading(true)
    try {
      // Upload file to storage
      const fileName = `${Date.now()}_${uploadFile.name.replace(/\s+/g, '_')}`
      const { error: uploadError } = await supabase.storage
        .from('educator-resources')
        .upload(fileName, uploadFile)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('educator-resources')
        .getPublicUrl(fileName)

      // Create resource record
      const { error } = await supabase.from('educator_resources').insert({
        title: formData.title,
        description: formData.description || null,
        file_url: publicUrl,
        file_type: uploadFile.type,
        file_size: uploadFile.size,
        category: formData.category,
        uploaded_by: profile?.id,
        is_visible: true
      })

      if (error) throw error

      toast.success('Resource uploaded successfully')
      setShowUploadModal(false)
      setUploadFile(null)
      setFormData({ title: '', description: '', category: 'General' })
      fetchResources()
    } catch (error) {
      console.error('Error uploading resource:', error)
      toast.error('Failed to upload resource')
    } finally {
      setUploading(false)
    }
  }

  const toggleVisibility = async (id: string, currentVisibility: boolean) => {
    try {
      const { error } = await supabase
        .from('educator_resources')
        .update({ is_visible: !currentVisibility })
        .eq('id', id)

      if (error) throw error
      toast.success(currentVisibility ? 'Resource hidden' : 'Resource visible')
      fetchResources()
    } catch (error) {
      console.error('Error toggling visibility:', error)
      toast.error('Failed to update resource')
    }
  }

  const deleteResource = async (id: string) => {
    if (!confirm('Are you sure you want to delete this resource?')) return

    try {
      const { error } = await supabase
        .from('educator_resources')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Resource deleted')
      fetchResources()
    } catch (error) {
      console.error('Error deleting resource:', error)
      toast.error('Failed to delete resource')
    }
  }

  const groupedResources = resources.reduce((acc, resource) => {
    const category = resource.category || 'General'
    if (!acc[category]) acc[category] = []
    acc[category].push(resource)
    return acc
  }, {} as Record<string, Resource[]>)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        <span className="sr-only">Loading...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Educator Resources</h1>
          <p className="text-gray-600">Manage files and documents for the Educator Area</p>
        </div>
        <Button onClick={() => setShowUploadModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Upload Resource
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-center">
          <p className="text-3xl font-bold text-gray-900">{resources.length}</p>
          <p className="text-sm text-gray-500">Total Resources</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-green-600">{resources.filter(r => r.is_visible).length}</p>
          <p className="text-sm text-gray-500">Visible</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-gray-400">{resources.filter(r => !r.is_visible).length}</p>
          <p className="text-sm text-gray-500">Hidden</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-orange-600">{Object.keys(groupedResources).length}</p>
          <p className="text-sm text-gray-500">Categories</p>
        </Card>
      </div>

      {/* Resources List */}
      {resources.length === 0 ? (
        <Card className="text-center py-12">
          <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No resources uploaded yet</p>
          <Button className="mt-4" onClick={() => setShowUploadModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Upload First Resource
          </Button>
        </Card>
      ) : (
        Object.entries(groupedResources).map(([category, categoryResources]) => (
          <div key={category}>
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-orange-500" />
              {category} ({categoryResources.length})
            </h3>
            <div className="space-y-2">
              {categoryResources.map(resource => (
                <Card key={resource.id} className={`${!resource.is_visible ? 'opacity-60' : ''}`}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-gray-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900 truncate">{resource.title}</h4>
                          {!resource.is_visible && (
                            <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded">Hidden</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 truncate">
                          {resource.description || 'No description'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={resource.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                        title="View file"
                      >
                        <FileText className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => toggleVisibility(resource.id, resource.is_visible)}
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                        title={resource.is_visible ? 'Hide from employees' : 'Show to employees'}
                        aria-label={resource.is_visible ? 'Hide from employees' : 'Show to employees'}
                      >
                        {resource.is_visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => deleteResource(resource.id)}
                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                        title="Delete"
                        aria-label="Delete resource"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onKeyDown={(e) => e.key === 'Escape' && setShowUploadModal(false)}>
          <div className="bg-white rounded-xl max-w-md w-full" role="dialog" aria-modal="true" aria-labelledby="upload-resource-title">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 id="upload-resource-title" className="text-xl font-bold text-gray-900">Upload Resource</h2>
              <button onClick={() => setShowUploadModal(false)} className="text-gray-400 hover:text-gray-600" aria-label="Close dialog">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">File</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-orange-500 transition-colors">
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className="hidden"
                    id="resource-upload"
                  />
                  <label htmlFor="resource-upload" className="cursor-pointer">
                    <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                    {uploadFile ? (
                      <p className="text-orange-600 font-medium">{uploadFile.name}</p>
                    ) : (
                      <>
                        <p className="text-gray-600">Click to upload</p>
                        <p className="text-sm text-gray-400 mt-1">Max 50MB</p>
                      </>
                    )}
                  </label>
                </div>
              </div>

              <Input
                label="Title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Resource title"
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
                  placeholder="Brief description of this resource"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setShowUploadModal(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleUpload} loading={uploading}>
                  Upload
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EducatorResourcesPage

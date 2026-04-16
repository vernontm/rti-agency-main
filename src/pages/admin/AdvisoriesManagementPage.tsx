import { useEffect, useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { Plus, Trash2, Eye, EyeOff, FileText, Upload, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface Advisory {
  id: string
  title: string
  description: string | null
  pdf_url: string
  is_visible: boolean
  uploaded_by: string | null
  created_at: string
  updated_at: string
  category: 'advisory' | 'downloads'
}

const AdvisoriesManagementPage = () => {
  const { profile } = useAuthStore()
  const [advisories, setAdvisories] = useState<Advisory[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedAdvisory, setSelectedAdvisory] = useState<Advisory | null>(null)
  const [newAdvisory, setNewAdvisory] = useState({ title: '', description: '', category: 'advisory' as 'advisory' | 'downloads' })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const location = useLocation()

  useEffect(() => {
    setLoading(true)
    fetchAdvisories()
  }, [location.pathname])

  const fetchAdvisories = async () => {
    try {
      const { data, error } = await supabase
        .from('advisories')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setAdvisories(data || [])
    } catch (error) {
      console.error('Error fetching advisories:', error)
      toast.error('Failed to load advisories')
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'application/zip', 'application/x-zip-compressed']
      if (!allowedTypes.includes(file.type)) {
        toast.error('Please select a PDF, PNG, JPEG, or ZIP file')
        return
      }
      // Check file size (500MB limit)
      const maxSize = 500 * 1024 * 1024
      if (file.size > maxSize) {
        toast.error('File size must be less than 500MB')
        return
      }
      setSelectedFile(file)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile || !newAdvisory.title.trim()) {
      toast.error('Please provide a title and select a file')
      return
    }

    setUploading(true)
    setUploadProgress(0)
    try {
      // Upload file to storage
      const fileName = `${Date.now()}-${selectedFile.name}`
      
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 200)
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('advisories')
        .upload(fileName, selectedFile)
      
      clearInterval(progressInterval)
      setUploadProgress(100)
      
      if (uploadError) {
        console.error('Storage upload error:', uploadError)
        throw uploadError
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('advisories')
        .getPublicUrl(fileName)

      // Create advisory record
      const { data: insertData, error: insertError } = await supabase
        .from('advisories')
        .insert({
          title: newAdvisory.title.trim(),
          description: newAdvisory.description.trim() || null,
          pdf_url: urlData.publicUrl,
          uploaded_by: profile?.id,
          is_visible: false,
          category: newAdvisory.category,
        })
        .select()

      if (insertError) {
        console.error('Database insert error:', insertError)
        throw insertError
      }

      toast.success('Advisory uploaded successfully')
      setShowUploadModal(false)
      setNewAdvisory({ title: '', description: '', category: 'advisory' })
      setSelectedFile(null)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      fetchAdvisories()
    } catch (error) {
      console.error('Error uploading advisory:', error)
      toast.error('Failed to upload advisory')
    } finally {
      setUploading(false)
    }
  }

  const toggleVisibility = async (advisory: Advisory) => {
    try {
      const { error } = await supabase
        .from('advisories')
        .update({ 
          is_visible: !advisory.is_visible,
          updated_at: new Date().toISOString()
        })
        .eq('id', advisory.id)

      if (error) throw error

      setAdvisories(prev => 
        prev.map(a => a.id === advisory.id ? { ...a, is_visible: !a.is_visible } : a)
      )
      toast.success(advisory.is_visible ? 'Advisory hidden' : 'Advisory now visible')
    } catch (error) {
      console.error('Error updating visibility:', error)
      toast.error('Failed to update visibility')
    }
  }

  const deleteAdvisory = async (advisory: Advisory) => {
    if (!confirm('Are you sure you want to delete this advisory?')) return

    try {
      // Delete from storage
      const fileName = advisory.pdf_url.split('/').pop()
      if (fileName) {
        await supabase.storage.from('advisories').remove([fileName])
      }

      // Delete record
      const { error } = await supabase
        .from('advisories')
        .delete()
        .eq('id', advisory.id)

      if (error) throw error

      setAdvisories(prev => prev.filter(a => a.id !== advisory.id))
      if (selectedAdvisory?.id === advisory.id) {
        setSelectedAdvisory(null)
      }
      toast.success('Advisory deleted')
    } catch (error) {
      console.error('Error deleting advisory:', error)
      toast.error('Failed to delete advisory')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        <span className="sr-only">Loading...</span>
      </div>
    )
  }

  const fileCategories = [
    { key: 'all', label: 'All Files', count: advisories.length },
    { key: 'advisory', label: 'Advisories', count: advisories.filter(a => a.category === 'advisory').length },
    { key: 'downloads', label: 'Downloads', count: advisories.filter(a => a.category === 'downloads').length },
    { key: 'visible', label: 'Visible', count: advisories.filter(a => a.is_visible).length },
    { key: 'hidden', label: 'Hidden', count: advisories.filter(a => !a.is_visible).length },
  ]

  const [fileCategoryFilter, setFileCategoryFilter] = useState('all')

  const filteredAdvisories = advisories.filter(a => {
    if (fileCategoryFilter === 'advisory') return a.category === 'advisory'
    if (fileCategoryFilter === 'downloads') return a.category === 'downloads'
    if (fileCategoryFilter === 'visible') return a.is_visible
    if (fileCategoryFilter === 'hidden') return !a.is_visible
    return true
  })

  return (
    <div className="-m-6 h-screen flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">File Manager</h1>
          <p className="text-gray-500 text-sm">Upload and manage advisories and downloads for educators</p>
        </div>
        <Button onClick={() => setShowUploadModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Upload File
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Sidebar */}
        <div className="w-56 border-r flex flex-col bg-gray-50/50">
          <nav className="flex-1 p-2 space-y-0.5">
            {fileCategories.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setFileCategoryFilter(cat.key)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  fileCategoryFilter === cat.key
                    ? 'bg-orange-50 text-orange-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4" />
                  {cat.label}
                </span>
                {cat.count > 0 && (
                  <span className={`text-xs font-bold rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1.5 ${
                    fileCategoryFilter === cat.key ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {cat.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* File list */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-5 py-3 border-b flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">
              {fileCategories.find(c => c.key === fileCategoryFilter)?.label || 'All Files'}
            </h2>
            <span className="text-sm text-gray-500">{filteredAdvisories.length} files</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredAdvisories.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <FileText className="w-12 h-12 mb-3 opacity-40" />
                <p className="text-sm">No files found</p>
              </div>
            ) : (
              filteredAdvisories.map((advisory) => (
                <button
                  key={advisory.id}
                  onClick={() => setSelectedAdvisory(selectedAdvisory?.id === advisory.id ? null : advisory)}
                  className={`w-full flex items-center gap-4 px-5 py-3.5 border-b border-gray-100 text-left hover:bg-gray-50 transition-colors ${
                    selectedAdvisory?.id === advisory.id ? 'bg-orange-50' : ''
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${advisory.is_visible ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{advisory.title}</p>
                    <p className="text-sm text-gray-500 truncate mt-0.5">
                      <span className="capitalize">{advisory.category}</span>
                      {advisory.description && <><span className="mx-1.5 text-gray-300">&mdash;</span>{advisory.description}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${advisory.is_visible ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {advisory.is_visible ? 'Visible' : 'Hidden'}
                    </span>
                    <span className="text-xs text-gray-400">{new Date(advisory.created_at).toLocaleDateString()}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Preview panel */}
        <div className="w-[45%] border-l flex flex-col bg-white">
          {selectedAdvisory ? (
            <>
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 truncate">{selectedAdvisory.title}</h3>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => toggleVisibility(selectedAdvisory)}
                    className={`p-2 rounded-lg transition-colors ${selectedAdvisory.is_visible ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                    aria-label={selectedAdvisory.is_visible ? 'Hide from educators' : 'Show to educators'}
                  >
                    {selectedAdvisory.is_visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => deleteAdvisory(selectedAdvisory)}
                    className="p-2 rounded-lg text-red-600 hover:bg-red-100 transition-colors"
                    aria-label="Delete file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1">
                <iframe src={selectedAdvisory.pdf_url} className="w-full h-full" title={selectedAdvisory.title} />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Select a file to preview</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onKeyDown={(e) => { if (e.key === 'Escape') { setShowUploadModal(false); setNewAdvisory({ title: '', description: '', category: 'advisory' }); setSelectedFile(null); } }}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4" role="dialog" aria-modal="true" aria-labelledby="upload-advisory-title">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 id="upload-advisory-title" className="text-lg font-semibold">Upload File</h2>
              <button
                onClick={() => {
                  setShowUploadModal(false)
                  setNewAdvisory({ title: '', description: '', category: 'advisory' })
                  setSelectedFile(null)
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <Input
                  value={newAdvisory.title}
                  onChange={(e) => setNewAdvisory(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Advisory title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newAdvisory.description}
                  onChange={(e) => setNewAdvisory(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  value={newAdvisory.category}
                  onChange={(e) => setNewAdvisory(prev => ({ ...prev, category: e.target.value as 'advisory' | 'downloads' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="advisory">Advisory</option>
                  <option value="downloads">Downloads</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File *</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpeg,.jpg,.zip"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-orange-500 transition-colors"
                >
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-2 text-orange-600">
                      <FileText className="w-5 h-5" />
                      <span>{selectedFile.name}</span>
                    </div>
                  ) : (
                    <div className="text-gray-500">
                      <Upload className="w-8 h-8 mx-auto mb-2" />
                      <p>Click to select file (PDF, PNG, JPEG, ZIP)</p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Upload Progress */}
              {uploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Uploading...</span>
                    <span className="font-medium text-orange-600">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-orange-500 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 p-4 border-t bg-gray-50">
              <Button
                variant="outline"
                onClick={() => {
                  setShowUploadModal(false)
                  setNewAdvisory({ title: '', description: '', category: 'advisory' })
                  setSelectedFile(null)
                  setUploadProgress(0)
                }}
                className="flex-1"
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                loading={uploading}
                disabled={!selectedFile || !newAdvisory.title.trim() || uploading}
                className="flex-1"
              >
                {uploading ? `Uploading ${uploadProgress}%` : 'Upload'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdvisoriesManagementPage

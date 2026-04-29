import { useEffect, useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { Plus, Trash2, Eye, EyeOff, FileText, Upload, X, Search, FolderOpen, Download, Star, FolderPlus, Edit2, Check } from 'lucide-react'
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
  category: string | null
}

interface CategoryFolder {
  id: string
  name: string
  sort_order: number
  is_default: boolean
  created_at: string
}

const AdvisoriesManagementPage = () => {
  const { profile } = useAuthStore()
  const [advisories, setAdvisories] = useState<Advisory[]>([])
  const [categories, setCategories] = useState<CategoryFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedAdvisory, setSelectedAdvisory] = useState<Advisory | null>(null)
  const [newAdvisory, setNewAdvisory] = useState({ title: '', description: '', category: '' })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [fileCategoryFilter, setFileCategoryFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [renamingCategoryId, setRenamingCategoryId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const location = useLocation()

  useEffect(() => {
    setLoading(true)
    fetchAll()
  }, [location.pathname])

  const fetchAll = async () => {
    try {
      const [{ data: advData }, { data: catData }] = await Promise.all([
        supabase.from('advisories').select('*').order('created_at', { ascending: false }),
        supabase.from('advisory_categories').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true }),
      ])

      // Normalize legacy lowercase categories ("advisory"/"downloads") to canonical names
      const normalizedAdv = (advData as Advisory[] || []).map(a => ({
        ...a,
        category: a.category === 'advisory' ? 'Advisories'
          : a.category === 'downloads' ? 'Downloads'
          : a.category,
      }))
      setAdvisories(normalizedAdv)
      setCategories((catData as CategoryFolder[]) || [])

      // Set default category for new uploads if none picked
      if (catData && catData.length > 0 && !newAdvisory.category) {
        setNewAdvisory(prev => ({ ...prev, category: catData[0].name }))
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load files')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim()
    if (!name) {
      toast.error('Please enter a category name')
      return
    }
    if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      toast.error('A category with that name already exists')
      return
    }
    try {
      const { data, error } = await supabase
        .from('advisory_categories')
        .insert({ name, sort_order: categories.length + 10 })
        .select()
        .single()

      if (error) throw error
      setCategories(prev => [...prev, data as CategoryFolder])
      toast.success(`Folder "${name}" created`)
      setNewCategoryName('')
      setShowNewCategoryInput(false)
    } catch (error) {
      console.error('Error creating category:', error)
      toast.error('Failed to create folder')
    }
  }

  const handleRenameCategory = async (cat: CategoryFolder) => {
    const newName = renameValue.trim()
    if (!newName || newName === cat.name) {
      setRenamingCategoryId(null)
      return
    }
    if (categories.some(c => c.id !== cat.id && c.name.toLowerCase() === newName.toLowerCase())) {
      toast.error('A category with that name already exists')
      return
    }
    try {
      // Rename category
      const { error: catErr } = await supabase
        .from('advisory_categories')
        .update({ name: newName })
        .eq('id', cat.id)
      if (catErr) throw catErr

      // Update advisories that reference the old name
      const { error: advErr } = await supabase
        .from('advisories')
        .update({ category: newName })
        .eq('category', cat.name)
      if (advErr) console.warn('Could not migrate advisories:', advErr)

      setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, name: newName } : c))
      setAdvisories(prev => prev.map(a => a.category === cat.name ? { ...a, category: newName } : a))
      if (fileCategoryFilter === cat.name) setFileCategoryFilter(newName)
      toast.success('Folder renamed')
      setRenamingCategoryId(null)
    } catch (error) {
      console.error('Error renaming category:', error)
      toast.error('Failed to rename folder')
    }
  }

  const handleMoveToFolder = async (advisory: Advisory, newCategory: string) => {
    if (advisory.category === newCategory) return
    try {
      const { error } = await supabase
        .from('advisories')
        .update({ category: newCategory })
        .eq('id', advisory.id)

      if (error) throw error

      setAdvisories(prev =>
        prev.map(a => a.id === advisory.id ? { ...a, category: newCategory } : a)
      )
      // Keep the selection updated
      if (selectedAdvisory?.id === advisory.id) {
        setSelectedAdvisory({ ...advisory, category: newCategory })
      }
      toast.success(`Moved to "${newCategory}"`)
    } catch (error) {
      console.error('Error moving file:', error)
      toast.error('Failed to move file')
    }
  }

  const handleDeleteCategory = async (cat: CategoryFolder) => {
    const filesInCategory = advisories.filter(a => a.category === cat.name).length
    const msg = filesInCategory > 0
      ? `Delete folder "${cat.name}"? ${filesInCategory} file(s) inside will become uncategorized (the files themselves will NOT be deleted).`
      : `Delete folder "${cat.name}"?`
    if (!confirm(msg)) return

    try {
      // Set advisories in this category to null category (uncategorized)
      const { error: advErr } = await supabase
        .from('advisories')
        .update({ category: null })
        .eq('category', cat.name)
      if (advErr) console.warn('Could not uncategorize advisories:', advErr)

      const { error } = await supabase
        .from('advisory_categories')
        .delete()
        .eq('id', cat.id)
      if (error) throw error

      setCategories(prev => prev.filter(c => c.id !== cat.id))
      setAdvisories(prev => prev.map(a => a.category === cat.name ? { ...a, category: null } : a))
      if (fileCategoryFilter === cat.name) setFileCategoryFilter('all')
      toast.success('Folder deleted')
    } catch (error) {
      console.error('Error deleting category:', error)
      toast.error('Failed to delete folder')
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
      const fileName = `${Date.now()}-${selectedFile.name}`

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

      const { data: urlData } = supabase.storage
        .from('advisories')
        .getPublicUrl(fileName)

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

      toast.success('File uploaded successfully')
      setShowUploadModal(false)
      setNewAdvisory({ title: '', description: '', category: categories[0]?.name || '' })
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      fetchAll()
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
      const fileName = advisory.pdf_url.split('/').pop()
      if (fileName) {
        await supabase.storage.from('advisories').remove([fileName])
      }

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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        <span className="sr-only">Loading...</span>
      </div>
    )
  }

  // Top-level system filters
  const systemFilters = [
    { key: 'all', label: 'All Files', icon: FolderOpen, count: advisories.length, color: 'bg-blue-600' },
    { key: '__visible', label: 'Visible', icon: Eye, count: advisories.filter(a => a.is_visible).length, color: 'bg-green-600' },
    { key: '__hidden', label: 'Hidden', icon: EyeOff, count: advisories.filter(a => !a.is_visible).length, color: 'bg-gray-500' },
  ]

  // Uncategorized files count (files whose category doesn't match any folder)
  const knownCategoryNames = new Set(categories.map(c => c.name))
  const uncategorizedCount = advisories.filter(a => !a.category || !knownCategoryNames.has(a.category)).length

  const filteredAdvisories = advisories.filter(a => {
    let matchesCategory = true
    if (fileCategoryFilter === 'all') matchesCategory = true
    else if (fileCategoryFilter === '__visible') matchesCategory = a.is_visible
    else if (fileCategoryFilter === '__hidden') matchesCategory = !a.is_visible
    else if (fileCategoryFilter === '__uncategorized') matchesCategory = !a.category || !knownCategoryNames.has(a.category)
    else matchesCategory = a.category === fileCategoryFilter

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const matchesSearch = a.title.toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q)
      return matchesCategory && matchesSearch
    }
    return matchesCategory
  })

  return (
    <div className="-m-6 h-screen flex flex-col bg-white">
      {/* Minimal header — title left, count right */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <h1 className="text-xl font-semibold text-gray-900">File Manager</h1>
        <span className="text-sm text-gray-400">{filteredAdvisories.length} files</span>
      </div>

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Sidebar */}
        <div className="w-56 border-r flex flex-col bg-gray-50/50">
          {/* Search */}
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
              />
            </div>
          </div>

          {/* Category nav */}
          <nav className="flex-1 px-2 pb-3 overflow-y-auto">
            {/* System filters */}
            {systemFilters.map((cat, idx) => (
              <div key={cat.key}>
                {idx > 0 && <div className="mx-2 border-t border-gray-200" />}
                <button
                  onClick={() => setFileCategoryFilter(cat.key)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    fileCategoryFilter === cat.key
                      ? 'bg-orange-50 text-orange-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <cat.icon className="w-4 h-4" />
                    {cat.label}
                  </span>
                  {cat.count > 0 && (
                    <span className={`text-xs text-white font-bold rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1.5 ${cat.color}`}>
                      {cat.count}
                    </span>
                  )}
                </button>
              </div>
            ))}

            {/* Folders header */}
            <div className="mx-2 my-2 border-t border-gray-200" />
            <div className="flex items-center justify-between px-3 py-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Folders</p>
              <button
                onClick={() => { setShowNewCategoryInput(true); setNewCategoryName('') }}
                className="p-1 text-gray-400 hover:text-orange-600 hover:bg-gray-100 rounded transition-colors"
                aria-label="New folder"
                title="New folder"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* New folder input */}
            {showNewCategoryInput && (
              <div className="px-2 pb-2">
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateCategory()
                      if (e.key === 'Escape') { setShowNewCategoryInput(false); setNewCategoryName('') }
                    }}
                    placeholder="Folder name"
                    autoFocus
                    className="flex-1 px-2 py-1.5 text-sm border border-orange-300 rounded focus:ring-1 focus:ring-orange-500 focus:outline-none bg-white"
                  />
                  <button
                    onClick={handleCreateCategory}
                    className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                    aria-label="Create folder"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { setShowNewCategoryInput(false); setNewCategoryName('') }}
                    className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"
                    aria-label="Cancel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* User-defined folders */}
            {categories.map((cat) => {
              const count = advisories.filter(a => a.category === cat.name).length
              const isRenaming = renamingCategoryId === cat.id
              const isActive = fileCategoryFilter === cat.name

              return (
                <div key={cat.id} className="group">
                  {isRenaming ? (
                    <div className="flex items-center gap-1 px-2 py-1">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameCategory(cat)
                          if (e.key === 'Escape') setRenamingCategoryId(null)
                        }}
                        autoFocus
                        className="flex-1 px-2 py-1.5 text-sm border border-orange-300 rounded focus:ring-1 focus:ring-orange-500 focus:outline-none bg-white"
                      />
                      <button
                        onClick={() => handleRenameCategory(cat)}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                        aria-label="Save"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setRenamingCategoryId(null)}
                        className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"
                        aria-label="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setFileCategoryFilter(cat.name)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-orange-50 text-orange-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0 flex-1">
                        <FolderOpen className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{cat.name}</span>
                      </span>
                      <span className="flex items-center gap-1 flex-shrink-0">
                        {/* Rename + Delete buttons (visible on hover) */}
                        {!cat.is_default && (
                          <>
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => { e.stopPropagation(); setRenamingCategoryId(cat.id); setRenameValue(cat.name) }}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded text-gray-500 transition-opacity"
                              aria-label={`Rename ${cat.name}`}
                              title="Rename"
                            >
                              <Edit2 className="w-3 h-3" />
                            </span>
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat) }}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded text-red-500 transition-opacity"
                              aria-label={`Delete ${cat.name}`}
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </span>
                          </>
                        )}
                        {count > 0 && (
                          <span className="text-xs text-white font-bold rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1.5 bg-blue-600">
                            {count}
                          </span>
                        )}
                      </span>
                    </button>
                  )}
                </div>
              )
            })}

            {/* Uncategorized */}
            {uncategorizedCount > 0 && (
              <button
                onClick={() => setFileCategoryFilter('__uncategorized')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  fileCategoryFilter === '__uncategorized'
                    ? 'bg-orange-50 text-orange-700 font-medium'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <span className="flex items-center gap-2.5 italic">
                  <FolderOpen className="w-4 h-4" />
                  Uncategorized
                </span>
                <span className="text-xs text-white font-bold rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1.5 bg-gray-400">
                  {uncategorizedCount}
                </span>
              </button>
            )}
          </nav>

          {/* Upload button at bottom */}
          <div className="p-3 border-t">
            <Button onClick={() => setShowUploadModal(true)} className="w-full text-sm">
              <Plus className="w-3.5 h-3.5 mr-2" />
              Upload File
            </Button>
          </div>
        </div>

        {/* File list */}
        <div className={`flex-1 flex flex-col min-h-0 ${selectedAdvisory ? 'w-[55%]' : ''}`}>
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
                  className={`w-full flex items-center gap-4 px-5 py-3 border-b border-gray-100 text-left hover:bg-gray-50 transition-colors ${
                    selectedAdvisory?.id === advisory.id ? 'bg-orange-50' : ''
                  }`}
                >
                  {/* File icon as avatar */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${advisory.is_visible ? 'bg-emerald-500 text-white' : 'bg-gray-400 text-white'}`}>
                    <FileText className="w-4 h-4" />
                  </div>

                  {/* Title — fixed width */}
                  <span className="w-44 flex-shrink-0 text-sm font-semibold text-gray-900 truncate">
                    {advisory.title}
                  </span>

                  {/* Category dropdown + description — single line */}
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <select
                      value={advisory.category || ''}
                      onChange={(e) => {
                        e.stopPropagation()
                        handleMoveToFolder(advisory, e.target.value)
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded px-2 py-0.5 focus:ring-1 focus:ring-orange-500 focus:outline-none cursor-pointer"
                      aria-label={`Move ${advisory.title} to folder`}
                    >
                      {!advisory.category || !categories.some(c => c.name === advisory.category) ? (
                        <option value="" disabled>Uncategorized</option>
                      ) : null}
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                    {advisory.description && (
                      <span className="text-sm text-gray-400 truncate">
                        <span className="text-gray-300 mr-1.5">&mdash;</span>
                        {advisory.description}
                      </span>
                    )}
                  </div>

                  {/* Visibility badge */}
                  <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded flex-shrink-0 ${advisory.is_visible ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {advisory.is_visible ? 'Visible' : 'Hidden'}
                  </span>

                  {/* Star */}
                  <Star className="w-4 h-4 text-gray-300 hover:text-yellow-400 flex-shrink-0 transition-colors" />

                  {/* Time */}
                  <span className="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap w-16 text-right">
                    {formatDate(advisory.created_at)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Preview panel */}
        {selectedAdvisory && (
          <div className="w-[45%] border-l flex flex-col bg-white">
            <div className="px-4 py-3 border-b">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-gray-900 truncate">{selectedAdvisory.title}</h3>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => toggleVisibility(selectedAdvisory)}
                    className={`p-2 rounded-lg transition-colors ${selectedAdvisory.is_visible ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                    aria-label={selectedAdvisory.is_visible ? 'Hide from educators' : 'Show to educators'}
                    title={selectedAdvisory.is_visible ? 'Visible to employees — click to hide' : 'Hidden from employees — click to show'}
                  >
                    {selectedAdvisory.is_visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => deleteAdvisory(selectedAdvisory)}
                    className="p-2 rounded-lg text-red-600 hover:bg-red-100 transition-colors"
                    aria-label="Delete file"
                    title="Delete file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {/* Folder selector */}
              <div className="mt-2 flex items-center gap-2">
                <label htmlFor="folder-select" className="text-xs font-medium text-gray-500 flex items-center gap-1">
                  <FolderOpen className="w-3 h-3" />
                  Folder:
                </label>
                <select
                  id="folder-select"
                  value={selectedAdvisory.category || ''}
                  onChange={(e) => handleMoveToFolder(selectedAdvisory, e.target.value)}
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
                >
                  {!selectedAdvisory.category || !categories.some(c => c.name === selectedAdvisory.category) ? (
                    <option value="" disabled>Uncategorized</option>
                  ) : null}
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
                <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${selectedAdvisory.is_visible ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {selectedAdvisory.is_visible ? 'Visible' : 'Hidden'}
                </span>
              </div>
            </div>
            <div className="flex-1">
              <iframe src={selectedAdvisory.pdf_url} className="w-full h-full" title={selectedAdvisory.title} />
            </div>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onKeyDown={(e) => { if (e.key === 'Escape') { setShowUploadModal(false); setNewAdvisory({ title: '', description: '', category: categories[0]?.name || '' }); setSelectedFile(null); } }}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4" role="dialog" aria-modal="true" aria-labelledby="upload-advisory-title">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 id="upload-advisory-title" className="text-lg font-semibold">Upload File</h2>
              <button
                onClick={() => {
                  setShowUploadModal(false)
                  setNewAdvisory({ title: '', description: '', category: categories[0]?.name || '' })
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Folder *</label>
                <select
                  value={newAdvisory.category}
                  onChange={(e) => setNewAdvisory(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  {categories.length === 0 && <option value="">No folders yet</option>}
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Create a new folder from the sidebar to add more options.</p>
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
                  setNewAdvisory({ title: '', description: '', category: categories[0]?.name || '' })
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

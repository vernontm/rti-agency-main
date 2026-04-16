import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import type { Tables } from '../../types/database.types'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { Plus, Trash2, Edit2, Video, X, Save, Upload, Loader2, Play, HelpCircle, ArrowUp, ArrowDown, GripVertical } from 'lucide-react'
import toast from 'react-hot-toast'
import QuizEditor from '../../components/admin/QuizEditor'

interface VideoCategory {
  id: string
  name: string
  sort_order: number
}

const VideoManagementPage = () => {
  const { profile } = useAuthStore()
  const [videos, setVideos] = useState<Tables<'videos'>[]>([])
  const [categories, setCategories] = useState<VideoCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingVideo, setEditingVideo] = useState<Tables<'videos'> | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const thumbnailInputRef = useRef<HTMLInputElement>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    video_url: '',
    duration_seconds: 0,
    thumbnail_url: '',
    category: '',
    is_required: false,
  })
  const [playingVideo, setPlayingVideo] = useState<Tables<'videos'> | null>(null)
  const [editingQuizVideo, setEditingQuizVideo] = useState<Tables<'videos'> | null>(null)
  const [reorderMode, setReorderMode] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  useEffect(() => {
    fetchVideos()
    fetchCategories()
  }, [])

  const fetchVideos = async () => {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })

      if (error) throw error
      setVideos(data || [])
    } catch (error) {
      console.error('Error fetching videos:', error)
      toast.error('Failed to load videos')
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('video_categories')
        .select('*')
        .order('sort_order', { ascending: true })

      if (error) throw error
      setCategories(data || [])
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const openNewModal = () => {
    setEditingVideo(null)
    setFormData({
      title: '',
      description: '',
      video_url: '',
      duration_seconds: 0,
      thumbnail_url: '',
      category: '',
      is_required: false,
    })
    setShowModal(true)
  }

  const openEditModal = (video: Tables<'videos'>) => {
    setEditingVideo(video)
    setFormData({
      title: video.title,
      description: video.description || '',
      video_url: video.video_url,
      duration_seconds: video.duration_seconds,
      thumbnail_url: video.thumbnail_url || '',
      category: video.category || '',
      is_required: video.is_required,
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title || !formData.video_url) {
      toast.error('Please fill in required fields')
      return
    }

    setSaving(true)
    try {
      if (editingVideo) {
        const { error } = await supabase
          .from('videos')
          .update(formData)
          .eq('id', editingVideo.id)
        if (error) throw error
        toast.success('Video updated!')
      } else {
        const { error } = await supabase.from('videos').insert({
          ...formData,
          uploaded_by: profile?.id,
        })
        if (error) throw error
        toast.success('Video added!')
      }

      setShowModal(false)
      fetchVideos()
    } catch (error) {
      console.error('Error saving video:', error)
      toast.error('Failed to save video')
    } finally {
      setSaving(false)
    }
  }

  const deleteVideo = async (id: string) => {
    if (!confirm('Are you sure you want to delete this video?')) return

    try {
      const { error } = await supabase.from('videos').delete().eq('id', id)
      if (error) throw error
      toast.success('Video deleted')
      fetchVideos()
    } catch (error) {
      console.error('Error deleting video:', error)
      toast.error('Failed to delete video')
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getVideosInCategory = (category: string | null) => {
    return videos
      .filter(v => v.category === category)
      .sort((a, b) => ((a as any).sort_order || 0) - ((b as any).sort_order || 0))
  }

  const moveVideo = async (videoId: string, direction: 'up' | 'down') => {
    const categoryVideos = getVideosInCategory(selectedCategory)
    const currentIndex = categoryVideos.findIndex(v => v.id === videoId)
    if (currentIndex === -1) return
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= categoryVideos.length) return
    
    const video1 = categoryVideos[currentIndex]
    const video2 = categoryVideos[newIndex]
    
    try {
      // Swap sort_order values
      const order1 = (video1 as any).sort_order || currentIndex
      const order2 = (video2 as any).sort_order || newIndex
      
      await Promise.all([
        supabase.from('videos').update({ sort_order: order2 } as any).eq('id', video1.id),
        supabase.from('videos').update({ sort_order: order1 } as any).eq('id', video2.id),
      ])
      
      await fetchVideos()
      toast.success('Video order updated')
    } catch (error) {
      console.error('Error reordering videos:', error)
      toast.error('Failed to reorder videos')
    }
  }

  const setVideoOrder = async (videoId: string, newPosition: number) => {
    const categoryVideos = getVideosInCategory(selectedCategory)
    const currentIndex = categoryVideos.findIndex(v => v.id === videoId)
    if (currentIndex === -1 || newPosition < 1 || newPosition > categoryVideos.length) return
    if (currentIndex === newPosition - 1) return // No change needed
    
    try {
      // Reorder all videos in the category
      const reorderedVideos = [...categoryVideos]
      const [movedVideo] = reorderedVideos.splice(currentIndex, 1)
      reorderedVideos.splice(newPosition - 1, 0, movedVideo)
      
      // Update all sort_order values
      const updates = reorderedVideos.map((video, index) => 
        supabase.from('videos').update({ sort_order: index + 1 } as any).eq('id', video.id)
      )
      
      await Promise.all(updates)
      await fetchVideos()
      toast.success('Video order updated')
    } catch (error) {
      console.error('Error setting video order:', error)
      toast.error('Failed to update video order')
    }
  }

  const getVideoMetadata = (file: File): Promise<{ duration: number; thumbnail: Blob | null }> => {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.muted = true
      
      video.onloadedmetadata = () => {
        // Seek to 1 second or 10% of video for thumbnail
        video.currentTime = Math.min(1, video.duration * 0.1)
      }
      
      video.onseeked = () => {
        // Create canvas and capture frame
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          canvas.toBlob((blob) => {
            window.URL.revokeObjectURL(video.src)
            resolve({
              duration: Math.round(video.duration),
              thumbnail: blob,
            })
          }, 'image/jpeg', 0.8)
        } else {
          window.URL.revokeObjectURL(video.src)
          resolve({ duration: Math.round(video.duration), thumbnail: null })
        }
      }
      
      video.onerror = () => {
        window.URL.revokeObjectURL(video.src)
        resolve({ duration: 0, thumbnail: null })
      }
      
      video.src = URL.createObjectURL(file)
    })
  }

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a valid video file (MP4, WebM, OGG, MOV)')
      return
    }

    // Validate file size (max 500MB)
    if (file.size > 500 * 1024 * 1024) {
      toast.error('Video file must be less than 500MB')
      return
    }

    setUploadingVideo(true)
    setUploadProgress(0)

    try {
      // Get video duration and thumbnail before upload
      const { duration, thumbnail } = await getVideoMetadata(file)
      
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = fileName

      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) throw uploadError

      // Get public URL for video
      const { data: { publicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(filePath)

      let thumbnailUrl = ''
      
      // Upload thumbnail if generated
      if (thumbnail) {
        const thumbFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`
        const thumbPath = thumbFileName
        
        const { error: thumbError } = await supabase.storage
          .from('thumbnails')
          .upload(thumbPath, thumbnail, {
            cacheControl: '3600',
            upsert: false,
            contentType: 'image/jpeg',
          })
        
        if (!thumbError) {
          const { data: { publicUrl: thumbUrl } } = supabase.storage
            .from('thumbnails')
            .getPublicUrl(thumbPath)
          thumbnailUrl = thumbUrl
        }
      }

      setFormData({ 
        ...formData, 
        video_url: publicUrl, 
        duration_seconds: duration,
        thumbnail_url: thumbnailUrl || formData.thumbnail_url,
      })
      toast.success('Video uploaded successfully!')
    } catch (error) {
      console.error('Error uploading video:', error)
      toast.error('Failed to upload video')
    } finally {
      setUploadingVideo(false)
      setUploadProgress(0)
    }
  }

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a valid image file (JPEG, PNG, WebP, GIF)')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Thumbnail must be less than 5MB')
      return
    }

    setUploadingThumbnail(true)

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `thumbnails/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('thumbnails')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('thumbnails')
        .getPublicUrl(filePath)

      setFormData({ ...formData, thumbnail_url: publicUrl })
      toast.success('Thumbnail uploaded successfully!')
    } catch (error) {
      console.error('Error uploading thumbnail:', error)
      toast.error('Failed to upload thumbnail')
    } finally {
      setUploadingThumbnail(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="sr-only">Loading...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Video Management</h1>
          <p className="text-gray-600">Manage training videos</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={reorderMode ? 'primary' : 'outline'} 
            onClick={() => setReorderMode(!reorderMode)}
          >
            <GripVertical className="w-4 h-4 mr-1" />
            {reorderMode ? 'Done Reordering' : 'Reorder Videos'}
          </Button>
          <Button onClick={openNewModal}>
            <Plus className="w-4 h-4 mr-1" />
            Add Video
          </Button>
        </div>
      </div>

      {/* Reorder Mode UI */}
      {reorderMode && (
        <Card>
          <h3 className="font-semibold text-gray-900 mb-3">Reorder Videos by Category</h3>
          <div className="flex gap-2 mb-4 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === cat.name
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat.name} ({getVideosInCategory(cat.name).length})
              </button>
            ))}
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === null
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Uncategorized ({getVideosInCategory(null).length})
            </button>
          </div>
          
          <div className="space-y-2">
            {getVideosInCategory(selectedCategory).map((video, index, arr) => (
              <div
                key={video.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => moveVideo(video.id, 'up')}
                    disabled={index === 0}
                    className="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Move video up"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => moveVideo(video.id, 'down')}
                    disabled={index === arr.length - 1}
                    className="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Move video down"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>
                <select
                  value={index + 1}
                  onChange={(e) => setVideoOrder(video.id, parseInt(e.target.value))}
                  className="w-14 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {Array.from({ length: arr.length }, (_, i) => i + 1).map((num) => (
                    <option key={num} value={num}>
                      {num}
                    </option>
                  ))}
                </select>
                {video.thumbnail_url && (
                  <img
                    src={video.thumbnail_url}
                    alt=""
                    className="w-16 h-10 object-cover rounded"
                  />
                )}
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{video.title}</p>
                  <p className="text-sm text-gray-500">{formatDuration(video.duration_seconds)}</p>
                </div>
              </div>
            ))}
            {getVideosInCategory(selectedCategory).length === 0 && (
              <p className="text-gray-500 text-center py-4">No videos in this category</p>
            )}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {videos.map((video) => (
          <Card key={video.id} className="overflow-hidden" padding="none">
            <div 
              className="aspect-video bg-gray-200 relative cursor-pointer group"
              onClick={() => setPlayingVideo(video)}
            >
              {video.thumbnail_url ? (
                <img
                  src={video.thumbnail_url}
                  alt={video.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Video className="w-12 h-12 text-gray-400" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="w-14 h-14 bg-white/90 rounded-full flex items-center justify-center">
                  <Play className="w-6 h-6 text-gray-900 ml-1" />
                </div>
              </div>
              <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                {formatDuration(video.duration_seconds)}
              </span>
              {video.is_required && (
                <span className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
                  Required
                </span>
              )}
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 mb-1">{video.title}</h3>
              {video.category && (
                <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded mb-2">
                  {video.category}
                </span>
              )}
              <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                {video.description}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openEditModal(video)}>
                  <Edit2 className="w-4 h-4 mr-1" />
                  Edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingQuizVideo(video)}>
                  <HelpCircle className="w-4 h-4 mr-1" />
                  Quiz
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:bg-red-50"
                  onClick={() => deleteVideo(video.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {videos.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            <Video className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No videos yet. Click "Add Video" to get started.</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onKeyDown={(e) => e.key === 'Escape' && setShowModal(false)}>
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="video-modal-title">
            <div className="flex items-center justify-between mb-6">
              <h2 id="video-modal-title" className="text-xl font-bold text-gray-900">
                {editingVideo ? 'Edit Video' : 'Add New Video'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Title *"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Video title"
                required
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Video description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Video *
                </label>
                <div className="flex gap-2">
                  <Input
                    value={formData.video_url}
                    onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                    placeholder="Enter URL or upload file"
                    className="flex-1"
                  />
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/ogg,video/quicktime"
                    onChange={handleVideoUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => videoInputRef.current?.click()}
                    disabled={uploadingVideo}
                  >
                    {uploadingVideo ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                {uploadingVideo && (
                  <div className="mt-2">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Uploading video...</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Thumbnail
                </label>
                <div className="flex gap-2">
                  <Input
                    value={formData.thumbnail_url}
                    onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
                    placeholder="Enter URL or upload image"
                    className="flex-1"
                  />
                  <input
                    ref={thumbnailInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleThumbnailUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => thumbnailInputRef.current?.click()}
                    disabled={uploadingThumbnail}
                  >
                    {uploadingThumbnail ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                {formData.thumbnail_url && (
                  <img
                    src={formData.thumbnail_url}
                    alt="Thumbnail preview"
                    className="mt-2 h-20 rounded object-cover"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Duration (seconds)"
                  type="number"
                  value={formData.duration_seconds}
                  onChange={(e) =>
                    setFormData({ ...formData, duration_seconds: parseInt(e.target.value) || 0 })
                  }
                  placeholder="300"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_required}
                  onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Required training</span>
              </label>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" loading={saving}>
                  <Save className="w-4 h-4 mr-1" />
                  {editingVideo ? 'Update' : 'Add Video'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Video Player Modal */}
      {playingVideo && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4" onKeyDown={(e) => e.key === 'Escape' && setPlayingVideo(null)}>
          <div className="w-full max-w-4xl" role="dialog" aria-modal="true" aria-labelledby="video-player-modal-title">
            <div className="flex items-center justify-between mb-4">
              <h2 id="video-player-modal-title" className="text-xl font-bold text-white">{playingVideo.title}</h2>
              <button
                onClick={() => setPlayingVideo(null)}
                className="p-2 text-white hover:bg-white/10 rounded-lg"
                aria-label="Close video player"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              <video
                src={playingVideo.video_url}
                controls
                autoPlay
                playsInline
                className="w-full h-full"
              />
            </div>
            {playingVideo.description && (
              <p className="text-gray-300 mt-4">{playingVideo.description}</p>
            )}
          </div>
        </div>
      )}

      {/* Quiz Editor Modal */}
      {editingQuizVideo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto" onKeyDown={(e) => e.key === 'Escape' && setEditingQuizVideo(null)}>
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="quiz-editor-title">
            <div className="flex items-center justify-between mb-4">
              <h2 id="quiz-editor-title" className="sr-only">Quiz Editor</h2>
              <div></div>
              <button
                onClick={() => setEditingQuizVideo(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
                aria-label="Close quiz editor"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <QuizEditor
              videoId={editingQuizVideo.id}
              videoTitle={editingQuizVideo.title}
              onClose={() => setEditingQuizVideo(null)}
            />
          </Card>
        </div>
      )}
    </div>
  )
}

export default VideoManagementPage

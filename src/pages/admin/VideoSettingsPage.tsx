import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { Plus, Trash2, Save, GripVertical, Settings } from 'lucide-react'
import toast from 'react-hot-toast'

interface VideoCategory {
  id: string
  name: string
  description: string | null
  sort_order: number
}

interface VideoSettings {
  require_completion: { enabled: boolean }
  engagement_check_interval: { seconds: number }
  allow_skip: { enabled: boolean }
}

const VideoSettingsPage = () => {
  const [categories, setCategories] = useState<VideoCategory[]>([])
  const [settings, setSettings] = useState<VideoSettings>({
    require_completion: { enabled: true },
    engagement_check_interval: { seconds: 300 },
    allow_skip: { enabled: false },
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newCategory, setNewCategory] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      // Fetch categories
      const { data: catData, error: catError } = await supabase
        .from('video_categories')
        .select('*')
        .order('sort_order', { ascending: true })

      if (catError) throw catError
      setCategories(catData || [])

      // Fetch settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('video_settings')
        .select('*')

      if (settingsError) throw settingsError

      if (settingsData) {
        const settingsObj: Partial<VideoSettings> = {}
        settingsData.forEach((s: { key: string; value: unknown }) => {
          settingsObj[s.key as keyof VideoSettings] = s.value as VideoSettings[keyof VideoSettings]
        })
        setSettings({ ...settings, ...settingsObj })
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const addCategory = async () => {
    if (!newCategory.trim()) {
      toast.error('Please enter a category name')
      return
    }

    try {
      const maxOrder = Math.max(...categories.map((c) => c.sort_order), 0)
      const { error } = await supabase.from('video_categories').insert({
        name: newCategory.trim(),
        sort_order: maxOrder + 1,
      })

      if (error) throw error

      toast.success('Category added')
      setNewCategory('')
      fetchData()
    } catch (error) {
      console.error('Error adding category:', error)
      toast.error('Failed to add category')
    }
  }

  const deleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return

    try {
      const { error } = await supabase.from('video_categories').delete().eq('id', id)

      if (error) throw error

      toast.success('Category deleted')
      fetchData()
    } catch (error) {
      console.error('Error deleting category:', error)
      toast.error('Failed to delete category')
    }
  }

  const updateCategoryOrder = async (id: string, direction: 'up' | 'down') => {
    const index = categories.findIndex((c) => c.id === id)
    if (index === -1) return
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === categories.length - 1) return

    const newCategories = [...categories]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    const tempOrder = newCategories[index].sort_order
    newCategories[index].sort_order = newCategories[swapIndex].sort_order
    newCategories[swapIndex].sort_order = tempOrder

    try {
      await Promise.all([
        supabase
          .from('video_categories')
          .update({ sort_order: newCategories[index].sort_order })
          .eq('id', newCategories[index].id),
        supabase
          .from('video_categories')
          .update({ sort_order: newCategories[swapIndex].sort_order })
          .eq('id', newCategories[swapIndex].id),
      ])

      fetchData()
    } catch (error) {
      console.error('Error updating order:', error)
      toast.error('Failed to update order')
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      const updates = Object.entries(settings).map(([key, value]) =>
        supabase
          .from('video_settings')
          .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
      )

      await Promise.all(updates)
      toast.success('Settings saved')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Video Settings</h1>
        <p className="text-gray-600">Manage video categories and training settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Categories Section */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Video Categories</h2>
          <p className="text-sm text-gray-600 mb-4">
            Manage the categories available for training videos
          </p>

          <div className="flex gap-2 mb-4">
            <Input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="New category name"
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && addCategory()}
            />
            <Button onClick={addCategory}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-2">
            {categories.map((category, index) => (
              <div
                key={category.id}
                className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg"
              >
                <GripVertical className="w-4 h-4 text-gray-400" />
                <span className="flex-1 font-medium">{category.name}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => updateCategoryOrder(category.id, 'up')}
                    disabled={index === 0}
                    className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30"
                    aria-label="Move category up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => updateCategoryOrder(category.id, 'down')}
                    disabled={index === categories.length - 1}
                    className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-30"
                    aria-label="Move category down"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => deleteCategory(category.id)}
                    className="p-1 text-red-500 hover:text-red-700"
                    aria-label="Delete category"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {categories.length === 0 && (
              <p className="text-center text-gray-500 py-4">No categories yet</p>
            )}
          </div>
        </Card>

        {/* Settings Section */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Training Settings</h2>
          </div>
          <p className="text-sm text-gray-600 mb-6">
            Configure how training videos behave for users
          </p>

          <div className="space-y-6">
            <label className="flex items-center justify-between">
              <div>
                <span className="font-medium text-gray-900">Require Video Completion</span>
                <p className="text-sm text-gray-500">
                  Users must watch entire video to mark as complete
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.require_completion.enabled}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    require_completion: { enabled: e.target.checked },
                  })
                }
                className="w-5 h-5 rounded border-gray-300 text-blue-600"
              />
            </label>

            <label className="flex items-center justify-between">
              <div>
                <span className="font-medium text-gray-900">Allow Skipping</span>
                <p className="text-sm text-gray-500">
                  Allow users to skip non-required videos
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.allow_skip.enabled}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    allow_skip: { enabled: e.target.checked },
                  })
                }
                className="w-5 h-5 rounded border-gray-300 text-blue-600"
              />
            </label>

            <div>
              <label className="block font-medium text-gray-900 mb-1">
                Engagement Check Interval
              </label>
              <p className="text-sm text-gray-500 mb-2">
                How often to prompt "Still watching?" (in seconds)
              </p>
              <Input
                type="number"
                value={settings.engagement_check_interval.seconds}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    engagement_check_interval: { seconds: parseInt(e.target.value) || 300 },
                  })
                }
                min={60}
                max={1800}
              />
            </div>

            <Button onClick={saveSettings} loading={saving} className="w-full">
              <Save className="w-4 h-4 mr-2" />
              Save Settings
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default VideoSettingsPage

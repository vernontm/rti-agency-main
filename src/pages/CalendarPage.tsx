import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { supabase } from '../lib/supabase'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Calendar as CalendarIcon,
  Star,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface CalendarNote {
  id: string
  date: string
  title: string
  description: string
  color: string
  created_by: string
  created_at: string
}

interface Holiday {
  date: string
  name: string
}

// US Federal Holidays for 2024-2026
const getHolidays = (year: number): Holiday[] => {
  const holidays: Holiday[] = [
    { date: `${year}-01-01`, name: "New Year's Day" },
    { date: `${year}-01-15`, name: "Martin Luther King Jr. Day" },
    { date: `${year}-02-19`, name: "Presidents' Day" },
    { date: `${year}-05-27`, name: "Memorial Day" },
    { date: `${year}-06-19`, name: "Juneteenth" },
    { date: `${year}-07-04`, name: "Independence Day" },
    { date: `${year}-09-02`, name: "Labor Day" },
    { date: `${year}-10-14`, name: "Columbus Day" },
    { date: `${year}-11-11`, name: "Veterans Day" },
    { date: `${year}-11-28`, name: "Thanksgiving" },
    { date: `${year}-12-25`, name: "Christmas Day" },
  ]
  return holidays
}

const CalendarPage = () => {
  const { profile, getEffectiveRole } = useAuthStore()
  const effectiveRole = getEffectiveRole()
  const isAdmin = effectiveRole === 'admin'

  const [currentDate, setCurrentDate] = useState(new Date())
  const [notes, setNotes] = useState<CalendarNote[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteDescription, setNoteDescription] = useState('')
  const [noteColor, setNoteColor] = useState('blue')
  const [loading, setLoading] = useState(true)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const holidays = getHolidays(year)

  useEffect(() => {
    fetchNotes()
  }, [year, month])

  const fetchNotes = async () => {
    try {
      const startOfMonth = new Date(year, month, 1).toISOString().split('T')[0]
      const endOfMonth = new Date(year, month + 1, 0).toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('calendar_notes')
        .select('*')
        .gte('date', startOfMonth)
        .lte('date', endOfMonth)
        .order('date', { ascending: true })

      if (error) throw error
      setNotes((data as CalendarNote[]) || [])
    } catch (error) {
      console.error('Error fetching calendar notes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddNote = async () => {
    if (!selectedDate || !noteTitle.trim()) {
      toast.error('Please enter a title')
      return
    }

    try {
      const { error } = await supabase
        .from('calendar_notes')
        .insert({
          date: selectedDate,
          title: noteTitle.trim(),
          description: noteDescription.trim(),
          color: noteColor,
          created_by: profile?.id,
        } as any)

      if (error) throw error

      // Create an announcement for the new calendar note
      const formattedDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
      
      await supabase.from('announcements').insert({
        title: `📅 Calendar Update: ${noteTitle.trim()}`,
        content: noteDescription.trim() 
          ? `${noteDescription.trim()}\n\nDate: ${formattedDate}`
          : `A new calendar note has been added for ${formattedDate}.`,
        created_by: profile?.id,
        target_audience: 'all',
        sent_at: new Date().toISOString(),
      } as any)

      toast.success('Note added and notification sent')
      setShowNoteModal(false)
      setNoteTitle('')
      setNoteDescription('')
      setNoteColor('blue')
      fetchNotes()
    } catch (error) {
      console.error('Error adding note:', error)
      toast.error('Failed to add note')
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from('calendar_notes')
        .delete()
        .eq('id', noteId)

      if (error) throw error
      toast.success('Note deleted')
      fetchNotes()
    } catch (error) {
      console.error('Error deleting note:', error)
      toast.error('Failed to delete note')
    }
  }

  const getDaysInMonth = () => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDay = firstDay.getDay()

    const days: (number | null)[] = []

    // Add empty slots for days before the first day of the month
    for (let i = 0; i < startingDay; i++) {
      days.push(null)
    }

    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i)
    }

    return days
  }

  const formatDateString = (day: number) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const getHolidayForDate = (dateString: string) => {
    return holidays.find(h => h.date === dateString)
  }

  const getNotesForDate = (dateString: string) => {
    return notes.filter(n => n.date === dateString)
  }

  const isToday = (day: number) => {
    const today = new Date()
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    )
  }

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const getFullDateLabel = (day: number) => {
    const date = new Date(year, month, day)
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  }

  const colorOptions = [
    { value: 'blue', bg: 'bg-blue-500', light: 'bg-blue-100 text-blue-800' },
    { value: 'orange', bg: 'bg-orange-500', light: 'bg-orange-100 text-orange-800' },
    { value: 'green', bg: 'bg-green-500', light: 'bg-green-100 text-green-800' },
    { value: 'purple', bg: 'bg-purple-500', light: 'bg-purple-100 text-purple-800' },
    { value: 'red', bg: 'bg-red-500', light: 'bg-red-100 text-red-800' },
  ]

  const getColorClasses = (color: string) => {
    return colorOptions.find(c => c.value === color)?.light || 'bg-blue-100 text-blue-800'
  }

  const days = getDaysInMonth()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-gray-600">View holidays and important dates</p>
        </div>
      </div>

      {/* Calendar Card */}
      <Card className="p-0 overflow-hidden">
        {/* Calendar Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <div className="flex items-center gap-1">
              <button
                onClick={prevMonth}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={nextMonth}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Next month"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              {monthNames[month]} {year}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Star className="w-4 h-4 text-orange-500" />
              <span>Holiday</span>
            </div>
          </div>
        </div>

        {/* Day Names Header */}
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {dayNames.map((day) => (
            <div
              key={day}
              className="py-3 text-center text-sm font-medium text-gray-500"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7">
          {days.map((day, index) => {
            if (day === null) {
              return (
                <div
                  key={`empty-${index}`}
                  className="min-h-[120px] border-b border-r border-gray-100 bg-gray-50/50"
                />
              )
            }

            const dateString = formatDateString(day)
            const holiday = getHolidayForDate(dateString)
            const dayNotes = getNotesForDate(dateString)
            const isTodayDate = isToday(day)

            return (
              <div
                key={day}
                role="button"
                tabIndex={0}
                aria-label={getFullDateLabel(day)}
                className={`min-h-[120px] border-b border-r border-gray-100 p-2 transition-colors hover:bg-blue-50/50 cursor-pointer ${
                  isTodayDate ? 'bg-blue-50' : 'bg-white'
                }`}
                onClick={() => {
                  if (isAdmin) {
                    setSelectedDate(dateString)
                    setShowNoteModal(true)
                  }
                }}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && isAdmin) {
                    e.preventDefault()
                    setSelectedDate(dateString)
                    setShowNoteModal(true)
                  }
                }}
              >
                {/* Day Number */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`inline-flex items-center justify-center w-7 h-7 text-sm font-medium rounded-full ${
                      isTodayDate
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-900'
                    }`}
                  >
                    {day}
                  </span>
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedDate(dateString)
                        setShowNoteModal(true)
                      }}
                      className="p-1 hover:bg-gray-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Add note"
                    >
                      <Plus className="w-4 h-4 text-gray-400" />
                    </button>
                  )}
                </div>

                {/* Holiday */}
                {holiday && (
                  <div className="mb-1 px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded truncate flex items-center gap-1">
                    <Star className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{holiday.name}</span>
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-1">
                  {dayNotes.slice(0, 2).map((note) => (
                    <div
                      key={note.id}
                      className={`px-2 py-1 text-xs font-medium rounded truncate ${getColorClasses(note.color)}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate">{note.title}</span>
                        {isAdmin && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteNote(note.id)
                            }}
                            className="ml-1 hover:text-red-600"
                            aria-label="Delete note"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {dayNotes.length > 2 && (
                    <div className="text-xs text-gray-500 px-2">
                      +{dayNotes.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-6 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-600" />
          <span>Today</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-orange-100 border border-orange-200" />
          <span>Holiday</span>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-blue-600" />
            <span>Click any day to add a note</span>
          </div>
        )}
      </div>

      {/* Add Note Modal */}
      {showNoteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onKeyDown={(e) => e.key === 'Escape' && setShowNoteModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4" role="dialog" aria-modal="true" aria-labelledby="note-modal-title">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 id="note-modal-title" className="text-lg font-semibold text-gray-900">
                Add Note - {selectedDate && new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </h3>
              <button
                onClick={() => setShowNoteModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="Enter note title"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={noteDescription}
                  onChange={(e) => setNoteDescription(e.target.value)}
                  placeholder="Enter description"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color
                </label>
                <div className="flex gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setNoteColor(color.value)}
                      aria-label={`Select ${color.value} color`}
                      className={`w-8 h-8 rounded-full ${color.bg} ${
                        noteColor === color.value
                          ? 'ring-2 ring-offset-2 ring-gray-400'
                          : ''
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
              <Button variant="outline" onClick={() => setShowNoteModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddNote}>
                Add Note
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CalendarPage

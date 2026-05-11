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
  Trash2,
  Settings,
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
  id?: string
  date: string
  name: string
  is_federal?: boolean
}

// Get the nth weekday of a month (e.g., 3rd Monday = nthWeekday(year, 0, 1, 3))
// weekday: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
const nthWeekday = (year: number, month: number, weekday: number, n: number): string => {
  const firstOfMonth = new Date(year, month, 1)
  const firstWeekday = firstOfMonth.getDay()
  const offset = (weekday - firstWeekday + 7) % 7
  const day = 1 + offset + (n - 1) * 7
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// Get the LAST occurrence of a weekday in a month (e.g., last Monday of May for Memorial Day)
const lastWeekday = (year: number, month: number, weekday: number): string => {
  const lastDay = new Date(year, month + 1, 0)
  const lastWeekdayNum = lastDay.getDay()
  const offset = (lastWeekdayNum - weekday + 7) % 7
  const day = lastDay.getDate() - offset
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// Compute correct US federal holidays for any given year
const computeFederalHolidays = (year: number): Holiday[] => {
  return [
    { date: `${year}-01-01`, name: "New Year's Day", is_federal: true },
    { date: nthWeekday(year, 0, 1, 3), name: "Martin Luther King Jr. Day", is_federal: true }, // 3rd Monday of January
    { date: nthWeekday(year, 1, 1, 3), name: "Presidents' Day", is_federal: true }, // 3rd Monday of February
    { date: lastWeekday(year, 4, 1), name: "Memorial Day", is_federal: true }, // last Monday of May
    { date: `${year}-06-19`, name: "Juneteenth", is_federal: true },
    { date: `${year}-07-04`, name: "Independence Day", is_federal: true },
    { date: nthWeekday(year, 8, 1, 1), name: "Labor Day", is_federal: true }, // 1st Monday of September
    { date: nthWeekday(year, 9, 1, 2), name: "Columbus Day", is_federal: true }, // 2nd Monday of October
    { date: `${year}-11-11`, name: "Veterans Day", is_federal: true },
    { date: nthWeekday(year, 10, 4, 4), name: "Thanksgiving", is_federal: true }, // 4th Thursday of November
    { date: `${year}-12-25`, name: "Christmas Day", is_federal: true },
  ]
}

const CalendarPage = () => {
  const { profile, getEffectiveRole } = useAuthStore()
  const effectiveRole = getEffectiveRole()
  const isAdmin = effectiveRole === 'admin'

  const [currentDate, setCurrentDate] = useState(new Date())
  const [notes, setNotes] = useState<CalendarNote[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteDescription, setNoteDescription] = useState('')
  const [noteColor, setNoteColor] = useState('blue')
  const [loading, setLoading] = useState(true)
  const [showHolidaysModal, setShowHolidaysModal] = useState(false)
  const [newHolidayDate, setNewHolidayDate] = useState('')
  const [newHolidayName, setNewHolidayName] = useState('')

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  useEffect(() => {
    fetchNotes()
    fetchHolidays()
  }, [year, month])

  const fetchHolidays = async () => {
    try {
      // Fetch holidays for current year (and adjacent months for cleaner UX)
      const startOfYear = `${year}-01-01`
      const endOfYear = `${year}-12-31`
      const { data, error } = await supabase
        .from('calendar_holidays')
        .select('*')
        .gte('date', startOfYear)
        .lte('date', endOfYear)
        .order('date')

      if (error) throw error

      // If no holidays exist for this year, auto-seed the federal ones
      if (!data || data.length === 0) {
        const federalHolidays = computeFederalHolidays(year)
        const { data: inserted, error: insertError } = await supabase
          .from('calendar_holidays')
          .insert(federalHolidays.map(h => ({ date: h.date, name: h.name, is_federal: true })))
          .select()

        if (insertError) {
          // RLS may block non-admins from seeding; fall back to computed federal holidays only
          console.warn('Could not seed federal holidays (likely RLS):', insertError)
          setHolidays(federalHolidays)
          return
        }
        setHolidays((inserted as Holiday[]) || federalHolidays)
        return
      }

      setHolidays(data as Holiday[])
    } catch (error) {
      console.error('Error fetching holidays:', error)
      // Fall back to computed federal holidays
      setHolidays(computeFederalHolidays(year))
    }
  }

  const handleAddHoliday = async () => {
    if (!newHolidayDate || !newHolidayName.trim()) {
      toast.error('Date and name are required')
      return
    }
    try {
      const { data, error } = await supabase
        .from('calendar_holidays')
        .insert({
          date: newHolidayDate,
          name: newHolidayName.trim(),
          is_federal: false,
          created_by: profile?.id,
        })
        .select()
        .single()

      if (error) throw error
      setHolidays(prev => [...prev, data as Holiday].sort((a, b) => a.date.localeCompare(b.date)))
      setNewHolidayDate('')
      setNewHolidayName('')
      toast.success('Holiday added')
    } catch (error: any) {
      console.error('Error adding holiday:', error)
      toast.error(`Failed: ${error?.message || 'unknown error'}`)
    }
  }

  const handleDeleteHoliday = async (holiday: Holiday) => {
    if (!holiday.id) {
      toast.error('Cannot delete this holiday (no ID — refresh and try again)')
      return
    }
    if (!confirm(`Delete "${holiday.name}" on ${holiday.date}?`)) return
    try {
      const { error } = await supabase
        .from('calendar_holidays')
        .delete()
        .eq('id', holiday.id)

      if (error) throw error
      setHolidays(prev => prev.filter(h => h.id !== holiday.id))
      toast.success('Holiday deleted')
    } catch (error: any) {
      console.error('Error deleting holiday:', error)
      toast.error(`Failed: ${error?.message || 'unknown error'}`)
    }
  }

  const handleUpdateHolidayDate = async (holiday: Holiday, newDate: string) => {
    if (!holiday.id || newDate === holiday.date) return
    try {
      const { error } = await supabase
        .from('calendar_holidays')
        .update({ date: newDate })
        .eq('id', holiday.id)

      if (error) throw error
      setHolidays(prev => prev.map(h => h.id === holiday.id ? { ...h, date: newDate } : h).sort((a, b) => a.date.localeCompare(b.date)))
      toast.success('Date updated')
    } catch (error: any) {
      console.error('Error updating holiday:', error)
      toast.error(`Failed: ${error?.message || 'unknown error'}`)
    }
  }

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
        {isAdmin && (
          <Button variant="outline" onClick={() => setShowHolidaysModal(true)}>
            <Settings className="w-4 h-4 mr-2" />
            Manage Holidays
          </Button>
        )}
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

      {/* Manage Holidays Modal */}
      {showHolidaysModal && isAdmin && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onKeyDown={(e) => e.key === 'Escape' && setShowHolidaysModal(false)}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" role="dialog" aria-modal="true" aria-labelledby="holidays-modal-title">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h2 id="holidays-modal-title" className="text-xl font-bold text-gray-900">Manage Holidays</h2>
                <p className="text-sm text-gray-500">Holidays for {year}</p>
              </div>
              <button
                onClick={() => setShowHolidaysModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {/* Add new holiday */}
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Add Holiday</p>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={newHolidayDate}
                    onChange={(e) => setNewHolidayDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                  <input
                    type="text"
                    value={newHolidayName}
                    onChange={(e) => setNewHolidayName(e.target.value)}
                    placeholder="Holiday name"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                  <Button onClick={handleAddHoliday} size="sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* List of holidays */}
              <div className="space-y-1">
                {holidays.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No holidays yet</p>
                ) : (
                  holidays.map(h => (
                    <div
                      key={h.id || h.date + h.name}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg"
                    >
                      <input
                        type="date"
                        defaultValue={h.date}
                        onBlur={(e) => handleUpdateHolidayDate(h, e.target.value)}
                        className="px-2 py-1 border border-gray-200 rounded text-sm focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                      />
                      <span className="flex-1 text-sm text-gray-900">{h.name}</span>
                      {h.is_federal && (
                        <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                          Federal
                        </span>
                      )}
                      <button
                        onClick={() => handleDeleteHoliday(h)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                        aria-label={`Delete ${h.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
              <Button variant="outline" onClick={() => setShowHolidaysModal(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CalendarPage

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { GraduationCap, CheckCircle, XCircle, Download, Search, Filter, RefreshCw, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'

interface QuizAttempt {
  id: string
  user_id: string
  video_id: string
  score: number
  passed: boolean
  passing_score: number
  total_questions: number
  correct_count: number
  taker_name: string | null
  taken_at: string
  users?: { full_name: string | null; email: string | null } | null
  videos?: { title: string | null; category: string | null } | null
}

type PassFilter = 'all' | 'passed' | 'failed'

const TrainingReportsPage = () => {
  const { profile } = useAuthStore()
  const isAdmin = profile?.role === 'admin'
  const [attempts, setAttempts] = useState<QuizAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [videoFilter, setVideoFilter] = useState<string>('all')
  const [passFilter, setPassFilter] = useState<PassFilter>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    if (!isAdmin) return
    fetchAttempts()
  }, [isAdmin])

  const fetchAttempts = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('quiz_attempts')
        .select('*, users:user_id (full_name, email), videos:video_id (title, category)')
        .order('taken_at', { ascending: false })
        .limit(500)
      if (error) throw error
      setAttempts((data as unknown as QuizAttempt[]) || [])
    } catch (err) {
      console.error('Failed to load quiz attempts:', err)
      toast.error('Failed to load quiz attempts')
    } finally {
      setLoading(false)
    }
  }

  const videoOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const a of attempts) {
      if (a.video_id && !seen.has(a.video_id)) {
        seen.set(a.video_id, a.videos?.title || 'Untitled video')
      }
    }
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [attempts])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    const from = dateFrom ? new Date(dateFrom).getTime() : null
    const to = dateTo ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 : null
    return attempts.filter((a) => {
      if (videoFilter !== 'all' && a.video_id !== videoFilter) return false
      if (passFilter === 'passed' && !a.passed) return false
      if (passFilter === 'failed' && a.passed) return false
      if (from && new Date(a.taken_at).getTime() < from) return false
      if (to && new Date(a.taken_at).getTime() > to) return false
      if (s) {
        const hay = `${a.taker_name || ''} ${a.users?.full_name || ''} ${a.users?.email || ''} ${a.videos?.title || ''}`.toLowerCase()
        if (!hay.includes(s)) return false
      }
      return true
    })
  }, [attempts, search, videoFilter, passFilter, dateFrom, dateTo])

  const resetForNextTaker = async (attempt: QuizAttempt) => {
    const takerLabel = attempt.taker_name || attempt.users?.full_name || 'this account'
    const videoLabel = attempt.videos?.title || 'this video'
    if (!confirm(
      `Reset "${videoLabel}" on the account for "${takerLabel}"?\n\nThe next person on this account will see the video as new. Historical attempts stay in this report.`,
    )) return
    try {
      const { error } = await supabase
        .from('video_progress')
        .delete()
        .eq('user_id', attempt.user_id)
        .eq('video_id', attempt.video_id)
      if (error) throw error
      toast.success('Reset. Next person can start this video fresh.')
    } catch (err) {
      console.error('Failed to reset video progress:', err)
      toast.error('Failed to reset. Check the console.')
    }
  }

  const stats = useMemo(() => {
    const total = filtered.length
    const passed = filtered.filter((a) => a.passed).length
    const failed = total - passed
    const avg = total > 0 ? Math.round(filtered.reduce((sum, a) => sum + a.score, 0) / total) : 0
    return { total, passed, failed, avg, passRate: total > 0 ? Math.round((passed / total) * 100) : 0 }
  }, [filtered])

  const downloadCsv = () => {
    if (filtered.length === 0) {
      toast('Nothing to export', { icon: '📭' })
      return
    }
    const rows = [
      ['Taker', 'Account', 'Email', 'Video', 'Category', 'Score %', 'Passing %', 'Correct / Total', 'Result', 'Taken At'],
      ...filtered.map((a) => [
        a.taker_name || a.users?.full_name || '',
        a.users?.full_name || '',
        a.users?.email || '',
        a.videos?.title || '',
        a.videos?.category || '',
        String(a.score),
        String(a.passing_score),
        `${a.correct_count} / ${a.total_questions}`,
        a.passed ? 'Passed' : 'Failed',
        new Date(a.taken_at).toISOString(),
      ]),
    ]
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `training-quiz-attempts-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const clearFilters = () => {
    setSearch('')
    setVideoFilter('all')
    setPassFilter('all')
    setDateFrom('')
    setDateTo('')
  }

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-gray-500">
        Admins only.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-blue-600" />
            Training Reports
          </h1>
          <p className="text-gray-600 mt-1">Every quiz attempt across all staff and videos. Latest 500 attempts.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAttempts} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={downloadCsv} disabled={filtered.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Attempts (filtered)</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Passed</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{stats.passed}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Failed</p>
          <p className="text-3xl font-bold text-red-600 mt-1">{stats.failed}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Pass rate / Avg score</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">
            {stats.passRate}% <span className="text-base text-gray-500 font-medium">/ {stats.avg}%</span>
          </p>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-700">Filters</h3>
          {(search || videoFilter !== 'all' || passFilter !== 'all' || dateFrom || dateTo) && (
            <button
              onClick={clearFilters}
              className="ml-auto text-xs text-blue-600 hover:text-blue-800"
            >
              Clear all
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <Input
              placeholder="Search staff or video…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={videoFilter}
            onChange={(e) => setVideoFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All videos</option>
            {videoOptions.map(([id, title]) => (
              <option key={id} value={id}>{title}</option>
            ))}
          </select>
          <select
            value={passFilter}
            onChange={(e) => setPassFilter(e.target.value as PassFilter)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Passed and failed</option>
            <option value="passed">Passed only</option>
            <option value="failed">Failed only</option>
          </select>
          <div className="flex gap-2">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label="From date"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label="To date"
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Taker</th>
                <th className="text-left px-4 py-3 font-medium">Video</th>
                <th className="text-left px-4 py-3 font-medium">Score</th>
                <th className="text-left px-4 py-3 font-medium">Result</th>
                <th className="text-left px-4 py-3 font-medium">Taken</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    <GraduationCap className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    {attempts.length === 0
                      ? 'No quiz attempts yet. Staff results will appear here after they submit a quiz.'
                      : 'No attempts match the current filters.'}
                  </td>
                </tr>
              ) : (
                filtered.map((a) => {
                  const displayName = a.taker_name?.trim() || a.users?.full_name || '—'
                  const showAccountHint = !!a.taker_name && a.users?.full_name && a.taker_name !== a.users.full_name
                  return (
                    <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{displayName}</div>
                        <div className="text-xs text-gray-500">
                          {showAccountHint
                            ? <>on account <span className="font-medium">{a.users?.full_name}</span> · {a.users?.email}</>
                            : (a.users?.email || '')}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{a.videos?.title || '—'}</div>
                        {a.videos?.category && (
                          <div className="text-xs text-gray-500">{a.videos.category}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">{a.score}%</div>
                        <div className="text-xs text-gray-500">
                          {a.correct_count} / {a.total_questions} correct · needed {a.passing_score}%
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {a.passed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3" />
                            Passed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <XCircle className="w-3 h-3" />
                            Failed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {new Date(a.taken_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => resetForNextTaker(a)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                          title="Reset this video on this account so the next person can start fresh"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Reset for next taker
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

export default TrainingReportsPage

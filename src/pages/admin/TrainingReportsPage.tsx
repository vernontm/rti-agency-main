import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { GraduationCap, CheckCircle, XCircle, Download, Search, Filter, RefreshCw, RotateCcw, Printer, X } from 'lucide-react'
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
  answers: Record<string, number | string> | null
  users?: { full_name: string | null; email: string | null } | null
  videos?: { title: string | null; category: string | null } | null
}

interface QuizQuestion {
  id: string
  question: string
  type: 'multiple_choice' | 'text'
  options: string[]
  correctAnswer: number | string
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
  const [detailAttempt, setDetailAttempt] = useState<QuizAttempt | null>(null)
  const [detailQuestions, setDetailQuestions] = useState<QuizQuestion[] | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

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

  const openDetail = async (attempt: QuizAttempt) => {
    setDetailAttempt(attempt)
    setDetailQuestions(null)
    setDetailLoading(true)
    try {
      const { data, error } = await supabase
        .from('video_quizzes')
        .select('questions')
        .eq('video_id', attempt.video_id)
        .single()
      if (error) throw error
      const qs = (data?.questions as QuizQuestion[] | null) || []
      setDetailQuestions(qs)
    } catch (err) {
      console.error('Failed to load quiz questions:', err)
      toast.error('Failed to load the quiz questions for this attempt.')
      setDetailQuestions([])
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => {
    setDetailAttempt(null)
    setDetailQuestions(null)
  }

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
                    <tr
                      key={a.id}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={() => openDetail(a)}
                      title="Click to see the questions and answers"
                    >
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
                      <td className="px-4 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openDetail(a)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded mr-1"
                          title="View and print this attempt"
                        >
                          <Printer className="w-3 h-3" />
                          View / Print
                        </button>
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

      {/* Print-only styles: when printing, hide everything except the detail sheet */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-quiz-detail, #print-quiz-detail * { visibility: visible !important; }
          #print-quiz-detail {
            position: absolute !important;
            inset: 0 !important;
            margin: 0 !important;
            padding: 24px !important;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            max-height: none !important;
            overflow: visible !important;
          }
          #print-quiz-detail .no-print { display: none !important; }
        }
      `}</style>

      {/* Attempt detail modal — questions, correct answers, taker's answers, print button */}
      {detailAttempt && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-start md:items-center justify-center p-4 overflow-y-auto"
          onKeyDown={(e) => e.key === 'Escape' && closeDetail()}
          onClick={closeDetail}
        >
          <div
            id="print-quiz-detail"
            role="dialog"
            aria-modal="true"
            className="relative bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="no-print sticky top-0 z-10 flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white">
              <div className="text-sm font-medium text-gray-700">Quiz attempt details</div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </Button>
                <button
                  onClick={closeDetail}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Header block */}
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {detailAttempt.videos?.title || 'Quiz attempt'}
                </h2>
                {detailAttempt.videos?.category && (
                  <p className="text-sm text-gray-500 mt-1">{detailAttempt.videos.category}</p>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border border-gray-200 rounded-lg p-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500">Taker</p>
                  <p className="font-medium text-gray-900 mt-0.5">
                    {detailAttempt.taker_name?.trim() || detailAttempt.users?.full_name || '—'}
                  </p>
                  {(detailAttempt.taker_name && detailAttempt.users?.full_name && detailAttempt.taker_name !== detailAttempt.users.full_name) && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      on account {detailAttempt.users.full_name}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500">Score</p>
                  <p className="font-medium text-gray-900 mt-0.5">
                    {detailAttempt.score}% ({detailAttempt.correct_count} / {detailAttempt.total_questions})
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">needed {detailAttempt.passing_score}%</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500">Result</p>
                  <p className={`font-medium mt-0.5 ${detailAttempt.passed ? 'text-green-700' : 'text-red-700'}`}>
                    {detailAttempt.passed ? 'Passed' : 'Failed'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500">Taken</p>
                  <p className="font-medium text-gray-900 mt-0.5">
                    {new Date(detailAttempt.taken_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Questions */}
              {detailLoading ? (
                <div className="text-center py-8 text-gray-500">Loading questions…</div>
              ) : detailQuestions === null || detailQuestions.length === 0 ? (
                <div className="text-center py-8 text-gray-500 border border-dashed border-gray-300 rounded-lg">
                  Questions are unavailable for this attempt. The quiz may have been deleted or changed.
                </div>
              ) : (
                <ol className="space-y-3">
                  {detailQuestions.map((q, index) => {
                    const userAns = detailAttempt.answers?.[String(index)]
                    const isText = q.type === 'text'
                    const isCorrect = isText
                      ? String(userAns ?? '').toLowerCase().trim() === String(q.correctAnswer).toLowerCase().trim()
                      : userAns === q.correctAnswer
                    const userDisplay = isText
                      ? (String(userAns ?? '').trim() || '(no answer)')
                      : (typeof userAns === 'number' && q.options[userAns] !== undefined ? q.options[userAns] : '(no answer)')
                    const correctDisplay = isText
                      ? String(q.correctAnswer)
                      : (q.options[q.correctAnswer as number] ?? String(q.correctAnswer))
                    return (
                      <li
                        key={q.id || index}
                        className={`border rounded-lg p-4 ${isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}
                      >
                        <div className="flex items-start gap-2">
                          {isCorrect ? (
                            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Question {index + 1}</p>
                            <p className="font-medium text-gray-900">{q.question}</p>
                            <p className="text-sm mt-2">
                              <span className="text-gray-500">Their answer: </span>
                              <span className={isCorrect ? 'text-green-800' : 'text-red-800'}>{userDisplay}</span>
                            </p>
                            {!isCorrect && (
                              <p className="text-sm">
                                <span className="text-gray-500">Correct answer: </span>
                                <span className="text-green-800">{correctDisplay}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}

              {/* Footer for the printed page */}
              <div className="pt-4 border-t border-gray-200 text-xs text-gray-500 flex items-center justify-between">
                <span>RTI Agency — Training Report</span>
                <span>Printed {new Date().toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TrainingReportsPage

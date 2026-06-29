import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { AlertTriangle, Trash2, RefreshCw, User, Clock, Monitor } from 'lucide-react'
import toast from 'react-hot-toast'
import Button from '../../components/ui/Button'

interface ErrorLog {
  id: string
  user_id: string | null
  user_email: string | null
  route: string | null
  error_message: string
  error_stack: string | null
  user_agent: string | null
  viewport: string | null
  created_at: string
}

const ErrorLogsPage = () => {
  const [logs, setLogs] = useState<ErrorLog[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('error_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      setLogs((data as ErrorLog[]) || [])
    } catch (e) {
      console.error('Failed to load error logs:', e)
      toast.error('Failed to load error logs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this error log?')) return
    try {
      const { error } = await supabase.from('error_logs').delete().eq('id', id)
      if (error) throw error
      setLogs(prev => prev.filter(l => l.id !== id))
      toast.success('Deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }

  const handleClearAll = async () => {
    if (!confirm(`Delete all ${logs.length} error logs?`)) return
    try {
      const ids = logs.map(l => l.id)
      const { error } = await supabase.from('error_logs').delete().in('id', ids)
      if (error) throw error
      setLogs([])
      toast.success('Cleared')
    } catch {
      toast.error('Failed to clear')
    }
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-orange-500" />
            Error Logs
          </h1>
          <p className="text-gray-600 mt-1">Client-side crashes captured by the app's ErrorBoundary.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchLogs}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
          {logs.length > 0 && (
            <Button variant="outline" onClick={handleClearAll} className="text-red-600 border-red-300 hover:bg-red-50">
              <Trash2 className="w-4 h-4 mr-1" />
              Clear All
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No errors logged yet. Nice.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map(log => {
            const isOpen = expandedId === log.id
            return (
              <div key={log.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedId(isOpen ? null : log.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 break-words">{log.error_message}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(log.created_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {log.user_email || 'Anonymous'}
                        </span>
                        {log.route && (
                          <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{log.route}</span>
                        )}
                        {log.viewport && (
                          <span className="flex items-center gap-1">
                            <Monitor className="w-3 h-3" />
                            {log.viewport}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(log.id)
                      }}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                      aria-label="Delete log"
                      title="Delete log"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {isOpen && (
                  <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-3">
                    {log.error_stack && (
                      <div>
                        <p className="text-xs font-medium text-gray-700 mb-1">Stack trace</p>
                        <pre className="text-xs text-red-700 whitespace-pre-wrap break-words overflow-auto max-h-64 bg-white p-3 rounded border border-gray-200">
                          {log.error_stack}
                        </pre>
                      </div>
                    )}
                    {log.user_agent && (
                      <div>
                        <p className="text-xs font-medium text-gray-700 mb-1">User Agent</p>
                        <p className="text-xs text-gray-600 break-words">{log.user_agent}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ErrorLogsPage

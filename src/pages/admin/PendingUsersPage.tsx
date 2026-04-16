import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Tables } from '../../types/database.types'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { CheckCircle, XCircle, Mail, MailCheck, Clock, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

interface PendingUser extends Tables<'users'> {
  email_confirmed?: boolean
}

const PendingUsersPage = () => {
  const [users, setUsers] = useState<PendingUser[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchPendingUsers()
  }, [])

  const fetchPendingUsers = async () => {
    try {
      // Fetch pending users from public.users
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) throw error
      
      // For each user, check if their email is confirmed via auth.users
      // Note: This requires a database function or edge function to access auth.users
      // For now, we'll show the data we have
      setUsers(data || [])
    } catch (error) {
      console.error('Error fetching pending users:', error)
      toast.error('Failed to load pending users')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleApprove = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: 'approved' })
        .eq('id', userId)
      if (error) throw error
      toast.success('User approved!')
      fetchPendingUsers()
    } catch (error) {
      console.error('Error approving user:', error)
      toast.error('Failed to approve user')
    }
  }

  const handleReject = async (userId: string) => {
    if (!confirm('Are you sure you want to reject this user? They will not be able to access the portal.')) return
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: 'rejected' })
        .eq('id', userId)
      if (error) throw error
      toast.success('User rejected')
      fetchPendingUsers()
    } catch (error) {
      console.error('Error rejecting user:', error)
      toast.error('Failed to reject user')
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchPendingUsers()
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getTimeSince = (dateString: string) => {
    const now = new Date()
    const created = new Date(dateString)
    const diffMs = now.getTime() - created.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffDays > 0) return `${diffDays}d ago`
    if (diffHours > 0) return `${diffHours}h ago`
    if (diffMins > 0) return `${diffMins}m ago`
    return 'Just now'
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
          <h1 className="text-2xl font-bold text-gray-900">Pending Approvals</h1>
          <p className="text-gray-600">
            Review and approve new user registrations
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {users.length === 0 ? (
        <Card className="text-center py-12">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">All caught up!</h2>
          <p className="text-gray-600">No pending user approvals at this time.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-yellow-600" />
            <span className="text-yellow-800">
              <strong>{users.length}</strong> user{users.length !== 1 ? 's' : ''} waiting for approval
            </span>
          </div>

          <div className="grid gap-4">
            {users.map((user) => (
              <Card key={user.id} className="p-0">
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-semibold text-lg">
                            {user.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 text-lg">
                            {user.full_name}
                          </h3>
                          <p className="text-gray-600">{user.email}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-4 mt-4 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">Role:</span>
                          <span className="px-2 py-0.5 bg-gray-100 rounded-full capitalize font-medium">
                            {user.role}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">Registered:</span>
                          <span className="font-medium">{formatDate(user.created_at)}</span>
                          <span className="text-gray-400">({getTimeSince(user.created_at)})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {user.email_confirmed ? (
                            <>
                              <MailCheck className="w-4 h-4 text-green-500" />
                              <span className="text-green-600 font-medium">Email Confirmed</span>
                            </>
                          ) : (
                            <>
                              <Mail className="w-4 h-4 text-yellow-500" />
                              <span className="text-yellow-600 font-medium">Email Pending</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <Button
                        onClick={() => handleApprove(user.id)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleReject(user.id)}
                        className="text-red-600 border-red-300 hover:bg-red-50"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default PendingUsersPage

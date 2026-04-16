import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import Card from '../../components/ui/Card'
import { 
  Bell, 
  FileText, 
  UserPlus, 
  CheckCircle, 
  XCircle, 
  MessageSquare,
  GraduationCap,
  Circle,
  CheckCircle2
} from 'lucide-react'
import toast from 'react-hot-toast'

interface ActivityItem {
  id: string
  type: 'user_registration' | 'form_submission' | 'training_completed' | 'inquiry' | 'form_approved' | 'form_rejected'
  title: string
  description: string
  user_name?: string
  user_role?: string
  timestamp: string
  status?: string
  metadata?: Record<string, unknown>
  dismissed?: boolean
  requiresApproval?: boolean
}

const UpdatesPage = () => {
  const { profile } = useAuthStore()
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchActivities()
    fetchDismissals()
  }, [profile])

  const fetchActivities = async () => {
    try {
      const allActivities: ActivityItem[] = []

      // Fetch pending user registrations
      const { data: pendingUsers } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'client')
        .order('created_at', { ascending: false })
        .limit(50)

      if (pendingUsers) {
        // Check which users are pending approval (no approved status in metadata or recently created)
        for (const user of pendingUsers) {
          allActivities.push({
            id: `user_${user.id}`,
            type: 'user_registration',
            title: 'New User Registration',
            description: `${user.full_name} registered as a ${user.role}`,
            user_name: user.full_name,
            user_role: user.role,
            timestamp: user.created_at,
          })
        }
      }

      // Fetch form submissions
      const { data: formSubmissions } = await supabase
        .from('form_submissions')
        .select(`
          *,
          forms (form_name),
          users!form_submissions_submitted_by_fkey (full_name, role)
        `)
        .order('submitted_at', { ascending: false })
        .limit(50)

      if (formSubmissions) {
        for (const submission of formSubmissions) {
          const form = submission.forms as { form_name: string } | null
          const user = submission.users as { full_name: string; role: string } | null
          
          let activityType: ActivityItem['type'] = 'form_submission'
          let title = 'Form Submitted'
          
          if (submission.status === 'approved') {
            activityType = 'form_approved'
            title = 'Form Approved'
          } else if (submission.status === 'rejected') {
            activityType = 'form_rejected'
            title = 'Form Rejected'
          }

          allActivities.push({
            id: `form_${submission.id}`,
            type: activityType,
            title,
            description: `${user?.full_name || 'Unknown'} - ${form?.form_name || 'Unknown Form'}`,
            user_name: user?.full_name,
            user_role: user?.role,
            timestamp: submission.reviewed_at || submission.submitted_at,
            status: submission.status,
          })
        }
      }

      // Fetch completed training (video progress where completed = true)
      const { data: completedTraining } = await supabase
        .from('video_progress')
        .select(`
          *,
          users (full_name, role),
          videos (title)
        `)
        .eq('completed', true)
        .order('completed_at', { ascending: false })
        .limit(50)

      if (completedTraining) {
        for (const progress of completedTraining) {
          const user = progress.users as { full_name: string; role: string } | null
          const video = progress.videos as { title: string } | null

          allActivities.push({
            id: `training_${progress.id}`,
            type: 'training_completed',
            title: 'Training Completed',
            description: `${user?.full_name || 'Unknown'} completed "${video?.title || 'Unknown Video'}"`,
            user_name: user?.full_name,
            user_role: user?.role,
            timestamp: progress.completed_at || progress.started_at,
          })
        }
      }

      // Fetch service inquiries
      const { data: inquiries } = await supabase
        .from('service_inquiries')
        .select(`
          *,
          services (service_name)
        `)
        .order('created_at', { ascending: false })
        .limit(50)

      if (inquiries) {
        for (const inquiry of inquiries) {
          const service = inquiry.services as { service_name: string } | null

          allActivities.push({
            id: `inquiry_${inquiry.id}`,
            type: 'inquiry',
            title: 'New Service Inquiry',
            description: `${inquiry.contact_name} inquired about ${service?.service_name || 'a service'}`,
            user_name: inquiry.contact_name,
            timestamp: inquiry.created_at,
            status: inquiry.status,
          })
        }
      }

      // Sort all activities by timestamp (most recent first)
      allActivities.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )

      setActivities(allActivities)
    } catch (error) {
      console.error('Error fetching activities:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchDismissals = async () => {
    if (!profile?.id) return
    try {
      const { data } = await supabase
        .from('admin_notification_dismissals')
        .select('notification_type, notification_id')
        .eq('admin_id', profile.id)

      if (data) {
        const dismissed = new Set(
          data.map((d: { notification_type: string; notification_id: string }) => 
            `${d.notification_type}_${d.notification_id}`
          )
        )
        setDismissedIds(dismissed)
      }
    } catch (error) {
      console.error('Error fetching dismissals:', error)
    }
  }

  const handleDismiss = async (activity: ActivityItem) => {
    // Check if this requires approval
    const requiresApproval = 
      (activity.type === 'form_submission' && activity.status === 'pending') ||
      (activity.type === 'inquiry' && activity.status === 'new')

    if (requiresApproval) {
      toast.error('You must approve or deny this item before dismissing it')
      return
    }

    if (!profile?.id) return

    try {
      const { error } = await supabase
        .from('admin_notification_dismissals')
        .insert({
          admin_id: profile.id,
          notification_type: activity.type,
          notification_id: activity.id.replace(`${activity.type}_`, ''),
        })

      if (error) throw error

      setDismissedIds(prev => {
        const newSet = new Set(prev)
        newSet.add(`${activity.type}_${activity.id.replace(`${activity.type}_`, '')}`)
        return newSet
      })
      toast.success('Notification dismissed')
    } catch (error) {
      console.error('Error dismissing notification:', error)
      toast.error('Failed to dismiss notification')
    }
  }

  const isActivityDismissed = (activity: ActivityItem): boolean => {
    const notificationId = activity.id.replace(`${activity.type}_`, '')
    return dismissedIds.has(`${activity.type}_${notificationId}`)
  }

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'user_registration':
        return <UserPlus className="w-5 h-5 text-blue-600" />
      case 'form_submission':
        return <FileText className="w-5 h-5 text-orange-600" />
      case 'form_approved':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'form_rejected':
        return <XCircle className="w-5 h-5 text-red-600" />
      case 'training_completed':
        return <GraduationCap className="w-5 h-5 text-purple-600" />
      case 'inquiry':
        return <MessageSquare className="w-5 h-5 text-teal-600" />
      default:
        return <Bell className="w-5 h-5 text-gray-600" />
    }
  }

  const getActivityBgColor = (type: ActivityItem['type']) => {
    switch (type) {
      case 'user_registration':
        return 'bg-blue-100'
      case 'form_submission':
        return 'bg-orange-100'
      case 'form_approved':
        return 'bg-green-100'
      case 'form_rejected':
        return 'bg-red-100'
      case 'training_completed':
        return 'bg-purple-100'
      case 'inquiry':
        return 'bg-teal-100'
      default:
        return 'bg-gray-100'
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
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

  const filteredActivities = filter === 'all' 
    ? activities 
    : activities.filter(a => a.type === filter)

  const activityCounts = {
    all: activities.length,
    user_registration: activities.filter(a => a.type === 'user_registration').length,
    form_submission: activities.filter(a => a.type === 'form_submission').length,
    training_completed: activities.filter(a => a.type === 'training_completed').length,
    inquiry: activities.filter(a => a.type === 'inquiry').length,
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
        <h1 className="text-2xl font-bold text-gray-900">Activity Updates</h1>
        <p className="text-gray-600 mt-1">Recent activity across the platform</p>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All ({activityCounts.all})
        </button>
        <button
          onClick={() => setFilter('user_registration')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            filter === 'user_registration'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          Registrations ({activityCounts.user_registration})
        </button>
        <button
          onClick={() => setFilter('form_submission')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            filter === 'form_submission'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          Forms ({activityCounts.form_submission})
        </button>
        <button
          onClick={() => setFilter('training_completed')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            filter === 'training_completed'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          Training ({activityCounts.training_completed})
        </button>
        <button
          onClick={() => setFilter('inquiry')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            filter === 'inquiry'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Inquiries ({activityCounts.inquiry})
        </button>
      </div>

      {/* Activity feed */}
      <Card>
        <div className="space-y-1">
          {filteredActivities.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No activities found</p>
            </div>
          ) : (
            filteredActivities.map((activity, index) => {
              const isDismissed = isActivityDismissed(activity)
              const requiresApproval = 
                (activity.type === 'form_submission' && activity.status === 'pending') ||
                (activity.type === 'inquiry' && activity.status === 'new')

              return (
                <div
                  key={activity.id}
                  className={`flex items-start gap-4 p-4 rounded-lg hover:bg-gray-50 transition-colors ${
                    index !== filteredActivities.length - 1 ? 'border-b border-gray-100' : ''
                  } ${isDismissed ? 'opacity-50' : ''}`}
                >
                  {/* Dismiss checkbox */}
                  <button
                    onClick={() => handleDismiss(activity)}
                    disabled={isDismissed}
                    className={`mt-1 flex-shrink-0 ${isDismissed ? 'cursor-default' : 'cursor-pointer hover:scale-110 transition-transform'}`}
                    title={
                      isDismissed
                        ? 'Already dismissed'
                        : requiresApproval
                          ? 'Approve or deny to dismiss'
                          : 'Click to dismiss'
                    }
                    aria-label={isDismissed ? 'Already dismissed' : 'Dismiss activity'}
                  >
                    {isDismissed ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <Circle className={`w-5 h-5 ${requiresApproval ? 'text-yellow-500' : 'text-gray-300 hover:text-gray-500'}`} />
                    )}
                  </button>

                  <div className={`p-2 rounded-lg ${getActivityBgColor(activity.type)}`}>
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">{activity.title}</h3>
                      {activity.status && (
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          activity.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          activity.status === 'approved' ? 'bg-green-100 text-green-700' :
                          activity.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          activity.status === 'new' ? 'bg-blue-100 text-blue-700' :
                          activity.status === 'in_progress' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {activity.status}
                        </span>
                      )}
                      {activity.user_role && (
                        <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                          {activity.user_role}
                        </span>
                      )}
                      {requiresApproval && !isDismissed && (
                        <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">
                          Action Required
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">{activity.description}</p>
                  </div>
                  <div className="text-sm text-gray-500 whitespace-nowrap">
                    {formatTimestamp(activity.timestamp)}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </Card>
    </div>
  )
}

export default UpdatesPage

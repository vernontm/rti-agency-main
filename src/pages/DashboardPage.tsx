import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { supabase } from '../lib/supabase'
import {
  FileText,
  Users,
  Video,
  Bell,
  Clock,
  UserCheck,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  BookOpen,
  Eye,
  Target,
  Calendar,
  StickyNote,
  Save,
  Briefcase,
  GraduationCap,
  MessageSquare,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface PendingUser {
  id: string
  full_name: string
  email: string
  created_at: string
}

interface PendingForm {
  id: string
  form_id: string
  user_id: string
  created_at: string
  forms?: { title: string }
  users?: { full_name: string }
}

interface RecentActivity {
  id: string
  type: 'video_completed' | 'form_submitted' | 'quiz_passed' | 'user_registered'
  description: string
  user_name: string
  timestamp: string
}

interface DashboardStats {
  pendingForms: number
  pendingUsers: number
  totalUsers: number
  activeVideos: number
  unreadAnnouncements: number
  trainingCompletion: number
  pendingUsersList: PendingUser[]
  pendingFormsList: PendingForm[]
  recentActivity: RecentActivity[]
  // Employee-specific stats
  totalVideos: number
  completedVideos: number
  totalDocuments: number
  viewedDocuments: number
  newAnnouncements: number
  // Admin stats
  pendingApplications: number
}

const DashboardPage = () => {
  const { profile, getEffectiveRole } = useAuthStore()
  const navigate = useNavigate()
  const effectiveRole = getEffectiveRole()
  const [stats, setStats] = useState<DashboardStats>({
    pendingForms: 0,
    pendingUsers: 0,
    totalUsers: 0,
    activeVideos: 0,
    unreadAnnouncements: 0,
    trainingCompletion: 0,
    pendingUsersList: [],
    pendingFormsList: [],
    recentActivity: [],
    totalVideos: 0,
    completedVideos: 0,
    totalDocuments: 0,
    viewedDocuments: 0,
    newAnnouncements: 0,
    pendingApplications: 0,
  })
  const [loading, setLoading] = useState(true)
  const [adminNotes, setAdminNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const notesTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (notesTimeoutRef.current) clearTimeout(notesTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchDashboardStats()
  }, [effectiveRole])

  const fetchDashboardStats = async () => {
    try {
      // Admin stats
      const [
        { count: pendingForms },
        { count: pendingUsers },
        { count: totalUsers },
        { count: activeVideos },
        { count: unreadAnnouncements },
        { data: pendingUsersList },
        { data: pendingFormsList },
      ] = await Promise.all([
        supabase.from('form_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('videos').select('*', { count: 'exact', head: true }),
        supabase.from('announcements').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('id, full_name, email, created_at').eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
        supabase.from('form_submissions').select('id, form_id, user_id, created_at, forms(title), users(full_name)').eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
      ])

      // Employee-specific stats
      let totalVideos = 0
      let completedVideos = 0
      let totalDocuments = 0
      let viewedDocuments = 0
      let newAnnouncements = 0

      if (profile?.id) {
        const oneWeekAgo = new Date()
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

        // Fetch all employee stats in parallel
        const [
          { data: videos },
          { data: videoProgress },
          { data: documents },
          { data: recentAnnouncements },
          { data: readAnnouncements },
        ] = await Promise.all([
          supabase.from('videos').select('id'),
          supabase
            .from('video_progress')
            .select('video_id, completed')
            .eq('user_id', profile.id)
            .eq('completed', true),
          supabase.from('advisories').select('id'),
          supabase
            .from('announcements')
            .select('id')
            .gte('created_at', oneWeekAgo.toISOString()),
          supabase
            .from('announcement_reads')
            .select('announcement_id')
            .eq('user_id', profile.id),
        ])

        totalVideos = videos?.length || 0
        completedVideos = videoProgress?.length || 0
        totalDocuments = documents?.length || 0
        // For now, assume all viewed - you can add a document_views table later
        viewedDocuments = 0

        const readIds = new Set((readAnnouncements as { announcement_id: string }[] | null)?.map(r => r.announcement_id) || [])
        newAnnouncements = (recentAnnouncements as { id: string }[] | null)?.filter(a => !readIds.has(a.id)).length || 0
      }

      // Calculate training completion percentage
      const trainingCompletion = totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : 0

      // Fetch recent employee activity for admin dashboard
      let recentActivity: RecentActivity[] = []
      let pendingApplications = 0

      if (effectiveRole === 'admin') {
        // Get pending job applications
        const { count: appCount } = await supabase
          .from('form_submissions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
        pendingApplications = appCount || 0

        // Get recent video completions
        const { data: recentCompletions } = await supabase
          .from('video_progress')
          .select('id, completed_at, user_id, video_id, users(full_name), videos(title)')
          .eq('completed', true)
          .order('completed_at', { ascending: false })
          .limit(5)

        // Get recent form submissions
        const { data: recentSubmissions } = await supabase
          .from('form_submissions')
          .select('id, submitted_at, user_id, form_id, users(full_name), forms(form_name)')
          .order('submitted_at', { ascending: false })
          .limit(5)

        // Get recent user registrations
        const { data: recentUsers } = await supabase
          .from('users')
          .select('id, full_name, created_at')
          .order('created_at', { ascending: false })
          .limit(5)

        // Combine and sort activities
        const activities: RecentActivity[] = []

        if (recentCompletions) {
          (recentCompletions as any[]).forEach(item => {
            if (item.completed_at) {
              activities.push({
                id: item.id,
                type: 'video_completed',
                description: `Completed video: ${item.videos?.title || 'Unknown'}`,
                user_name: item.users?.full_name || 'Unknown User',
                timestamp: item.completed_at,
              })
            }
          })
        }

        if (recentSubmissions) {
          (recentSubmissions as any[]).forEach(item => {
            activities.push({
              id: item.id,
              type: 'form_submitted',
              description: `Submitted form: ${item.forms?.form_name || 'Unknown'}`,
              user_name: item.users?.full_name || 'Unknown User',
              timestamp: item.submitted_at,
            })
          })
        }

        if (recentUsers) {
          (recentUsers as any[]).forEach(item => {
            activities.push({
              id: item.id,
              type: 'user_registered',
              description: 'New user registered',
              user_name: item.full_name || 'Unknown User',
              timestamp: item.created_at,
            })
          })
        }

        // Sort by timestamp and take top 10
        recentActivity = activities
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 10)

        // Load admin notes
        const { data: notesData } = await supabase
          .from('admin_settings')
          .select('value')
          .eq('key', 'dashboard_notes')
          .single()
        
        if (notesData && (notesData as any).value) {
          setAdminNotes((notesData as any).value as string)
        }
      }

      setStats({
        pendingForms: pendingForms || 0,
        pendingUsers: pendingUsers || 0,
        totalUsers: totalUsers || 0,
        activeVideos: activeVideos || 0,
        unreadAnnouncements: unreadAnnouncements || 0,
        trainingCompletion,
        pendingUsersList: pendingUsersList || [],
        pendingFormsList: pendingFormsList || [],
        recentActivity,
        totalVideos,
        completedVideos,
        totalDocuments,
        viewedDocuments,
        newAnnouncements,
        pendingApplications,
      })
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApproveUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: 'approved' } as any)
        .eq('id', userId)
      if (error) throw error
      fetchDashboardStats()
    } catch (error) {
      console.error('Error approving user:', error)
    }
  }

  const handleNotesChange = (value: string) => {
    setAdminNotes(value)
    
    // Auto-save after 1 second of no typing
    if (notesTimeoutRef.current) {
      clearTimeout(notesTimeoutRef.current)
    }
    
    notesTimeoutRef.current = setTimeout(() => {
      saveNotes(value)
    }, 1000)
  }

  const saveNotes = async (notes: string) => {
    setSavingNotes(true)
    try {
      const { error } = await supabase
        .from('admin_settings')
        .upsert({ key: 'dashboard_notes', value: notes, updated_at: new Date().toISOString() } as any, { onConflict: 'key' })
      
      if (error) throw error
      toast.success('Notes saved', { duration: 1500 })
    } catch (error) {
      console.error('Error saving notes:', error)
      toast.error('Failed to save notes')
    } finally {
      setSavingNotes(false)
    }
  }

  const getActivityIcon = (type: RecentActivity['type']) => {
    switch (type) {
      case 'video_completed':
        return <GraduationCap className="w-4 h-4 text-orange-600" />
      case 'form_submitted':
        return <FileText className="w-4 h-4 text-orange-600" />
      case 'quiz_passed':
        return <CheckCircle className="w-4 h-4 text-blue-600" />
      case 'user_registered':
        return <UserCheck className="w-4 h-4 text-blue-600" />
      default:
        return <Clock className="w-4 h-4 text-gray-600" />
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffDays > 0) return `${diffDays}d ago`
    if (diffHours > 0) return `${diffHours}h ago`
    if (diffMins > 0) return `${diffMins}m ago`
    return 'Just now'
  }

  const isAdmin = effectiveRole === 'admin'

  const statCards = [
    {
      title: 'Pending Approvals',
      value: stats.pendingUsers,
      icon: UserCheck,
      color: 'bg-red-500',
      show: isAdmin,
      urgent: stats.pendingUsers > 0,
    },
    {
      title: 'Pending Forms',
      value: stats.pendingForms,
      icon: FileText,
      color: 'bg-orange-500',
      show: isAdmin,
      urgent: stats.pendingForms > 0,
    },
    {
      title: 'Total Users',
      value: stats.totalUsers,
      icon: Users,
      color: 'bg-blue-500',
      show: isAdmin,
      urgent: false,
    },
    {
      title: 'Training Videos',
      value: stats.activeVideos,
      icon: Video,
      color: 'bg-purple-500',
      show: true,
      urgent: false,
    },
    {
      title: 'Announcements',
      value: stats.unreadAnnouncements,
      icon: Bell,
      color: 'bg-green-500',
      show: true,
      urgent: false,
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const formatDate = () => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const pendingVideos = stats.totalVideos - stats.completedVideos
  const pendingDocuments = stats.totalDocuments - stats.viewedDocuments

  return (
    <div className="space-y-6">
      {/* Greeting with Date */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {getGreeting()}, {profile?.full_name?.split(' ')[0]}!
          </h1>
          <div className="flex items-center gap-2 text-gray-600 mt-1">
            <Calendar className="w-4 h-4" />
            <span>{formatDate()}</span>
          </div>
        </div>
      </div>

      {/* Employee Progress Section */}
      {!isAdmin && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Target className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Your Progress</h2>
              <p className="text-sm text-gray-600">Track your completion status</p>
            </div>
          </div>

          {/* Overall Progress Bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Overall Completion</span>
              <span className="text-lg font-bold text-blue-600">{stats.trainingCompletion}%</span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-500"
                style={{ width: `${stats.trainingCompletion}%` }}
              />
            </div>
          </div>

          {/* Progress Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Training Videos */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Video className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Training Videos</p>
                  <p className="text-xl font-bold text-gray-900">
                    {stats.completedVideos}/{stats.totalVideos}
                  </p>
                </div>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-orange-500 rounded-full"
                  style={{ width: `${stats.totalVideos > 0 ? (stats.completedVideos / stats.totalVideos) * 100 : 0}%` }}
                />
              </div>
              {pendingVideos > 0 && (
                <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {pendingVideos} video{pendingVideos !== 1 ? 's' : ''} remaining
                </p>
              )}
              {pendingVideos === 0 && stats.totalVideos > 0 && (
                <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  All videos completed!
                </p>
              )}
            </div>

            {/* Documents */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Documents</p>
                  <p className="text-xl font-bold text-gray-900">
                    {stats.totalDocuments}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => navigate('/documents')}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-2"
              >
                <Eye className="w-3 h-3" />
                View documents
              </button>
            </div>

            {/* Announcements */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Bell className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">New Announcements</p>
                  <p className="text-xl font-bold text-gray-900">
                    {stats.newAnnouncements}
                  </p>
                </div>
              </div>
              {stats.newAnnouncements > 0 ? (
                <button 
                  onClick={() => navigate('/announcements')}
                  className="text-xs text-orange-600 hover:text-orange-800 flex items-center gap-1 mt-2"
                >
                  <AlertCircle className="w-3 h-3" />
                  {stats.newAnnouncements} unread this week
                </button>
              ) : (
                <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  All caught up!
                </p>
              )}
            </div>
          </div>

          {/* Quick Actions for Employee */}
          <div className="mt-4 pt-4 border-t border-blue-200 flex gap-3">
            <Button size="sm" onClick={() => navigate('/training')}>
              <Video className="w-4 h-4 mr-1" />
              Continue Training
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate('/announcements')}>
              <Bell className="w-4 h-4 mr-1" />
              View Announcements
            </Button>
          </div>
        </Card>
      )}

      {/* Admin greeting (simplified) */}
      {isAdmin && (
        <div>
          <p className="text-gray-600">
            Here's what's happening with your account today.
          </p>
        </div>
      )}

      {/* Pending Items Section */}
      {isAdmin && (stats.pendingUsers > 0 || stats.pendingForms > 0) && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-6 h-6 text-orange-400" />
            <h2 className="text-lg font-semibold text-white">Items Requiring Attention</h2>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pending Users */}
            {stats.pendingUsersList.length > 0 && (
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">Pending User Approvals</h3>
                  <button 
                    onClick={() => navigate('/admin/pending-users')}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    View All <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3">
                  {stats.pendingUsersList.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-semibold">
                            {user.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{user.full_name}</p>
                          <p className="text-sm text-gray-500">{formatTimeAgo(user.created_at)}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleApproveUser(user.id)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending Forms */}
            {stats.pendingFormsList.length > 0 && (
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">Pending Form Submissions</h3>
                  <button 
                    onClick={() => navigate('/admin/forms')}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    View All <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3">
                  {stats.pendingFormsList.map((form) => (
                    <div key={form.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                          <FileText className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {(form.forms as { title: string } | undefined)?.title || 'Form Submission'}
                          </p>
                          <p className="text-sm text-gray-500">
                            by {(form.users as { full_name: string } | undefined)?.full_name || 'Unknown'} • {formatTimeAgo(form.created_at)}
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => navigate('/admin/forms')}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Training Completion Rate
            </h2>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all duration-500"
                    style={{ width: `${stats.trainingCompletion}%` }}
                  />
                </div>
              </div>
              <span className="text-2xl font-bold text-gray-900">
                {stats.trainingCompletion}%
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Overall employee training completion
            </p>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => navigate('/admin/pending-users')}
                className="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <UserCheck className="w-5 h-5" />
                <span className="text-sm font-medium">Review Users</span>
              </button>
              <button 
                onClick={() => navigate('/admin/videos')}
                className="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Video className="w-5 h-5" />
                <span className="text-sm font-medium">Upload Video</span>
              </button>
              <button 
                onClick={() => navigate('/announcements')}
                className="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Bell className="w-5 h-5" />
                <span className="text-sm font-medium">Announcements</span>
              </button>
              <button 
                onClick={() => navigate('/admin/forms')}
                className="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <FileText className="w-5 h-5" />
                <span className="text-sm font-medium">Review Forms</span>
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Recent Activity & Quick Notes - Admin Only */}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Employee Activity */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Recent Employee Activity</h2>
            </div>
            {stats.recentActivity.length > 0 ? (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {stats.recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="p-2 bg-gray-100 rounded-full">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{activity.user_name}</p>
                      <p className="text-sm text-gray-600 truncate">{activity.description}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatTimeAgo(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No recent activity</p>
              </div>
            )}
          </Card>

          {/* Quick Notes */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <StickyNote className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Quick Notes</h2>
              </div>
              {savingNotes && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Save className="w-3 h-3 animate-pulse" />
                  Saving...
                </span>
              )}
            </div>
            <textarea
              value={adminNotes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Write notes here... (auto-saves)"
              className="w-full h-64 p-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <p className="text-xs text-gray-400 mt-2">
              Notes are automatically saved as you type
            </p>
          </Card>
        </div>
      )}
    </div>
  )
}

export default DashboardPage

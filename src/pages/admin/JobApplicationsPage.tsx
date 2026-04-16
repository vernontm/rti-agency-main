import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../stores/authStore'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { FileText, Download, Eye, CheckCircle, XCircle, Clock, User, Mail, Phone, Briefcase, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'

type ApplicationStatus = 'pending' | 'reviewed' | 'interviewed' | 'hired' | 'rejected'

interface JobApplication {
  id: string
  full_name: string
  email: string
  phone: string
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  position_applied: string
  experience_years: number | null
  availability: string | null
  start_date: string | null
  resume_url: string | null
  cover_letter: string | null
  status: ApplicationStatus
  notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

const STATUS_CONFIG: Record<ApplicationStatus, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  reviewed: { label: 'Reviewed', color: 'bg-blue-100 text-blue-800', icon: Eye },
  interviewed: { label: 'Interviewed', color: 'bg-purple-100 text-purple-800', icon: User },
  hired: { label: 'Hired', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800', icon: XCircle }
}

const JobApplicationsPage = () => {
  const { profile } = useAuthStore()
  const [applications, setApplications] = useState<JobApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedApp, setSelectedApp] = useState<JobApplication | null>(null)
  const [filterStatus, setFilterStatus] = useState<ApplicationStatus | 'all'>('all')
  const [notes, setNotes] = useState('')
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    fetchApplications()
  }, [])

  const fetchApplications = async () => {
    try {
      const { data, error } = await supabase
        .from('job_applications')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setApplications((data as JobApplication[]) || [])
    } catch (error) {
      console.error('Error fetching applications:', error)
      toast.error('Failed to load applications')
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (id: string, status: ApplicationStatus) => {
    setUpdating(true)
    try {
      const { error } = await supabase
        .from('job_applications')
        .update({
          status,
          notes: notes || null,
          reviewed_by: profile?.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) throw error
      toast.success(`Application marked as ${status}`)
      fetchApplications()
      setSelectedApp(null)
      setNotes('')
    } catch (error) {
      console.error('Error updating application:', error)
      toast.error('Failed to update application')
    } finally {
      setUpdating(false)
    }
  }

  const filteredApplications = filterStatus === 'all' 
    ? applications 
    : applications.filter(app => app.status === filterStatus)

  const stats = {
    total: applications.length,
    pending: applications.filter(a => a.status === 'pending').length,
    reviewed: applications.filter(a => a.status === 'reviewed').length,
    hired: applications.filter(a => a.status === 'hired').length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        <span className="sr-only">Loading...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Job Applications</h1>
        <p className="text-gray-600">Review and manage job applications</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-center">
          <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-sm text-gray-500">Total Applications</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
          <p className="text-sm text-gray-500">Pending Review</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-blue-600">{stats.reviewed}</p>
          <p className="text-sm text-gray-500">Reviewed</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-green-600">{stats.hired}</p>
          <p className="text-sm text-gray-500">Hired</p>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filterStatus === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        {(Object.keys(STATUS_CONFIG) as ApplicationStatus[]).map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === status ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {STATUS_CONFIG[status].label}
          </button>
        ))}
      </div>

      {/* Applications List */}
      <div className="space-y-4">
        {filteredApplications.length === 0 ? (
          <Card className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No applications found</p>
          </Card>
        ) : (
          filteredApplications.map(app => {
            const StatusIcon = STATUS_CONFIG[app.status].icon
            return (
              <Card key={app.id} className="hover:shadow-md transition-shadow">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">{app.full_name}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${STATUS_CONFIG[app.status].color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {STATUS_CONFIG[app.status].label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Briefcase className="w-4 h-4" />
                        {app.position_applied}
                      </span>
                      <span className="flex items-center gap-1">
                        <Mail className="w-4 h-4" />
                        {app.email}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="w-4 h-4" />
                        {app.phone}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(app.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {app.resume_url && (
                      <a
                        href={app.resume_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1"
                      >
                        <Download className="w-4 h-4" />
                        Resume
                      </a>
                    )}
                    <Button size="sm" onClick={() => { setSelectedApp(app); setNotes(app.notes || ''); }}>
                      <Eye className="w-4 h-4 mr-1" />
                      Review
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })
        )}
      </div>

      {/* Review Modal */}
      {selectedApp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onKeyDown={(e) => e.key === 'Escape' && setSelectedApp(null)}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="app-review-title">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 id="app-review-title" className="text-xl font-bold text-gray-900">Application Review</h2>
                <button onClick={() => setSelectedApp(null)} className="text-gray-400 hover:text-gray-600" aria-label="Close dialog">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Applicant Info */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Applicant Information</h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Full Name:</span>
                    <p className="font-medium">{selectedApp.full_name}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Email:</span>
                    <p className="font-medium">{selectedApp.email}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Phone:</span>
                    <p className="font-medium">{selectedApp.phone}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Address:</span>
                    <p className="font-medium">
                      {[selectedApp.address, selectedApp.city, selectedApp.state, selectedApp.zip_code].filter(Boolean).join(', ') || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Position Info */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Position Details</h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Position Applied:</span>
                    <p className="font-medium">{selectedApp.position_applied}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Experience:</span>
                    <p className="font-medium">{selectedApp.experience_years ? `${selectedApp.experience_years} years` : 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Availability:</span>
                    <p className="font-medium">{selectedApp.availability || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Start Date:</span>
                    <p className="font-medium">{selectedApp.start_date ? new Date(selectedApp.start_date).toLocaleDateString() : 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Cover Letter */}
              {selectedApp.cover_letter && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Cover Letter</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">{selectedApp.cover_letter}</p>
                </div>
              )}

              {/* Resume */}
              {selectedApp.resume_url && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Resume</h3>
                  <a
                    href={selectedApp.resume_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    <Download className="w-4 h-4" />
                    Download Resume
                  </a>
                </div>
              )}

              {/* Notes */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Notes</h3>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  placeholder="Add notes about this applicant..."
                />
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => updateStatus(selectedApp.id, 'reviewed')} loading={updating}>
                  <Eye className="w-4 h-4 mr-1" />
                  Mark Reviewed
                </Button>
                <Button variant="outline" onClick={() => updateStatus(selectedApp.id, 'interviewed')} loading={updating}>
                  <User className="w-4 h-4 mr-1" />
                  Mark Interviewed
                </Button>
                <Button onClick={() => updateStatus(selectedApp.id, 'hired')} loading={updating}>
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Hire
                </Button>
                <Button variant="danger" onClick={() => updateStatus(selectedApp.id, 'rejected')} loading={updating}>
                  <XCircle className="w-4 h-4 mr-1" />
                  Reject
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default JobApplicationsPage

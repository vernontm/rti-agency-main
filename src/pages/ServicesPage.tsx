import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import type { Tables, InquiryStatus } from '../types/database.types'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { Briefcase, X, Send, Phone, Mail, User, Plus, Edit2, Trash2, Eye, MessageSquare } from 'lucide-react'
import toast from 'react-hot-toast'

interface ServiceWithInquiries extends Tables<'services'> {
  service_inquiries?: Tables<'service_inquiries'>[]
}

interface InquiryWithService extends Tables<'service_inquiries'> {
  services?: { service_name: string }
  users?: { full_name: string; email: string }
}

const ServicesPage = () => {
  const { profile } = useAuthStore()
  const [services, setServices] = useState<ServiceWithInquiries[]>([])
  const [inquiries, setInquiries] = useState<InquiryWithService[]>([])
  const [loading, setLoading] = useState(true)
  const [showInquiryModal, setShowInquiryModal] = useState(false)
  const [showServiceModal, setShowServiceModal] = useState(false)
  const [showInquiryDetailModal, setShowInquiryDetailModal] = useState(false)
  const [selectedService, setSelectedService] = useState<ServiceWithInquiries | null>(null)
  const [selectedInquiry, setSelectedInquiry] = useState<InquiryWithService | null>(null)
  const [editingService, setEditingService] = useState<ServiceWithInquiries | null>(null)
  const [formData, setFormData] = useState({
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    message: '',
  })
  const [serviceFormData, setServiceFormData] = useState({
    service_name: '',
    description: '',
    active: true,
  })
  const [adminNotes, setAdminNotes] = useState('')

  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    fetchServices()
    if (isAdmin) {
      fetchInquiries()
    }
  }, [isAdmin])

  const fetchServices = async () => {
    try {
      const query = supabase
        .from('services')
        .select('*')
        .order('created_at', { ascending: false })
      
      // Non-admins only see active services
      if (!isAdmin) {
        query.eq('active', true)
      }

      const { data, error } = await query

      if (error) throw error
      setServices(data || [])
    } catch (error) {
      console.error('Error fetching services:', error)
      toast.error('Failed to load services')
    } finally {
      setLoading(false)
    }
  }

  const fetchInquiries = async () => {
    try {
      const { data, error } = await supabase
        .from('service_inquiries')
        .select('*, services(service_name), users(full_name, email)')
        .order('created_at', { ascending: false })

      if (error) throw error
      setInquiries(data || [])
    } catch (error) {
      console.error('Error fetching inquiries:', error)
    }
  }

  const handleSubmitInquiry = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedService) return

    try {
      const { error } = await supabase.from('service_inquiries').insert({
        service_id: selectedService.id,
        submitted_by: profile?.id || null,
        contact_name: formData.contact_name,
        contact_email: formData.contact_email,
        contact_phone: formData.contact_phone,
        inquiry_data: { message: formData.message },
      })

      if (error) throw error
      toast.success('Inquiry submitted successfully!')
      setShowInquiryModal(false)
      setSelectedService(null)
      setFormData({ contact_name: '', contact_email: '', contact_phone: '', message: '' })
    } catch (error) {
      console.error('Error submitting inquiry:', error)
      toast.error('Failed to submit inquiry')
    }
  }

  const updateInquiryStatus = async (inquiryId: string, status: InquiryStatus) => {
    try {
      const { error } = await supabase
        .from('service_inquiries')
        .update({ status })
        .eq('id', inquiryId)

      if (error) throw error
      toast.success('Status updated')
      fetchInquiries()
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('Failed to update status')
    }
  }

  const getStatusBadge = (status: InquiryStatus) => {
    const badges = {
      new: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      closed: 'bg-gray-100 text-gray-800',
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badges[status]}`}>
        {status.replace('_', ' ')}
      </span>
    )
  }

  const openNewServiceModal = () => {
    setEditingService(null)
    setServiceFormData({ service_name: '', description: '', active: true })
    setShowServiceModal(true)
  }

  const openEditServiceModal = (service: ServiceWithInquiries) => {
    setEditingService(service)
    setServiceFormData({
      service_name: service.service_name,
      description: service.description,
      active: service.active,
    })
    setShowServiceModal(true)
  }

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingService) {
        const { error } = await supabase
          .from('services')
          .update({
            service_name: serviceFormData.service_name,
            description: serviceFormData.description,
            active: serviceFormData.active,
          })
          .eq('id', editingService.id)
        if (error) throw error
        toast.success('Service updated')
      } else {
        const { error } = await supabase.from('services').insert({
          service_name: serviceFormData.service_name,
          description: serviceFormData.description,
          active: serviceFormData.active,
          inquiry_form_schema: {},
        })
        if (error) throw error
        toast.success('Service created')
      }
      setShowServiceModal(false)
      fetchServices()
    } catch (error) {
      console.error('Error saving service:', error)
      toast.error('Failed to save service')
    }
  }

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return
    try {
      const { error } = await supabase.from('services').delete().eq('id', serviceId)
      if (error) throw error
      toast.success('Service deleted')
      fetchServices()
    } catch (error) {
      console.error('Error deleting service:', error)
      toast.error('Failed to delete service')
    }
  }

  const openInquiryDetail = (inquiry: InquiryWithService) => {
    setSelectedInquiry(inquiry)
    setAdminNotes((inquiry.inquiry_data as { admin_notes?: string })?.admin_notes || '')
    setShowInquiryDetailModal(true)
  }

  const handleSaveNotes = async () => {
    if (!selectedInquiry) return
    try {
      const { error } = await supabase
        .from('service_inquiries')
        .update({
          inquiry_data: {
            ...(selectedInquiry.inquiry_data as Record<string, unknown>),
            admin_notes: adminNotes,
          },
        })
        .eq('id', selectedInquiry.id)
      if (error) throw error
      toast.success('Notes saved')
      fetchInquiries()
    } catch (error) {
      console.error('Error saving notes:', error)
      toast.error('Failed to save notes')
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Services</h1>
          <p className="text-gray-600 mt-1">
            {isAdmin ? 'Manage services and inquiries' : 'Explore our available services'}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openNewServiceModal}>
            <Plus className="w-4 h-4 mr-2" />
            Add Service
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map((service) => (
          <Card key={service.id} className={!service.active ? 'opacity-60' : ''}>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Briefcase className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-gray-900 mb-1">{service.service_name}</h3>
                  {!service.active && (
                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">Inactive</span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-4">{service.description}</p>
                <div className="flex gap-2">
                  {service.active && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedService(service)
                        setShowInquiryModal(true)
                      }}
                    >
                      Inquire Now
                    </Button>
                  )}
                  {isAdmin && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditServiceModal(service)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteService(service.id)}
                        className="text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}

        {services.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No services available</p>
          </div>
        )}
      </div>

      {isAdmin && inquiries.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Service Inquiries</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Service</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Contact</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Email</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Date</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {inquiries.map((inquiry) => (
                  <tr key={inquiry.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-900">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                        {inquiry.services?.service_name || 'Unknown'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900">{inquiry.contact_name}</td>
                    <td className="py-3 px-4 text-gray-600">{inquiry.contact_email}</td>
                    <td className="py-3 px-4">{getStatusBadge(inquiry.status)}</td>
                    <td className="py-3 px-4 text-gray-600">
                      {new Date(inquiry.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openInquiryDetail(inquiry)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="View Details"
                          aria-label="View inquiry details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <select
                          value={inquiry.status}
                          onChange={(e) => updateInquiryStatus(inquiry.id, e.target.value as InquiryStatus)}
                          className="text-sm px-2 py-1 border border-gray-300 rounded"
                        >
                          <option value="new">New</option>
                          <option value="in_progress">In Progress</option>
                          <option value="closed">Closed</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showInquiryModal && selectedService && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onKeyDown={(e) => { if (e.key === 'Escape') { setShowInquiryModal(false); setSelectedService(null); } }}>
          <Card className="w-full max-w-lg" role="dialog" aria-modal="true" aria-labelledby="inquiry-modal-title">
            <div className="flex items-center justify-between mb-6">
              <h2 id="inquiry-modal-title" className="text-xl font-bold text-gray-900">
                Inquire about {selectedService.service_name}
              </h2>
              <button
                onClick={() => {
                  setShowInquiryModal(false)
                  setSelectedService(null)
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitInquiry} className="space-y-4">
              <div className="relative">
                <User className="absolute left-3 top-9 w-5 h-5 text-gray-400" />
                <Input
                  label="Your Name"
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  className="pl-10"
                  required
                />
              </div>

              <div className="relative">
                <Mail className="absolute left-3 top-9 w-5 h-5 text-gray-400" />
                <Input
                  label="Email"
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  className="pl-10"
                  required
                />
              </div>

              <div className="relative">
                <Phone className="absolute left-3 top-9 w-5 h-5 text-gray-400" />
                <Input
                  label="Phone"
                  type="tel"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  className="pl-10"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Tell us about your needs..."
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowInquiryModal(false)
                    setSelectedService(null)
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">
                  <Send className="w-4 h-4 mr-1" />
                  Submit Inquiry
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Service Add/Edit Modal */}
      {showServiceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onKeyDown={(e) => e.key === 'Escape' && setShowServiceModal(false)}>
          <Card className="w-full max-w-lg" role="dialog" aria-modal="true" aria-labelledby="service-modal-title">
            <div className="flex items-center justify-between mb-6">
              <h2 id="service-modal-title" className="text-xl font-bold text-gray-900">
                {editingService ? 'Edit Service' : 'Add New Service'}
              </h2>
              <button
                onClick={() => setShowServiceModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveService} className="space-y-4">
              <Input
                label="Service Name"
                value={serviceFormData.service_name}
                onChange={(e) => setServiceFormData({ ...serviceFormData, service_name: e.target.value })}
                placeholder="e.g., Consulting Services"
                required
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={serviceFormData.description}
                  onChange={(e) => setServiceFormData({ ...serviceFormData, description: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe the service..."
                  required
                />
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={serviceFormData.active}
                  onChange={(e) => setServiceFormData({ ...serviceFormData, active: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Active (visible to users)</span>
              </label>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowServiceModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">
                  {editingService ? 'Save Changes' : 'Create Service'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Inquiry Detail Modal */}
      {showInquiryDetailModal && selectedInquiry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onKeyDown={(e) => { if (e.key === 'Escape') { setShowInquiryDetailModal(false); setSelectedInquiry(null); } }}>
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="inquiry-detail-title">
            <div className="flex items-center justify-between mb-6">
              <h2 id="inquiry-detail-title" className="text-xl font-bold text-gray-900">Inquiry Details</h2>
              <button
                onClick={() => {
                  setShowInquiryDetailModal(false)
                  setSelectedInquiry(null)
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">Service</label>
                  <p className="font-medium">{selectedInquiry.services?.service_name || 'Unknown'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Status</label>
                  <div className="mt-1">{getStatusBadge(selectedInquiry.status)}</div>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Contact Name</label>
                  <p className="font-medium">{selectedInquiry.contact_name}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Email</label>
                  <p className="font-medium">{selectedInquiry.contact_email}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Phone</label>
                  <p className="font-medium">{selectedInquiry.contact_phone}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Submitted</label>
                  <p className="font-medium">{new Date(selectedInquiry.created_at).toLocaleString()}</p>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-500">Message</label>
                <div className="mt-1 p-4 bg-gray-50 rounded-lg">
                  <p className="text-gray-900 whitespace-pre-wrap">
                    {(selectedInquiry.inquiry_data as { message?: string })?.message || 'No message'}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <MessageSquare className="w-4 h-4 inline mr-1" />
                  Admin Notes
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Add internal notes about this inquiry..."
                />
                <Button
                  size="sm"
                  className="mt-2"
                  onClick={handleSaveNotes}
                >
                  Save Notes
                </Button>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <select
                  value={selectedInquiry.status}
                  onChange={(e) => {
                    updateInquiryStatus(selectedInquiry.id, e.target.value as InquiryStatus)
                    setSelectedInquiry({ ...selectedInquiry, status: e.target.value as InquiryStatus })
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="new">New</option>
                  <option value="in_progress">In Progress</option>
                  <option value="closed">Closed</option>
                </select>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowInquiryDetailModal(false)
                    setSelectedInquiry(null)
                  }}
                >
                  Close
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

export default ServicesPage

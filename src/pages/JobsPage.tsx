import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Upload, CheckCircle, Briefcase, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'

const RTI_LOGO = 'https://vernon-tech-media.s3.us-east-1.amazonaws.com/RTI-agency/logos/RTI-logo.png'

interface JobPosition {
  id: string
  title: string
  description: string
  department: string | null
  location: string | null
  employment_type: string | null
}

const JobsPage = () => {
  const [positions, setPositions] = useState<JobPosition[]>([])
  const [loadingPositions, setLoadingPositions] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    position_applied: '',
    experience_years: '',
    availability: '',
    start_date: '',
    cover_letter: ''
  })

  useEffect(() => {
    fetchPositions()
  }, [])

  const fetchPositions = async () => {
    try {
      const { data, error } = await supabase
        .from('job_positions')
        .select('id, title, description, department, location, employment_type')
        .eq('is_visible', true)
        .order('sort_order', { ascending: true })

      if (error) throw error
      setPositions(data || [])
    } catch (error) {
      console.error('Error fetching positions:', error)
    } finally {
      setLoadingPositions(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB')
        return
      }
      const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      if (!allowedTypes.includes(file.type)) {
        toast.error('Please upload a PDF or Word document')
        return
      }
      setResumeFile(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.full_name || !formData.email || !formData.phone || !formData.position_applied) {
      toast.error('Please fill in all required fields')
      return
    }

    setSubmitting(true)
    try {
      let resumeUrl = null

      // Upload resume if provided
      if (resumeFile) {
        const fileName = `${Date.now()}_${resumeFile.name.replace(/\s+/g, '_')}`
        const { error: uploadError } = await supabase.storage
          .from('resumes')
          .upload(fileName, resumeFile)

        if (uploadError) {
          console.error('Resume upload error:', uploadError)
          // Continue without resume if upload fails
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('resumes')
            .getPublicUrl(fileName)
          resumeUrl = publicUrl
        }
      }

      // Submit application
      const { error } = await supabase.from('job_applications').insert({
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone,
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        zip_code: formData.zip_code || null,
        position_applied: formData.position_applied,
        experience_years: formData.experience_years ? parseInt(formData.experience_years) : null,
        availability: formData.availability || null,
        start_date: formData.start_date || null,
        resume_url: resumeUrl,
        cover_letter: formData.cover_letter || null
      })

      if (error) throw error

      setSubmitted(true)
      toast.success('Application submitted successfully!')
    } catch (error) {
      console.error('Error submitting application:', error)
      toast.error('Failed to submit application. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#003d5c] to-[#002840] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-12 max-w-lg text-center shadow-2xl">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Application Submitted!</h1>
          <p className="text-gray-600 mb-8">
            Thank you for your interest in joining Road to Independence. We will review your application and contact you soon.
          </p>
          <Link
            to="/"
            className="inline-block px-8 py-3 bg-gradient-to-br from-[#fe9226] to-[#e67e1a] text-white rounded-full font-medium hover:-translate-y-0.5 transition-all"
          >
            Return to Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={RTI_LOGO} alt="RTI Logo" className="h-12" />
          </Link>
          <Link to="/" className="flex items-center gap-2 text-gray-600 hover:text-[#fe9226] transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#003d5c] to-[#002840] text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="w-16 h-16 bg-[#fe9226]/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Briefcase className="w-8 h-8 text-[#fe9226]" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Join Our Team</h1>
          <p className="text-xl text-white/90 max-w-2xl mx-auto">
            Make a difference in the lives of individuals with special needs. We're looking for compassionate, dedicated caregivers to join our team.
          </p>
        </div>
      </section>

      {/* Position Descriptions */}
      <section className="py-12 bg-gray-100">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Open Positions</h2>
          {loadingPositions ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#fe9226]"></div>
            </div>
          ) : positions.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No open positions at this time. Check back soon!</p>
          ) : (
            <div className="space-y-6">
              {positions.map((position) => (
                <div key={position.id} className="bg-white rounded-xl p-6 shadow-md">
                  <h3 className="text-xl font-bold text-[#003d5c] mb-3">{position.title}</h3>
                  {(position.department || position.location || position.employment_type) && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {position.department && (
                        <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-1 rounded-full">{position.department}</span>
                      )}
                      {position.location && (
                        <span className="bg-green-100 text-green-800 text-xs px-2.5 py-1 rounded-full">{position.location}</span>
                      )}
                      {position.employment_type && (
                        <span className="bg-purple-100 text-purple-800 text-xs px-2.5 py-1 rounded-full">{position.employment_type}</span>
                      )}
                    </div>
                  )}
                  {position.description && (
                    <p className="text-gray-700 leading-relaxed">{position.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Application Form */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Employment Application</h2>
            <p className="text-gray-600 mb-8">Please fill out the form below to apply for a position with Road to Independence.</p>

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Personal Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">Personal Information</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="full_name"
                      value={formData.full_name}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fe9226] focus:border-[#fe9226] outline-none transition-all"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fe9226] focus:border-[#fe9226] outline-none transition-all"
                      placeholder="john@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fe9226] focus:border-[#fe9226] outline-none transition-all"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fe9226] focus:border-[#fe9226] outline-none transition-all"
                      placeholder="123 Main St"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fe9226] focus:border-[#fe9226] outline-none transition-all"
                      placeholder="Los Angeles"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                      <input
                        type="text"
                        name="state"
                        value={formData.state}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fe9226] focus:border-[#fe9226] outline-none transition-all"
                        placeholder="CA"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
                      <input
                        type="text"
                        name="zip_code"
                        value={formData.zip_code}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fe9226] focus:border-[#fe9226] outline-none transition-all"
                        placeholder="90001"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Position Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">Position Information</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Position Applied For <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="position_applied"
                      value={formData.position_applied}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fe9226] focus:border-[#fe9226] outline-none transition-all"
                    >
                      <option value="">Select a position</option>
                      {positions.map(pos => (
                        <option key={pos.id} value={pos.title}>{pos.title}</option>
                      ))}
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Years of Experience</label>
                    <input
                      type="number"
                      name="experience_years"
                      value={formData.experience_years}
                      onChange={handleChange}
                      min="0"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fe9226] focus:border-[#fe9226] outline-none transition-all"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Availability</label>
                    <select
                      name="availability"
                      value={formData.availability}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fe9226] focus:border-[#fe9226] outline-none transition-all"
                    >
                      <option value="">Select availability</option>
                      <option value="Full-time">Full-time</option>
                      <option value="Part-time">Part-time</option>
                      <option value="Weekends">Weekends</option>
                      <option value="Flexible">Flexible</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Available Start Date</label>
                    <input
                      type="date"
                      name="start_date"
                      value={formData.start_date}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fe9226] focus:border-[#fe9226] outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Resume Upload */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">Resume & Cover Letter</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Upload Resume (PDF or Word)</label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#fe9226] transition-colors">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={handleFileChange}
                        className="hidden"
                        id="resume-upload"
                      />
                      <label htmlFor="resume-upload" className="cursor-pointer">
                        <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                        {resumeFile ? (
                          <p className="text-[#fe9226] font-medium">{resumeFile.name}</p>
                        ) : (
                          <>
                            <p className="text-gray-600">Click to upload or drag and drop</p>
                            <p className="text-sm text-gray-400 mt-1">PDF or Word (max 10MB)</p>
                          </>
                        )}
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cover Letter (Optional)</label>
                    <textarea
                      name="cover_letter"
                      value={formData.cover_letter}
                      onChange={handleChange}
                      rows={5}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#fe9226] focus:border-[#fe9226] outline-none transition-all resize-none"
                      placeholder="Tell us why you'd be a great fit for this position..."
                    />
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 bg-gradient-to-br from-[#fe9226] to-[#e67e1a] text-white rounded-lg font-semibold text-lg shadow-lg shadow-[#fe9226]/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#fe9226]/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                >
                  {submitting ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#002840] text-white py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-white/70">
          <p>&copy; {new Date().getFullYear()} Road to Independence. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

export default JobsPage

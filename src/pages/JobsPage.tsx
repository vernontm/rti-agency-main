import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Upload, CheckCircle, Briefcase, ArrowLeft, Phone, MapPin, Mail, Clock, Menu, X, Users, Heart, Shield } from 'lucide-react'
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

const WHY_JOIN = [
  { icon: Heart, title: 'Make a Difference', desc: 'Help individuals with special needs live fuller, more independent lives every day.' },
  { icon: Users, title: 'Supportive Team', desc: 'Join a team of compassionate professionals who support and uplift each other.' },
  { icon: Shield, title: 'Growth & Training', desc: 'Receive ongoing professional development, CPR/First Aid certification, and career advancement.' },
]

const JobsPage = () => {
  const [positions, setPositions] = useState<JobPosition[]>([])
  const [loadingPositions, setLoadingPositions] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
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
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
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

      if (resumeFile) {
        const fileName = `${Date.now()}_${resumeFile.name.replace(/\s+/g, '_')}`
        const { error: uploadError } = await supabase.storage
          .from('resumes')
          .upload(fileName, resumeFile)

        if (uploadError) {
          console.error('Resume upload error:', uploadError)
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('resumes')
            .getPublicUrl(fileName)
          resumeUrl = publicUrl
        }
      }

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
            className="inline-block px-8 py-3 bg-gradient-to-br from-[#fe9226] to-[#e67e1a] text-white rounded-lg font-medium hover:-translate-y-0.5 transition-all"
          >
            Return to Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Top Info Bar */}
      <div className={`fixed top-0 left-0 right-0 z-[60] transition-all duration-300 ${scrolled ? 'h-0 opacity-0 overflow-hidden' : 'h-auto opacity-100'}`}>
        <div className="bg-[#002840] text-white/80 text-xs py-2">
          <div className="max-w-[1280px] mx-auto px-6 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <span className="hidden sm:flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-[#fe9226]" />
                45030 Trevor Ave. Suite B, Lancaster, CA 93534
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-[#fe9226]" />
                Mon-Fri 8AM - 5PM
              </span>
            </div>
            <a href="tel:661-948-6760" className="flex items-center gap-1.5 hover:text-white transition-colors">
              <Phone className="w-3 h-3 text-[#fe9226]" />
              661-948-6760
            </a>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className={`fixed left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'top-0 bg-white/95 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)]' : 'top-[32px] bg-white/80 backdrop-blur-lg'}`}>
        <div className="max-w-[1280px] mx-auto px-6 flex justify-between items-center h-[72px]">
          <Link to="/" className="transition-transform hover:scale-105">
            <img src={RTI_LOGO} alt="Road to Independence - Home" className="h-[46px] w-auto" />
          </Link>

          <ul className="hidden md:flex items-center gap-8">
            <li>
              <Link to="/" className="text-[#003d5c] text-sm font-medium tracking-wide hover:text-[#fe9226] transition-colors flex items-center gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5" />
                Home
              </Link>
            </li>
            <li>
              <Link to="/contact" className="text-[#003d5c] text-sm font-medium tracking-wide hover:text-[#fe9226] transition-colors">
                Contact
              </Link>
            </li>
            <li>
              <Link to="/login" className="px-5 py-2.5 bg-[#003d5c] text-white text-sm font-medium rounded-lg hover:bg-[#002840] transition-colors">
                Staff Portal
              </Link>
            </li>
          </ul>

          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-[#003d5c]">
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 shadow-lg">
            <div className="px-6 py-4 space-y-3">
              <Link to="/" className="block text-[#003d5c] font-medium py-2 hover:text-[#fe9226] transition-colors" onClick={() => setMobileMenuOpen(false)}>Home</Link>
              <Link to="/contact" className="block text-[#003d5c] font-medium py-2 hover:text-[#fe9226] transition-colors" onClick={() => setMobileMenuOpen(false)}>Contact</Link>
              <Link to="/login" className="block w-full text-center px-5 py-2.5 bg-[#003d5c] text-white font-medium rounded-lg" onClick={() => setMobileMenuOpen(false)}>Staff Portal</Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative pt-[104px] bg-gradient-to-br from-[#003d5c] via-[#004a6e] to-[#002840] text-white overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#fe9226]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

        <div className="relative max-w-[1280px] mx-auto px-6 py-20 md:py-28 text-center">
          <div className="w-16 h-16 bg-[#fe9226]/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Briefcase className="w-8 h-8 text-[#fe9226]" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-5" style={{ animation: 'fadeInUp 0.6s ease-out' }}>
            Join Our Team
          </h1>
          <p className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto" style={{ animation: 'fadeInUp 0.6s ease-out 0.1s both' }}>
            Make a difference in the lives of individuals with special needs. We're looking for compassionate, dedicated caregivers to join our team.
          </p>
        </div>
      </section>

      {/* Slant Divider */}
      <div className="relative h-20 -mt-1 bg-white">
        <svg className="absolute top-0 left-0 w-full h-full" viewBox="0 0 1440 80" preserveAspectRatio="none">
          <polygon points="0,0 1440,80 0,80" fill="white" />
          <polygon points="0,0 1440,0 1440,80" fill="#003d5c" />
        </svg>
      </div>

      {/* Why Join Us */}
      <section className="py-16 bg-white">
        <div className="max-w-[1280px] mx-auto px-6">
          <p className="text-[#fe9226] text-sm font-semibold tracking-[0.15em] uppercase text-center mb-3">WHY JOIN US</p>
          <h2 className="text-3xl md:text-4xl font-bold text-[#003d5c] text-center mb-12">Why Work at RTI?</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {WHY_JOIN.map((item, i) => (
              <div key={i} className="bg-[#003d5c] rounded-2xl p-7 group hover:bg-[#004a6e] transition-all duration-300">
                <div className="w-12 h-12 bg-[#fe9226]/20 rounded-xl flex items-center justify-center mb-4">
                  <item.icon className="w-6 h-6 text-[#fe9226]" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-white/60 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Slant Divider */}
      <div className="relative h-20 -mt-1 bg-[#f0f4f8]">
        <svg className="absolute top-0 left-0 w-full h-full" viewBox="0 0 1440 80" preserveAspectRatio="none">
          <polygon points="0,0 0,80 1440,80" fill="#f0f4f8" />
          <polygon points="0,0 1440,0 1440,80" fill="white" />
        </svg>
      </div>

      {/* Open Positions */}
      <section className="py-16 bg-[#f0f4f8]">
        <div className="max-w-4xl mx-auto px-6">
          <p className="text-[#fe9226] text-sm font-semibold tracking-[0.15em] uppercase text-center mb-3">CAREERS</p>
          <h2 className="text-3xl md:text-4xl font-bold text-[#003d5c] text-center mb-12">Open Positions</h2>
          {loadingPositions ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#fe9226]"></div>
            </div>
          ) : positions.length === 0 ? (
            <div className="bg-[#003d5c] rounded-2xl p-8 text-center">
              <p className="text-white/70">No open positions at this time. Check back soon!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {positions.map((position) => (
                <div key={position.id} className="bg-[#003d5c] rounded-2xl p-6 hover:bg-[#004a6e] transition-colors">
                  <h3 className="text-xl font-bold text-white mb-3">{position.title}</h3>
                  {(position.department || position.location || position.employment_type) && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {position.department && (
                        <span className="bg-white/10 text-[#fe9226] text-xs px-3 py-1 rounded-full font-medium">{position.department}</span>
                      )}
                      {position.location && (
                        <span className="bg-white/10 text-white/80 text-xs px-3 py-1 rounded-full">{position.location}</span>
                      )}
                      {position.employment_type && (
                        <span className="bg-[#fe9226]/20 text-[#fe9226] text-xs px-3 py-1 rounded-full font-medium">{position.employment_type}</span>
                      )}
                    </div>
                  )}
                  {position.description && (
                    <p className="text-white/60 leading-relaxed text-sm">{position.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Slant Divider */}
      <div className="relative h-20 -mt-1 bg-white">
        <svg className="absolute top-0 left-0 w-full h-full" viewBox="0 0 1440 80" preserveAspectRatio="none">
          <polygon points="0,0 1440,80 0,80" fill="white" />
          <polygon points="0,0 1440,0 1440,80" fill="#f0f4f8" />
        </svg>
      </div>

      {/* Application Form */}
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          <p className="text-[#fe9226] text-sm font-semibold tracking-[0.15em] uppercase text-center mb-3">APPLY NOW</p>
          <h2 className="text-3xl md:text-4xl font-bold text-[#003d5c] text-center mb-3">Employment Application</h2>
          <p className="text-gray-500 text-center mb-12 max-w-xl mx-auto">Please fill out the form below to apply for a position with Road to Independence.</p>

          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.08)] p-8 md:p-12 border border-gray-100">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Personal Information */}
              <div>
                <h3 className="text-lg font-semibold text-[#003d5c] mb-4 pb-2 border-b border-gray-200">Personal Information</h3>
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
                <h3 className="text-lg font-semibold text-[#003d5c] mb-4 pb-2 border-b border-gray-200">Position Information</h3>
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
                <h3 className="text-lg font-semibold text-[#003d5c] mb-4 pb-2 border-b border-gray-200">Resume & Cover Letter</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Upload Resume (PDF or Word)</label>
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-[#fe9226] transition-colors">
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
                  className="w-full py-4 bg-[#fe9226] text-white rounded-lg font-semibold text-lg hover:-translate-y-0.5 hover:bg-[#e67e1a] hover:shadow-[0_8px_30px_rgba(254,146,38,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                >
                  {submitting ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#002030] text-white pt-20 pb-8">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-16">
            <div>
              <img src={RTI_LOGO} alt="Road to Independence" className="h-10 mb-5" loading="lazy" />
              <p className="text-white/40 text-sm leading-relaxed">
                Providing quality care and support to individuals with special needs and their families in Lancaster, CA and the Antelope Valley.
              </p>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-5 text-sm">Quick Links</h3>
              <ul className="space-y-3 text-sm">
                <li><Link to="/" className="text-white/40 hover:text-[#fe9226] transition-colors">Home</Link></li>
                <li><Link to="/contact" className="text-white/40 hover:text-[#fe9226] transition-colors">Contact Us</Link></li>
                <li><Link to="/jobs" className="text-white/40 hover:text-[#fe9226] transition-colors">Careers</Link></li>
                <li><Link to="/login" className="text-white/40 hover:text-[#fe9226] transition-colors">Staff Portal</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-5 text-sm">Contact</h3>
              <address className="not-italic space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-[#fe9226] mt-0.5 shrink-0" />
                  <span className="text-white/40">45030 Trevor Ave. Suite B<br />Lancaster, CA 93534</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-[#fe9226] shrink-0" />
                  <a href="tel:661-948-6760" className="text-white/40 hover:text-[#fe9226] transition-colors">661-948-6760</a>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-[#fe9226] shrink-0" />
                  <a href="mailto:info@roadtoindependence.org" className="text-white/40 hover:text-[#fe9226] transition-colors">info@roadtoindependence.org</a>
                </div>
              </address>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-5 text-sm">Hours</h3>
              <div className="flex items-center gap-3 text-sm">
                <Clock className="w-4 h-4 text-[#fe9226] shrink-0" />
                <span className="text-white/40">Mon-Fri 8:00 AM - 5:00 PM</span>
              </div>
            </div>
          </div>

          <div className="text-center pt-8 border-t border-white/[0.06] text-white/30 text-xs flex flex-col sm:flex-row items-center justify-between gap-2">
            <p>&copy; {new Date().getFullYear()} Road to Independence. All rights reserved.</p>
            <a href="https://vernontm.com" target="_blank" rel="noopener" className="hover:text-[#fe9226] transition-colors">Built by Vernon Tech &amp; Media</a>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

export default JobsPage

import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Menu, X, Phone, MapPin, Mail, Clock } from 'lucide-react'
import SitePopup from '../components/SitePopup'

const RTI_LOGO = 'https://vernon-tech-media.s3.us-east-1.amazonaws.com/RTI-agency/logos/RTI-logo.png'
const HERO_SLIDES = [
  'https://vernon-tech-media.s3.us-east-1.amazonaws.com/RTI-agency/website-images/slider-1.png',
  'https://vernon-tech-media.s3.us-east-1.amazonaws.com/RTI-agency/website-images/slider-2.png'
]
const STAFF_IMAGES = [
  'https://vernon-tech-media.s3.us-east-1.amazonaws.com/RTI-agency/website-images/staff-1.jpeg',
  'https://vernon-tech-media.s3.us-east-1.amazonaws.com/RTI-agency/website-images/staff-2.png'
]

const FAQ_CARDS = [
  {
    question: 'What is an Intellectual Disability?',
    content: (
      <>
        <p className="text-white/90 leading-relaxed mb-6">
          Intellectual disabilities are a group of conditions due to an impairment in physical, learning, language, or behavior areas. These conditions begin during the developmental period, may impact day-to-day functioning, and usually last throughout a person's lifetime.
        </p>
        <p className="text-white/90 leading-relaxed mb-6">
          A "substantial disability" means the existence of significant functional limitations in three or more of the following areas of major life activity, as determined by a regional center, and as appropriate to the age of the person:
        </p>
        <ul className="space-y-2">
          {['Self-care', 'Receptive and expressive language', 'Learning', 'Mobility', 'Self-direction', 'Capacity for independent living', 'Economic self-sufficiency'].map((item, i) => (
            <li key={i} className="text-white/90 pl-8 relative before:content-['•'] before:absolute before:left-0 before:text-[#fe9226] before:font-bold before:text-2xl">{item}</li>
          ))}
        </ul>
      </>
    ),
  },
  {
    question: 'What Services Does RTI Provide?',
    content: (
      <>
        <p className="text-white/90 leading-relaxed mb-6">
          Road to Independence offers a range of services designed to support individuals with developmental disabilities and their families:
        </p>
        <ul className="space-y-3">
          {[
            { title: 'Independent Living Skills (ILS)', desc: 'Training in community integration, home management, budgeting, meal prep, and accessing resources.' },
            { title: 'Supported Living Skills (SLS)', desc: 'Ongoing support for daily living, personal finance management, and community participation.' },
            { title: 'Respite Services', desc: 'Temporary relief for family caregivers while ensuring the safety and care of your loved one.' },
            { title: 'Coordinated Family Support', desc: 'Help navigating services, managing appointments, and following the Individual Program Plan (IPP).' },
          ].map((item, i) => (
            <li key={i} className="text-white/90 pl-8 relative before:content-['•'] before:absolute before:left-0 before:text-[#fe9226] before:font-bold before:text-2xl">
              <span className="font-semibold text-[#fe9226]">{item.title}</span> — {item.desc}
            </li>
          ))}
        </ul>
      </>
    ),
  },
  {
    question: 'How Do I Get Started with RTI?',
    content: (
      <>
        <p className="text-white/90 leading-relaxed mb-6">
          Getting started with Road to Independence is simple. Here's what you need to know:
        </p>
        <ul className="space-y-3">
          {[
            'Contact us by phone at 661-948-6760 or through our contact form.',
            'Referrals are typically made through your Regional Center service coordinator.',
            'We will work with you and your Regional Center to develop a personalized service plan.',
            'Our team will match you with qualified, trained staff who meet your specific needs.',
            'Services can begin as soon as authorization is received from the Regional Center.',
          ].map((item, i) => (
            <li key={i} className="text-white/90 pl-8 relative before:content-['•'] before:absolute before:left-0 before:text-[#fe9226] before:font-bold before:text-2xl">{item}</li>
          ))}
        </ul>
      </>
    ),
  },
  {
    question: 'What Qualifications Do Your Staff Have?',
    content: (
      <>
        <p className="text-white/90 leading-relaxed mb-6">
          All Road to Independence staff members undergo thorough screening and training to provide the highest quality of care:
        </p>
        <ul className="space-y-3">
          {[
            'First Aid and CPR certified',
            'Background checked and fingerprinted through the DOJ and FBI',
            'Trained in person-centered care and individualized support',
            'Experienced in working with individuals with developmental disabilities',
            'Ongoing professional development and supervision',
            'Committed to maintaining the highest standards of professionalism and accountability',
          ].map((item, i) => (
            <li key={i} className="text-white/90 pl-8 relative before:content-['•'] before:absolute before:left-0 before:text-[#fe9226] before:font-bold before:text-2xl">{item}</li>
          ))}
        </ul>
      </>
    ),
  },
]

const LandingPage = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [currentHeroSlide, setCurrentHeroSlide] = useState(0)
  const [currentStaffSlide, setCurrentStaffSlide] = useState(0)
  const [currentILSSlide, setCurrentILSSlide] = useState(0)
  const [currentFAQSlide, setCurrentFAQSlide] = useState(0)

  useEffect(() => {
    const heroInterval = setInterval(() => {
      setCurrentHeroSlide((prev) => (prev + 1) % HERO_SLIDES.length)
    }, 6000)
    const staffInterval = setInterval(() => {
      setCurrentStaffSlide((prev) => (prev + 1) % STAFF_IMAGES.length)
    }, 5000)
    const ilsInterval = setInterval(() => {
      setCurrentILSSlide((prev) => (prev + 1) % 2)
    }, 5000)
    return () => {
      clearInterval(heroInterval)
      clearInterval(staffInterval)
      clearInterval(ilsInterval)
    }
  }, [])

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
    setMobileMenuOpen(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <SitePopup />
      {/* Top Info Bar */}
      <div className="fixed top-0 left-0 right-0 bg-[#fe9226] text-white text-center py-2 text-sm z-[60]">
        <div className="flex items-center justify-center gap-4 flex-wrap px-4">
          <span className="hidden sm:inline">
            <MapPin className="w-3.5 h-3.5 inline mr-1" />
            45030 Trevor Ave. Suite B, Lancaster, CA 93534
          </span>
          <a href="tel:661-948-6760" className="hover:underline">
            <Phone className="w-3.5 h-3.5 inline mr-1" />
            661-948-6760
          </a>
        </div>
      </div>

      {/* Navigation */}
      <nav className="fixed top-8 left-0 right-0 bg-white/85 backdrop-blur-lg shadow-lg z-50 border-b border-white/30" aria-label="Main navigation">
        <div className="max-w-[1200px] mx-auto px-5 flex justify-between items-center h-20">
          <Link to="/" className="transition-transform hover:scale-105">
            <img src={RTI_LOGO} alt="Road to Independence - Home" className="h-[50px] w-auto" />
          </Link>

          {/* Desktop Navigation */}
          <ul className="hidden md:flex items-center gap-10">
            <li>
              <button onClick={() => scrollToSection('services')} className="text-gray-800 font-medium relative after:content-[''] after:absolute after:bottom-[-5px] after:left-0 after:w-0 after:h-0.5 after:bg-gradient-to-r after:from-[#fe9226] after:to-[#e67e1a] hover:after:w-full after:transition-all">
                Services
              </button>
            </li>
            <li>
              <button onClick={() => scrollToSection('faq')} className="text-gray-800 font-medium relative after:content-[''] after:absolute after:bottom-[-5px] after:left-0 after:w-0 after:h-0.5 after:bg-gradient-to-r after:from-[#fe9226] after:to-[#e67e1a] hover:after:w-full after:transition-all">
                FAQ
              </button>
            </li>
            <li>
              <Link to="/contact" className="text-gray-800 font-medium relative after:content-[''] after:absolute after:bottom-[-5px] after:left-0 after:w-0 after:h-0.5 after:bg-gradient-to-r after:from-[#fe9226] after:to-[#e67e1a] hover:after:w-full after:transition-all">
                Contact
              </Link>
            </li>
            <li>
              <Link to="/jobs" className="text-gray-800 font-medium relative after:content-[''] after:absolute after:bottom-[-5px] after:left-0 after:w-0 after:h-0.5 after:bg-gradient-to-r after:from-[#fe9226] after:to-[#e67e1a] hover:after:w-full after:transition-all">
                Careers
              </Link>
            </li>
            <li>
              <Link to="/login" className="bg-gradient-to-br from-[#fe9226] to-[#e67e1a] text-white px-7 py-3 rounded-full font-medium shadow-lg shadow-[#fe9226]/30 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#fe9226]/40 transition-all">
                Staff Portal
              </Link>
            </li>
          </ul>

          {/* Mobile menu button */}
          <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t px-4 py-4 space-y-3">
            <button onClick={() => scrollToSection('services')} className="block w-full text-left text-gray-800 py-2">Services</button>
            <button onClick={() => scrollToSection('faq')} className="block w-full text-left text-gray-800 py-2">FAQ</button>
            <Link to="/contact" className="block w-full text-left text-gray-800 py-2">Contact</Link>
            <Link to="/jobs" className="block w-full text-left text-gray-800 py-2">Careers</Link>
            <Link to="/login" className="block w-full text-center bg-gradient-to-br from-[#fe9226] to-[#e67e1a] text-white px-4 py-3 rounded-full">
              Staff Portal
            </Link>
          </div>
        )}
      </nav>

      <main>
        {/* Hero Section */}
        <section className="relative min-h-[600px] lg:min-h-[650px] mt-28 flex items-center overflow-hidden" aria-label="Hero">
          {/* Hero Slider with real images for SEO */}
          <div className="absolute inset-0">
            {HERO_SLIDES.map((slide, index) => (
              <div
                key={index}
                className={`absolute inset-0 transition-opacity duration-[1500ms] ${currentHeroSlide === index ? 'opacity-100' : 'opacity-0'}`}
              >
                <img
                  src={slide}
                  alt={index === 0 ? 'Caregiver helping a child with special needs' : 'Road to Independence care team providing support'}
                  className="w-full h-full object-cover"
                  loading={index === 0 ? 'eager' : 'lazy'}
                />
                <div className="absolute inset-0 bg-gradient-to-br from-[#003d5c]/85 to-[#002840]/75" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(254,146,38,0.15),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(0,184,212,0.15),transparent_50%)]" />
              </div>
            ))}
          </div>

          {/* Hero Content */}
          <div className="relative z-10 w-full text-center px-5 animate-[fadeInUp_1s_ease-out]">
            <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-bold text-white mb-6 leading-tight drop-shadow-[0_4px_20px_rgba(0,0,0,0.4)]">
              Road to <span className="bg-gradient-to-br from-[#fe9226] to-[#ffb366] bg-clip-text text-transparent">Independence</span>
            </h1>
            <p className="text-xl md:text-2xl text-white/95 max-w-[800px] mx-auto mb-10 drop-shadow-[0_2px_10px_rgba(0,0,0,0.3)]">
              Committed to providing quality service to individuals with special needs
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/contact"
                className="inline-block px-8 py-4 bg-gradient-to-br from-[#fe9226] to-[#e67e1a] text-white rounded-full font-semibold text-lg shadow-[0_6px_25px_rgba(254,146,38,0.4)] hover:-translate-y-1 hover:shadow-[0_10px_35px_rgba(254,146,38,0.5)] transition-all"
              >
                Get Started
              </Link>
              <button
                onClick={() => scrollToSection('services')}
                className="inline-block px-8 py-4 bg-white/15 backdrop-blur-sm text-white border-2 border-white/40 rounded-full font-semibold text-lg hover:bg-white/25 hover:-translate-y-1 transition-all"
              >
                Our Services
              </button>
            </div>
          </div>

          {/* Slider Dots */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 z-10">
            {HERO_SLIDES.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentHeroSlide(index)}
                aria-label={`Go to slide ${index + 1}`}
                className={`w-3 h-3 rounded-full border-2 transition-all ${
                  currentHeroSlide === index
                    ? 'bg-[#fe9226] border-[#fe9226] scale-[1.3]'
                    : 'bg-white/40 border-white/60 hover:bg-white/60'
                }`}
              />
            ))}
          </div>
        </section>

        {/* About / Mission Section */}
        <section className="bg-gradient-to-br from-[#fe9226] to-[#e67e1a] text-white py-20 text-center relative overflow-hidden" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 85%, 0 100%)' }} aria-label="Our mission">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent_60%),radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.08),transparent_50%)]" />
          <div className="max-w-[900px] mx-auto px-5 relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 drop-shadow-[0_2px_10px_rgba(0,0,0,0.2)]">Our Mission</h2>
            <p className="text-xl md:text-2xl font-medium leading-relaxed tracking-wide opacity-95">
              We empower individuals with developmental disabilities to live fuller, more independent lives through personalized care, professional support, and a commitment to dignity and respect.
            </p>
          </div>
        </section>

        {/* Promise Section */}
        <section className="py-24 bg-white relative overflow-hidden" aria-labelledby="promise-heading">
          <div className="max-w-[1200px] mx-auto px-5 relative z-10">
            <h2 id="promise-heading" className="text-center text-3xl md:text-4xl font-bold text-[#003d5c] mb-4">
              Our Promise To You
            </h2>
            <p className="text-center text-gray-600 text-lg mb-16">You will receive staff who:</p>

            <div className="grid lg:grid-cols-2 gap-16 items-center">
              {/* Promise Cards */}
              <div className="grid md:grid-cols-2 gap-6">
                {[
                  { title: 'First Aid & CPR Certified', desc: 'All our staff members are certified in First Aid and CPR to ensure safety and emergency preparedness.' },
                  { title: 'Personalized Care', desc: "Provide services with care to fit all of our client's needs with individualized attention." },
                  { title: 'Professional & Responsible', desc: 'Our team maintains the highest standards of professionalism and accountability.' },
                  { title: 'Support & Guidance', desc: 'Provide support & guidance to individuals with special needs & their families.' }
                ].map((card, i) => (
                  <div key={i} className="bg-gradient-to-br from-[rgba(13,71,97,0.95)] to-[rgba(8,51,68,0.98)] backdrop-blur-xl p-8 rounded-[20px] shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] border border-white/10 relative overflow-hidden group hover:-translate-y-2.5 hover:scale-[1.02] hover:shadow-[0_15px_45px_rgba(254,146,38,0.2),0_10px_30px_rgba(0,0,0,0.4)] hover:border-[#fe9226]/30 transition-all duration-400">
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#fe9226] to-[#ffb366] opacity-80" />
                    <h3 className="bg-gradient-to-br from-[#fe9226] to-[#ffb366] bg-clip-text text-transparent font-bold text-lg mb-3">{card.title}</h3>
                    <p className="text-white/90 text-sm leading-relaxed">{card.desc}</p>
                  </div>
                ))}
              </div>

              {/* Image Slider */}
              <div className="relative rounded-[25px] overflow-hidden shadow-[0_15px_50px_rgba(0,0,0,0.15)] h-[500px]">
                {STAFF_IMAGES.map((imgSrc, index) => (
                  <div
                    key={index}
                    className={`absolute inset-0 transition-opacity duration-1000 ${currentStaffSlide === index ? 'opacity-100' : 'opacity-0'}`}
                  >
                    <img
                      src={imgSrc}
                      alt={index === 0 ? 'Road to Independence staff providing care' : 'Professional caregiving team members'}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-br from-[#fe9226]/30 to-[#003d5c]/30 mix-blend-overlay" />
                  </div>
                ))}

                {/* Arrows */}
                <div className="absolute top-1/2 -translate-y-1/2 w-full flex justify-between px-5 z-10">
                  <button onClick={() => setCurrentStaffSlide((prev) => (prev - 1 + STAFF_IMAGES.length) % STAFF_IMAGES.length)} aria-label="Previous image" className="w-11 h-11 rounded-full bg-white/90 backdrop-blur-lg flex items-center justify-center text-[#fe9226] shadow-lg hover:bg-[#fe9226] hover:text-white hover:scale-110 transition-all">
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button onClick={() => setCurrentStaffSlide((prev) => (prev + 1) % STAFF_IMAGES.length)} aria-label="Next image" className="w-11 h-11 rounded-full bg-white/90 backdrop-blur-lg flex items-center justify-center text-[#fe9226] shadow-lg hover:bg-[#fe9226] hover:text-white hover:scale-110 transition-all">
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </div>

                {/* Dots */}
                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-3 z-10">
                  {STAFF_IMAGES.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentStaffSlide(index)}
                      aria-label={`Staff image ${index + 1}`}
                      className={`w-3 h-3 rounded-full border-2 transition-all ${
                        currentStaffSlide === index
                          ? 'bg-[#fe9226] border-[#fe9226] scale-[1.3]'
                          : 'bg-white/50 border-white/80 hover:bg-white/70'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Services Section */}
        <section id="services" className="py-24 bg-gradient-to-br from-[#003d5c] to-[#002840] relative overflow-hidden" aria-labelledby="services-heading">
          <div className="max-w-[1200px] mx-auto px-5 relative z-10">
            <h2 id="services-heading" className="text-center text-4xl font-bold bg-gradient-to-br from-[#fe9226] to-[#ffb366] bg-clip-text text-transparent mb-16">
              Our Services
            </h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Independent Living Skills */}
              <article className="bg-gradient-to-br from-[rgba(13,71,97,0.95)] to-[rgba(8,51,68,0.98)] backdrop-blur-xl p-10 rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] border border-white/10 relative overflow-hidden group hover:-translate-y-2.5 hover:shadow-[0_25px_70px_rgba(254,146,38,0.2),0_10px_30px_rgba(0,0,0,0.4)] hover:border-[#fe9226]/30 transition-all duration-400">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#fe9226] via-[#ffb366] to-[#00b8d4] opacity-80" />
                <h3 className="text-xl font-bold text-white mb-6">
                  <span className="bg-gradient-to-br from-[#fe9226] to-[#ffb366] bg-clip-text text-transparent">Independent</span> Living Skills
                </h3>

                <div className="min-h-[280px] relative">
                  <div className={`transition-opacity duration-500 ${currentILSSlide === 0 ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'}`}>
                    <h4 className="text-[#fe9226] font-semibold text-sm uppercase tracking-wider mb-4">COMMUNITY</h4>
                    <ul className="space-y-2">
                      {['AFDC', 'Accessing Community Resources', 'DCFS Support', 'Shopping', 'Travel/Transportation', 'Social Security'].map((item, i) => (
                        <li key={i} className="text-white/90 pl-7 relative before:content-['◆'] before:absolute before:left-0 before:text-[#fe9226] before:text-sm">{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className={`transition-opacity duration-500 ${currentILSSlide === 1 ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'}`}>
                    <h4 className="text-[#fe9226] font-semibold text-sm uppercase tracking-wider mb-4">HOME MANAGEMENT</h4>
                    <ul className="space-y-2">
                      {['Bill Paying', 'Budgeting', 'Money Management', 'Meal/Menu Preparation', 'Cleaning', 'Locating Suitable Housing'].map((item, i) => (
                        <li key={i} className="text-white/90 pl-7 relative before:content-['◆'] before:absolute before:left-0 before:text-[#fe9226] before:text-sm">{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="flex gap-2 justify-center mt-4">
                  {[0, 1].map((i) => (
                    <button key={i} onClick={() => setCurrentILSSlide(i)} aria-label={`ILS category ${i + 1}`} className={`w-2.5 h-2.5 rounded-full border transition-all ${currentILSSlide === i ? 'bg-[#fe9226] border-[#fe9226] scale-[1.3] shadow-[0_0_10px_#fe9226]' : 'bg-white/30 border-white/50'}`} />
                  ))}
                </div>
              </article>

              {/* Supported Living Skills */}
              <article className="bg-gradient-to-br from-[rgba(13,71,97,0.95)] to-[rgba(8,51,68,0.98)] backdrop-blur-xl p-10 rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] border border-white/10 relative overflow-hidden group hover:-translate-y-2.5 hover:shadow-[0_25px_70px_rgba(254,146,38,0.2),0_10px_30px_rgba(0,0,0,0.4)] hover:border-[#fe9226]/30 transition-all duration-400">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#fe9226] via-[#ffb366] to-[#00b8d4] opacity-80" />
                <h3 className="text-xl font-bold text-white mb-6">
                  <span className="bg-gradient-to-br from-[#fe9226] to-[#ffb366] bg-clip-text text-transparent">Supported</span> Living Skills
                </h3>
                <ul className="space-y-3">
                  {['Choosing personal attendants and housemates', 'Acquiring household furnishings', 'Common daily living activities and emergencies', 'Assist in participating in community life', 'Manage personal finances', 'Provide ongoing support'].map((item, i) => (
                    <li key={i} className="text-white/90 pl-7 relative before:content-['◆'] before:absolute before:left-0 before:text-[#fe9226] before:text-sm">{item}</li>
                  ))}
                </ul>
              </article>

              {/* Respite Services */}
              <article className="bg-gradient-to-br from-[rgba(13,71,97,0.95)] to-[rgba(8,51,68,0.98)] backdrop-blur-xl p-10 rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] border border-white/10 relative overflow-hidden group hover:-translate-y-2.5 hover:shadow-[0_25px_70px_rgba(254,146,38,0.2),0_10px_30px_rgba(0,0,0,0.4)] hover:border-[#fe9226]/30 transition-all duration-400">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#fe9226] via-[#ffb366] to-[#00b8d4] opacity-80" />
                <h3 className="text-xl font-bold text-white mb-6">
                  <span className="bg-gradient-to-br from-[#fe9226] to-[#ffb366] bg-clip-text text-transparent">Respite</span> Services
                </h3>
                <ul className="space-y-3">
                  {[
                    'Assisting family members to enable an individual with intellectual disabilities to stay at home',
                    "Providing appropriate care and supervision to protect that person's safety in the absence of a family member(s)",
                    'Relieving family members from the constantly demanding responsibility of providing care'
                  ].map((item, i) => (
                    <li key={i} className="text-white/90 pl-7 relative before:content-['◆'] before:absolute before:left-0 before:text-[#fe9226] before:text-sm">{item}</li>
                  ))}
                </ul>
              </article>

              {/* Coordinated Family Support */}
              <article className="bg-gradient-to-br from-[rgba(13,71,97,0.95)] to-[rgba(8,51,68,0.98)] backdrop-blur-xl p-10 rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] border border-white/10 relative overflow-hidden group hover:-translate-y-2.5 hover:shadow-[0_25px_70px_rgba(254,146,38,0.2),0_10px_30px_rgba(0,0,0,0.4)] hover:border-[#fe9226]/30 transition-all duration-400">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#fe9226] via-[#ffb366] to-[#00b8d4] opacity-80" />
                <h3 className="text-xl font-bold text-white mb-6">
                  <span className="bg-gradient-to-br from-[#fe9226] to-[#ffb366] bg-clip-text text-transparent">Coordinated</span> Family Support
                </h3>
                <p className="text-white/80 text-sm mb-5">Helping individuals with developmental disabilities and their families navigate, organize, and manage services and daily supports.</p>
                <ul className="space-y-3">
                  {[
                    'Help coordinate services and supports',
                    'Assist with planning, organizing, and accessing community resources',
                    'Provide guidance on managing appointments, services, and programs',
                    'Support families in understanding and following the Individual Program Plan (IPP)',
                    'Help reduce stress and improve stability in the home'
                  ].map((item, i) => (
                    <li key={i} className="text-white/90 pl-7 relative before:content-['◆'] before:absolute before:left-0 before:text-[#fe9226] before:text-sm">{item}</li>
                  ))}
                </ul>
              </article>
            </div>

            {/* Services CTA */}
            <div className="text-center mt-16">
              <Link
                to="/contact"
                className="inline-block px-10 py-4 bg-gradient-to-br from-[#fe9226] to-[#e67e1a] text-white rounded-full font-semibold text-lg shadow-[0_6px_25px_rgba(254,146,38,0.4)] hover:-translate-y-1 hover:scale-105 hover:shadow-[0_10px_35px_rgba(254,146,38,0.5)] transition-all"
              >
                Inquire About Services
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="py-24 bg-gray-50" aria-labelledby="faq-heading">
          <div className="max-w-[900px] mx-auto px-5">
            <h2 id="faq-heading" className="text-center text-3xl md:text-4xl font-bold text-[#003d5c] mb-16">
              Frequently Asked Questions
            </h2>

            <div className="relative">
              {/* FAQ Card Slider */}
              <div className="overflow-hidden rounded-[24px]">
                {FAQ_CARDS.map((faq, index) => (
                  <div
                    key={index}
                    className={`transition-all duration-500 ${
                      currentFAQSlide === index
                        ? 'opacity-100 relative'
                        : 'opacity-0 absolute inset-0 pointer-events-none'
                    }`}
                  >
                    <div className="bg-gradient-to-br from-[rgba(13,71,97,0.95)] to-[rgba(8,51,68,0.98)] backdrop-blur-xl p-10 md:p-12 rounded-[24px] shadow-[0_8px_30px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] border border-white/10 relative overflow-hidden">
                      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#fe9226] via-[#ffb366] to-[#00b8d4] opacity-80" />
                      <h3 className="text-2xl font-bold bg-gradient-to-br from-[#fe9226] to-[#ffb366] bg-clip-text text-transparent mb-6">
                        {faq.question}
                      </h3>
                      {faq.content}
                    </div>
                  </div>
                ))}
              </div>

              {/* Navigation Arrows */}
              <button
                onClick={() => setCurrentFAQSlide((prev) => (prev - 1 + FAQ_CARDS.length) % FAQ_CARDS.length)}
                aria-label="Previous FAQ"
                className="absolute top-1/2 -translate-y-1/2 -left-4 md:-left-6 w-11 h-11 rounded-full bg-white shadow-lg flex items-center justify-center text-[#fe9226] hover:bg-[#fe9226] hover:text-white hover:scale-110 transition-all z-10"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={() => setCurrentFAQSlide((prev) => (prev + 1) % FAQ_CARDS.length)}
                aria-label="Next FAQ"
                className="absolute top-1/2 -translate-y-1/2 -right-4 md:-right-6 w-11 h-11 rounded-full bg-white shadow-lg flex items-center justify-center text-[#fe9226] hover:bg-[#fe9226] hover:text-white hover:scale-110 transition-all z-10"
              >
                <ChevronRight className="w-6 h-6" />
              </button>

              {/* Dots */}
              <div className="flex gap-3 justify-center mt-6">
                {FAQ_CARDS.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentFAQSlide(index)}
                    aria-label={`FAQ ${index + 1}`}
                    className={`w-3 h-3 rounded-full border-2 transition-all ${
                      currentFAQSlide === index
                        ? 'bg-[#fe9226] border-[#fe9226] scale-[1.3]'
                        : 'bg-gray-300 border-gray-400 hover:bg-gray-400'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 bg-gradient-to-br from-[#003d5c] to-[#002840] text-white text-center relative overflow-hidden" aria-label="Call to action">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(254,146,38,0.15),transparent_70%)]" />
          <div className="max-w-[800px] mx-auto px-5 relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Join Our Team of Caregivers</h2>
            <p className="text-xl opacity-90 mb-10 max-w-[600px] mx-auto">Make a difference in the lives of individuals with special needs in the Antelope Valley</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/jobs" className="inline-block px-10 py-4 bg-gradient-to-br from-[#fe9226] to-[#e67e1a] text-white rounded-full font-semibold text-lg shadow-[0_6px_25px_rgba(254,146,38,0.4)] hover:-translate-y-1 hover:scale-105 hover:shadow-[0_10px_35px_rgba(254,146,38,0.5)] transition-all">
                View Open Positions
              </Link>
              <Link to="/contact" className="inline-block px-10 py-4 bg-white/10 backdrop-blur-sm border-2 border-white/30 text-white rounded-full font-semibold text-lg hover:bg-white/20 hover:-translate-y-1 transition-all">
                Contact Us
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#002840] text-white py-16" role="contentinfo">
        <div className="max-w-[1200px] mx-auto px-5">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div>
              <img src={RTI_LOGO} alt="Road to Independence" className="h-10 mb-4" loading="lazy" />
              <p className="text-white/70 text-sm leading-relaxed">
                Providing quality care and support to individuals with special needs and their families in Lancaster, CA and the Antelope Valley.
              </p>
            </div>

            {/* Services */}
            <div>
              <h3 className="text-[#fe9226] font-semibold mb-4 text-sm uppercase tracking-wider">Services</h3>
              <ul className="space-y-2 text-sm">
                <li><button onClick={() => scrollToSection('services')} className="text-white/70 hover:text-[#fe9226] transition-colors">Independent Living Skills</button></li>
                <li><button onClick={() => scrollToSection('services')} className="text-white/70 hover:text-[#fe9226] transition-colors">Supported Living Skills</button></li>
                <li><button onClick={() => scrollToSection('services')} className="text-white/70 hover:text-[#fe9226] transition-colors">Respite Services</button></li>
                <li><button onClick={() => scrollToSection('services')} className="text-white/70 hover:text-[#fe9226] transition-colors">Coordinated Family Support</button></li>
              </ul>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-[#fe9226] font-semibold mb-4 text-sm uppercase tracking-wider">Quick Links</h3>
              <ul className="space-y-2 text-sm">
                <li><Link to="/contact" className="text-white/70 hover:text-[#fe9226] transition-colors">Contact Us</Link></li>
                <li><Link to="/jobs" className="text-white/70 hover:text-[#fe9226] transition-colors">Careers</Link></li>
                <li><button onClick={() => scrollToSection('faq')} className="text-white/70 hover:text-[#fe9226] transition-colors">FAQ</button></li>
                <li><Link to="/login" className="text-white/70 hover:text-[#fe9226] transition-colors">Staff Portal</Link></li>
              </ul>
            </div>

            {/* Contact Info */}
            <div>
              <h3 className="text-[#fe9226] font-semibold mb-4 text-sm uppercase tracking-wider">Contact</h3>
              <address className="not-italic space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-[#fe9226] mt-0.5 shrink-0" />
                  <span className="text-white/70">45030 Trevor Ave. Suite B<br />Lancaster, CA 93534</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#fe9226] shrink-0" />
                  <a href="tel:661-948-6760" className="text-white/70 hover:text-[#fe9226] transition-colors">661-948-6760</a>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#fe9226] shrink-0" />
                  <a href="mailto:info@roadtoindependence.org" className="text-white/70 hover:text-[#fe9226] transition-colors">info@roadtoindependence.org</a>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#fe9226] shrink-0" />
                  <span className="text-white/70">Mon-Fri 8:00 AM - 5:00 PM</span>
                </div>
              </address>
            </div>
          </div>

          <div className="text-center pt-8 border-t border-white/15 text-white/50 text-sm">
            <p>&copy; {new Date().getFullYear()} Road to Independence. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Custom animations */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

export default LandingPage

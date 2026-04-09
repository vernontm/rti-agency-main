import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, Menu, X, Phone, MapPin, Mail, Clock, Heart, Shield, Users, Home, ArrowRight } from 'lucide-react'
import SitePopup from '../components/SitePopup'

const SUPABASE_STORAGE = 'https://gtfwrcapxsksxkvulull.supabase.co/storage/v1/object/public/website-images'
// TODO: Upload RTI-logo.png to Supabase storage to fix logo
const RTI_LOGO = 'https://vernon-tech-media.s3.us-east-1.amazonaws.com/RTI-agency/logos/RTI-logo.png'
const HERO_SLIDES = [
  `${SUPABASE_STORAGE}/caregiver-client.png`,
  `${SUPABASE_STORAGE}/staff-team.png`
]
const STAFF_IMAGES = [
  `${SUPABASE_STORAGE}/staff-team.png`
]

const FAQ_DATA = [
  {
    question: 'What is an Intellectual Disability?',
    answer: (
      <>
        <p className="text-white/80 leading-relaxed mb-4">
          Intellectual disabilities are a group of conditions due to an impairment in physical, learning, language, or behavior areas. These conditions begin during the developmental period, may impact day-to-day functioning, and usually last throughout a person's lifetime.
        </p>
        <p className="text-white/80 leading-relaxed mb-4">
          A "substantial disability" means the existence of significant functional limitations in three or more of the following areas of major life activity, as determined by a regional center, and as appropriate to the age of the person:
        </p>
        <ul className="space-y-2">
          {['Self-care', 'Receptive and expressive language', 'Learning', 'Mobility', 'Self-direction', 'Capacity for independent living', 'Economic self-sufficiency'].map((item, i) => (
            <li key={i} className="text-white/80 flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#fe9226] mt-2 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </>
    ),
  },
  {
    question: 'What Services Does RTI Provide?',
    answer: (
      <>
        <p className="text-white/80 leading-relaxed mb-4">
          Road to Independence offers a range of services designed to support individuals with developmental disabilities and their families:
        </p>
        <ul className="space-y-3">
          {[
            { title: 'Independent Living Skills (ILS)', desc: 'Training in community integration, home management, budgeting, meal prep, and accessing resources.' },
            { title: 'Supported Living Skills (SLS)', desc: 'Ongoing support for daily living, personal finance management, and community participation.' },
            { title: 'Respite Services', desc: 'Temporary relief for family caregivers while ensuring the safety and care of your loved one.' },
            { title: 'Coordinated Family Support', desc: 'Help navigating services, managing appointments, and following the Individual Program Plan (IPP).' },
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#fe9226] mt-2 shrink-0" />
              <span className="text-white/80">
                <span className="font-semibold text-[#fe9226]">{item.title}</span> — {item.desc}
              </span>
            </li>
          ))}
        </ul>
      </>
    ),
  },
  {
    question: 'How Do I Get Started with RTI?',
    answer: (
      <>
        <p className="text-white/80 leading-relaxed mb-4">
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
            <li key={i} className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#fe9226] mt-2 shrink-0" />
              <span className="text-white/80">{item}</span>
            </li>
          ))}
        </ul>
      </>
    ),
  },
  {
    question: 'What Qualifications Do Your Staff Have?',
    answer: (
      <>
        <p className="text-white/80 leading-relaxed mb-4">
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
            <li key={i} className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#fe9226] mt-2 shrink-0" />
              <span className="text-white/80">{item}</span>
            </li>
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
  const [openFAQ, setOpenFAQ] = useState<number | null>(null)
  const [scrolled, setScrolled] = useState(false)

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

    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      clearInterval(heroInterval)
      clearInterval(staffInterval)
      clearInterval(ilsInterval)
      window.removeEventListener('scroll', handleScroll)
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
    <div className="min-h-screen bg-white overflow-x-hidden">
      <SitePopup />

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
      <nav className={`fixed left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'top-0 bg-white/95 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)]' : 'top-[32px] bg-white/80 backdrop-blur-lg'}`} aria-label="Main navigation">
        <div className="max-w-[1280px] mx-auto px-6 flex justify-between items-center h-[72px]">
          <Link to="/" className="transition-transform hover:scale-105">
            <img src={RTI_LOGO} alt="Road to Independence - Home" className="h-[46px] w-auto" />
          </Link>

          {/* Desktop Navigation */}
          <ul className="hidden md:flex items-center gap-8">
            {[
              { label: 'Services', action: () => scrollToSection('services') },
              { label: 'About', action: () => scrollToSection('about') },
              { label: 'FAQ', action: () => scrollToSection('faq') },
              { label: 'Contact', to: '/contact' },
              { label: 'Careers', to: '/jobs' },
            ].map((item, i) => (
              <li key={i}>
                {item.to ? (
                  <Link to={item.to} className="text-[#003d5c] text-sm font-medium tracking-wide hover:text-[#fe9226] transition-colors">
                    {item.label}
                  </Link>
                ) : (
                  <button onClick={item.action} className="text-[#003d5c] text-sm font-medium tracking-wide hover:text-[#fe9226] transition-colors">
                    {item.label}
                  </button>
                )}
              </li>
            ))}
            <li>
              <Link to="/login" className="bg-[#003d5c] text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-[#002840] transition-all hover:shadow-lg">
                Staff Portal
              </Link>
            </li>
          </ul>

          {/* Mobile menu button */}
          <button className="md:hidden p-2 text-[#003d5c]" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 px-6 py-4 space-y-1 shadow-lg">
            <button onClick={() => scrollToSection('services')} className="block w-full text-left text-[#003d5c] py-3 text-sm font-medium">Services</button>
            <button onClick={() => scrollToSection('about')} className="block w-full text-left text-[#003d5c] py-3 text-sm font-medium">About</button>
            <button onClick={() => scrollToSection('faq')} className="block w-full text-left text-[#003d5c] py-3 text-sm font-medium">FAQ</button>
            <Link to="/contact" className="block w-full text-left text-[#003d5c] py-3 text-sm font-medium">Contact</Link>
            <Link to="/jobs" className="block w-full text-left text-[#003d5c] py-3 text-sm font-medium">Careers</Link>
            <Link to="/login" className="block w-full text-center bg-[#003d5c] text-white px-4 py-3 rounded-lg text-sm font-medium mt-2">
              Staff Portal
            </Link>
          </div>
        )}
      </nav>

      <main>
        {/* Hero Section */}
        <section className="relative h-screen min-h-[700px] max-h-[900px] flex items-center overflow-hidden" aria-label="Hero">
          {/* Hero Slider */}
          <div className="absolute inset-0">
            {HERO_SLIDES.map((slide, index) => (
              <div
                key={index}
                className={`absolute inset-0 transition-opacity duration-[2000ms] ${currentHeroSlide === index ? 'opacity-100' : 'opacity-0'}`}
              >
                <img
                  src={slide}
                  alt={index === 0 ? 'Caregiver helping a child with special needs' : 'Road to Independence care team providing support'}
                  className="w-full h-full object-cover scale-105"
                  loading={index === 0 ? 'eager' : 'lazy'}
                />
              </div>
            ))}
            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#002840]/90 via-[#003d5c]/80 to-[#003d5c]/60" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#002840]/40 via-transparent to-transparent" />
          </div>

          {/* Hero Content */}
          <div className="relative z-10 w-full max-w-[1280px] mx-auto px-6">
            <div className="max-w-[680px]">
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-8 animate-[fadeIn_1s_ease-out]">
                <span className="w-2 h-2 rounded-full bg-[#fe9226] animate-pulse" />
                <span className="text-white/90 text-sm font-medium tracking-wide">Serving the Antelope Valley</span>
              </div>

              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-[1.1] tracking-tight animate-[fadeInUp_0.8s_ease-out]">
                Road to{' '}
                <span className="text-[#fe9226]">Independence</span>
              </h1>
              <p className="text-lg md:text-xl text-white/80 max-w-[540px] mb-10 leading-relaxed animate-[fadeInUp_0.8s_ease-out_0.2s_both]">
                Committed to providing quality service to individuals with special needs through personalized care and professional support.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 animate-[fadeInUp_0.8s_ease-out_0.4s_both]">
                <Link
                  to="/contact"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#fe9226] text-white rounded-lg font-semibold text-base hover:-translate-y-0.5 hover:bg-[#e67e1a] hover:shadow-[0_8px_30px_rgba(254,146,38,0.35)] transition-all"
                >
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <button
                  onClick={() => scrollToSection('services')}
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 backdrop-blur-sm text-white border border-white/25 rounded-lg font-semibold text-base hover:bg-white/20 hover:-translate-y-0.5 transition-all"
                >
                  Our Services
                </button>
              </div>
            </div>
          </div>

          {/* Slider Dots */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-2.5 z-10">
            {HERO_SLIDES.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentHeroSlide(index)}
                aria-label={`Go to slide ${index + 1}`}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  currentHeroSlide === index
                    ? 'bg-[#fe9226] w-8'
                    : 'bg-white/40 w-4 hover:bg-white/60'
                }`}
              />
            ))}
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-10 right-10 hidden lg:flex flex-col items-center gap-2 text-white/40 animate-bounce">
            <span className="text-xs tracking-widest uppercase" style={{ writingMode: 'vertical-lr' }}>Scroll</span>
            <ChevronDown className="w-4 h-4" />
          </div>
        </section>

        {/* Slant divider: hero → mission */}
        <div className="relative h-20 -mt-1 bg-white">
          <svg className="absolute top-0 left-0 w-full h-full" viewBox="0 0 1440 80" preserveAspectRatio="none">
            <polygon points="0,0 1440,80 0,80" fill="white" />
            <polygon points="0,0 1440,0 1440,80" fill="#003d5c" />
          </svg>
        </div>

        {/* Stats / Mission Band */}
        <section className="relative bg-white py-20" aria-label="Our mission">
          <div className="max-w-[1280px] mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div className="animate-on-scroll-in">
                <span className="text-[#fe9226] text-sm font-semibold uppercase tracking-[0.15em] mb-4 block">Our Mission</span>
                <h2 className="text-3xl md:text-4xl font-bold text-[#003d5c] leading-tight mb-6">
                  Empowering individuals to live fuller, more independent lives
                </h2>
                <p className="text-gray-500 text-lg leading-relaxed">
                  We empower individuals with developmental disabilities to live fuller, more independent lives through personalized care, professional support, and a commitment to dignity and respect.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-5">
                {[
                  { icon: Heart, label: 'Personalized Care', value: 'Client-First' },
                  { icon: Shield, label: 'Certified Staff', value: 'CPR & First Aid' },
                  { icon: Users, label: 'Family Support', value: 'Coordinated' },
                  { icon: Home, label: 'Independent Living', value: 'Skills Training' },
                ].map((stat, i) => (
                  <div key={i} className="bg-[#003d5c] rounded-2xl p-6 group hover:bg-gray-100 transition-all duration-300">
                    <stat.icon className="w-6 h-6 text-[#fe9226] mb-4" />
                    <p className="text-white font-bold text-lg group-hover:text-[#003d5c] transition-colors">{stat.value}</p>
                    <p className="text-white/60 text-sm group-hover:text-gray-400 transition-colors">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Slant divider: mission → promise */}
        <div className="relative h-20 -mt-1">
          <svg className="absolute top-0 left-0 w-full h-full" viewBox="0 0 1440 80" preserveAspectRatio="none">
            <polygon points="0,0 1440,0 0,80" fill="white" />
            <polygon points="1440,0 1440,80 0,80" fill="#f0f4f8" />
          </svg>
        </div>

        {/* Promise / About Section */}
        <section id="about" className="py-24 bg-[#f0f4f8] relative overflow-hidden" aria-labelledby="promise-heading">
          <div className="max-w-[1280px] mx-auto px-6 relative z-10">
            <div className="text-center mb-16">
              <span className="text-[#fe9226] text-sm font-semibold uppercase tracking-[0.15em] mb-4 block">Why Choose Us</span>
              <h2 id="promise-heading" className="text-3xl md:text-4xl font-bold text-[#003d5c] mb-4">
                Our Promise To You
              </h2>
              <p className="text-gray-500 text-lg max-w-[600px] mx-auto">You will receive staff who meet the highest standards of care and professionalism.</p>
            </div>

            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Promise Cards */}
              <div className="grid sm:grid-cols-2 gap-5">
                {[
                  { title: 'First Aid & CPR Certified', desc: 'All our staff members are certified in First Aid and CPR to ensure safety and emergency preparedness.', num: '01' },
                  { title: 'Personalized Care', desc: "Provide services with care to fit all of our client's needs with individualized attention.", num: '02' },
                  { title: 'Professional & Responsible', desc: 'Our team maintains the highest standards of professionalism and accountability.', num: '03' },
                  { title: 'Support & Guidance', desc: 'Provide support & guidance to individuals with special needs & their families.', num: '04' }
                ].map((card, i) => (
                  <div key={i} className="bg-[#003d5c] rounded-2xl p-7 shadow-[0_4px_20px_rgba(0,0,0,0.15)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.25)] hover:-translate-y-1 transition-all duration-300 group">
                    <span className="text-4xl font-bold text-[#fe9226]">{card.num}</span>
                    <h3 className="text-white font-bold text-base mt-3 mb-2">{card.title}</h3>
                    <p className="text-white/70 text-sm leading-relaxed">{card.desc}</p>
                  </div>
                ))}
              </div>

              {/* Image Slider */}
              <div className="relative rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.12)] h-[520px]">
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
                  </div>
                ))}

                {/* Arrows */}
                <div className="absolute top-1/2 -translate-y-1/2 w-full flex justify-between px-4 z-10">
                  <button onClick={() => setCurrentStaffSlide((prev) => (prev - 1 + STAFF_IMAGES.length) % STAFF_IMAGES.length)} aria-label="Previous image" className="w-10 h-10 rounded-full bg-white/90 backdrop-blur flex items-center justify-center text-[#003d5c] shadow-lg hover:bg-white hover:scale-110 transition-all">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button onClick={() => setCurrentStaffSlide((prev) => (prev + 1) % STAFF_IMAGES.length)} aria-label="Next image" className="w-10 h-10 rounded-full bg-white/90 backdrop-blur flex items-center justify-center text-[#003d5c] shadow-lg hover:bg-white hover:scale-110 transition-all">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                {/* Dots */}
                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                  {STAFF_IMAGES.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentStaffSlide(index)}
                      aria-label={`Staff image ${index + 1}`}
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        currentStaffSlide === index
                          ? 'bg-white w-6'
                          : 'bg-white/50 w-3 hover:bg-white/70'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Slant divider: promise → services */}
        <div className="relative h-20 -mt-1">
          <svg className="absolute top-0 left-0 w-full h-full" viewBox="0 0 1440 80" preserveAspectRatio="none">
            <polygon points="0,0 1440,80 1440,0" fill="#f0f4f8" />
            <polygon points="0,0 0,80 1440,80" fill="#003d5c" />
          </svg>
        </div>

        {/* Services Section */}
        <section id="services" className="py-24 bg-[#003d5c] relative overflow-hidden" aria-labelledby="services-heading">
          {/* Subtle background pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />

          <div className="max-w-[1280px] mx-auto px-6 relative z-10">
            <div className="text-center mb-16">
              <span className="text-[#fe9226] text-sm font-semibold uppercase tracking-[0.15em] mb-4 block">What We Offer</span>
              <h2 id="services-heading" className="text-3xl md:text-4xl font-bold text-white mb-4">
                Our Services
              </h2>
              <p className="text-white/50 text-lg max-w-[600px] mx-auto">Comprehensive support tailored to each individual's unique needs and goals.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Independent Living Skills */}
              <article className="bg-white/[0.06] backdrop-blur-sm border border-white/10 rounded-2xl p-8 hover:bg-white/[0.1] hover:border-[#fe9226]/30 transition-all duration-300 group">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-[#fe9226]/10 flex items-center justify-center shrink-0 group-hover:bg-[#fe9226]/20 transition-colors">
                    <Home className="w-6 h-6 text-[#fe9226]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">Independent Living Skills</h3>
                    <p className="text-white/40 text-sm">Community integration & home management</p>
                  </div>
                </div>

                <div className="min-h-[220px] relative">
                  <div className={`transition-all duration-500 ${currentILSSlide === 0 ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'}`}>
                    <h4 className="text-[#fe9226] font-semibold text-xs uppercase tracking-[0.15em] mb-4">Community</h4>
                    <ul className="space-y-2.5">
                      {['AFDC', 'Accessing Community Resources', 'DCFS Support', 'Shopping', 'Travel/Transportation', 'Social Security'].map((item, i) => (
                        <li key={i} className="text-white/70 text-sm flex items-center gap-3">
                          <span className="w-1 h-1 rounded-full bg-[#fe9226]" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className={`transition-all duration-500 ${currentILSSlide === 1 ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'}`}>
                    <h4 className="text-[#fe9226] font-semibold text-xs uppercase tracking-[0.15em] mb-4">Home Management</h4>
                    <ul className="space-y-2.5">
                      {['Bill Paying', 'Budgeting', 'Money Management', 'Meal/Menu Preparation', 'Cleaning', 'Locating Suitable Housing'].map((item, i) => (
                        <li key={i} className="text-white/70 text-sm flex items-center gap-3">
                          <span className="w-1 h-1 rounded-full bg-[#fe9226]" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  {[0, 1].map((i) => (
                    <button key={i} onClick={() => setCurrentILSSlide(i)} aria-label={`ILS category ${i + 1}`} className={`h-1 rounded-full transition-all ${currentILSSlide === i ? 'bg-[#fe9226] w-6' : 'bg-white/20 w-3'}`} />
                  ))}
                </div>
              </article>

              {/* Supported Living Skills */}
              <article className="bg-white/[0.06] backdrop-blur-sm border border-white/10 rounded-2xl p-8 hover:bg-white/[0.1] hover:border-[#fe9226]/30 transition-all duration-300 group">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-[#fe9226]/10 flex items-center justify-center shrink-0 group-hover:bg-[#fe9226]/20 transition-colors">
                    <Users className="w-6 h-6 text-[#fe9226]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">Supported Living Skills</h3>
                    <p className="text-white/40 text-sm">Daily living & community participation</p>
                  </div>
                </div>
                <ul className="space-y-3">
                  {['Choosing personal attendants and housemates', 'Acquiring household furnishings', 'Common daily living activities and emergencies', 'Assist in participating in community life', 'Manage personal finances', 'Provide ongoing support'].map((item, i) => (
                    <li key={i} className="text-white/70 text-sm flex items-center gap-3">
                      <span className="w-1 h-1 rounded-full bg-[#fe9226]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>

              {/* Respite Services */}
              <article className="bg-white/[0.06] backdrop-blur-sm border border-white/10 rounded-2xl p-8 hover:bg-white/[0.1] hover:border-[#fe9226]/30 transition-all duration-300 group">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-[#fe9226]/10 flex items-center justify-center shrink-0 group-hover:bg-[#fe9226]/20 transition-colors">
                    <Heart className="w-6 h-6 text-[#fe9226]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">Respite Services</h3>
                    <p className="text-white/40 text-sm">Temporary relief for family caregivers</p>
                  </div>
                </div>
                <ul className="space-y-3">
                  {[
                    'Assisting family members to enable an individual with intellectual disabilities to stay at home',
                    "Providing appropriate care and supervision to protect that person's safety in the absence of a family member(s)",
                    'Relieving family members from the constantly demanding responsibility of providing care'
                  ].map((item, i) => (
                    <li key={i} className="text-white/70 text-sm flex items-start gap-3">
                      <span className="w-1 h-1 rounded-full bg-[#fe9226] mt-2 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>

              {/* Coordinated Family Support */}
              <article className="bg-white/[0.06] backdrop-blur-sm border border-white/10 rounded-2xl p-8 hover:bg-white/[0.1] hover:border-[#fe9226]/30 transition-all duration-300 group">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-[#fe9226]/10 flex items-center justify-center shrink-0 group-hover:bg-[#fe9226]/20 transition-colors">
                    <Shield className="w-6 h-6 text-[#fe9226]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">Coordinated Family Support</h3>
                    <p className="text-white/40 text-sm">Navigate, organize & manage services</p>
                  </div>
                </div>
                <ul className="space-y-3">
                  {[
                    'Help coordinate services and supports',
                    'Assist with planning, organizing, and accessing community resources',
                    'Provide guidance on managing appointments, services, and programs',
                    'Support families in understanding and following the Individual Program Plan (IPP)',
                    'Help reduce stress and improve stability in the home'
                  ].map((item, i) => (
                    <li key={i} className="text-white/70 text-sm flex items-start gap-3">
                      <span className="w-1 h-1 rounded-full bg-[#fe9226] mt-2 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            </div>

            {/* Services CTA */}
            <div className="text-center mt-14">
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 px-8 py-4 bg-[#fe9226] text-white rounded-lg font-semibold hover:-translate-y-0.5 hover:bg-[#e67e1a] hover:shadow-[0_8px_30px_rgba(254,146,38,0.3)] transition-all"
              >
                Inquire About Services
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Slant divider: services → FAQ */}
        <div className="relative h-20 -mt-1">
          <svg className="absolute top-0 left-0 w-full h-full" viewBox="0 0 1440 80" preserveAspectRatio="none">
            <polygon points="0,0 1440,0 0,80" fill="#003d5c" />
            <polygon points="1440,0 1440,80 0,80" fill="white" />
          </svg>
        </div>

        {/* FAQ Section */}
        <section id="faq" className="py-24 bg-white" aria-labelledby="faq-heading">
          <div className="max-w-[800px] mx-auto px-6">
            <div className="text-center mb-16">
              <span className="text-[#fe9226] text-sm font-semibold uppercase tracking-[0.15em] mb-4 block">Got Questions?</span>
              <h2 id="faq-heading" className="text-3xl md:text-4xl font-bold text-[#003d5c]">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="space-y-3">
              {FAQ_DATA.map((faq, index) => (
                <div key={index} className="bg-[#003d5c] rounded-xl overflow-hidden hover:bg-[#004a6e] transition-colors">
                  <button
                    onClick={() => setOpenFAQ(openFAQ === index ? null : index)}
                    className="w-full flex items-center justify-between px-6 py-5 text-left"
                  >
                    <span className="text-white font-semibold pr-4">{faq.question}</span>
                    <ChevronDown className={`w-5 h-5 text-[#fe9226] shrink-0 transition-transform duration-300 ${openFAQ === index ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`transition-all duration-300 ease-in-out overflow-hidden ${openFAQ === index ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="px-6 pb-6">
                      {faq.answer}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 bg-gray-50 relative overflow-hidden" aria-label="Call to action">
          <div className="max-w-[1280px] mx-auto px-6 relative z-10">
            <div className="bg-[#003d5c] rounded-3xl p-12 md:p-16 text-center relative overflow-hidden">
              {/* Pattern */}
              <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
              <div className="absolute top-0 right-0 w-96 h-96 bg-[#fe9226]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

              <div className="relative z-10">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Join Our Team of Caregivers</h2>
                <p className="text-white/60 text-lg mb-10 max-w-[520px] mx-auto">Make a difference in the lives of individuals with special needs in the Antelope Valley.</p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link to="/jobs" className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#fe9226] text-white rounded-lg font-semibold hover:-translate-y-0.5 hover:bg-[#e67e1a] hover:shadow-[0_8px_30px_rgba(254,146,38,0.3)] transition-all">
                    View Open Positions
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link to="/contact" className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 border border-white/20 text-white rounded-lg font-semibold hover:bg-white/20 hover:-translate-y-0.5 transition-all">
                    Contact Us
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#002030] text-white pt-20 pb-8" role="contentinfo">
        <div className="max-w-[1280px] mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-16">
            {/* Brand */}
            <div>
              <img src={RTI_LOGO} alt="Road to Independence" className="h-10 mb-5" loading="lazy" />
              <p className="text-white/40 text-sm leading-relaxed">
                Providing quality care and support to individuals with special needs and their families in Lancaster, CA and the Antelope Valley.
              </p>
            </div>

            {/* Services */}
            <div>
              <h3 className="text-white font-semibold mb-5 text-sm">Services</h3>
              <ul className="space-y-3 text-sm">
                <li><button onClick={() => scrollToSection('services')} className="text-white/40 hover:text-[#fe9226] transition-colors">Independent Living Skills</button></li>
                <li><button onClick={() => scrollToSection('services')} className="text-white/40 hover:text-[#fe9226] transition-colors">Supported Living Skills</button></li>
                <li><button onClick={() => scrollToSection('services')} className="text-white/40 hover:text-[#fe9226] transition-colors">Respite Services</button></li>
                <li><button onClick={() => scrollToSection('services')} className="text-white/40 hover:text-[#fe9226] transition-colors">Coordinated Family Support</button></li>
              </ul>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-white font-semibold mb-5 text-sm">Quick Links</h3>
              <ul className="space-y-3 text-sm">
                <li><Link to="/contact" className="text-white/40 hover:text-[#fe9226] transition-colors">Contact Us</Link></li>
                <li><Link to="/jobs" className="text-white/40 hover:text-[#fe9226] transition-colors">Careers</Link></li>
                <li><button onClick={() => scrollToSection('faq')} className="text-white/40 hover:text-[#fe9226] transition-colors">FAQ</button></li>
                <li><Link to="/login" className="text-white/40 hover:text-[#fe9226] transition-colors">Staff Portal</Link></li>
              </ul>
            </div>

            {/* Contact Info */}
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
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-[#fe9226] shrink-0" />
                  <span className="text-white/40">Mon-Fri 8:00 AM - 5:00 PM</span>
                </div>
              </address>
            </div>
          </div>

          <div className="text-center pt-8 border-t border-white/[0.06] text-white/30 text-xs flex flex-col sm:flex-row items-center justify-between gap-2">
            <p>&copy; {new Date().getFullYear()} Road to Independence. All rights reserved.</p>
            <a href="https://vernontm.com" target="_blank" rel="noopener" className="hover:text-[#fe9226] transition-colors">Built by Vernon Tech &amp; Media</a>
          </div>
        </div>
      </footer>

      {/* Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

export default LandingPage

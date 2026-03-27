import { useState, useEffect } from 'react'
import { X, Megaphone } from 'lucide-react'

interface PopupData {
  id: string
  title: string
  message: string
  delay_seconds: number
  active_from: string | null
  active_until: string | null
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const SitePopup = () => {
  const [popup, setPopup] = useState<PopupData | null>(null)
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const fetchPopup = async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/site_popups?select=id,title,message,delay_seconds,active_from,active_until&is_visible=eq.true`,
          {
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
          }
        )
        if (!res.ok) return
        const allPopups: PopupData[] = await res.json()
        if (!allPopups?.length) return

        const now = new Date()
        const active = allPopups.find((p) => {
          const from = p.active_from ? new Date(p.active_from) : null
          const until = p.active_until ? new Date(p.active_until) : null
          return (!from || now >= from) && (!until || now <= until)
        })

        if (active) {
          const dismissedId = sessionStorage.getItem('dismissed_popup')
          if (dismissedId === active.id) return

          setPopup(active)
          const delay = (active.delay_seconds || 0) * 1000
          setTimeout(() => setVisible(true), delay)
        }
      } catch (e) {
        console.error('SitePopup fetch error:', e)
      }
    }

    fetchPopup()
  }, [])

  const handleDismiss = () => {
    setVisible(false)
    setDismissed(true)
    if (popup) {
      sessionStorage.setItem('dismissed_popup', popup.id)
    }
  }

  if (!popup || dismissed) return null

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleDismiss}
      />

      <div
        className={`relative bg-white rounded-2xl shadow-2xl max-w-lg w-full transform transition-all duration-300 ${
          visible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        }`}
      >
        <div className="bg-gradient-to-r from-[#003d5c] to-[#002840] rounded-t-2xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#fe9226]/20 rounded-full flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-[#fe9226]" />
            </div>
            <h2 className="text-xl font-bold text-white">{popup.title}</h2>
          </div>
          <button
            onClick={handleDismiss}
            className="text-white/70 hover:text-white transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-6">
          <div className="text-gray-700 leading-relaxed whitespace-pre-line">
            {popup.message}
          </div>
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={handleDismiss}
            className="w-full py-3 bg-gradient-to-r from-[#fe9226] to-[#e67e1a] text-white rounded-xl font-semibold hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#fe9226]/30 transition-all"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}

export default SitePopup

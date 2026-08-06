import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'

declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement, opts: unknown) => YTPlayerInstance
      PlayerState: { ENDED: number; PLAYING: number; PAUSED: number }
    }
    onYouTubeIframeAPIReady?: () => void
  }
}

interface YTPlayerInstance {
  playVideo?: () => void
  pauseVideo?: () => void
  seekTo?: (seconds: number, allowSeekAhead: boolean) => void
  getCurrentTime?: () => number
  getDuration?: () => number
  destroy?: () => void
}

interface Props {
  videoId: string
  title: string
  onEnded: () => void
  onPlaybackTime: (seconds: number) => void
  allowSkip: boolean
  onSkipBlocked?: () => void
}

export interface YouTubePlayerHandle {
  play: () => void
  pause: () => void
}

let apiLoadPromise: Promise<void> | null = null

const loadYouTubeAPI = (): Promise<void> => {
  if (window.YT?.Player) return Promise.resolve()
  if (apiLoadPromise) return apiLoadPromise
  apiLoadPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve()
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    document.head.appendChild(script)
  })
  return apiLoadPromise
}

const YouTubePlayer = forwardRef<YouTubePlayerHandle, Props>(function YouTubePlayer(
  { videoId, title, onEnded, onPlaybackTime, allowSkip, onSkipBlocked },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayerInstance | null>(null)
  const maxTimeRef = useRef(0)
  const lastReportedRef = useRef(0)
  const pollTimerRef = useRef<number | null>(null)
  const propsRef = useRef({ onEnded, onPlaybackTime, allowSkip, onSkipBlocked })
  propsRef.current = { onEnded, onPlaybackTime, allowSkip, onSkipBlocked }

  useImperativeHandle(ref, () => ({
    play: () => playerRef.current?.playVideo?.(),
    pause: () => playerRef.current?.pauseVideo?.(),
  }))

  useEffect(() => {
    let cancelled = false
    let stopPolling = () => {}

    loadYouTubeAPI().then(() => {
      if (cancelled || !containerRef.current || !window.YT) return

      const startPolling = () => {
        if (pollTimerRef.current) return
        pollTimerRef.current = window.setInterval(() => {
          const p = playerRef.current
          if (!p?.getCurrentTime) return
          const t = p.getCurrentTime()
          const { allowSkip: skipAllowed, onSkipBlocked: skipCb, onPlaybackTime: cb } = propsRef.current
          if (!skipAllowed && t > maxTimeRef.current + 2) {
            p.seekTo?.(maxTimeRef.current, true)
            skipCb?.()
            return
          }
          if (t > maxTimeRef.current) maxTimeRef.current = t
          if (Math.abs(t - lastReportedRef.current) >= 0.5) {
            lastReportedRef.current = t
            cb(t)
          }
        }, 500)
      }
      stopPolling = () => {
        if (pollTimerRef.current) {
          window.clearInterval(pollTimerRef.current)
          pollTimerRef.current = null
        }
      }

      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 1,
          rel: 0,
          modestbranding: 1,
          disablekb: 1,
          controls: 1,
        },
        events: {
          onStateChange: (e: { data: number }) => {
            const YT = window.YT!
            if (e.data === YT.PlayerState.PLAYING) {
              startPolling()
            } else {
              stopPolling()
            }
            if (e.data === YT.PlayerState.ENDED) {
              propsRef.current.onEnded()
            }
          },
        },
      })
    })

    return () => {
      cancelled = true
      stopPolling()
      try {
        playerRef.current?.destroy?.()
      } catch {
        // ignore destroy errors
      }
      playerRef.current = null
    }
  }, [videoId])

  return (
    <div className="w-full h-full">
      <div ref={containerRef} className="w-full h-full" aria-label={title} />
    </div>
  )
})

export default YouTubePlayer

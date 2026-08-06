import { useEffect, useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import type { Tables } from '../types/database.types'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { Play, CheckCircle, Clock, Award, X, ChevronDown, ChevronRight, BookOpen, Lock, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import VideoQuiz from '../components/training/VideoQuiz'
import YouTubePlayer, { type YouTubePlayerHandle } from '../components/training/YouTubePlayer'
import { getYouTubeId, getVimeoId } from '../utils/videoUrl'
// Using native HTML5 video element instead of ReactPlayer for better Supabase storage compatibility

interface VideoProgress {
  user_id: string
  video_id: string
  progress_seconds: number
  completed: boolean
  completed_at: string | null
  quiz_score: number | null
  quiz_passed: boolean | null
}

interface VideoWithProgress extends Tables<'videos'> {
  video_progress?: VideoProgress[]
}

interface CourseModule {
  name: string
  videos: VideoWithProgress[]
  completedCount: number
  totalCount: number
  isExpanded: boolean
}

const TrainingPage = () => {
  const { t } = useTranslation()
  const { profile } = useAuthStore()
  const [videos, setVideos] = useState<VideoWithProgress[]>([])
  const [modules, setModules] = useState<CourseModule[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVideo, setSelectedVideo] = useState<VideoWithProgress | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [showEngagementCheck, setShowEngagementCheck] = useState(false)
  const [engagementInterval, setEngagementInterval] = useState(90) // Default 90 seconds
  const [allowSkip, setAllowSkip] = useState(false)
  const [showQuiz, setShowQuiz] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [videoLoading, setVideoLoading] = useState(false)
  const playerRef = useRef<HTMLVideoElement>(null)
  const youtubePlayerRef = useRef<YouTubePlayerHandle>(null)
  const lastCheckInRef = useRef(0)
  const maxSeekTimeRef = useRef(0)

  useEffect(() => {
    fetchVideos()
    fetchVideoSettings()
  }, [])

  // Reset engagement check when selecting a new video
  useEffect(() => {
    if (selectedVideo) {
      lastCheckInRef.current = 0
      maxSeekTimeRef.current = 0
      setShowEngagementCheck(false)
      setPlaying(true) // Auto-play when video is selected
      setVideoError(null)
      setVideoLoading(true)
    }
  }, [selectedVideo])

  const fetchVideoSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('video_settings')
        .select('*')
        .in('key', ['engagement_check_interval', 'allow_skip'])

      if (error) throw error
      for (const row of (data as { key: string; value: { seconds?: number; enabled?: boolean } }[] | null) || []) {
        if (row.key === 'engagement_check_interval' && typeof row.value?.seconds === 'number') {
          setEngagementInterval(row.value.seconds)
        }
        if (row.key === 'allow_skip' && typeof row.value?.enabled === 'boolean') {
          setAllowSkip(row.value.enabled)
        }
      }
    } catch (error) {
      console.error('Error fetching video settings:', error)
    }
  }

  // Helper function to check if video is completed - defined before useEffect that uses it
  const isVideoCompleted = useCallback((video: VideoWithProgress) => {
    const userProgress = video.video_progress?.find(p => p.user_id === profile?.id)
    return userProgress?.completed || false
  }, [profile])

  // Helper function to get quiz score for a video
  const getQuizScore = useCallback((video: VideoWithProgress) => {
    const userProgress = video.video_progress?.find(p => p.user_id === profile?.id)
    return {
      score: userProgress?.quiz_score ?? null,
      passed: userProgress?.quiz_passed ?? null
    }
  }, [profile])

  // Group videos into modules by category
  useEffect(() => {
    if (videos.length === 0) return

    const categoryMap = new Map<string, VideoWithProgress[]>()

    videos.forEach(video => {
      const category = video.category || t('training.generalCategory')
      if (!categoryMap.has(category)) {
        categoryMap.set(category, [])
      }
      categoryMap.get(category)!.push(video)
    })

    const newModules: CourseModule[] = Array.from(categoryMap.entries()).map(([name, vids]) => {
      const completedCount = vids.filter(v => isVideoCompleted(v)).length
      return {
        name,
        videos: vids,
        completedCount,
        totalCount: vids.length,
        isExpanded: true, // Start expanded
      }
    })

    setModules(newModules)
  }, [videos, profile, isVideoCompleted, t])

  const fetchVideos = async () => {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select(`
          *,
          video_progress (*)
        `)
        .eq('is_published', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })

      if (error) throw error
      setVideos(data || [])
    } catch (error) {
      console.error('Error fetching videos:', error)
      toast.error(t('training.loadError'))
    } finally {
      setLoading(false)
    }
  }

  const handleProgress = useCallback((state: { playedSeconds: number }) => {
    const currentTime = state.playedSeconds
    setProgress(currentTime)

    // Use engagement interval from settings (default 90 seconds)
    if (engagementInterval > 0 && currentTime - lastCheckInRef.current >= engagementInterval) {
      lastCheckInRef.current = currentTime
      setShowEngagementCheck(true)
      setPlaying(false)
      // Pause whichever player is active
      playerRef.current?.pause()
      youtubePlayerRef.current?.pause()
      // Exit fullscreen if active so user can see the prompt
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => { /* ignore fullscreen exit errors */ })
      }
    }
  }, [engagementInterval])

  const handleSkipBlocked = useCallback(() => {
    toast.error(t('training.skipDisabled'), { id: 'skip-disabled', duration: 3000 })
  }, [t])

  const handleEngagementResponse = async () => {
    if (!selectedVideo || !profile) return

    try {
      await supabase.from('engagement_checkins').insert({
        user_id: profile.id,
        video_id: selectedVideo.id,
        timestamp_seconds: Math.floor(progress),
        responded: true,
        response_time_ms: 1000,
      })

      setShowEngagementCheck(false)
      setPlaying(true)
      // Resume whichever player is active
      playerRef.current?.play()
      youtubePlayerRef.current?.play()
      toast.success(t('training.stillWatchingThanks'))
    } catch (error) {
      console.error('Error recording check-in:', error)
    }
  }

  const handleVideoEnd = async () => {
    if (!selectedVideo || !profile) return

    try {
      // First update progress to mark video as watched
      await supabase
        .from('video_progress')
        .upsert({
          user_id: profile.id,
          video_id: selectedVideo.id,
          progress_seconds: selectedVideo.duration_seconds,
          completed: true,
          completed_at: new Date().toISOString(),
        }, { onConflict: 'user_id,video_id' })

      // Show quiz if available
      setShowQuiz(true)
    } catch (error) {
      console.error('Error marking video complete:', error)
    }
  }

  const handleQuizComplete = (passed: boolean, score: number) => {
    setShowQuiz(false)
    if (passed) {
      toast.success(t('training.quizPassedToast', { score }))
    }
    fetchVideos()
    setSelectedVideo(null)
  }

  const getVideoProgress = (video: VideoWithProgress) => {
    const userProgress = video.video_progress?.find(p => p.user_id === profile?.id)
    if (!userProgress) return 0
    return Math.round((userProgress.progress_seconds / video.duration_seconds) * 100)
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-live="polite">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="sr-only">{t('common.loadingSr')}</span>
      </div>
    )
  }

  const toggleModule = (moduleName: string) => {
    setModules(prev => prev.map(m =>
      m.name === moduleName ? { ...m, isExpanded: !m.isExpanded } : m
    ))
  }

  const getOverallProgress = () => {
    const totalVideos = videos.length
    const completedVideos = videos.filter(v => isVideoCompleted(v)).length
    return totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : 0
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('training.title')}</h1>
          <p className="text-gray-600 mt-1">{t('training.subtitle')}</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500">{t('training.overallProgress')}</div>
          <div className="text-2xl font-bold text-blue-600">{getOverallProgress()}%</div>
        </div>
      </div>

      {/* Overall Progress Bar */}
      <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-500"
          style={{ width: `${getOverallProgress()}%` }}
        />
      </div>

      {/* Course Modules */}
      <div className="space-y-4">
        {modules.map((module) => (
          <Card key={module.name} padding="none" className="overflow-hidden">
            {/* Module Header */}
            <button
              onClick={() => toggleModule(module.name)}
              aria-expanded={module.isExpanded}
              aria-controls={`module-panel-${module.name.replace(/\s+/g, '-').toLowerCase()}`}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${module.completedCount === module.totalCount ? 'bg-green-100' : 'bg-blue-100'}`}>
                  <BookOpen className={`w-5 h-5 ${module.completedCount === module.totalCount ? 'text-green-600' : 'text-blue-600'}`} />
                </div>
                <div className="text-left">
                  <h2 className="font-semibold text-gray-900">{module.name}</h2>
                  <p className="text-sm text-gray-500">
                    {t('training.videosCompleted', { completed: module.completedCount, total: module.totalCount })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {module.completedCount === module.totalCount && (
                  <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                    <CheckCircle className="w-4 h-4" />
                    {t('training.moduleComplete')}
                  </span>
                )}
                <div className="w-24 bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${module.completedCount === module.totalCount ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${(module.completedCount / module.totalCount) * 100}%` }}
                  />
                </div>
                {module.isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </button>

            {/* Module Videos */}
            {module.isExpanded && (
              <div id={`module-panel-${module.name.replace(/\s+/g, '-').toLowerCase()}`} className="border-t border-gray-100">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                  {module.videos.map((video, index) => {
                    const progressPercent = getVideoProgress(video)
                    const completed = isVideoCompleted(video)
                    const quizResult = getQuizScore(video)
                    const previousCompleted = index === 0 || isVideoCompleted(module.videos[index - 1])
                    const isLocked = video.is_required && !previousCompleted && index > 0

                    return (
                      <div
                        key={video.id}
                        className={`relative rounded-lg border ${isLocked ? 'opacity-60 border-gray-200' : 'border-gray-200 hover:border-blue-300'} overflow-hidden transition-all`}
                      >
                        <div className="relative aspect-video bg-gray-200">
                          {video.thumbnail_url ? (
                            <img
                              src={video.thumbnail_url}
                              alt={video.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
                              <Play className="w-12 h-12 text-white opacity-80" />
                            </div>
                          )}
                          {completed && (
                            <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              {t('training.doneBadge')}
                            </div>
                          )}
                          {isLocked && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <Lock className="w-8 h-8 text-white" />
                            </div>
                          )}
                          {/* Video number badge */}
                          <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-medium">
                            {index + 1}
                          </div>
                        </div>
                        <div className="p-3">
                          <h3 className="font-medium text-gray-900 text-sm mb-1 line-clamp-1">{video.title}</h3>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDuration(video.duration_seconds)}
                            </span>
                            {progressPercent > 0 && !completed && (
                              <span className="text-xs text-blue-600">{progressPercent}%</span>
                            )}
                          </div>
                          {/* Quiz Score Display */}
                          {quizResult.score !== null && (
                            <div className={`flex items-center gap-1 mb-2 text-xs font-medium ${
                              quizResult.passed ? 'text-green-600' : 'text-orange-600'
                            }`}>
                              <Award className="w-3 h-3" />
                              {t('training.quizLabel', { score: quizResult.score })}
                              {quizResult.passed ? (
                                <span className="ml-1 text-green-600">✓ {t('training.quizPassed')}</span>
                              ) : (
                                <span className="ml-1 text-orange-600">- {t('training.quizRetry')}</span>
                              )}
                            </div>
                          )}
                          {progressPercent > 0 && !completed && (
                            <div className="h-1 bg-gray-200 rounded-full mb-2 overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full transition-all"
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                          )}
                          <Button
                            className="w-full"
                            size="sm"
                            variant={completed ? 'outline' : 'primary'}
                            onClick={() => !isLocked && setSelectedVideo(video)}
                            disabled={isLocked}
                          >
                            {isLocked ? (
                              <>
                                <Lock className="w-3 h-3 mr-1" />
                                {t('training.locked')}
                              </>
                            ) : (
                              <>
                                <Play className="w-3 h-3 mr-1" />
                                {completed ? t('training.rewatch') : progressPercent > 0 ? t('training.continue') : t('training.start')}
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </Card>
        ))}

        {modules.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-500">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{t('training.noCoursesAvailable')}</p>
          </div>
        )}
      </div>

      {selectedVideo && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 overflow-y-auto" onKeyDown={(e) => { if (e.key === 'Escape') { setSelectedVideo(null); setPlaying(false); setShowQuiz(false); } }}>
          <div className="w-full max-w-4xl p-4" role="dialog" aria-modal="true" aria-labelledby="video-player-title">
            <div className="flex items-center justify-between mb-4">
              <h2 id="video-player-title" className="text-xl font-bold text-white">{selectedVideo.title}</h2>
              <button
                onClick={() => {
                  setSelectedVideo(null)
                  setPlaying(false)
                  setShowQuiz(false)
                }}
                className="p-2 text-white hover:bg-white/10 rounded-lg"
                aria-label={t('training.closeVideoPlayer')}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {showQuiz ? (
              <VideoQuiz
                videoId={selectedVideo.id}
                videoTitle={selectedVideo.title}
                onComplete={handleQuizComplete}
              />
            ) : (
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                {(() => {
                  const ytId = getYouTubeId(selectedVideo.video_url)
                  const vimeoId = getVimeoId(selectedVideo.video_url)
                  const isEmbed = !!(ytId || vimeoId)

                  if (!selectedVideo.video_url) {
                    return (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6 text-center">
                        <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
                        <h3 className="text-lg font-semibold mb-2">{t('training.noVideoFileTitle')}</h3>
                        <p className="text-sm text-gray-300 max-w-md">
                          {t('training.noVideoFileBody')}
                        </p>
                      </div>
                    )
                  }

                  // YouTube embed via IFrame Player API (real end-detection, skip prevention, engagement timing)
                  if (ytId) {
                    return (
                      <YouTubePlayer
                        ref={youtubePlayerRef}
                        videoId={ytId}
                        title={selectedVideo.title}
                        onEnded={handleVideoEnd}
                        onPlaybackTime={(t) => handleProgress({ playedSeconds: t })}
                        allowSkip={allowSkip}
                        onSkipBlocked={handleSkipBlocked}
                      />
                    )
                  }

                  // Vimeo embed — no player-API integration yet, so engagement/skip aren't enforced.
                  // TODO: swap for @vimeo/player when a Vimeo video is added.
                  if (vimeoId) {
                    return (
                      <iframe
                        src={`https://player.vimeo.com/video/${vimeoId}?autoplay=1`}
                        className="w-full h-full"
                        title={selectedVideo.title}
                        allow="autoplay; fullscreen; picture-in-picture"
                        allowFullScreen
                      />
                    )
                  }

                  // Direct video file fallthrough — handled by the legacy branches below
                  return null
                })()}

                {/* Direct file player branches (only render when NOT a YouTube/Vimeo URL) */}
                {selectedVideo.video_url && !getYouTubeId(selectedVideo.video_url) && !getVimeoId(selectedVideo.video_url) && (videoError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6 text-center">
                    <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
                    <h3 className="text-lg font-semibold mb-2">{t('training.cannotLoadVideoTitle')}</h3>
                    <p className="text-sm text-gray-300 max-w-md mb-2">{videoError}</p>
                    <p className="text-xs text-gray-400 max-w-md mb-4 break-all">{t('training.urlLabel', { url: selectedVideo.video_url })}</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setVideoError(null)
                          setVideoLoading(true)
                          playerRef.current?.load()
                        }}
                      >
                        {t('training.retry')}
                      </Button>
                      <a
                        href={selectedVideo.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-white/10 text-white rounded-lg hover:bg-white/20"
                      >
                        {t('training.openUrlDirectly')}
                      </a>
                    </div>
                  </div>
                ) : (
                  <>
                    <video
                      ref={playerRef}
                      src={selectedVideo.video_url}
                      className="w-full h-full"
                      controls
                      autoPlay
                      playsInline
                      onLoadStart={() => { setVideoLoading(true); setVideoError(null) }}
                      onCanPlay={() => setVideoLoading(false)}
                      onError={(e) => {
                        setVideoLoading(false)
                        const v = e.currentTarget
                        const err = v.error
                        let msg = t('training.videoErrorGeneric')
                        if (err) {
                          switch (err.code) {
                            case 1: msg = t('training.videoErrorAborted'); break
                            case 2: msg = t('training.videoErrorNetwork'); break
                            case 3: msg = t('training.videoErrorCorrupt'); break
                            case 4: msg = t('training.videoErrorFormat'); break
                          }
                        }
                        console.error('Video error:', err, 'URL:', selectedVideo.video_url)
                        setVideoError(msg)
                      }}
                      onTimeUpdate={(e) => {
                        const video = e.target as HTMLVideoElement
                        const currentTime = video.currentTime
                        // Enforce skip prevention here as well. The order of the timeupdate
                        // and seeking events is not guaranteed, so a forward scrub can reach
                        // this handler first. If we advanced the high-water mark below, the
                        // onSeeking clamp would be defeated and the viewer could skip ahead.
                        if (!allowSkip && currentTime > maxSeekTimeRef.current + 2) {
                          video.currentTime = maxSeekTimeRef.current
                          handleSkipBlocked()
                          return
                        }
                        if (currentTime > maxSeekTimeRef.current) {
                          maxSeekTimeRef.current = currentTime
                        }
                        handleProgress({ playedSeconds: currentTime })
                      }}
                      onSeeking={(e) => {
                        if (allowSkip) return
                        const video = e.target as HTMLVideoElement
                        if (video.currentTime > maxSeekTimeRef.current + 2) {
                          video.currentTime = maxSeekTimeRef.current
                          handleSkipBlocked()
                        }
                      }}
                      onEnded={handleVideoEnd}
                      onPlay={() => setPlaying(true)}
                      onPause={() => setPlaying(false)}
                    />
                    {videoLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white"></div>
                      </div>
                    )}
                  </>
                ))}

                {showEngagementCheck && (
                  <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                    <Card className="text-center max-w-sm">
                      <Award className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                      <h3 className="text-xl font-bold text-gray-900 mb-2">
                        {t('training.stillWatchingTitle')}
                      </h3>
                      <p className="text-gray-600 mb-4">
                        {t('training.stillWatchingBody')}
                      </p>
                      <Button onClick={handleEngagementResponse} className="w-full">
                        {t('training.stillWatchingButton')}
                      </Button>
                    </Card>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default TrainingPage

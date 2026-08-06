export const getYouTubeId = (url: string | null | undefined): string | null => {
  if (!url) return null
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/v\/)([\w-]{11})/,
    /youtube\.com\/.*[?&]v=([\w-]{11})/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m && m[1]) return m[1]
  }
  return null
}

export const getVimeoId = (url: string | null | undefined): string | null => {
  if (!url) return null
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  return m ? m[1] : null
}

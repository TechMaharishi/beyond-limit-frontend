import { useEffect, useRef } from 'react'
import Hls from 'hls.js'

type Props = {
  hlsUrl?: string
  mp4Url?: string
  vttUrl?: string
  controls?: boolean
  className?: string
  onError?: (e: unknown) => void
  onReady?: () => void
}

export default function HlsVideo({
  hlsUrl,
  mp4Url,
  vttUrl,
  controls = true,
  className,
  onError,
  onReady
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  // Track whether we already triggered a native-level error so we don't
  // call onError again when HLS itself falls back to MP4 (which triggers load()).
  const errorFiredRef = useRef(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let hls: Hls | null = null
    errorFiredRef.current = false

    const setup = async () => {
      try {
        if (hlsUrl && Hls.isSupported()) {
          hls = new Hls({ lowLatencyMode: true, backBufferLength: 90 })
          hls.loadSource(hlsUrl)
          hls.attachMedia(video)
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (onReady) onReady()
          })
          hls.on(Hls.Events.ERROR, (_, data) => {
            // Only act on fatal errors — non-fatal are recovered automatically by hls.js
            if ((data as any)?.fatal) {
              if (mp4Url) {
                try {
                  hls?.destroy()
                  hls = null
                } catch {}
                // Fallback to MP4 — suppress the native 'error' event that src change triggers
                errorFiredRef.current = true
                video.src = mp4Url
                video.load()
                // Re-enable native error reporting after fallback settles
                setTimeout(() => { errorFiredRef.current = false }, 1000)
              } else {
                // No MP4 fallback available — report to caller
                if (onError && !errorFiredRef.current) {
                  errorFiredRef.current = true
                  onError(data)
                }
              }
            }
          })
          return
        }
        if (hlsUrl && video.canPlayType('application/vnd.apple.mpegurl')) {
          // Safari native HLS support
          video.src = hlsUrl
          return
        }
        if (mp4Url) {
          video.src = mp4Url
        }
      } catch (e) {
        if (onError) onError(e)
      }
    }

    setup()

    const handleError = () => {
      // Only forward native video errors if not caused by our own MP4 fallback swap
      if (onError && !errorFiredRef.current) {
        onError(new Error('Video playback error'))
      }
    }
    const handleLoaded = () => {
      if (onReady) onReady()
    }

    video.addEventListener('error', handleError)
    video.addEventListener('loadedmetadata', handleLoaded)

    return () => {
      video.removeEventListener('error', handleError)
      video.removeEventListener('loadedmetadata', handleLoaded)
      if (hls) {
        hls.destroy()
        hls = null
      }
    }
  }, [hlsUrl, mp4Url, onError, onReady])

  // Dynamically manage the subtitle track via the DOM API.
  // We cannot rely on React JSX <track> re-renders alone because browsers
  // freeze the TextTrack list after media load — tracks added later via JSX
  // are not always honoured. Programmatic addTextTrack + addCue is the only
  // reliable cross-browser approach.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (!vttUrl) {
      // Remove all subtitle tracks when URL is cleared
      const existing = Array.from(video.textTracks)
      if (existing.length > 0) {
        // We can only hide tracks, not remove them from the TextTrackList API
        existing.forEach(t => { t.mode = 'disabled' })
      }
      return
    }

    const applyTrack = () => {
      try {
        // Look for an existing <track> element with our URL and make it 'showing'
        const trackEls = Array.from(video.querySelectorAll('track'))
        const match = trackEls.find(el => el.src === vttUrl || el.getAttribute('src') === vttUrl)
        if (match && match.track) {
          // Disable all other tracks first
          Array.from(video.textTracks).forEach(t => { t.mode = 'disabled' })
          match.track.mode = 'showing'
          return
        }

        // Remove any old programmatic subtitle tracks we injected
        const oldEl = video.querySelector('track[data-dynamic="1"]')
        if (oldEl) video.removeChild(oldEl)

        // Inject a fresh <track> element pointing to the new VTT
        const trackEl = document.createElement('track')
        trackEl.kind = 'subtitles'
        trackEl.label = 'English'
        trackEl.srclang = 'en'
        trackEl.src = vttUrl
        trackEl.default = true
        trackEl.setAttribute('data-dynamic', '1')
        video.appendChild(trackEl)

        // Wait a tick then set mode to 'showing' (browsers need the DOM settled)
        setTimeout(() => {
          try {
            Array.from(video.textTracks).forEach(t => { t.mode = 'disabled' })
            const newTrack = Array.from(video.textTracks).find(
              t => t.label === 'English' || t.language === 'en'
            )
            if (newTrack) newTrack.mode = 'showing'
          } catch {}
        }, 200)
      } catch {}
    }

    // Apply immediately and also after metadata is ready
    applyTrack()
    video.addEventListener('loadedmetadata', applyTrack)
    video.addEventListener('canplay', applyTrack)

    return () => {
      video.removeEventListener('loadedmetadata', applyTrack)
      video.removeEventListener('canplay', applyTrack)
    }
  }, [vttUrl])

  return (
    <video
      ref={videoRef}
      className={className}
      controls={controls}
      crossOrigin="anonymous"
      preload="metadata"
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      {/* Render the track in JSX as a static hint; dynamic management is via useEffect above */}
      {vttUrl ? (
        <track
          kind="subtitles"
          src={vttUrl}
          srcLang="en"
          label="English"
          default
        />
      ) : null}
    </video>
  )
}

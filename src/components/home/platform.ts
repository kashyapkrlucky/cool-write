import type { ReleaseTarget } from '../../server/services/releases'

export type DetectedPlatform = 'mac' | 'windows' | 'linux' | 'mobile' | null

type NavigatorWithUAData = Navigator & {
  userAgentData?: {
    platform?: string
    mobile?: boolean
    getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string }>
  }
}

// Mobile first: iPadOS/iOS report "Mac"-like strings and Android reports "Linux".
export function detectPlatform(): DetectedPlatform {
  if (typeof navigator === 'undefined') return null
  const nav = navigator as NavigatorWithUAData
  const ua = nav.userAgent || ''
  if (nav.userAgentData?.mobile || /Android|iPhone|iPad|iPod/i.test(ua)) return 'mobile'
  // iPadOS 13+ pretends to be a Mac; touch support gives it away.
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return 'mobile'
  const platform = nav.userAgentData?.platform || ua
  if (/Mac/i.test(platform)) return 'mac'
  if (/Win/i.test(platform)) return 'windows'
  if (/Linux/i.test(platform)) return 'linux'
  return null
}

// Chromium browsers can report the CPU architecture; Safari and Firefox can't,
// in which case Apple Silicon is the likelier Mac (all Macs sold since 2021).
export async function detectRecommendedTarget(): Promise<ReleaseTarget | null> {
  const platform = detectPlatform()
  if (platform === 'windows') return 'win-x64'
  if (platform !== 'mac') return null
  const nav = navigator as NavigatorWithUAData
  try {
    const { architecture } = (await nav.userAgentData?.getHighEntropyValues?.(['architecture'])) ?? {}
    if (architecture === 'x86') return 'mac-x64'
  } catch {
    // Hint unavailable — fall through to the default.
  }
  return 'mac-arm64'
}

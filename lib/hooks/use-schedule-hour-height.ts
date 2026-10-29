"use client"

import { useSyncExternalStore } from "react"

const query = "(pointer: coarse)"
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(query)
  media.addEventListener("change", notify)
  return () => media.removeEventListener("change", notify)
}

// Leave room for borders around four targets of at least 44px on touch screens.
export function useScheduleHourHeight() {
  const touch = useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false)
  return touch ? 180 : 76
}

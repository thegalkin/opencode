import type { TuiConfig } from "../config"

export type TimestampsMode = "hide" | "footer" | "gutter"

export const TIMESTAMPS_MODES: readonly TimestampsMode[] = ["hide", "footer", "gutter"] as const

export function getTimestampsMode(tuiConfig?: Pick<TuiConfig.Info, "timestamps_mode">): TimestampsMode {
  return tuiConfig?.timestamps_mode ?? "hide"
}

// Cycles in display-priority order so the slash command feels predictable:
// hide → footer → gutter → hide.
export function nextTimestampsMode(current: TimestampsMode): TimestampsMode {
  const i = TIMESTAMPS_MODES.indexOf(current)
  return TIMESTAMPS_MODES[(i + 1) % TIMESTAMPS_MODES.length]
}

// Normalize legacy KV values: an existing user toggled "show" before this
// change shipped — preserve their intent by mapping it to "footer".
export function normalizeTimestampsMode(value: unknown, fallback: TimestampsMode): TimestampsMode {
  if (value === "show") return "footer"
  if (value === "hide" || value === "footer" || value === "gutter") return value
  return fallback
}

// "HH:MM:SS" 24-hour, locale-independent. Used by the message timestamp popup.
// Format chosen to match the user's preference: DD-MM-YYYY HH:MM:SS in full
// form, HH:MM:SS for the inline (gutter) rendering. Locale-independent so the
// column stays aligned across en-US (12h) and en-GB (24h) users; also side-steps
// opencode#28804 (Bun ignores system locale → spurious AM/PM on Linux).
function pad(n: number): string {
  return String(n).padStart(2, "0")
}

// Fixed 5-cell "HH:MM" in the user's local timezone, 24-hour.
export function hourMinute(input: number): string {
  const date = new Date(input)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// "HH:MM:SS" 24-hour, locale-independent.
export function hourMinuteSecond(input: number): string {
  const date = new Date(input)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

// "DD-MM-YYYY HH:MM:SS" — full local datetime used in the popup dialog.
// User-facing format choice (Russian/European date order with seconds).
export function dayMonthYearHourMinuteSecond(input: number): string {
  const date = new Date(input)
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${hourMinuteSecond(input)}`
}

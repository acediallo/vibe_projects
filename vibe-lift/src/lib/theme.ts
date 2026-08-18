// Single dark theme — personal app, keep it simple.
export const theme = {
  bg: '#0b1120',
  bgElevated: '#111a2e',
  bgCard: '#152036',
  bgInput: '#1a253d',
  border: '#243352',
  text: '#e6edf7',
  textDim: '#8b9bb8',
  textFaint: '#5c6b85',
  accent: '#0ea5e9',
  accentDim: '#0284c7',
  success: '#22c55e',
  danger: '#ef4444',
  warn: '#f59e0b',
} as const

export type Theme = typeof theme

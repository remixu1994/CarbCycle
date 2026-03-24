const CUID_PATTERN = /^c[a-z0-9]{7,}$/i

export const isCuid = (value: string | null | undefined): value is string => {
  if (!value) return false
  return CUID_PATTERN.test(value.trim())
}

export const cuidRegex = CUID_PATTERN

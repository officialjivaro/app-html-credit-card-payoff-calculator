import { CURRENCIES, getCurrencyDefinition } from '../constants/currencies.js'

export { CURRENCIES }

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

export function getCurrencyConfig(code = 'USD') {
  return getCurrencyDefinition(code)
}

export function currencyFractionDigits(code = 'USD') {
  return getCurrencyDefinition(code).fractionDigits
}

export function formatCurrency(value, currencyCode = 'USD', options = {}) {
  const currency = getCurrencyDefinition(currencyCode)
  const numericValue = Number.isFinite(Number(value)) ? Number(value) : 0

  return new Intl.NumberFormat(currency.locale, {
    style: 'currency',
    currency: currency.code,
    minimumFractionDigits: options.compact ? 0 : currency.fractionDigits,
    maximumFractionDigits: currency.fractionDigits,
    notation: options.compact ? 'compact' : 'standard',
  }).format(numericValue)
}

export function formatSignedCurrency(value, currencyCode = 'USD') {
  const numericValue = Number(value) || 0
  if (numericValue > 0) return `+${formatCurrency(numericValue, currencyCode)}`
  if (numericValue < 0) return `−${formatCurrency(Math.abs(numericValue), currencyCode)}`
  return formatCurrency(0, currencyCode)
}

export function formatPercent(value, digits = 1) {
  const numericValue = Number.isFinite(Number(value)) ? Number(value) : 0
  return `${numericValue.toFixed(digits)}%`
}

export function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value) || 0)
}

export function parseDateOnly(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
  }

  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return date
}

export function toDateInputValue(value) {
  const date = value instanceof Date ? value : parseDateOnly(value)
  if (!date || Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

export function formatDate(dateValue) {
  if (!dateValue) return '—'
  const date = dateValue instanceof Date ? dateValue : parseDateOnly(dateValue)
  if (!date || Number.isNaN(date.getTime())) return '—'
  return dateFormatter.format(date)
}

export function formatDuration(days) {
  const totalDays = Math.max(0, Math.round(Number(days) || 0))
  if (totalDays === 0) return 'Paid immediately'
  if (totalDays < 31) return `${totalDays} ${totalDays === 1 ? 'day' : 'days'}`

  const totalMonths = Math.max(1, Math.round(totalDays / (365.2425 / 12)))
  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12

  if (!years) return `${months} ${months === 1 ? 'month' : 'months'}`
  if (!months) return `${years} ${years === 1 ? 'year' : 'years'}`
  return `${years} ${years === 1 ? 'year' : 'years'}, ${months} ${months === 1 ? 'month' : 'months'}`
}

export function frequencyLabel(frequency) {
  return {
    monthly: 'Monthly',
    biweekly: 'Biweekly',
    weekly: 'Weekly',
  }[frequency] || 'Monthly'
}

export const paymentFrequencyLabel = frequencyLabel

export function paymentFrequencyNoun(frequency, count = 2) {
  const adjective = frequencyLabel(frequency).toLowerCase()
  return `${adjective} ${count === 1 ? 'payment' : 'payments'}`
}

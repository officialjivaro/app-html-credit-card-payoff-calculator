import {
  formatCurrency,
  formatDate,
  formatDuration,
  formatNumber,
  frequencyLabel,
} from './formatters.js'

function csvCell(value) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function rowsToCsv(rows) {
  return rows.map((row) => row.map(csvCell).join(',')).join('\n')
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

export function downloadText(text, filename, type = 'text/plain;charset=utf-8') {
  downloadBlob(new Blob([text], { type }), filename)
}

export function buildScheduleCsv(result, currency = 'USD') {
  const rows = [[
    'Event',
    'Date',
    'Type',
    'Days accrued',
    'Starting balance',
    'Interest',
    'Scheduled payment',
    'Recurring extra',
    'One-time payment',
    'Total payment',
    'Principal change',
    'Ending balance',
    'Cumulative interest',
    'Cumulative paid',
    'Currency',
  ]]

  result.schedule.forEach((row) => {
    rows.push([
      row.number,
      row.date,
      row.type,
      row.days,
      row.startBalance,
      row.interest,
      row.scheduledPayment,
      row.extraPayment,
      row.lumpSum,
      row.totalPayment,
      row.principal,
      row.endBalance,
      row.cumulativeInterest,
      row.cumulativePaid,
      currency,
    ])
  })

  return rowsToCsv(rows)
}

export function downloadScheduleCsv(result, currency = 'USD') {
  downloadText(
    `\ufeff${buildScheduleCsv(result, currency)}`,
    'credit-card-payoff-schedule.csv',
    'text/csv;charset=utf-8',
  )
}

export function buildAnnualCsv(result, currency = 'USD') {
  const rows = [[
    'Year',
    'Starting balance',
    'Scheduled payments',
    'Recurring extras',
    'One-time payments',
    'Total payments',
    'Interest',
    'Principal change',
    'Ending balance',
    'Currency',
  ]]

  result.annualSummary.forEach((row) => {
    rows.push([
      row.year,
      row.startingBalance,
      row.scheduledPayments,
      row.extraPayments,
      row.lumpSums,
      row.payments,
      row.interest,
      row.principal,
      row.endingBalance,
      currency,
    ])
  })

  return rowsToCsv(rows)
}

export function downloadAnnualCsv(result, currency = 'USD') {
  downloadText(
    `\ufeff${buildAnnualCsv(result, currency)}`,
    'credit-card-payoff-annual-summary.csv',
    'text/csv;charset=utf-8',
  )
}

export function buildSummaryText({
  result,
  baseline = null,
  requiredStartingPayment = null,
  currency = 'USD',
  mode = 'fixed',
}) {
  if (!result) return ''

  const modeLabel = {
    fixed: 'Fixed payment',
    minimum: 'Changing minimum payment',
    target: 'Target payoff date',
  }[mode] || 'Payoff plan'

  const lines = [
    'Credit Card Payoff Calculator',
    `Plan: ${modeLabel}`,
    `Starting balance: ${formatCurrency(result.startingBalance, currency)}`,
  ]

  if (requiredStartingPayment !== null && requiredStartingPayment !== undefined) {
    lines.push(`Required starting ${frequencyLabel(result.frequency || 'monthly').toLowerCase()} payment: ${formatCurrency(requiredStartingPayment, currency)}`)
  }

  lines.push(
    `Estimated payoff date: ${formatDate(result.payoffDate)}`,
    `Estimated payoff time: ${formatDuration(result.durationDays)}`,
    `Scheduled payments: ${formatNumber(result.paymentCount)}`,
    `Total interest: ${formatCurrency(result.totalInterest, currency)}`,
    `Total paid: ${formatCurrency(result.totalPaid, currency)}`,
    `Final payment event: ${formatCurrency(result.finalPayment, currency)}`,
    `Highest scheduled payment: ${formatCurrency(result.highestScheduledPayment, currency)}`,
  )

  if (baseline?.result?.possible && baseline.comparison) {
    const comparison = baseline.comparison
    lines.push(
      '',
      'Baseline comparison',
      `Baseline payoff date: ${formatDate(comparison.baselinePayoffDate)}`,
      `Interest difference: ${formatCurrency(comparison.interestSaved || 0, currency)}`,
      `Total-cost difference: ${formatCurrency(comparison.totalSaved || 0, currency)}`,
    )
  }

  if (result.warnings?.length) {
    lines.push('', 'Important notes')
    result.warnings.forEach((warning) => lines.push(`- ${warning}`))
  }

  lines.push('', 'Estimate only. Actual card statements may use different interest, fee, and minimum-payment rules.')
  return lines.join('\n')
}

export async function copyText(text) {
  if (!text) return false

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return true
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  return copied
}

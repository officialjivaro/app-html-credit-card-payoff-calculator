const DAY_MS = 86_400_000
const DEFAULT_MAX_YEARS = 80
const EPSILON = 1e-8

// Date Helpers | Keep all calculations on UTC calendar dates
export function parseDateKey(value) {
  if (value instanceof Date) {
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

export function toDateKey(value) {
  const date = value instanceof Date ? value : parseDateKey(value)
  if (!date || Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

export function addDays(dateKey, days) {
  const date = parseDateKey(dateKey)
  if (!date) return ''
  date.setUTCDate(date.getUTCDate() + Number(days || 0))
  return toDateKey(date)
}

export function addMonthsClamped(dateKey, months) {
  const date = parseDateKey(dateKey)
  if (!date) return ''

  const originalDay = date.getUTCDate()
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + Number(months || 0), 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(originalDay, lastDay))
  return toDateKey(target)
}

export function addYearsClamped(dateKey, years) {
  return addMonthsClamped(dateKey, Number(years || 0) * 12)
}

export const addMonths = addMonthsClamped
export const addYears = addYearsClamped

export function daysBetween(startDateKey, endDateKey) {
  const start = parseDateKey(startDateKey)
  const end = parseDateKey(endDateKey)
  if (!start || !end) return 0
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / DAY_MS))
}

function compareDates(left, right) {
  return String(left).localeCompare(String(right))
}

function earliestDate(values) {
  return values.filter(Boolean).sort(compareDates)[0] || ''
}

function dateIsOnOrBefore(left, right) {
  return compareDates(left, right) <= 0
}

function dateIsBefore(left, right) {
  return compareDates(left, right) < 0
}

function frequencyDate(startDate, sequence, frequency) {
  if (frequency === 'weekly') return addDays(startDate, sequence * 7)
  if (frequency === 'biweekly') return addDays(startDate, sequence * 14)
  return addMonthsClamped(startDate, sequence)
}

export function firstPaymentDate(startDate, frequency = 'monthly') {
  return frequencyDate(startDate, 1, frequency)
}

// Money Helpers | Round at transaction boundaries using the selected currency precision
export function roundMoney(value, fractionDigits = 2) {
  const factor = 10 ** fractionDigits
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor
}

function ceilMoney(value, fractionDigits = 2) {
  const factor = 10 ** fractionDigits
  return Math.ceil((Number(value) - Number.EPSILON) * factor) / factor
}

function smallestUnit(fractionDigits = 2) {
  return 1 / 10 ** fractionDigits
}

function isPaid(balance, fractionDigits = 2) {
  return balance <= smallestUnit(fractionDigits) / 2 + EPSILON
}

function anniversariesElapsed(startDate, eventDate) {
  const start = parseDateKey(startDate)
  const event = parseDateKey(eventDate)
  if (!start || !event || event < start) return 0

  let years = event.getUTCFullYear() - start.getUTCFullYear()
  if (compareDates(addYearsClamped(startDate, years), eventDate) > 0) years -= 1
  return Math.max(0, years)
}

function adjustedPayment(startingPayment, type, increaseValue, anniversaries, fractionDigits) {
  if (!anniversaries || type === 'none' || !increaseValue) {
    return roundMoney(startingPayment, fractionDigits)
  }

  if (type === 'amount') {
    return roundMoney(startingPayment + increaseValue * anniversaries, fractionDigits)
  }

  if (type === 'percent') {
    return roundMoney(startingPayment * (1 + increaseValue / 100) ** anniversaries, fractionDigits)
  }

  return roundMoney(startingPayment, fractionDigits)
}

// Interest Helpers | Accrue simple daily interest and split periods at a promotional-rate boundary
function accrueInterest(balance, fromDate, toDate, config) {
  if (!balance || !dateIsBefore(fromDate, toDate)) {
    return { interest: 0, days: 0 }
  }

  const standardApr = Math.max(0, Number(config.apr) || 0)
  const promoEnabled = Boolean(config.promoEnabled && config.promoEndDate)
  const promoApr = Math.max(0, Number(config.promoApr) || 0)
  const promoEndDate = promoEnabled ? config.promoEndDate : ''
  const totalDays = daysBetween(fromDate, toDate)

  if (!promoEnabled || !dateIsBefore(fromDate, promoEndDate)) {
    return {
      interest: balance * (standardApr / 100 / 365) * totalDays,
      days: totalDays,
    }
  }

  if (dateIsOnOrBefore(toDate, promoEndDate)) {
    return {
      interest: balance * (promoApr / 100 / 365) * totalDays,
      days: totalDays,
    }
  }

  const promoDays = daysBetween(fromDate, promoEndDate)
  const standardDays = daysBetween(promoEndDate, toDate)

  return {
    interest:
      balance * (promoApr / 100 / 365) * promoDays +
      balance * (standardApr / 100 / 365) * standardDays,
    days: promoDays + standardDays,
  }
}

function allocatePayments(due, requests, fractionDigits) {
  let remaining = Math.max(0, due)
  const applied = {}

  for (const [key, requested] of Object.entries(requests)) {
    const amount = Math.min(Math.max(0, Number(requested) || 0), remaining)
    applied[key] = roundMoney(amount, fractionDigits)
    remaining = Math.max(0, remaining - applied[key])
  }

  return applied
}

function rowType(flags) {
  const labels = []
  if (flags.scheduled) labels.push('Scheduled payment')
  if (flags.minimum) labels.push('Minimum payment')
  if (flags.extra) labels.push('Extra payment')
  if (flags.lump) labels.push('One-time payment')
  return labels.join(' + ') || 'Interest update'
}

function buildAnnualSummary(schedule, fractionDigits) {
  const years = new Map()

  schedule.forEach((row) => {
    const year = row.date.slice(0, 4)
    const current = years.get(year) || {
      year,
      startingBalance: row.startBalance,
      payments: 0,
      scheduledPayments: 0,
      extraPayments: 0,
      lumpSums: 0,
      interest: 0,
      principal: 0,
      endingBalance: row.endBalance,
    }

    current.payments += row.totalPayment
    current.scheduledPayments += row.scheduledPayment
    current.extraPayments += row.extraPayment
    current.lumpSums += row.lumpSum
    current.interest += row.interest
    current.principal += row.principal
    current.endingBalance = row.endBalance
    years.set(year, current)
  })

  return [...years.values()].map((row) => ({
    ...row,
    startingBalance: roundMoney(row.startingBalance, fractionDigits),
    payments: roundMoney(row.payments, fractionDigits),
    scheduledPayments: roundMoney(row.scheduledPayments, fractionDigits),
    extraPayments: roundMoney(row.extraPayments, fractionDigits),
    lumpSums: roundMoney(row.lumpSums, fractionDigits),
    interest: roundMoney(row.interest, fractionDigits),
    principal: roundMoney(row.principal, fractionDigits),
    endingBalance: roundMoney(row.endingBalance, fractionDigits),
  }))
}

function buildMilestones(schedule, startingBalance, fractionDigits) {
  const definitions = [
    { percent: 25, remaining: 0.75 },
    { percent: 50, remaining: 0.5 },
    { percent: 75, remaining: 0.25 },
    { percent: 100, remaining: 0 },
  ]

  return definitions.map((milestone) => {
    const threshold = roundMoney(startingBalance * milestone.remaining, fractionDigits)
    const row = schedule.find((entry) => entry.endBalance <= threshold + smallestUnit(fractionDigits) / 2)

    return {
      percent: milestone.percent,
      label: milestone.percent === 100 ? 'Paid off' : `${milestone.percent}% paid`,
      date: row?.date || '',
      paymentNumber: row?.number || null,
      balance: row?.endBalance ?? null,
    }
  })
}

function buildWarnings(result, mode) {
  const warnings = [...(result.warnings || [])]
  const firstScheduled = result.schedule.find((row) => row.scheduledPayment > 0)

  if (firstScheduled) {
    if (firstScheduled.totalPayment <= firstScheduled.interest) {
      warnings.push('The first scheduled payment does not cover the interest accrued before it, so the balance initially grows.')
    } else if (firstScheduled.principal / firstScheduled.totalPayment < 0.1) {
      warnings.push('Less than 10% of the first scheduled payment reduces principal. Payoff progress will be slow at the beginning.')
    }
  }

  if (result.schedule.some((row) => row.principal < 0)) {
    warnings.push('At least one payment period has negative amortization, meaning unpaid interest increases the balance.')
  }

  if (result.possible && result.totalInterest > result.startingBalance) {
    warnings.push('Estimated interest exceeds the original balance. Increasing payments could substantially reduce the total cost.')
  }

  if (result.possible && result.durationDays > 365.2425 * 10) {
    warnings.push('The estimated payoff takes more than 10 years.')
  }

  if (mode === 'minimum') {
    warnings.push('Minimum-payment results are estimates because each card issuer can use a different statement formula and rounding method.')
  }

  return [...new Set(warnings)]
}

function finalizeResult({
  possible,
  mode,
  startDate,
  frequency = 'monthly',
  startingBalance,
  remainingBalance,
  schedule,
  totalInterest,
  totalPaid,
  warnings,
  fractionDigits,
  startingPayment,
  requiredStartingPayment = null,
}) {
  const payoffDate = possible ? schedule.at(-1)?.date || startDate : ''
  const durationDays = payoffDate ? daysBetween(startDate, payoffDate) : 0
  const scheduledRows = schedule.filter((row) => row.scheduledPayment > 0)
  const firstScheduled = scheduledRows[0] || null
  const lastRow = schedule.at(-1) || null
  const roundedStartingBalance = roundMoney(startingBalance, fractionDigits)

  const result = {
    possible,
    mode,
    startDate,
    frequency,
    startingBalance: roundedStartingBalance,
    remainingBalance: roundMoney(Math.max(0, remainingBalance), fractionDigits),
    payoffDate,
    durationDays,
    schedule,
    annualSummary: buildAnnualSummary(schedule, fractionDigits),
    milestones: buildMilestones(schedule, roundedStartingBalance, fractionDigits),
    totalInterest: roundMoney(totalInterest, fractionDigits),
    totalPaid: roundMoney(totalPaid, fractionDigits),
    totalPrincipal: roundMoney(totalPaid - totalInterest, fractionDigits),
    paymentCount: scheduledRows.length,
    eventCount: schedule.length,
    finalPayment: roundMoney(lastRow?.totalPayment || 0, fractionDigits),
    highestScheduledPayment: roundMoney(
      scheduledRows.reduce((highest, row) => Math.max(highest, row.scheduledPayment), 0),
      fractionDigits,
    ),
    firstPaymentInterest: roundMoney(firstScheduled?.interest || 0, fractionDigits),
    firstPaymentPrincipal: roundMoney(firstScheduled?.principal || 0, fractionDigits),
    lumpSumUsed: roundMoney(schedule.reduce((sum, row) => sum + row.lumpSum, 0), fractionDigits),
    startingPayment: roundMoney(startingPayment || firstScheduled?.scheduledPayment || 0, fractionDigits),
    requiredStartingPayment:
      requiredStartingPayment === null ? null : roundMoney(requiredStartingPayment, fractionDigits),
    warnings,
  }

  result.warnings = buildWarnings(result, mode)
  return result
}

function createScheduleRow({
  schedule,
  date,
  flags,
  startBalance,
  days,
  interest,
  scheduledPayment,
  extraPayment,
  lumpSum,
  endBalance,
  cumulativeInterest,
  cumulativePaid,
  fractionDigits,
}) {
  const totalPayment = scheduledPayment + extraPayment + lumpSum
  const principal = totalPayment - interest

  return {
    number: schedule.length + 1,
    date,
    type: rowType(flags),
    days,
    startBalance: roundMoney(startBalance, fractionDigits),
    interest: roundMoney(interest, fractionDigits),
    scheduledPayment: roundMoney(scheduledPayment, fractionDigits),
    extraPayment: roundMoney(extraPayment, fractionDigits),
    lumpSum: roundMoney(lumpSum, fractionDigits),
    totalPayment: roundMoney(totalPayment, fractionDigits),
    principal: roundMoney(principal, fractionDigits),
    endBalance: roundMoney(endBalance, fractionDigits),
    cumulativeInterest: roundMoney(cumulativeInterest, fractionDigits),
    cumulativePaid: roundMoney(cumulativePaid, fractionDigits),
  }
}

// Fixed Plan | Simulate fixed-payment and target-date schedules
export function simulateFixedPlan(input) {
  const config = {
    mode: input.mode || 'fixed',
    balance: Math.max(0, Number(input.balance) || 0),
    apr: Math.max(0, Number(input.apr) || 0),
    startDate: input.startDate,
    frequency: input.frequency || 'monthly',
    startingPayment: Math.max(0, Number(input.startingPayment) || 0),
    extraAmount: Math.max(0, Number(input.extraAmount) || 0),
    extraFrequency: input.extraFrequency || 'monthly',
    lumpAmount: Math.max(0, Number(input.lumpAmount) || 0),
    lumpDate: input.lumpDate || '',
    annualIncreaseType: input.annualIncreaseType || 'none',
    annualIncreaseValue: Math.max(0, Number(input.annualIncreaseValue) || 0),
    promoEnabled: Boolean(input.promoEnabled),
    promoApr: Math.max(0, Number(input.promoApr) || 0),
    promoEndDate: input.promoEndDate || '',
    fractionDigits: Number.isInteger(input.fractionDigits) ? input.fractionDigits : 2,
    deadlineDate: input.deadlineDate || '',
    maxYears: Math.max(1, Number(input.maxYears) || DEFAULT_MAX_YEARS),
  }

  const schedule = []
  const warnings = []
  let balance = roundMoney(config.balance, config.fractionDigits)
  let totalInterest = 0
  let totalPaid = 0
  let lastDate = config.startDate
  let scheduledSequence = 1
  let extraSequence = 1
  let lumpApplied = false
  let iterations = 0
  const maximumDate = config.deadlineDate || addYearsClamped(config.startDate, config.maxYears)
  const maxIterations = 60_000
  const balanceSafetyLimit = Math.max(config.balance * 1_000, 1_000_000_000_000)

  while (!isPaid(balance, config.fractionDigits) && iterations < maxIterations) {
    const nextScheduled = frequencyDate(config.startDate, scheduledSequence, config.frequency)
    const nextExtra = config.extraAmount > 0
      ? frequencyDate(config.startDate, extraSequence, config.extraFrequency)
      : ''
    const nextLump = config.lumpAmount > 0 && !lumpApplied ? config.lumpDate : ''
    const eventDate = earliestDate([nextScheduled, nextExtra, nextLump])

    if (!eventDate || compareDates(eventDate, maximumDate) > 0) break

    const flags = {
      scheduled: eventDate === nextScheduled,
      minimum: false,
      extra: Boolean(nextExtra && eventDate === nextExtra),
      lump: Boolean(nextLump && eventDate === nextLump),
    }

    const startBalance = balance
    const accrual = accrueInterest(balance, lastDate, eventDate, config)
    const interest = roundMoney(accrual.interest, config.fractionDigits)
    const due = roundMoney(balance + interest, config.fractionDigits)
    const anniversaries = anniversariesElapsed(config.startDate, eventDate)
    const requestedScheduled = flags.scheduled
      ? adjustedPayment(
          config.startingPayment,
          config.annualIncreaseType,
          config.annualIncreaseValue,
          anniversaries,
          config.fractionDigits,
        )
      : 0
    const requestedExtra = flags.extra ? config.extraAmount : 0
    const requestedLump = flags.lump ? config.lumpAmount : 0
    const applied = allocatePayments(
      due,
      {
        scheduledPayment: requestedScheduled,
        extraPayment: requestedExtra,
        lumpSum: requestedLump,
      },
      config.fractionDigits,
    )
    const totalPayment = applied.scheduledPayment + applied.extraPayment + applied.lumpSum

    balance = roundMoney(Math.max(0, due - totalPayment), config.fractionDigits)
    totalInterest = roundMoney(totalInterest + interest, config.fractionDigits)
    totalPaid = roundMoney(totalPaid + totalPayment, config.fractionDigits)

    schedule.push(
      createScheduleRow({
        schedule,
        date: eventDate,
        flags,
        startBalance,
        days: accrual.days,
        interest,
        scheduledPayment: applied.scheduledPayment,
        extraPayment: applied.extraPayment,
        lumpSum: applied.lumpSum,
        endBalance: balance,
        cumulativeInterest: totalInterest,
        cumulativePaid: totalPaid,
        fractionDigits: config.fractionDigits,
      }),
    )

    if (flags.scheduled) scheduledSequence += 1
    if (flags.extra) extraSequence += 1
    if (flags.lump) lumpApplied = true

    if (!Number.isFinite(balance) || balance > balanceSafetyLimit) {
      warnings.push('The projected balance grew beyond the calculation safety limit. Increase the payment amount.')
      break
    }

    lastDate = eventDate
    iterations += 1
  }

  const possible = isPaid(balance, config.fractionDigits)

  if (!possible) {
    warnings.push(
      config.deadlineDate
        ? 'The current payment assumptions do not clear the balance by the selected target date.'
        : `The balance is not paid off within ${config.maxYears} years.`,
    )
  }

  if (iterations >= maxIterations) {
    warnings.push('The safety limit stopped the calculation before a payoff was reached.')
  }

  return finalizeResult({
    possible,
    mode: config.mode,
    startDate: config.startDate,
    frequency: config.frequency,
    startingBalance: config.balance,
    remainingBalance: balance,
    schedule,
    totalInterest,
    totalPaid,
    warnings,
    fractionDigits: config.fractionDigits,
    startingPayment: config.startingPayment,
  })
}

// Minimum Plan | Recalculate a statement minimum every month
export function simulateMinimumPlan(input) {
  const config = {
    mode: 'minimum',
    balance: Math.max(0, Number(input.balance) || 0),
    apr: Math.max(0, Number(input.apr) || 0),
    startDate: input.startDate,
    minimumFormula: input.minimumFormula || 'interestPlusPrincipal',
    balancePercent: Math.max(0, Number(input.balancePercent) || 0),
    principalPercent: Math.max(0, Number(input.principalPercent) || 0),
    minimumFloor: Math.max(0, Number(input.minimumFloor) || 0),
    extraAmount: Math.max(0, Number(input.extraAmount) || 0),
    extraFrequency: input.extraFrequency || 'monthly',
    annualIncreaseType: input.annualIncreaseType || 'none',
    annualIncreaseValue: Math.max(0, Number(input.annualIncreaseValue) || 0),
    lumpAmount: Math.max(0, Number(input.lumpAmount) || 0),
    lumpDate: input.lumpDate || '',
    promoEnabled: Boolean(input.promoEnabled),
    promoApr: Math.max(0, Number(input.promoApr) || 0),
    promoEndDate: input.promoEndDate || '',
    fractionDigits: Number.isInteger(input.fractionDigits) ? input.fractionDigits : 2,
    maxYears: Math.max(1, Number(input.maxYears) || DEFAULT_MAX_YEARS),
  }

  const schedule = []
  const warnings = []
  let balance = roundMoney(config.balance, config.fractionDigits)
  let totalInterest = 0
  let totalPaid = 0
  let interestSinceStatement = 0
  let lastDate = config.startDate
  let statementSequence = 1
  let extraSequence = 1
  let lumpApplied = false
  let iterations = 0
  let startingMinimum = 0
  const maximumDate = addYearsClamped(config.startDate, config.maxYears)
  const maxIterations = 60_000
  const balanceSafetyLimit = Math.max(config.balance * 1_000, 1_000_000_000_000)

  while (!isPaid(balance, config.fractionDigits) && iterations < maxIterations) {
    const nextStatement = frequencyDate(config.startDate, statementSequence, 'monthly')
    const hasExtraStream = config.extraAmount > 0 ||
      (config.annualIncreaseType !== 'none' && config.annualIncreaseValue > 0)
    const nextExtra = hasExtraStream
      ? frequencyDate(config.startDate, extraSequence, config.extraFrequency)
      : ''
    const nextLump = config.lumpAmount > 0 && !lumpApplied ? config.lumpDate : ''
    const eventDate = earliestDate([nextStatement, nextExtra, nextLump])

    if (!eventDate || compareDates(eventDate, maximumDate) > 0) break

    const flags = {
      scheduled: eventDate === nextStatement,
      minimum: eventDate === nextStatement,
      extra: Boolean(nextExtra && eventDate === nextExtra),
      lump: Boolean(nextLump && eventDate === nextLump),
    }

    const startBalance = balance
    const accrual = accrueInterest(balance, lastDate, eventDate, config)
    const interest = roundMoney(accrual.interest, config.fractionDigits)
    interestSinceStatement = roundMoney(interestSinceStatement + interest, config.fractionDigits)
    const due = roundMoney(balance + interest, config.fractionDigits)

    let requestedMinimum = 0
    if (flags.minimum) {
      const formulaAmount = config.minimumFormula === 'balancePercent'
        ? due * (config.balancePercent / 100)
        : interestSinceStatement + startBalance * (config.principalPercent / 100)

      requestedMinimum = roundMoney(
        Math.min(due, Math.max(config.minimumFloor, formulaAmount)),
        config.fractionDigits,
      )

      if (!startingMinimum) startingMinimum = requestedMinimum
    }

    const requestedExtra = flags.extra
      ? adjustedPayment(
          config.extraAmount,
          config.annualIncreaseType,
          config.annualIncreaseValue,
          anniversariesElapsed(config.startDate, eventDate),
          config.fractionDigits,
        )
      : 0
    const requestedLump = flags.lump ? config.lumpAmount : 0
    const applied = allocatePayments(
      due,
      {
        scheduledPayment: requestedMinimum,
        extraPayment: requestedExtra,
        lumpSum: requestedLump,
      },
      config.fractionDigits,
    )
    const totalPayment = applied.scheduledPayment + applied.extraPayment + applied.lumpSum

    balance = roundMoney(Math.max(0, due - totalPayment), config.fractionDigits)
    totalInterest = roundMoney(totalInterest + interest, config.fractionDigits)
    totalPaid = roundMoney(totalPaid + totalPayment, config.fractionDigits)

    schedule.push(
      createScheduleRow({
        schedule,
        date: eventDate,
        flags,
        startBalance,
        days: accrual.days,
        interest,
        scheduledPayment: applied.scheduledPayment,
        extraPayment: applied.extraPayment,
        lumpSum: applied.lumpSum,
        endBalance: balance,
        cumulativeInterest: totalInterest,
        cumulativePaid: totalPaid,
        fractionDigits: config.fractionDigits,
      }),
    )

    if (flags.minimum) {
      statementSequence += 1
      interestSinceStatement = 0
    }
    if (flags.extra) extraSequence += 1
    if (flags.lump) lumpApplied = true

    if (!Number.isFinite(balance) || balance > balanceSafetyLimit) {
      warnings.push('The projected balance grew beyond the calculation safety limit. Increase the payment amount.')
      break
    }

    lastDate = eventDate
    iterations += 1
  }

  const possible = isPaid(balance, config.fractionDigits)
  if (!possible) warnings.push(`The estimated minimum-payment plan does not clear the balance within ${config.maxYears} years.`)
  if (iterations >= maxIterations) warnings.push('The safety limit stopped the calculation before a payoff was reached.')

  return finalizeResult({
    possible,
    mode: 'minimum',
    startDate: config.startDate,
    frequency: 'monthly',
    startingBalance: config.balance,
    remainingBalance: balance,
    schedule,
    totalInterest,
    totalPaid,
    warnings,
    fractionDigits: config.fractionDigits,
    startingPayment: startingMinimum,
  })
}

// Target Solver | Find the smallest starting payment that succeeds by the deadline
export function solveTargetPayment(input) {
  const fractionDigits = Number.isInteger(input.fractionDigits) ? input.fractionDigits : 2
  const targetDate = input.targetDate
  const baseConfig = {
    ...input,
    mode: 'target',
    deadlineDate: targetDate,
    fractionDigits,
  }

  const zeroResult = simulateFixedPlan({ ...baseConfig, startingPayment: 0 })
  if (zeroResult.possible) {
    return {
      possible: true,
      requiredStartingPayment: 0,
      result: {
        ...zeroResult,
        requiredStartingPayment: 0,
      },
    }
  }

  const firstDate = firstPaymentDate(input.startDate, input.frequency)
  if (!targetDate || compareDates(firstDate, targetDate) > 0) {
    return {
      possible: false,
      error: 'The target date must include at least one scheduled payment.',
      requiredStartingPayment: null,
      result: null,
    }
  }

  const paymentDates = []
  let sequence = 1
  let date = firstDate
  while (dateIsOnOrBefore(date, targetDate) && paymentDates.length < 10_000) {
    paymentDates.push(date)
    sequence += 1
    date = frequencyDate(input.startDate, sequence, input.frequency)
  }

  const roughPayment = paymentDates.length
    ? Math.max(smallestUnit(fractionDigits), Number(input.balance) / paymentDates.length)
    : Math.max(smallestUnit(fractionDigits), Number(input.balance))

  let low = 0
  let high = roughPayment
  let highResult = simulateFixedPlan({ ...baseConfig, startingPayment: high })
  const maximumHigh = Math.max(Number(input.balance) * 100, 1_000_000_000)
  let expansionSteps = 0

  while (!highResult.possible && high < maximumHigh && expansionSteps < 80) {
    high *= 2
    highResult = simulateFixedPlan({ ...baseConfig, startingPayment: high })
    expansionSteps += 1
  }

  if (!highResult.possible) {
    return {
      possible: false,
      error: 'A practical starting payment could not be found for the selected target date and assumptions.',
      requiredStartingPayment: null,
      result: highResult,
    }
  }

  for (let iteration = 0; iteration < 70; iteration += 1) {
    const middle = (low + high) / 2
    const middleResult = simulateFixedPlan({ ...baseConfig, startingPayment: middle })

    if (middleResult.possible) high = middle
    else low = middle
  }

  let requiredStartingPayment = ceilMoney(high, fractionDigits)
  let result = simulateFixedPlan({ ...baseConfig, startingPayment: requiredStartingPayment })
  const unit = smallestUnit(fractionDigits)
  let correctionSteps = 0

  while (!result.possible && correctionSteps < 100) {
    requiredStartingPayment = roundMoney(requiredStartingPayment + unit, fractionDigits)
    result = simulateFixedPlan({ ...baseConfig, startingPayment: requiredStartingPayment })
    correctionSteps += 1
  }

  if (!result.possible) {
    return {
      possible: false,
      error: 'Rounding prevented the target payment from producing a complete payoff schedule.',
      requiredStartingPayment: null,
      result,
    }
  }

  result.requiredStartingPayment = requiredStartingPayment
  result.startingPayment = requiredStartingPayment

  if (input.annualIncreaseType !== 'none' && Number(input.annualIncreaseValue) > 0) {
    result.warnings = [
      ...result.warnings,
      'The target result is the required starting payment. Later scheduled payments increase according to the annual increase entered.',
    ]
  }

  return {
    possible: true,
    requiredStartingPayment,
    result,
  }
}

// Comparison | Calculate savings against a matching baseline plan
export function comparePlans(plan, baseline) {
  if (!plan || !baseline) return null

  return {
    planPossible: Boolean(plan.possible),
    baselinePossible: Boolean(baseline.possible),
    daysSaved: plan.possible && baseline.possible ? baseline.durationDays - plan.durationDays : null,
    interestSaved: plan.possible && baseline.possible ? baseline.totalInterest - plan.totalInterest : null,
    totalSaved: plan.possible && baseline.possible ? baseline.totalPaid - plan.totalPaid : null,
    baselinePayoffDate: baseline.payoffDate || '',
    baselineInterest: baseline.totalInterest,
    baselineTotalPaid: baseline.totalPaid,
  }
}


// Planner API | Convert UI form fields into pure simulation inputs
function normalizedIncreaseType(type) {
  return type === 'fixed' ? 'amount' : type
}

function commonSimulationInput(config) {
  return {
    balance: Number(config.balance) || 0,
    apr: Number(config.apr) || 0,
    startDate: config.startDate,
    extraAmount: Number(config.recurringExtra) || 0,
    extraFrequency: config.extraFrequency || 'monthly',
    lumpAmount: Number(config.lumpSum) || 0,
    lumpDate: Number(config.lumpSum) > 0 ? config.lumpSumDate : '',
    annualIncreaseType: normalizedIncreaseType(config.annualIncreaseType || 'none'),
    annualIncreaseValue: Number(config.annualIncreaseAmount) || 0,
    promoEnabled: Boolean(config.promoAprEnabled),
    promoApr: Number(config.promoApr) || 0,
    promoEndDate: config.promoAprEnabled ? config.promoEndDate : '',
    fractionDigits: Number.isInteger(config.fractionDigits) ? config.fractionDigits : 2,
    maxYears: Number(config.maxYears) || DEFAULT_MAX_YEARS,
  }
}

export function calculatePlan(config) {
  const common = commonSimulationInput(config)

  if (config.mode === 'minimum') {
    const result = simulateMinimumPlan({
      ...common,
      minimumFormula: config.minimumFormula,
      balancePercent: Number(config.minimumBalancePercent) || 0,
      principalPercent: Number(config.minimumPrincipalPercent) || 0,
      minimumFloor: Number(config.minimumFloor) || 0,
    })

    return {
      possible: result.possible,
      requiredStartingPayment: null,
      result,
      reason: result.possible ? '' : result.warnings[0] || 'The minimum-payment plan did not reach a payoff.',
    }
  }

  if (config.mode === 'target') {
    const solved = solveTargetPayment({
      ...common,
      frequency: config.baseFrequency || 'monthly',
      targetDate: config.targetDate,
    })

    return {
      possible: solved.possible,
      requiredStartingPayment: solved.requiredStartingPayment,
      result: solved.result,
      reason: solved.error || solved.result?.warnings?.[0] || '',
    }
  }

  const result = simulateFixedPlan({
    ...common,
    mode: 'fixed',
    frequency: config.baseFrequency || 'monthly',
    startingPayment: Number(config.basePayment) || 0,
  })

  return {
    possible: result.possible,
    requiredStartingPayment: null,
    result,
    reason: result.possible ? '' : result.warnings[0] || 'The fixed-payment plan did not reach a payoff.',
  }
}

export function calculateBaseline(config, existingPlanResult = null) {
  const common = commonSimulationInput({
    ...config,
    recurringExtra: 0,
    lumpSum: 0,
    annualIncreaseType: 'none',
    annualIncreaseAmount: 0,
  })

  let result
  let requiredStartingPayment = null

  if (config.mode === 'minimum') {
    result = simulateMinimumPlan({
      ...common,
      minimumFormula: config.minimumFormula,
      balancePercent: Number(config.minimumBalancePercent) || 0,
      principalPercent: Number(config.minimumPrincipalPercent) || 0,
      minimumFloor: Number(config.minimumFloor) || 0,
    })
  } else if (config.mode === 'target') {
    const solved = solveTargetPayment({
      ...common,
      frequency: 'monthly',
      targetDate: config.targetDate,
    })
    result = solved.result
    requiredStartingPayment = solved.requiredStartingPayment
  } else {
    result = simulateFixedPlan({
      ...common,
      mode: 'fixed',
      frequency: config.baseFrequency || 'monthly',
      startingPayment: Number(config.basePayment) || 0,
    })
  }

  if (!result) {
    return {
      possible: false,
      requiredStartingPayment,
      result: null,
      comparison: null,
    }
  }

  const planResult = existingPlanResult || calculatePlan(config).result

  return {
    possible: result.possible,
    requiredStartingPayment,
    result,
    comparison: planResult ? comparePlans(planResult, result) : null,
  }
}

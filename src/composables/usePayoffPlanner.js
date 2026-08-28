import { computed, reactive, ref, watch } from 'vue'
import { CURRENCIES, getCurrencyDefinition } from '../constants/currencies.js'
import {
  addMonthsClamped,
  addYearsClamped,
  calculateBaseline,
  calculatePlan,
  firstPaymentDate,
  parseDateKey,
} from '../lib/payoffEngine.js'

const STORAGE_KEY = 'nortune-credit-card-payoff-calculator-v1'
const VALID_MODES = new Set(['fixed', 'minimum', 'target'])
const VALID_FREQUENCIES = new Set(['monthly', 'biweekly', 'weekly'])
const VALID_MINIMUM_FORMULAS = new Set(['interestPlusPrincipal', 'balancePercent'])
const VALID_INCREASE_TYPES = new Set(['none', 'amount', 'percent'])

function todayKey() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function createDefaults() {
  const startDate = todayKey()

  return {
    currency: 'USD',
    mode: 'fixed',
    balance: 5_000,
    apr: 22.99,
    startDate,
    frequency: 'monthly',
    fixedPayment: 250,
    minimumFormula: 'interestPlusPrincipal',
    minimumBalancePercent: 2,
    minimumPrincipalPercent: 1,
    minimumFloor: 25,
    targetDate: addYearsClamped(startDate, 3),
    extraAmount: 0,
    extraFrequency: 'monthly',
    lumpAmount: 0,
    lumpDate: addMonthsClamped(startDate, 6),
    annualIncreaseType: 'none',
    annualIncreaseValue: 0,
    promoEnabled: false,
    promoApr: 0,
    promoEndDate: addYearsClamped(startDate, 1),
    advancedOpen: false,
  }
}

function assignForm(target, source = {}) {
  const defaults = createDefaults()
  const safe = {}

  Object.keys(defaults).forEach((key) => {
    safe[key] = Object.prototype.hasOwnProperty.call(source, key) ? source[key] : defaults[key]
  })

  if (!CURRENCIES.some((item) => item.code === safe.currency)) safe.currency = defaults.currency
  if (!VALID_MODES.has(safe.mode)) safe.mode = defaults.mode
  if (!VALID_FREQUENCIES.has(safe.frequency)) safe.frequency = defaults.frequency
  if (!VALID_FREQUENCIES.has(safe.extraFrequency)) safe.extraFrequency = defaults.extraFrequency
  if (!VALID_MINIMUM_FORMULAS.has(safe.minimumFormula)) safe.minimumFormula = defaults.minimumFormula
  if (!VALID_INCREASE_TYPES.has(safe.annualIncreaseType)) safe.annualIncreaseType = defaults.annualIncreaseType
  safe.promoEnabled = Boolean(safe.promoEnabled)
  safe.advancedOpen = Boolean(safe.advancedOpen)

  Object.assign(target, safe)
}

function positiveNumber(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0
}

function nonNegativeNumber(value) {
  return Number.isFinite(Number(value)) && Number(value) >= 0
}

function dateIsAfter(left, right) {
  return String(left).localeCompare(String(right)) > 0
}

function dateIsOnOrAfter(left, right) {
  return String(left).localeCompare(String(right)) >= 0
}

function buildPlannerConfig(form, currency) {
  return {
    currency: form.currency,
    fractionDigits: currency.fractionDigits,
    balance: Number(form.balance),
    apr: Number(form.apr),
    startDate: form.startDate,
    mode: form.mode,
    baseFrequency: form.frequency,
    basePayment: Number(form.fixedPayment),
    minimumFormula: form.minimumFormula,
    minimumBalancePercent: Number(form.minimumBalancePercent),
    minimumPrincipalPercent: Number(form.minimumPrincipalPercent),
    minimumFloor: Number(form.minimumFloor),
    targetDate: form.targetDate,
    recurringExtra: Number(form.extraAmount) || 0,
    extraFrequency: form.extraFrequency,
    lumpSum: Number(form.lumpAmount) || 0,
    lumpSumDate: form.lumpDate,
    annualIncreaseType: form.mode === 'minimum' ? 'none' : form.annualIncreaseType,
    annualIncreaseAmount: form.mode === 'minimum' ? 0 : Number(form.annualIncreaseValue) || 0,
    promoAprEnabled: form.promoEnabled,
    promoApr: Number(form.promoApr) || 0,
    promoEndDate: form.promoEndDate,
    maxYears: 80,
  }
}

export function usePayoffPlanner() {
  const form = reactive(createDefaults())
  const errors = reactive({})
  const result = ref(null)
  const baseline = ref(null)
  const requiredStartingPayment = ref(null)
  const isStale = ref(false)
  const isCalculating = ref(false)
  const notice = ref('Ready to calculate.')
  const noticeTone = ref('neutral')
  const savedSettingsFound = ref(false)
  let suppressStale = true

  const currency = computed(() => getCurrencyDefinition(form.currency))

  function setNotice(message, tone = 'neutral') {
    notice.value = message
    noticeTone.value = tone
  }

  function clearErrors() {
    Object.keys(errors).forEach((key) => delete errors[key])
  }

  function validate() {
    clearErrors()

    if (!positiveNumber(form.balance)) errors.balance = 'Enter a balance greater than 0.'
    if (!nonNegativeNumber(form.apr) || Number(form.apr) > 1_000) errors.apr = 'Enter an APR between 0% and 1,000%.'
    if (!parseDateKey(form.startDate)) errors.startDate = 'Choose a valid start date.'

    if (form.mode === 'fixed' && !positiveNumber(form.fixedPayment)) {
      errors.fixedPayment = 'Enter a recurring payment greater than 0.'
    }

    if (form.mode === 'minimum') {
      if (form.minimumFormula === 'balancePercent' && !positiveNumber(form.minimumBalancePercent)) {
        errors.minimumBalancePercent = 'Enter a balance percentage greater than 0.'
      }
      if (form.minimumFormula === 'interestPlusPrincipal' && !positiveNumber(form.minimumPrincipalPercent)) {
        errors.minimumPrincipalPercent = 'Enter a principal percentage greater than 0.'
      }
      if (!positiveNumber(form.minimumFloor)) errors.minimumFloor = 'Enter a minimum payment floor greater than 0.'
    }

    if (form.mode === 'target') {
      if (!parseDateKey(form.targetDate)) {
        errors.targetDate = 'Choose a valid target date.'
      } else if (!dateIsOnOrAfter(form.targetDate, firstPaymentDate(form.startDate, form.frequency))) {
        errors.targetDate = 'The target must allow at least one scheduled payment.'
      } else if (dateIsAfter(form.targetDate, addYearsClamped(form.startDate, 80))) {
        errors.targetDate = 'Choose a target within 80 years of the start date.'
      }
    }

    if (!nonNegativeNumber(form.extraAmount)) errors.extraAmount = 'Enter an extra payment of 0 or more.'
    if (!nonNegativeNumber(form.lumpAmount)) errors.lumpAmount = 'Enter a one-time payment of 0 or more.'

    if (Number(form.lumpAmount) > 0) {
      if (!parseDateKey(form.lumpDate)) {
        errors.lumpDate = 'Choose a valid one-time payment date.'
      } else if (!dateIsOnOrAfter(form.lumpDate, form.startDate)) {
        errors.lumpDate = 'The one-time payment cannot occur before the plan starts.'
      } else if (form.mode === 'target' && dateIsAfter(form.lumpDate, form.targetDate)) {
        errors.lumpDate = 'The one-time payment must occur on or before the target date.'
      }
    }

    if (form.mode !== 'minimum' && form.annualIncreaseType !== 'none') {
      if (!nonNegativeNumber(form.annualIncreaseValue)) {
        errors.annualIncreaseValue = 'Enter an annual increase of 0 or more.'
      } else if (form.annualIncreaseType === 'percent' && Number(form.annualIncreaseValue) > 1_000) {
        errors.annualIncreaseValue = 'Enter an annual increase of 1,000% or less.'
      }
    }

    if (form.promoEnabled) {
      if (!nonNegativeNumber(form.promoApr) || Number(form.promoApr) > 1_000) {
        errors.promoApr = 'Enter a promotional APR between 0% and 1,000%.'
      }
      if (!parseDateKey(form.promoEndDate) || !dateIsAfter(form.promoEndDate, form.startDate)) {
        errors.promoEndDate = 'Choose a promotional end date after the start date.'
      }
    }

    return Object.keys(errors).length === 0
  }

  function calculate() {
    if (!validate()) {
      setNotice('Check the highlighted fields and try again.', 'error')
      return false
    }

    isCalculating.value = true

    try {
      const config = buildPlannerConfig(form, currency.value)
      const plan = calculatePlan(config)

      if (!plan.possible || !plan.result) {
        result.value = null
        baseline.value = null
        requiredStartingPayment.value = null
        setNotice(plan.reason || 'The current assumptions do not produce a complete payoff.', 'error')
        isStale.value = false
        return false
      }

      const baselinePlan = calculateBaseline(config, plan.result)
      result.value = plan.result
      baseline.value = baselinePlan
      requiredStartingPayment.value = plan.requiredStartingPayment
      setNotice('Payoff projection updated.', 'success')
      isStale.value = false
      return true
    } catch (error) {
      console.error(error)
      result.value = null
      baseline.value = null
      requiredStartingPayment.value = null
      setNotice('The calculation could not be completed. Review the inputs and try again.', 'error')
      return false
    } finally {
      isCalculating.value = false
    }
  }

  function saveSettings() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...form }))
      savedSettingsFound.value = true
      setNotice('Settings saved in this browser.', 'success')
      return true
    } catch {
      setNotice('This browser could not save the settings.', 'error')
      return false
    }
  }

  function loadSettings() {
    if (typeof window === 'undefined') return false

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (!stored) return false
      suppressStale = true
      assignForm(form, JSON.parse(stored))
      savedSettingsFound.value = true
      setNotice('Saved settings restored.', 'neutral')
      return true
    } catch {
      try {
        window.localStorage.removeItem(STORAGE_KEY)
      } catch {}
      savedSettingsFound.value = false
      setNotice('Saved settings are unavailable in this browser.', 'neutral')
      return false
    }
  }

  function clearSavedSettings() {
    try {
      window.localStorage.removeItem(STORAGE_KEY)
      savedSettingsFound.value = false
      setNotice('Saved settings cleared.', 'neutral')
      return true
    } catch {
      setNotice('Saved settings could not be cleared.', 'error')
      return false
    }
  }

  function reset() {
    suppressStale = true
    assignForm(form, createDefaults())
    clearErrors()
    result.value = null
    baseline.value = null
    requiredStartingPayment.value = null
    isStale.value = false
    setNotice('Calculator reset to its default assumptions.', 'neutral')

    queueMicrotask(() => {
      suppressStale = false
      calculate()
    })
  }

  watch(
    form,
    () => {
      if (suppressStale) return
      clearErrors()
      if (result.value) {
        isStale.value = true
        setNotice('Inputs changed. Calculate again to refresh the results.', 'warning')
      }
    },
    { deep: true },
  )

  loadSettings()
  queueMicrotask(() => {
    suppressStale = false
    calculate()
  })

  return {
    form,
    errors,
    result,
    baseline,
    requiredStartingPayment,
    currency,
    isStale,
    isCalculating,
    notice,
    noticeTone,
    savedSettingsFound,
    calculate,
    saveSettings,
    clearSavedSettings,
    reset,
    setNotice,
  }
}

<script setup>
import { computed } from 'vue'
import {
  formatCurrency,
  formatDate,
  formatDuration,
  formatNumber,
  formatPercent,
  frequencyLabel,
} from '../lib/formatters.js'

const props = defineProps({
  result: {
    type: Object,
    default: null,
  },
  baseline: {
    type: Object,
    default: null,
  },
  requiredStartingPayment: {
    type: Number,
    default: null,
  },
  currency: {
    type: String,
    default: 'USD',
  },
  mode: {
    type: String,
    default: 'fixed',
  },
  isStale: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['copy', 'print', 'recalculate'])

const principalShare = computed(() => {
  if (!props.result?.totalPaid) return 100
  return Math.max(0, Math.min(100, (props.result.totalPrincipal / props.result.totalPaid) * 100))
})

const interestShare = computed(() => Math.max(0, 100 - principalShare.value))

const strength = computed(() => {
  if (!props.result) return { label: 'Ready', className: 'status-badge--empty', detail: 'Enter a plan to calculate.' }

  const criticalWarning = props.result.warnings?.some((warning) =>
    /negative amortization|does not cover|more than 10 years|exceeds the original balance/i.test(warning),
  )
  const interestRatio = props.result.totalPaid ? props.result.totalInterest / props.result.totalPaid : 0
  const years = props.result.durationDays / 365.2425

  if (criticalWarning) {
    return { label: 'Caution', className: 'status-badge--behind', detail: 'The plan has a slow or interest-heavy payoff pattern.' }
  }
  if (years <= 2 && interestRatio <= 0.15) {
    return { label: 'Strong', className: 'status-badge--ahead', detail: 'Fast payoff with relatively limited interest.' }
  }
  if (years <= 5) {
    return { label: 'Steady', className: 'status-badge--on-track', detail: 'A workable payoff path with room to optimize.' }
  }
  return { label: 'Long-term', className: 'status-badge--behind', detail: 'A higher payment could reduce time and interest.' }
})

const comparison = computed(() => props.baseline?.comparison || null)
const baselineResult = computed(() => props.baseline?.result || null)

const timeSavedLabel = computed(() => {
  const days = comparison.value?.daysSaved
  if (days === null || days === undefined) return '—'
  if (days > 0) return formatDuration(days)
  if (days < 0) return `${formatDuration(Math.abs(days))} longer`
  return 'No change'
})

const interestSavedLabel = computed(() => {
  const amount = comparison.value?.interestSaved
  if (amount === null || amount === undefined) return '—'
  if (amount > 0) return formatCurrency(amount, props.currency)
  if (amount < 0) return `${formatCurrency(Math.abs(amount), props.currency)} more`
  return formatCurrency(0, props.currency)
})

const modeLabel = computed(() => ({
  fixed: 'Fixed payment plan',
  minimum: 'Changing minimum-payment plan',
  target: 'Target-date payment plan',
}[props.mode] || 'Payoff plan'))
</script>

<template>
  <!-- Result Overview | Summarizes payoff time, cost, warnings, and comparison -->
  <section class="panel results-summary" aria-labelledby="results-heading">
    <header class="panel__header panel__header--split">
      <div>
        <p class="eyebrow">Projection</p>
        <h2 id="results-heading">Your payoff outlook</h2>
        <p>Review the estimated timeline, cost, and major plan milestones.</p>
      </div>
      <span class="status-badge" :class="strength.className">{{ strength.label }}</span>
    </header>

    <div v-if="!result" class="empty-results">
      <strong>Your payoff plan will appear here.</strong>
      <p>Choose a planning mode, check the assumptions, and calculate.</p>
    </div>

    <div v-else class="results-summary__body" aria-live="polite">
      <div v-if="isStale" class="stale-banner">
        <span>Inputs changed after the last calculation.</span>
        <button type="button" class="button button--compact" @click="emit('recalculate')">Update results</button>
      </div>

      <article class="hero-result-card">
        <div>
          <span>{{ modeLabel }}</span>
          <strong>{{ formatDuration(result.durationDays) }}</strong>
          <p>Estimated payoff date: {{ formatDate(result.payoffDate) }}</p>
        </div>
        <div v-if="mode === 'target' && requiredStartingPayment !== null" class="hero-result-card__payment">
          <span>Required starting {{ frequencyLabel(result.frequency).toLowerCase() }} payment</span>
          <strong>{{ formatCurrency(requiredStartingPayment, currency) }}</strong>
        </div>
      </article>

      <div class="progress-track" aria-hidden="true">
        <span class="progress-fill" :style="{ width: `${principalShare}%` }"></span>
      </div>
      <div class="progress-copy">
        <span>{{ formatPercent(principalShare, 1) }} principal</span>
        <span>{{ formatPercent(interestShare, 1) }} interest</span>
      </div>

      <div class="kpi-grid">
        <article class="kpi-card kpi-card--primary">
          <span>Total interest</span>
          <strong>{{ formatCurrency(result.totalInterest, currency) }}</strong>
          <small>Estimated cost above the original principal.</small>
        </article>

        <article class="kpi-card">
          <span>Total paid</span>
          <strong>{{ formatCurrency(result.totalPaid, currency) }}</strong>
          <small>Principal, interest, recurring extras, and lump sums.</small>
        </article>

        <article class="kpi-card">
          <span>Scheduled payments</span>
          <strong>{{ formatNumber(result.paymentCount) }}</strong>
          <small>{{ frequencyLabel(result.frequency) }} base-payment events.</small>
        </article>

        <article class="kpi-card">
          <span>Final payment event</span>
          <strong>{{ formatCurrency(result.finalPayment, currency) }}</strong>
          <small>Reduced automatically to the estimated amount due.</small>
        </article>

        <article class="kpi-card">
          <span>Highest scheduled payment</span>
          <strong>{{ formatCurrency(result.highestScheduledPayment, currency) }}</strong>
          <small>Includes the effect of annual payment increases.</small>
        </article>

        <article class="kpi-card">
          <span>One-time payment used</span>
          <strong>{{ formatCurrency(result.lumpSumUsed, currency) }}</strong>
          <small>Never applies more than the remaining amount due.</small>
        </article>
      </div>

      <div class="insight-grid">
        <article class="insight-card">
          <span>First scheduled payment</span>
          <strong>{{ formatCurrency(result.startingPayment, currency) }}</strong>
          <small>
            {{ formatCurrency(result.firstPaymentInterest, currency) }} interest and
            {{ formatCurrency(result.firstPaymentPrincipal, currency) }} principal.
          </small>
        </article>
        <article class="insight-card">
          <span>Plan assessment</span>
          <strong>{{ strength.label }}</strong>
          <small>{{ strength.detail }}</small>
        </article>
      </div>

      <section v-if="baselineResult?.possible" class="comparison-block" aria-labelledby="comparison-heading">
        <div class="section-heading-row">
          <div>
            <h3 id="comparison-heading">Baseline comparison</h3>
            <p>
              {{ mode === 'target'
                ? 'Compares your boosted target plan with a flat monthly target plan.'
                : 'Compares your plan with the same base assumptions but without payoff boosters.' }}
            </p>
          </div>
        </div>

        <div v-if="mode === 'target'" class="comparison-grid">
          <article>
            <span>Your starting payment</span>
            <strong>{{ formatCurrency(requiredStartingPayment || 0, currency) }}</strong>
            <small>{{ frequencyLabel(result.frequency) }}</small>
          </article>
          <article>
            <span>Flat monthly baseline</span>
            <strong>{{ formatCurrency(baseline.requiredStartingPayment || 0, currency) }}</strong>
            <small>Monthly, without boosters</small>
          </article>
          <article>
            <span>Interest difference</span>
            <strong>{{ interestSavedLabel }}</strong>
            <small>Positive means your plan saves interest.</small>
          </article>
        </div>

        <div v-else class="comparison-grid">
          <article>
            <span>Time saved</span>
            <strong>{{ timeSavedLabel }}</strong>
            <small>Baseline payoff: {{ formatDate(comparison?.baselinePayoffDate) }}</small>
          </article>
          <article>
            <span>Interest saved</span>
            <strong>{{ interestSavedLabel }}</strong>
            <small>Baseline interest: {{ formatCurrency(comparison?.baselineInterest || 0, currency) }}</small>
          </article>
          <article>
            <span>Total-cost difference</span>
            <strong>{{ formatCurrency(comparison?.totalSaved || 0, currency) }}</strong>
            <small>Positive means your plan costs less overall.</small>
          </article>
        </div>
      </section>

      <section class="milestone-block" aria-labelledby="milestone-heading">
        <div class="section-heading-row">
          <div>
            <h3 id="milestone-heading">Payoff milestones</h3>
            <p>Approximate dates when the remaining balance crosses each threshold.</p>
          </div>
        </div>

        <div class="milestone-list">
          <article v-for="milestone in result.milestones" :key="milestone.percent" class="milestone-row">
            <span class="milestone-row__number" aria-hidden="true">{{ milestone.percent }}</span>
            <div>
              <strong>{{ milestone.label }}</strong>
              <small>{{ formatDate(milestone.date) }}</small>
            </div>
            <span>{{ milestone.paymentNumber ? `Event ${formatNumber(milestone.paymentNumber)}` : '—' }}</span>
          </article>
        </div>
      </section>

      <section v-if="result.warnings?.length" class="warning-block" aria-labelledby="warning-heading">
        <h3 id="warning-heading">Important assumptions and warnings</h3>
        <ul>
          <li v-for="warning in result.warnings" :key="warning">{{ warning }}</li>
        </ul>
      </section>

      <div class="result-actions">
        <button type="button" class="button" @click="emit('copy')">Copy summary</button>
        <button type="button" class="button button--secondary" @click="emit('print')">Print report</button>
      </div>
    </div>
  </section>
</template>

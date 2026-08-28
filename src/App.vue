<script setup>
import { nextTick, ref } from 'vue'
import AppHeader from './components/AppHeader.vue'
import AppIntro from './components/AppIntro.vue'
import AppGuide from './components/AppGuide.vue'
import PayoffChart from './components/PayoffChart.vue'
import PayoffForm from './components/PayoffForm.vue'
import PayoffTables from './components/PayoffTables.vue'
import PlanningModeSelector from './components/PlanningModeSelector.vue'
import ResultsOverview from './components/ResultsOverview.vue'
import { usePayoffPlanner } from './composables/usePayoffPlanner.js'
import { CURRENCIES } from './constants/currencies.js'
import { buildSummaryText, copyText } from './lib/exporters.js'

const formComponent = ref(null)
const resultAnchor = ref(null)

const {
  form,
  errors,
  result,
  baseline,
  requiredStartingPayment,
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
} = usePayoffPlanner()

async function handleCalculate() {
  const calculated = calculate()

  if (!calculated) {
    await nextTick()
    formComponent.value?.focusFirstError()
    return
  }

  await nextTick()
  if (window.matchMedia('(max-width: 980px)').matches) {
    resultAnchor.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

async function handleCopy() {
  const text = buildSummaryText({
    result: result.value,
    baseline: baseline.value,
    requiredStartingPayment: requiredStartingPayment.value,
    currency: form.currency,
    mode: form.mode,
  })

  try {
    const copied = await copyText(text)
    setNotice(
      copied ? 'Payoff summary copied to the clipboard.' : 'The payoff summary could not be copied.',
      copied ? 'success' : 'error',
    )
  } catch {
    setNotice('The payoff summary could not be copied in this browser.', 'error')
  }
}

function handlePrint() {
  window.print()
}
</script>

<template>
  <AppHeader />

  <main class="app-shell">
    <AppIntro />

    <PlanningModeSelector v-model="form.mode" />

    <div
      v-if="notice"
      class="app-notice"
      :class="`app-notice--${noticeTone}`"
      role="status"
      aria-live="polite"
    >
      {{ notice }}
    </div>

    <div class="workspace-grid">
      <PayoffForm
        ref="formComponent"
        :form="form"
        :errors="errors"
        :currencies="CURRENCIES"
        :is-stale="isStale"
        :is-calculating="isCalculating"
        :saved-settings-found="savedSettingsFound"
        @calculate="handleCalculate"
        @save="saveSettings"
        @reset="reset"
        @clear-saved="clearSavedSettings"
      />

      <div ref="resultAnchor">
        <ResultsOverview
          :result="result"
          :baseline="baseline"
          :required-starting-payment="requiredStartingPayment"
          :currency="form.currency"
          :mode="form.mode"
          :is-stale="isStale"
          @copy="handleCopy"
          @print="handlePrint"
          @recalculate="handleCalculate"
        />
      </div>
    </div>

    <template v-if="result">
      <PayoffChart :result="result" :currency="form.currency" />
      <PayoffTables :result="result" :currency="form.currency" />
    </template>

    <AppGuide />
  </main>
</template>

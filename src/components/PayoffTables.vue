<script setup>
import { computed, ref, watch } from 'vue'
import { downloadAnnualCsv, downloadScheduleCsv } from '../lib/exporters.js'
import { formatCurrency, formatDate, formatNumber } from '../lib/formatters.js'

const props = defineProps({
  result: {
    type: Object,
    required: true,
  },
  currency: {
    type: String,
    default: 'USD',
  },
})

const visibleRows = ref(120)
const pageSize = 120

const displayedSchedule = computed(() => props.result.schedule.slice(0, visibleRows.value))
const hasMoreRows = computed(() => visibleRows.value < props.result.schedule.length)

function loadMore() {
  visibleRows.value = Math.min(props.result.schedule.length, visibleRows.value + pageSize)
}

watch(() => props.result, () => {
  visibleRows.value = pageSize
})
</script>

<template>
  <!-- Payoff Tables | Shows annual totals and the full event-by-event ledger -->
  <section class="panel annual-breakdown" aria-labelledby="annual-heading">
    <header class="panel__header panel__header--split">
      <div>
        <p class="eyebrow">Annual breakdown</p>
        <h2 id="annual-heading">Year-by-year summary</h2>
        <p>Review how much goes toward interest and principal in each calendar year.</p>
      </div>
      <button
        type="button"
        class="button button--secondary button--compact"
        @click="downloadAnnualCsv(result, currency)"
      >
        Download annual CSV
      </button>
    </header>

    <div class="table-scroll">
      <table>
        <caption class="sr-only">Annual credit card payoff summary</caption>
        <thead>
          <tr>
            <th scope="col">Year</th>
            <th scope="col">Starting balance</th>
            <th scope="col">Payments</th>
            <th scope="col">Interest</th>
            <th scope="col">Principal</th>
            <th scope="col">Ending balance</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in result.annualSummary" :key="row.year">
            <th scope="row">{{ row.year }}</th>
            <td>{{ formatCurrency(row.startingBalance, currency) }}</td>
            <td>{{ formatCurrency(row.payments, currency) }}</td>
            <td>{{ formatCurrency(row.interest, currency) }}</td>
            <td :class="{ 'table-value--negative': row.principal < 0 }">
              {{ formatCurrency(row.principal, currency) }}
            </td>
            <td>{{ formatCurrency(row.endingBalance, currency) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <details class="panel monthly-breakdown">
    <summary>
      <span>
        <strong>Detailed payment schedule</strong>
        <small>{{ formatNumber(result.schedule.length) }} dated events, including recurring extras and one-time payments</small>
      </span>
      <span aria-hidden="true">+</span>
    </summary>

    <div class="monthly-breakdown__content">
      <div class="monthly-breakdown__actions">
        <p>
          Interest is accrued between dated events. An event may contain a scheduled payment, recurring extra, one-time payment, or a combination.
        </p>
        <button
          type="button"
          class="button button--secondary button--compact"
          @click="downloadScheduleCsv(result, currency)"
        >
          Download full CSV
        </button>
      </div>

      <div class="table-scroll table-scroll--schedule">
        <table>
          <caption class="sr-only">Detailed credit card payoff schedule</caption>
          <thead>
            <tr>
              <th scope="col">Event</th>
              <th scope="col">Date</th>
              <th scope="col">Type</th>
              <th scope="col">Starting balance</th>
              <th scope="col">Interest</th>
              <th scope="col">Scheduled</th>
              <th scope="col">Extra</th>
              <th scope="col">One-time</th>
              <th scope="col">Principal</th>
              <th scope="col">Ending balance</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in displayedSchedule" :key="`${row.number}-${row.date}-${row.type}`">
              <th scope="row">{{ formatNumber(row.number) }}</th>
              <td>{{ formatDate(row.date) }}</td>
              <td class="table-type">{{ row.type }}</td>
              <td>{{ formatCurrency(row.startBalance, currency) }}</td>
              <td>{{ formatCurrency(row.interest, currency) }}</td>
              <td>{{ formatCurrency(row.scheduledPayment, currency) }}</td>
              <td>{{ formatCurrency(row.extraPayment, currency) }}</td>
              <td>{{ formatCurrency(row.lumpSum, currency) }}</td>
              <td :class="{ 'table-value--negative': row.principal < 0 }">
                {{ formatCurrency(row.principal, currency) }}
              </td>
              <td>{{ formatCurrency(row.endBalance, currency) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="hasMoreRows" class="table-load-more">
        <span>
          Showing {{ formatNumber(displayedSchedule.length) }} of {{ formatNumber(result.schedule.length) }} events.
        </span>
        <button type="button" class="button button--ghost button--compact" @click="loadMore">
          Load {{ formatNumber(Math.min(pageSize, result.schedule.length - visibleRows)) }} more
        </button>
      </div>
    </div>
  </details>
</template>

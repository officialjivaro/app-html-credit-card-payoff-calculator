<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Chart from 'chart.js/auto'
import { formatCurrency, formatDate } from '../lib/formatters.js'

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

const canvas = ref(null)
let chart = null

function sampleSchedule(schedule, maximumPoints = 320) {
  const points = [
    {
      date: props.result.startDate,
      balance: props.result.startingBalance,
      cumulativeInterest: 0,
    },
    ...schedule.map((row) => ({
      date: row.date,
      balance: row.endBalance,
      cumulativeInterest: row.cumulativeInterest,
    })),
  ]

  if (points.length <= maximumPoints) return points

  const sampled = [points[0]]
  const step = (points.length - 2) / (maximumPoints - 2)

  for (let index = 1; index < maximumPoints - 1; index += 1) {
    sampled.push(points[Math.round(index * step)])
  }

  sampled.push(points.at(-1))
  return sampled
}

function chartColors() {
  const styles = getComputedStyle(document.documentElement)
  return {
    ink: styles.getPropertyValue('--ink-950').trim() || '#111820',
    muted: styles.getPropertyValue('--slate-500').trim() || '#7b8490',
    line: styles.getPropertyValue('--line').trim() || '#cfd6dc',
    copper: styles.getPropertyValue('--copper-deep').trim() || '#a76b33',
    coral: styles.getPropertyValue('--coral').trim() || '#c96b61',
    paper: styles.getPropertyValue('--paper-bright').trim() || '#fffefb',
  }
}

async function renderChart() {
  await nextTick()
  if (!canvas.value || !props.result) return

  chart?.destroy()
  chart = null

  const colors = chartColors()
  const points = sampleSchedule(props.result.schedule)

  const whiteBackground = {
    id: 'creditClearWhiteBackground',
    beforeDraw(instance) {
      const { ctx, width, height } = instance
      ctx.save()
      ctx.globalCompositeOperation = 'destination-over'
      ctx.fillStyle = colors.paper
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    },
  }

  chart = new Chart(canvas.value, {
    type: 'line',
    data: {
      labels: points.map((point) => point.date),
      datasets: [
        {
          label: 'Remaining balance',
          data: points.map((point) => point.balance),
          borderColor: colors.copper,
          backgroundColor: 'rgba(167, 107, 51, 0.12)',
          fill: true,
          borderWidth: 3,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.2,
        },
        {
          label: 'Cumulative interest',
          data: points.map((point) => point.cumulativeInterest),
          borderColor: colors.coral,
          backgroundColor: 'rgba(201, 107, 97, 0.08)',
          fill: false,
          borderWidth: 2,
          borderDash: [6, 5],
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      animation: {
        duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 280,
      },
      plugins: {
        title: {
          display: true,
          text: 'Balance and cumulative interest over time',
          color: colors.ink,
          align: 'start',
          font: {
            size: 16,
            weight: '700',
          },
          padding: {
            bottom: 18,
          },
        },
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            color: colors.ink,
            usePointStyle: true,
            padding: 18,
          },
        },
        tooltip: {
          callbacks: {
            title(items) {
              return formatDate(items[0]?.label)
            },
            label(context) {
              return `${context.dataset.label}: ${formatCurrency(context.parsed.y, props.currency)}`
            },
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Payment timeline',
            color: colors.ink,
            font: { weight: '700' },
          },
          ticks: {
            color: colors.muted,
            maxTicksLimit: 8,
            callback(value) {
              return formatDate(this.getLabelForValue(value))
            },
          },
          grid: {
            color: colors.line,
          },
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: `Amount (${props.currency})`,
            color: colors.ink,
            font: { weight: '700' },
          },
          ticks: {
            color: colors.muted,
            callback(value) {
              return formatCurrency(value, props.currency, { compact: true })
            },
          },
          grid: {
            color: colors.line,
          },
        },
      },
    },
    plugins: [whiteBackground],
  })
}

function downloadChart() {
  if (!chart) return
  const anchor = document.createElement('a')
  anchor.href = chart.toBase64Image('image/png', 1)
  anchor.download = 'credit-card-payoff-chart.png'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

onMounted(renderChart)
watch(() => [props.result, props.currency], renderChart, { deep: true })
onBeforeUnmount(() => chart?.destroy())
</script>

<template>
  <!-- Payoff Chart | Provides a labelled balance and interest visualization -->
  <section class="panel projection-section" aria-labelledby="chart-heading">
    <header class="panel__header panel__header--split">
      <div>
        <p class="eyebrow">Visual projection</p>
        <h2 id="chart-heading">Payoff trajectory</h2>
        <p>Track the estimated remaining balance alongside cumulative interest.</p>
      </div>
      <button type="button" class="button button--secondary button--compact" @click="downloadChart">
        Download PNG
      </button>
    </header>

    <div class="chart-frame">
      <canvas
        ref="canvas"
        role="img"
        :aria-label="`Line chart showing the ${currency} balance falling from ${formatCurrency(result.startingBalance, currency)} to zero by ${formatDate(result.payoffDate)}, while cumulative interest rises to ${formatCurrency(result.totalInterest, currency)}.`"
      ></canvas>
    </div>
    <p class="chart-summary">
      The projected balance reaches zero on {{ formatDate(result.payoffDate) }}. Estimated cumulative interest is
      {{ formatCurrency(result.totalInterest, currency) }}. Hover or focus the chart in a supported browser to inspect individual points.
    </p>
  </section>
</template>

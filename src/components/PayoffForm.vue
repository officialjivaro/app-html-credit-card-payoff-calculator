<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  form: { type: Object, required: true },
  errors: { type: Object, required: true },
  currencies: { type: Array, required: true },
  isStale: { type: Boolean, default: false },
  isCalculating: { type: Boolean, default: false },
  savedSettingsFound: { type: Boolean, default: false },
})

const emit = defineEmits(['calculate', 'save', 'reset', 'clear-saved'])
const formElement = ref(null)

const errorEntries = computed(() => Object.values(props.errors))
const amountStep = computed(() => ['JPY', 'KRW'].includes(props.form.currency) ? 1 : 0.01)

function handleAdvancedToggle(event) {
  props.form.advancedOpen = event.currentTarget.open
}

function focusFirstError() {
  const invalid = formElement.value?.querySelector('[aria-invalid="true"]')
  invalid?.focus()
}

defineExpose({ focusFirstError })
</script>

<template>
  <form ref="formElement" class="calculator-form panel" novalidate @submit.prevent="emit('calculate')">
    <header class="panel__header">
      <p class="eyebrow">Plan inputs</p>
      <h2>Build your payoff plan</h2>
      <p>Enter the essentials first. Optional payment boosters and promotional-rate assumptions are grouped below.</p>
    </header>

    <div v-if="errorEntries.length" class="form-error-summary" role="alert" aria-live="assertive">
      <strong>Check these fields:</strong>
      <ul>
        <li v-for="message in errorEntries" :key="message">{{ message }}</li>
      </ul>
    </div>

    <!-- Essentials | Core card and payment assumptions -->
    <fieldset class="form-section">
      <legend>Essentials</legend>
      <div class="form-grid">
        <label class="field">
          <span>Currency</span>
          <select v-model="form.currency">
            <option v-for="currency in currencies" :key="currency.code" :value="currency.code">
              {{ currency.code }} — {{ currency.label }}
            </option>
          </select>
        </label>

        <label class="field" :class="{ 'field--error': errors.balance }">
          <span>Current balance</span>
          <span class="input-with-unit">
            <input
              v-model.number="form.balance"
              type="number"
              inputmode="decimal"
              min="0"
              :step="amountStep"
              :aria-invalid="Boolean(errors.balance)"
              aria-describedby="balance-help balance-error"
            >
            <span>{{ form.currency }}</span>
          </span>
          <small id="balance-help">The statement balance you want to pay off.</small>
          <small v-if="errors.balance" id="balance-error" class="field-error">{{ errors.balance }}</small>
        </label>

        <label class="field" :class="{ 'field--error': errors.apr }">
          <span>Standard APR</span>
          <span class="input-with-unit">
            <input
              v-model.number="form.apr"
              type="number"
              inputmode="decimal"
              min="0"
              max="1000"
              step="0.01"
              :aria-invalid="Boolean(errors.apr)"
              aria-describedby="apr-error"
            >
            <span>%</span>
          </span>
          <small v-if="errors.apr" id="apr-error" class="field-error">{{ errors.apr }}</small>
        </label>

        <label class="field" :class="{ 'field--error': errors.startDate }">
          <span>Plan start date</span>
          <input
            v-model="form.startDate"
            type="date"
            :aria-invalid="Boolean(errors.startDate)"
            aria-describedby="start-date-error"
          >
          <small v-if="errors.startDate" id="start-date-error" class="field-error">{{ errors.startDate }}</small>
        </label>

        <template v-if="form.mode === 'fixed'">
          <label class="field">
            <span>Payment frequency</span>
            <select v-model="form.frequency">
              <option value="monthly">Monthly</option>
              <option value="biweekly">Biweekly</option>
              <option value="weekly">Weekly</option>
            </select>
          </label>

          <label class="field" :class="{ 'field--error': errors.fixedPayment }">
            <span>Recurring payment</span>
            <span class="input-with-unit">
              <input
                v-model.number="form.fixedPayment"
                type="number"
                inputmode="decimal"
                min="0"
                :step="amountStep"
                :aria-invalid="Boolean(errors.fixedPayment)"
                aria-describedby="fixed-payment-help fixed-payment-error"
              >
              <span>{{ form.currency }}</span>
            </span>
            <small id="fixed-payment-help">Amount paid at every selected interval.</small>
            <small v-if="errors.fixedPayment" id="fixed-payment-error" class="field-error">{{ errors.fixedPayment }}</small>
          </label>
        </template>

        <template v-else-if="form.mode === 'target'">
          <label class="field">
            <span>Payment frequency</span>
            <select v-model="form.frequency">
              <option value="monthly">Monthly</option>
              <option value="biweekly">Biweekly</option>
              <option value="weekly">Weekly</option>
            </select>
          </label>

          <label class="field" :class="{ 'field--error': errors.targetDate }">
            <span>Target payoff date</span>
            <input
              v-model="form.targetDate"
              type="date"
              :aria-invalid="Boolean(errors.targetDate)"
              aria-describedby="target-date-help target-date-error"
            >
            <small id="target-date-help">The result is the required starting payment.</small>
            <small v-if="errors.targetDate" id="target-date-error" class="field-error">{{ errors.targetDate }}</small>
          </label>
        </template>

        <template v-else>
          <div class="field field--static">
            <span>Statement frequency</span>
            <strong>Monthly</strong>
            <small>The estimated minimum is recalculated on every monthly statement date.</small>
          </div>

          <label class="field">
            <span>Minimum-payment formula</span>
            <select v-model="form.minimumFormula">
              <option value="interestPlusPrincipal">Interest + principal percentage</option>
              <option value="balancePercent">Percentage of current balance</option>
            </select>
          </label>

          <label
            v-if="form.minimumFormula === 'interestPlusPrincipal'"
            class="field"
            :class="{ 'field--error': errors.minimumPrincipalPercent }"
          >
            <span>Principal percentage</span>
            <span class="input-with-unit">
              <input
                v-model.number="form.minimumPrincipalPercent"
                type="number"
                inputmode="decimal"
                min="0"
                step="0.1"
                :aria-invalid="Boolean(errors.minimumPrincipalPercent)"
                aria-describedby="minimum-principal-error"
              >
              <span>%</span>
            </span>
            <small v-if="errors.minimumPrincipalPercent" id="minimum-principal-error" class="field-error">{{ errors.minimumPrincipalPercent }}</small>
          </label>

          <label
            v-else
            class="field"
            :class="{ 'field--error': errors.minimumBalancePercent }"
          >
            <span>Current-balance percentage</span>
            <span class="input-with-unit">
              <input
                v-model.number="form.minimumBalancePercent"
                type="number"
                inputmode="decimal"
                min="0"
                step="0.1"
                :aria-invalid="Boolean(errors.minimumBalancePercent)"
                aria-describedby="minimum-balance-error"
              >
              <span>%</span>
            </span>
            <small v-if="errors.minimumBalancePercent" id="minimum-balance-error" class="field-error">{{ errors.minimumBalancePercent }}</small>
          </label>

          <label class="field" :class="{ 'field--error': errors.minimumFloor }">
            <span>Minimum payment floor</span>
            <span class="input-with-unit">
              <input
                v-model.number="form.minimumFloor"
                type="number"
                inputmode="decimal"
                min="0"
                :step="amountStep"
                :aria-invalid="Boolean(errors.minimumFloor)"
                aria-describedby="minimum-floor-error"
              >
              <span>{{ form.currency }}</span>
            </span>
            <small v-if="errors.minimumFloor" id="minimum-floor-error" class="field-error">{{ errors.minimumFloor }}</small>
          </label>
        </template>
      </div>

      <p v-if="form.mode === 'minimum'" class="assumption-note">
        Default model: accrued statement interest plus 1% of principal, subject to the selected floor. Actual issuer formulas vary.
      </p>
    </fieldset>

    <!-- Advanced Assumptions | Optional payoff boosters and promotional APR -->
    <details class="advanced-disclosure" :open="form.advancedOpen" @toggle="handleAdvancedToggle">
      <summary>
        <span>
          <strong>Advanced assumptions</strong>
          <small>Recurring extras, a one-time payment, annual increases, and promotional APR</small>
        </span>
        <span aria-hidden="true">+</span>
      </summary>

      <div class="advanced-disclosure__content">
        <fieldset class="advanced-group">
          <legend>Recurring extra payment</legend>
          <div class="form-grid">
            <label class="field" :class="{ 'field--error': errors.extraAmount }">
              <span>Extra amount</span>
              <span class="input-with-unit">
                <input
                  v-model.number="form.extraAmount"
                  type="number"
                  inputmode="decimal"
                  min="0"
                  :step="amountStep"
                  :aria-invalid="Boolean(errors.extraAmount)"
                  aria-describedby="extra-amount-error"
                >
                <span>{{ form.currency }}</span>
              </span>
              <small v-if="errors.extraAmount" id="extra-amount-error" class="field-error">{{ errors.extraAmount }}</small>
            </label>

            <label class="field">
              <span>Extra-payment frequency</span>
              <select v-model="form.extraFrequency" :disabled="Number(form.extraAmount) <= 0">
                <option value="monthly">Monthly</option>
                <option value="biweekly">Biweekly</option>
                <option value="weekly">Weekly</option>
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset class="advanced-group">
          <legend>One-time payment</legend>
          <div class="form-grid">
            <label class="field" :class="{ 'field--error': errors.lumpAmount }">
              <span>Payment amount</span>
              <span class="input-with-unit">
                <input
                  v-model.number="form.lumpAmount"
                  type="number"
                  inputmode="decimal"
                  min="0"
                  :step="amountStep"
                  :aria-invalid="Boolean(errors.lumpAmount)"
                  aria-describedby="lump-amount-error"
                >
                <span>{{ form.currency }}</span>
              </span>
              <small v-if="errors.lumpAmount" id="lump-amount-error" class="field-error">{{ errors.lumpAmount }}</small>
            </label>

            <label class="field" :class="{ 'field--error': errors.lumpDate }">
              <span>Payment date</span>
              <input
                v-model="form.lumpDate"
                type="date"
                :disabled="Number(form.lumpAmount) <= 0"
                :aria-invalid="Boolean(errors.lumpDate)"
                aria-describedby="lump-date-error"
              >
              <small v-if="errors.lumpDate" id="lump-date-error" class="field-error">{{ errors.lumpDate }}</small>
            </label>
          </div>
        </fieldset>

        <fieldset v-if="form.mode !== 'minimum'" class="advanced-group">
          <legend>Annual scheduled-payment increase</legend>
          <div class="form-grid">
            <label class="field">
              <span>Increase type</span>
              <select v-model="form.annualIncreaseType">
                <option value="none">No annual increase</option>
                <option value="amount">Fixed amount</option>
                <option value="percent">Percentage</option>
              </select>
            </label>

            <label class="field" :class="{ 'field--error': errors.annualIncreaseValue }">
              <span>Annual increase</span>
              <span class="input-with-unit">
                <input
                  v-model.number="form.annualIncreaseValue"
                  type="number"
                  inputmode="decimal"
                  min="0"
                  :step="form.annualIncreaseType === 'percent' ? 0.1 : amountStep"
                  :disabled="form.annualIncreaseType === 'none'"
                  :aria-invalid="Boolean(errors.annualIncreaseValue)"
                  aria-describedby="annual-increase-error"
                >
                <span>{{ form.annualIncreaseType === 'percent' ? '%' : form.currency }}</span>
              </span>
              <small v-if="errors.annualIncreaseValue" id="annual-increase-error" class="field-error">{{ errors.annualIncreaseValue }}</small>
            </label>
          </div>
        </fieldset>

        <fieldset class="advanced-group choice-section">
          <legend>Promotional APR</legend>
          <label class="checkbox-field checkbox-field--full">
            <input v-model="form.promoEnabled" type="checkbox">
            Use a temporary promotional APR
          </label>

          <div v-if="form.promoEnabled" class="form-grid form-grid--full-width">
            <label class="field" :class="{ 'field--error': errors.promoApr }">
              <span>Promotional APR</span>
              <span class="input-with-unit">
                <input
                  v-model.number="form.promoApr"
                  type="number"
                  inputmode="decimal"
                  min="0"
                  max="1000"
                  step="0.01"
                  :aria-invalid="Boolean(errors.promoApr)"
                  aria-describedby="promo-apr-error"
                >
                <span>%</span>
              </span>
              <small v-if="errors.promoApr" id="promo-apr-error" class="field-error">{{ errors.promoApr }}</small>
            </label>

            <label class="field" :class="{ 'field--error': errors.promoEndDate }">
              <span>Promotional APR ends</span>
              <input
                v-model="form.promoEndDate"
                type="date"
                :aria-invalid="Boolean(errors.promoEndDate)"
                aria-describedby="promo-end-error"
              >
              <small v-if="errors.promoEndDate" id="promo-end-error" class="field-error">{{ errors.promoEndDate }}</small>
            </label>
          </div>
        </fieldset>
      </div>
    </details>

    <p v-if="isStale" class="stale-note">Inputs changed. Calculate again to refresh the result cards, chart, and tables.</p>

    <div class="form-actions">
      <button type="submit" class="button" :disabled="isCalculating">
        {{ isCalculating ? 'Calculating…' : 'Calculate' }}
      </button>
      <button type="button" class="button button--secondary" @click="emit('save')">Save settings</button>
      <button type="button" class="button button--ghost" @click="emit('reset')">Reset</button>
      <button type="button" class="button button--ghost" :disabled="!savedSettingsFound" @click="emit('clear-saved')">
        Clear saved
      </button>
    </div>
  </form>
</template>

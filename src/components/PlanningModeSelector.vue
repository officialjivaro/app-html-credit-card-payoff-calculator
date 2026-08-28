<script setup>
const props = defineProps({
  modelValue: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['update:modelValue'])

const modes = [
  {
    value: 'fixed',
    name: 'Fixed payment',
    description: 'Use one recurring payment and optional payoff boosters.',
  },
  {
    value: 'minimum',
    name: 'Changing minimum',
    description: 'Recalculate an estimated statement minimum every month.',
  },
  {
    value: 'target',
    name: 'Target payoff date',
    description: 'Solve for the required starting payment by a chosen date.',
  },
]
</script>

<template>
  <section class="mode-selector" aria-labelledby="mode-heading">
    <div>
      <p class="eyebrow">Planning mode</p>
      <h2 id="mode-heading">How do you want to plan the payoff?</h2>
      <p>Choose a payment method first. You can then add recurring extras, a lump sum, annual increases, or a promotional APR.</p>
    </div>

    <div class="mode-selector__options" role="radiogroup" aria-label="Payoff planning mode">
      <button
        v-for="mode in modes"
        :key="mode.value"
        type="button"
        class="mode-option"
        :class="{ 'mode-option--active': props.modelValue === mode.value }"
        role="radio"
        :aria-checked="props.modelValue === mode.value"
        @click="emit('update:modelValue', mode.value)"
      >
        <strong>{{ mode.name }}</strong>
        <span>{{ mode.description }}</span>
      </button>
    </div>
  </section>
</template>

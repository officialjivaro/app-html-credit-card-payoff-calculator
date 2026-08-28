<script setup>
const faqs = [
  {
    question: 'Does paying weekly or biweekly always save interest?',
    answer: 'More frequent payments can reduce the average balance when money reaches the card earlier, but the result depends on the amount paid at each interval and the issuer’s interest method.',
  },
  {
    question: 'How does the calculator estimate a changing minimum payment?',
    answer: 'It recalculates the estimated minimum each monthly statement using either a percentage of the current balance or accrued interest plus a chosen principal percentage, subject to a minimum currency floor.',
  },
  {
    question: 'What does target payoff date mode calculate?',
    answer: 'It estimates the starting recurring payment required to pay the balance by the selected date while including the promotional rate, extra payments, lump sum, and annual payment increases entered in the plan.',
  },
  {
    question: 'Will the estimate match a credit card statement exactly?',
    answer: 'Not necessarily. Issuers may use average daily balances, compounding conventions, fees, statement timing, and minimum-payment rules that differ from this simplified daily-interest model.',
  },
  {
    question: 'Does changing the currency convert the amounts?',
    answer: 'No. Currency selection changes number formatting only. The calculator does not fetch exchange rates or convert values.',
  },
  {
    question: 'Is the information entered into the calculator private?',
    answer: 'Calculator values and saved settings remain in this browser and are not submitted to Nortune. General page-level analytics may record a visit, but they must not receive balances, APRs, payments, dates, or other calculator inputs.',
  },
]
</script>

<template>
  <!-- App Guide | Explains methodology, assumptions, and common questions -->
  <section class="guide-section" aria-labelledby="guide-heading">
    <header class="section-header">
      <p class="eyebrow">Methodology</p>
      <h2 id="guide-heading">How this payoff estimate works</h2>
      <p>
        The calculator builds a dated ledger, accrues simple daily interest between events, applies each payment in sequence, and stops when the estimated amount due reaches zero.
      </p>
    </header>

    <div class="guide-grid">
      <article>
        <span>01</span>
        <h3>Daily interest</h3>
        <p>Interest is estimated from the entered APR using a 365-day daily rate. Promotional and standard APR periods are split at the selected transition date.</p>
      </article>
      <article>
        <span>02</span>
        <h3>Dated payments</h3>
        <p>Monthly dates preserve the plan’s start day where possible. Weekly and biweekly events occur every 7 or 14 days.</p>
      </article>
      <article>
        <span>03</span>
        <h3>Changing minimums</h3>
        <p>Minimum-payment mode recalculates the estimate at every monthly statement rather than treating one minimum amount as permanent.</p>
      </article>
      <article>
        <span>04</span>
        <h3>Exact final payment</h3>
        <p>The final event is reduced to the remaining balance plus accrued interest, preventing the projection from deliberately overpaying the account.</p>
      </article>
    </div>
  </section>

  <section class="faq-section" aria-labelledby="faq-heading">
    <header class="section-header">
      <p class="eyebrow">Questions</p>
      <h2 id="faq-heading">Credit card payoff calculator FAQ</h2>
      <p>Important context for interpreting the projection and comparing it with your actual statement.</p>
    </header>

    <div class="faq-list">
      <details v-for="faq in faqs" :key="faq.question">
        <summary>{{ faq.question }}<span aria-hidden="true">+</span></summary>
        <p>{{ faq.answer }}</p>
      </details>
    </div>
  </section>

  <aside class="app-disclaimer" aria-label="Financial estimate disclaimer">
    <strong>Estimate, not financial advice.</strong>
    <p>
      This tool does not include new purchases, fees, penalties, issuer-specific compounding, grace periods, or every minimum-payment rule. Confirm important payoff decisions with your card issuer or a qualified financial professional.
    </p>
  </aside>
</template>

# Credit Card Payoff Calculator

Complete Vue and Vite source for the Credit Card Payoff Calculator published by Nortune.

The normal production build creates the exact embedded runtime used at:

https://nortune.net/calculators/credit-card-payoff-calculator/app/

## Commands

- npm install: install the locked dependencies.
- npm run dev: start Vite for source development.
- npm run verify: validate source structure and payoff calculations.
- npm run build: build and apply Nortune runtime integration.
- npm run verify:dist: compare dist with the checked-in Nortune runtime manifest.
- npm run qc: run all source, build, built-app, and parity checks.

The dist directory is intentionally committed so the repository contains both editable source and the reviewed built application. The runtime directory contains the deterministic Nortune HTML template, storage guard, accessibility fixes, configuration, and authoritative file manifest.

Do not hand-edit dist. Update source or runtime inputs, run npm run qc, review the output, and synchronize the approved build with website-nortune-net.

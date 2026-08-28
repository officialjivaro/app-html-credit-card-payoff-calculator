import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CURRENCIES, formatCurrency } from '../src/lib/formatters.js'
import {
  calculateBaseline,
  calculatePlan,
  simulateFixedPlan,
} from '../src/lib/payoffEngine.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const checkDist = process.argv.includes('--dist')

function baseConfig(overrides = {}) {
  return {
    currency: 'USD',
    fractionDigits: 2,
    balance: 1_200,
    apr: 0,
    startDate: '2026-08-08',
    mode: 'fixed',
    baseFrequency: 'monthly',
    basePayment: 100,
    minimumFormula: 'interestPlusPrincipal',
    minimumBalancePercent: 2,
    minimumPrincipalPercent: 1,
    minimumFloor: 25,
    targetDate: '2027-08-08',
    recurringExtra: 0,
    extraFrequency: 'monthly',
    lumpSum: 0,
    lumpSumDate: '2027-02-08',
    annualIncreaseType: 'none',
    annualIncreaseAmount: 0,
    promoAprEnabled: false,
    promoApr: 0,
    promoEndDate: '2027-08-08',
    ...overrides,
  }
}

function close(actual, expected, tolerance = 0.01, label = 'value') {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, received ${actual}`)
}

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(directory, entry.name)
    return entry.isDirectory() ? listFiles(absolute) : [absolute]
  })
}

// Calculation Tests | Verify deterministic and edge-case behavior
const zeroInterest = calculatePlan(baseConfig())
assert.equal(zeroInterest.possible, true)
assert.equal(zeroInterest.result.paymentCount, 12)
close(zeroInterest.result.totalInterest, 0, 0.001, 'zero-interest total interest')
close(zeroInterest.result.totalPaid, 1_200, 0.001, 'zero-interest total paid')
close(zeroInterest.result.finalPayment, 100, 0.001, 'zero-interest final payment')
assert.equal(zeroInterest.result.payoffDate, '2027-08-08')
assert.equal(zeroInterest.result.remainingBalance, 0)

const target = calculatePlan(baseConfig({ mode: 'target', basePayment: 0 }))
assert.equal(target.possible, true)
close(target.requiredStartingPayment, 100, 0.001, 'target starting payment')
assert.equal(target.result.payoffDate, '2027-08-08')

const boostedTargetConfig = baseConfig({
  balance: 5_000,
  apr: 22.99,
  mode: 'target',
  baseFrequency: 'biweekly',
  targetDate: '2028-08-08',
  recurringExtra: 25,
  extraFrequency: 'monthly',
  lumpSum: 300,
  lumpSumDate: '2027-02-08',
  annualIncreaseType: 'percent',
  annualIncreaseAmount: 5,
  promoAprEnabled: true,
  promoApr: 0,
  promoEndDate: '2027-02-08',
})
const boostedTarget = calculatePlan(boostedTargetConfig)
const boostedTargetBaseline = calculateBaseline(boostedTargetConfig, boostedTarget.result)
assert.equal(boostedTarget.possible, true)
assert.equal(boostedTarget.result.payoffDate, '2028-08-08')
assert.ok(boostedTarget.requiredStartingPayment < boostedTargetBaseline.requiredStartingPayment)
assert.ok(boostedTargetBaseline.comparison)
assert.ok(boostedTarget.result.warnings.some((warning) => warning.includes('required starting payment')))

const oversizedLump = calculatePlan(baseConfig({
  balance: 1_200,
  apr: 19.99,
  lumpSum: 5_000,
  lumpSumDate: '2026-08-08',
}))
assert.equal(oversizedLump.possible, true)
assert.equal(oversizedLump.result.payoffDate, '2026-08-08')
assert.equal(oversizedLump.result.remainingBalance, 0)
close(oversizedLump.result.lumpSumUsed, 1_200, 0.001, 'oversized lump sum used')
assert.ok(oversizedLump.result.schedule.every((row) => row.endBalance >= 0))

const standardPlan = calculatePlan(baseConfig({
  balance: 5_000,
  apr: 22.99,
  basePayment: 250,
}))
const boostedPlan = calculatePlan(baseConfig({
  balance: 5_000,
  apr: 22.99,
  basePayment: 250,
  recurringExtra: 50,
}))
assert.equal(standardPlan.possible, true)
assert.equal(boostedPlan.possible, true)
assert.ok(boostedPlan.result.totalInterest < standardPlan.result.totalInterest)
assert.ok(boostedPlan.result.durationDays < standardPlan.result.durationDays)

const comparison = calculateBaseline(baseConfig({
  balance: 5_000,
  apr: 22.99,
  basePayment: 250,
  recurringExtra: 50,
}))
assert.equal(comparison.possible, true)
assert.ok(comparison.comparison.interestSaved > 0)
assert.ok(comparison.comparison.daysSaved > 0)

const lumpPlan = calculatePlan(baseConfig({
  balance: 5_000,
  apr: 22.99,
  basePayment: 250,
  lumpSum: 500,
  lumpSumDate: '2026-08-08',
}))
assert.equal(lumpPlan.result.schedule[0].date, '2026-08-08')
close(lumpPlan.result.schedule[0].lumpSum, 500, 0.001, 'starting lump sum')
close(lumpPlan.result.lumpSumUsed, 500, 0.001, 'lump sum used')
assert.ok(lumpPlan.result.schedule.every((row) => row.endBalance >= 0))

const promoPlan = calculatePlan(baseConfig({
  balance: 5_000,
  apr: 22.99,
  basePayment: 250,
  promoAprEnabled: true,
  promoApr: 0,
  promoEndDate: '2027-08-08',
}))
assert.ok(promoPlan.result.totalInterest < standardPlan.result.totalInterest)

const minimumPlan = calculatePlan(baseConfig({
  mode: 'minimum',
  balance: 5_000,
  apr: 24.99,
  minimumFormula: 'interestPlusPrincipal',
  minimumPrincipalPercent: 1,
  minimumFloor: 25,
}))
assert.equal(minimumPlan.possible, true)
const minimumRows = minimumPlan.result.schedule.filter((row) => row.scheduledPayment > 0)
assert.ok(minimumRows.length > 12)
assert.notEqual(minimumRows[0].scheduledPayment, minimumRows.at(-1).scheduledPayment)

const annualIncrease = calculatePlan(baseConfig({
  balance: 5_000,
  apr: 18,
  basePayment: 130,
  annualIncreaseType: 'fixed',
  annualIncreaseAmount: 20,
}))
assert.equal(annualIncrease.possible, true)
assert.ok(annualIncrease.result.highestScheduledPayment > annualIncrease.result.startingPayment)

const weekly = calculatePlan(baseConfig({
  balance: 1_200,
  apr: 0,
  baseFrequency: 'weekly',
  basePayment: 25,
}))
assert.equal(weekly.possible, true)
assert.equal(weekly.result.paymentCount, 48)
close(weekly.result.totalPaid, 1_200, 0.001, 'weekly total paid')

const insufficient = simulateFixedPlan({
  balance: 10_000,
  apr: 35,
  startDate: '2026-08-08',
  frequency: 'monthly',
  startingPayment: 10,
  fractionDigits: 2,
  maxYears: 5,
})
assert.equal(insufficient.possible, false)
assert.ok(insufficient.warnings.length > 0)
assert.ok(insufficient.schedule.length < 1_000)

assert.ok(CURRENCIES.length >= 20, 'At least 20 currencies must be available.')
assert.match(formatCurrency(1_234, 'JPY'), /1,234/)
assert.doesNotMatch(formatCurrency(1_234, 'JPY'), /\.00/)

// Project Tests | Verify required source files and safe packaging signals
const requiredFiles = [
  'index.html',
  'package.json',
  'package-lock.json',
  'vite.config.js',
  'src/main.js',
  'src/App.vue',
  'src/styles/tokens.css',
  'src/styles/global.css',
  'src/lib/payoffEngine.js',
  'src/lib/formatters.js',
  'src/lib/exporters.js',
  'src/composables/usePayoffPlanner.js',
  'src/components/AppHeader.vue',
  'src/components/AppIntro.vue',
  'src/components/PlanningModeSelector.vue',
  'src/components/PayoffForm.vue',
  'src/components/ResultsOverview.vue',
  'src/components/PayoffChart.vue',
  'src/components/PayoffTables.vue',
  'src/components/AppGuide.vue',
]

requiredFiles.forEach((file) => assert.ok(existsSync(join(root, file)), `Missing required file: ${file}`))

const sourceFiles = listFiles(root).filter((file) => !file.includes(`${join(root, 'node_modules')}`))
const sourceText = sourceFiles
  .filter((file) => /\.(?:js|vue|css|html|json|npmrc)$/.test(file))
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n')

assert.doesNotMatch(sourceText, /https?:\/\/(?:www\.)?aerod\.net/i, 'Aerod navigation must not use absolute domain URLs.')
assert.doesNotMatch(sourceText, /packages\.applied-caas|artifactory|openai\.org\/artifactory/i, 'Internal package registry URLs are forbidden.')

const lockText = readFileSync(join(root, 'package-lock.json'), 'utf8')
assert.doesNotMatch(lockText, /packages\.applied-caas|artifactory|openai/i, 'package-lock.json contains a forbidden internal registry URL.')
const resolvedHosts = [...lockText.matchAll(/"resolved"\s*:\s*"(https?:\/\/[^/]+)/g)].map((match) => match[1])
resolvedHosts.forEach((host) => assert.equal(host, 'https://registry.npmjs.org', `Unexpected package registry host: ${host}`))

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const packageLock = JSON.parse(lockText)
const lockedPackages = packageLock.packages || {}
assert.equal(packageJson.dependencies.vue, '3.5.13')
assert.equal(packageJson.dependencies['chart.js'], '4.5.1')
assert.equal(packageJson.devDependencies['@vitejs/plugin-vue'], '5.2.3')
assert.equal(packageJson.devDependencies.vite, '6.4.3')
assert.equal(packageJson.scripts.build, 'vite build && node scripts/build-nortune-runtime.mjs')
assert.deepEqual(lockedPackages[''].dependencies, packageJson.dependencies)
assert.deepEqual(lockedPackages[''].devDependencies, packageJson.devDependencies)
assert.equal(lockedPackages['node_modules/vue']?.version, packageJson.dependencies.vue)
assert.equal(lockedPackages['node_modules/chart.js']?.version, packageJson.dependencies['chart.js'])
assert.equal(lockedPackages['node_modules/@vitejs/plugin-vue']?.version, packageJson.devDependencies['@vitejs/plugin-vue'])
assert.equal(lockedPackages['node_modules/vite']?.version, packageJson.devDependencies.vite)
assert.ok(Object.keys(lockedPackages).length >= 80, 'package-lock.json is missing transitive package entries.')
assert.equal(lockedPackages['node_modules/vue-router'], undefined, 'Vue Router must not be included in this single-page app.')

const npmrc = readFileSync(join(root, '.npmrc'), 'utf8')
assert.match(npmrc, /registry=https:\/\/registry\.npmjs\.org\//)
assert.doesNotMatch(npmrc, /applied-caas|artifactory|openai/i)

if (checkDist) {
  const dist = join(root, 'dist')
  assert.ok(existsSync(dist) && statSync(dist).isDirectory(), 'dist/ does not exist. Run npm run build first.')
  const entries = readdirSync(dist).sort()
  assert.deepEqual(entries, ['assets', 'index.html'], 'dist/ root must contain only assets/ and index.html.')
  assert.ok(readdirSync(join(dist, 'assets')).length > 0, 'dist/assets/ must not be empty.')
}

console.log(`Verified ${requiredFiles.length} required files, ${CURRENCIES.length} currencies, and all payoff calculation checks.`)
if (checkDist) console.log('Verified dist/ contains only index.html and assets/.')

export const CURRENCIES = [
  { code: 'USD', label: 'US dollar', locale: 'en-US', fractionDigits: 2 },
  { code: 'EUR', label: 'Euro', locale: 'en-IE', fractionDigits: 2 },
  { code: 'GBP', label: 'British pound', locale: 'en-GB', fractionDigits: 2 },
  { code: 'JPY', label: 'Japanese yen', locale: 'ja-JP', fractionDigits: 0 },
  { code: 'CAD', label: 'Canadian dollar', locale: 'en-CA', fractionDigits: 2 },
  { code: 'AUD', label: 'Australian dollar', locale: 'en-AU', fractionDigits: 2 },
  { code: 'NZD', label: 'New Zealand dollar', locale: 'en-NZ', fractionDigits: 2 },
  { code: 'CHF', label: 'Swiss franc', locale: 'de-CH', fractionDigits: 2 },
  { code: 'CNY', label: 'Chinese yuan', locale: 'zh-CN', fractionDigits: 2 },
  { code: 'HKD', label: 'Hong Kong dollar', locale: 'en-HK', fractionDigits: 2 },
  { code: 'SGD', label: 'Singapore dollar', locale: 'en-SG', fractionDigits: 2 },
  { code: 'INR', label: 'Indian rupee', locale: 'en-IN', fractionDigits: 2 },
  { code: 'KRW', label: 'South Korean won', locale: 'ko-KR', fractionDigits: 0 },
  { code: 'BRL', label: 'Brazilian real', locale: 'pt-BR', fractionDigits: 2 },
  { code: 'MXN', label: 'Mexican peso', locale: 'es-MX', fractionDigits: 2 },
  { code: 'SEK', label: 'Swedish krona', locale: 'sv-SE', fractionDigits: 2 },
  { code: 'NOK', label: 'Norwegian krone', locale: 'nb-NO', fractionDigits: 2 },
  { code: 'DKK', label: 'Danish krone', locale: 'da-DK', fractionDigits: 2 },
  { code: 'PLN', label: 'Polish złoty', locale: 'pl-PL', fractionDigits: 2 },
  { code: 'ZAR', label: 'South African rand', locale: 'en-ZA', fractionDigits: 2 },
  { code: 'AED', label: 'UAE dirham', locale: 'en-AE', fractionDigits: 2 },
  { code: 'SAR', label: 'Saudi riyal', locale: 'ar-SA', fractionDigits: 2 },
]

export const currencies = CURRENCIES

export function getCurrencyDefinition(code = 'USD') {
  return CURRENCIES.find((currency) => currency.code === code) || CURRENCIES[0]
}

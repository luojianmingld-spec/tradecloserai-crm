/**
 * Number-to-words (English) for SAY TOTAL US DOLLARS ... ONLY
 * Supports up to billions; handles cents.
 */

const ONES = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
  'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN',
  'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
const TENS = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
const SCALES = ['', 'THOUSAND', 'MILLION', 'BILLION'];

function below1000(n) {
  let s = '';
  const h = Math.floor(n / 100);
  const rem = n % 100;
  if (h) s += ONES[h] + ' HUNDRED' + (rem ? ' ' : '');
  if (rem < 20) {
    s += ONES[rem];
  } else {
    const t = Math.floor(rem / 10);
    const o = rem % 10;
    s += TENS[t] + (o ? '-' + ONES[o] : '');
  }
  return s.trim();
}

function integerToWords(n) {
  if (n === 0) return 'ZERO';
  let parts = [];
  let scaleIdx = 0;
  while (n > 0) {
    const chunk = n % 1000;
    if (chunk > 0) {
      const chunkStr = below1000(chunk) + (SCALES[scaleIdx] ? ' ' + SCALES[scaleIdx] : '');
      parts.unshift(chunkStr);
    }
    n = Math.floor(n / 1000);
    scaleIdx++;
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export function numberToWords(num, currency = 'USD') {
  const CURRENCY_MAP = {
    USD: { major: 'US DOLLARS', minor: 'CENTS' },
    EUR: { major: 'EUROS', minor: 'CENTS' },
    CNY: { major: 'YUAN', minor: 'FEN' },
    GBP: { major: 'POUNDS STERLING', minor: 'PENCE' },
  };
  const c = CURRENCY_MAP[currency] || CURRENCY_MAP.USD;

  if (isNaN(num) || num < 0) return '';
  const n = Math.round(num * 100) / 100;
  const dollars = Math.floor(n);
  const cents = Math.round((n - dollars) * 100);

  let result = 'SAY TOTAL ' + integerToWords(dollars) + ' ' + c.major;
  if (cents > 0) {
    result += ' AND ' + integerToWords(cents) + ' ' + c.minor;
  }
  result += ' ONLY';
  return result;
}

export default numberToWords;

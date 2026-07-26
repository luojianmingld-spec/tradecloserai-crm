/**
 * 手机号国际区号 → 国家/地区 → 语言映射
 * 用于自动化营销的问候、动态、案例内容生成本地化
 */

// 区号到国家代码映射 (ISO 3166-1 alpha-2)
export const phonePrefixToCountry = {
  // 北美
  '1': 'US',      // US/CA (默认US)
  '1204': 'CA', '1226': 'CA', '1236': 'CA', '1249': 'CA', '1250': 'CA',
  '1289': 'CA', '1306': 'CA', '1343': 'CA', '1365': 'CA', '1403': 'CA',
  '1416': 'CA', '1418': 'CA', '1431': 'CA', '1437': 'CA', '1438': 'CA',
  '1450': 'CA', '1506': 'CA', '1514': 'CA', '1519': 'CA', '1548': 'CA',
  '1579': 'CA', '1581': 'CA', '1587': 'CA', '1604': 'CA', '1613': 'CA',
  '1639': 'CA', '1647': 'CA', '1672': 'CA', '1705': 'CA', '1709': 'CA',
  '1778': 'CA', '1780': 'CA', '1782': 'CA', '1807': 'CA', '1819': 'CA',
  '1825': 'CA', '1867': 'CA', '1873': 'CA', '1902': 'CA', '1905': 'CA',
  // 欧洲
  '44': 'GB', '33': 'FR', '49': 'DE', '34': 'ES', '39': 'IT',
  '31': 'NL', '32': 'BE', '41': 'CH', '43': 'AT', '46': 'SE',
  '47': 'NO', '45': 'DK', '358': 'FI', '351': 'PT', '30': 'GR',
  '48': 'PL', '380': 'UA', '40': 'RO', '420': 'CZ', '36': 'HU',
  '7': 'RU', '375': 'BY', '371': 'LV', '370': 'LT', '372': 'EE',
  '353': 'IE', '352': 'LU', '386': 'SI', '421': 'SK',
  // 中东
  '966': 'SA', '971': 'AE', '974': 'QA', '965': 'KW', '973': 'BH',
  '968': 'OM', '962': 'JO', '961': 'LB', '963': 'SY', '964': 'IQ',
  '972': 'IL', '98': 'IR', '90': 'TR',
  // 南亚
  '91': 'IN', '92': 'PK', '880': 'BD', '94': 'LK', '977': 'NP',
  // 东南亚
  '65': 'SG', '60': 'MY', '66': 'TH', '62': 'ID', '63': 'PH',
  '84': 'VN', '855': 'KH', '95': 'MM', '856': 'LA', '673': 'BN',
  // 东亚
  '86': 'CN', '81': 'JP', '82': 'KR', '852': 'HK', '853': 'MO', '886': 'TW',
  // 大洋洲
  '61': 'AU', '64': 'NZ', '679': 'FJ', '675': 'PG',
  // 拉美
  '52': 'MX', '54': 'AR', '55': 'BR', '56': 'CL', '57': 'CO',
  '51': 'PE', '58': 'VE', '591': 'BO', '593': 'EC', '595': 'PY',
  '598': 'UY', '507': 'PA', '503': 'SV', '504': 'HN', '505': 'NI',
  '506': 'CR', '502': 'GT', '592': 'GY', '509': 'HT', '1809': 'DO',
  '1829': 'DO', '1849': 'DO', '53': 'CU', '1787': 'PR', '1939': 'PR',
  // 非洲
  '27': 'ZA', '20': 'EG', '213': 'DZ', '216': 'TN', '212': 'MA',
  '234': 'NG', '254': 'KE', '255': 'TZ', '256': 'UG', '233': 'GH',
  '251': 'ET', '258': 'MZ', '263': 'ZW', '260': 'ZM', '265': 'MW',
  '267': 'BW', '264': 'NA', '221': 'SN', '225': 'CI', '237': 'CM',
  '244': 'AO', '243': 'CD', '249': 'SD', '218': 'LY',
  // 中亚
  '76': 'KZ', '77': 'KZ', '992': 'TJ', '996': 'KG', '993': 'TM', '998': 'UZ',
  '93': 'AF',
};

// 国家 → 主要语言 (BCP 47)
export const countryToLanguage = {
  US: 'en', CA: 'en', GB: 'en', AU: 'en', NZ: 'en', IE: 'en', SG: 'en',
  ZA: 'en', NG: 'en', GH: 'en', KE: 'en', TZ: 'en', UG: 'en', PK: 'en',
  HK: 'en', MY: 'en', IN: 'en', PH: 'en',
  FR: 'fr', BE: 'fr', LU: 'fr', CH: 'fr', MC: 'fr', SN: 'fr', CI: 'fr',
  CM: 'fr', MA: 'fr', DZ: 'fr', TN: 'fr',
  ES: 'es', MX: 'es', AR: 'es', CL: 'es', CO: 'es', PE: 'es', VE: 'es',
  EC: 'es', BO: 'es', PY: 'es', UY: 'es', PA: 'es', SV: 'es', HN: 'es',
  NI: 'es', CR: 'es', GT: 'es', DO: 'es', PR: 'es', CU: 'es', GY: 'es',
  PT: 'pt', BR: 'pt', AO: 'pt', MZ: 'pt',
  DE: 'de', AT: 'de', CH: 'de', LU: 'de',
  IT: 'it', CH: 'it',
  NL: 'nl', BE: 'nl',
  SE: 'sv', NO: 'no', DK: 'da', FI: 'fi', IS: 'is',
  PL: 'pl', CZ: 'cs', SK: 'sk', HU: 'hu', RO: 'ro', BG: 'bg', HR: 'hr',
  SR: 'sr', SL: 'sl', UA: 'uk', RU: 'ru', BY: 'ru', KZ: 'ru',
  GR: 'el', CY: 'el',
  TR: 'tr',
  SA: 'ar', AE: 'ar', QA: 'ar', KW: 'ar', BH: 'ar', OM: 'ar', JO: 'ar',
  LB: 'ar', SY: 'ar', IQ: 'ar', IL: 'ar', EG: 'ar', LY: 'ar', SD: 'ar',
  YE: 'ar', TN: 'ar', MA: 'ar', DZ: 'ar',
  IR: 'fa', AF: 'fa',
  CN: 'zh', TW: 'zh', MO: 'zh',
  JP: 'ja', KR: 'ko',
  TH: 'th', VN: 'vi', ID: 'id', KH: 'km', LA: 'lo', MM: 'my', BN: 'ms',
  BD: 'bn', LK: 'si', NP: 'ne',
  IL: 'he',
  ET: 'am',
  ZW: 'en', ZM: 'en', BW: 'en', NA: 'en', MW: 'en',
  UZ: 'uz', KG: 'ky', TJ: 'tg', TM: 'tk',
  CD: 'fr',
};

// 国家周末配置: 哪些天是周末(0=周日, 6=周六)
export const countryWeekend = {
  // 周五-周六周末 (伊斯兰国家)
  SA: [5, 6], AE: [5, 6], QA: [5, 6], KW: [5, 6], BH: [5, 6], OM: [5, 6],
  YE: [5, 6],
  // 周六-周日周末 (大部分国家) - default
  // 周日-周一周末 (少数国家)
};

// 语言名称映射（用于AI prompt）
export const languageNames = {
  en: 'English', zh: 'Chinese (Simplified)', ja: 'Japanese', ko: 'Korean',
  es: 'Spanish', fr: 'French', de: 'German', pt: 'Portuguese', it: 'Italian',
  nl: 'Dutch', sv: 'Swedish', no: 'Norwegian', da: 'Danish', fi: 'Finnish',
  pl: 'Polish', cs: 'Czech', sk: 'Slovak', hu: 'Hungarian', ro: 'Romanian',
  bg: 'Bulgarian', hr: 'Croatian', sr: 'Serbian', sl: 'Slovenian', uk: 'Ukrainian',
  ru: 'Russian', el: 'Greek', tr: 'Turkish', ar: 'Arabic', fa: 'Farsi',
  he: 'Hebrew', th: 'Thai', vi: 'Vietnamese', id: 'Indonesian', ms: 'Malay',
  bn: 'Bengali', si: 'Sinhala', ne: 'Nepali', km: 'Khmer', lo: 'Lao',
  my: 'Burmese', am: 'Amharic', uz: 'Uzbek', ky: 'Kyrgyz', tg: 'Tajik',
  tk: 'Turkmen', is: 'Icelandic',
};

// 国家英文名称（AI prompt用）
export const countryNames = {
  US: 'United States', CA: 'Canada', GB: 'United Kingdom', AU: 'Australia',
  NZ: 'New Zealand', IE: 'Ireland', SG: 'Singapore', HK: 'Hong Kong',
  ZA: 'South Africa', NG: 'Nigeria', GH: 'Ghana', KE: 'Kenya',
  TZ: 'Tanzania', UG: 'Uganda', EG: 'Egypt', MA: 'Morocco', DZ: 'Algeria',
  TN: 'Tunisia', LY: 'Libya', SD: 'Sudan', ET: 'Ethiopia',
  SA: 'Saudi Arabia', AE: 'UAE', QA: 'Qatar', KW: 'Kuwait', BH: 'Bahrain',
  OM: 'Oman', JO: 'Jordan', LB: 'Lebanon', SY: 'Syria', IQ: 'Iraq',
  IL: 'Israel', YE: 'Yemen', IR: 'Iran', TR: 'Turkey',
  FR: 'France', DE: 'Germany', ES: 'Spain', IT: 'Italy', NL: 'Netherlands',
  BE: 'Belgium', CH: 'Switzerland', AT: 'Austria', SE: 'Sweden', NO: 'Norway',
  DK: 'Denmark', FI: 'Finland', IS: 'Iceland', PT: 'Portugal', GR: 'Greece',
  CY: 'Cyprus', LU: 'Luxembourg', PL: 'Poland', CZ: 'Czech Republic',
  SK: 'Slovakia', HU: 'Hungary', RO: 'Romania', BG: 'Bulgaria', HR: 'Croatia',
  SR: 'Serbia', SL: 'Slovenia', UA: 'Ukraine', RU: 'Russia', BY: 'Belarus',
  MX: 'Mexico', BR: 'Brazil', AR: 'Argentina', CL: 'Chile', CO: 'Colombia',
  PE: 'Peru', VE: 'Venezuela', EC: 'Ecuador', BO: 'Bolivia', PY: 'Paraguay',
  UY: 'Uruguay', PA: 'Panama', CR: 'Costa Rica', GT: 'Guatemala', SV: 'El Salvador',
  HN: 'Honduras', NI: 'Nicaragua', DO: 'Dominican Republic', PR: 'Puerto Rico',
  CU: 'Cuba', GY: 'Guyana',
  CN: 'China', JP: 'Japan', KR: 'South Korea', TW: 'Taiwan', MO: 'Macau',
  IN: 'India', PK: 'Pakistan', BD: 'Bangladesh', LK: 'Sri Lanka', NP: 'Nepal',
  TH: 'Thailand', VN: 'Vietnam', MY: 'Malaysia', ID: 'Indonesia', PH: 'Philippines',
  KH: 'Cambodia', LA: 'Laos', MM: 'Myanmar', BN: 'Brunei',
  KZ: 'Kazakhstan', UZ: 'Uzbekistan', KG: 'Kyrgyzstan', TJ: 'Tajikistan',
  TM: 'Turkmenistan', AF: 'Afghanistan',
  ZW: 'Zimbabwe', ZM: 'Zambia', BW: 'Botswana', NA: 'Namibia', MW: 'Malawi',
  SN: 'Senegal', CI: "Cote d'Ivoire", CM: 'Cameroon', AO: 'Angola',
  CD: 'DR Congo', MZ: 'Mozambique',
  MC: 'Monaco',
};

/**
 * 根据手机号推断国家代码
 * @param {string} phone 手机号（带或不带+号）
 * @returns {{ country: string, language: string, countryName: string, languageName: string }}
 */
export function detectCountryFromPhone(phone) {
  if (!phone) return { country: 'US', language: 'en', countryName: 'United States', languageName: 'English' };

  // 去除+号和非数字字符
  let digits = phone.replace(/\D/g, '');
  // 去掉中国前面的86等常见前缀？不，直接匹配

  // 从长到短匹配前缀
  const sortedPrefixes = Object.keys(phonePrefixToCountry).sort((a, b) => b.length - a.length);
  for (const prefix of sortedPrefixes) {
    if (digits.startsWith(prefix)) {
      const country = phonePrefixToCountry[prefix];
      // 多语言国家默认优先英语
      let language = countryToLanguage[country] || 'en';
      return {
        country,
        language,
        countryName: countryNames[country] || country,
        languageName: languageNames[language] || 'English',
      };
    }
  }

  return { country: 'US', language: 'en', countryName: 'United States', languageName: 'English' };
}

/**
 * 获取客户的问候日（根据国家周末习惯，在周末前一天或第一天发送问候）
 * @param {string} country
 * @param {Date} now
 * @returns {boolean} 是否应该发送周末问候
 */
export function isWeekendGreetingDay(country, now = new Date()) {
  const day = now.getUTCDay(); // 0=Sun...6=Sat
  const weekend = countryWeekend[country] || [0, 6]; // 默认周六日

  // 在周末前一天（工作日最后一天）或周末第一天发送
  // 大部分国家周五下午/晚上发，伊斯兰国家周四发
  if (weekend[0] === 5 && weekend[1] === 6) {
    return day === 4; // 周四（周五周六是周末）
  }
  return day === 5; // 周五（周六周日是周末）
}

import { i18n } from '../next-i18next.config.js';

// G-20 countries and their primary languages
const G20_LANGUAGES: Record<string, string[]> = {
  'AR': ['es'], // Argentina - Spanish
  'AU': ['en'], // Australia - English
  'BR': ['pt-BR'], // Brazil - Portuguese
  'CA': ['en', 'fr'], // Canada - English, French
  'CN': ['zh-CN'], // China - Chinese Simplified
  'FR': ['fr'], // France - French
  'DE': ['de'], // Germany - German
  'IN': ['hi', 'en'], // India - Hindi, English
  'ID': ['id'], // Indonesia - Indonesian
  'IT': ['it'], // Italy - Italian
  'JP': ['ja'], // Japan - Japanese
  'KR': ['ko'], // South Korea - Korean
  'MX': ['es'], // Mexico - Spanish
  'RU': ['ru'], // Russia - Russian
  'SA': ['ar'], // Saudi Arabia - Arabic
  'ZA': ['en'], // South Africa - English
  'TR': ['tr'], // Turkey - Turkish
  'GB': ['en'], // United Kingdom - English
  'US': ['en'], // United States - English
  'EU': ['en', 'fr', 'de', 'it', 'es', 'pt', 'nl'], // European Union - Multiple languages
};

// Eastern European countries and languages
const EASTERN_EUROPE_LANGUAGES: Record<string, string[]> = {
  'AL': ['sq'], // Albania - Albanian
  'AM': ['hy'], // Armenia - Armenian
  'AZ': ['az'], // Azerbaijan - Azerbaijani
  'BY': ['be', 'ru'], // Belarus - Belarusian, Russian
  'BA': ['bs', 'hr', 'sr'], // Bosnia and Herzegovina - Bosnian, Croatian, Serbian
  'BG': ['bg'], // Bulgaria - Bulgarian
  'HR': ['hr'], // Croatia - Croatian
  'CZ': ['cs'], // Czech Republic - Czech
  'EE': ['et'], // Estonia - Estonian
  'GE': ['ka'], // Georgia - Georgian
  'HU': ['hu'], // Hungary - Hungarian
  'LV': ['lv'], // Latvia - Latvian
  'LT': ['lt'], // Lithuania - Lithuanian
  'MD': ['ro'], // Moldova - Romanian
  'ME': ['sr'], // Montenegro - Serbian
  'MK': ['mk'], // North Macedonia - Macedonian
  'PL': ['pl'], // Poland - Polish
  'RO': ['ro'], // Romania - Romanian
  'RS': ['sr'], // Serbia - Serbian
  'SK': ['sk'], // Slovakia - Slovak
  'SI': ['sl'], // Slovenia - Slovenian
  'UA': ['uk'], // Ukraine - Ukrainian
};

export function detectLanguageFromCountry(countryCode: string): string {
  // Check G-20 countries first
  if (G20_LANGUAGES[countryCode]) {
    return G20_LANGUAGES[countryCode][0];
  }

  // Check Eastern European countries
  if (EASTERN_EUROPE_LANGUAGES[countryCode]) {
    return EASTERN_EUROPE_LANGUAGES[countryCode][0];
  }

  // Default to English for unknown countries
  return 'en';
}

export function detectLanguageFromBrowser(): string {
  if (typeof navigator === 'undefined') return 'en';

  // Try to get language from browser
  const browserLang = navigator.language || 'en';

  // Map browser language codes to our supported locales
  const langMap: Record<string, string> = {
    'en': 'en',
    'es': 'es',
    'pt': 'pt-BR',
    'fr': 'fr',
    'de': 'de',
    'it': 'it',
    'ru': 'ru',
    'ar': 'ar',
    'zh': 'zh-CN',
    'ja': 'ja',
    'ko': 'ko',
    'tr': 'tr',
    'id': 'id',
    'hi': 'hi',
  };

  // Check for exact matches
  if (langMap[browserLang]) {
    return langMap[browserLang];
  }

  // Check for language family matches (e.g., 'en-US' -> 'en')
  const langFamily = browserLang.split('-')[0];
  if (langMap[langFamily]) {
    return langMap[langFamily];
  }

  return 'en';
}

export function getOptimalLanguage(): string {
  if (typeof navigator === 'undefined') return 'en';

  try {
    // Try to detect from geolocation (if available)
    if ('geolocation' in navigator) {
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            // This would require a reverse geocoding service
            // For now, we'll use browser language detection
            resolve(detectLanguageFromBrowser());
          },
          () => {
            // Geolocation failed, fall back to browser language
            resolve(detectLanguageFromBrowser());
          },
          { timeout: 5000 }
        );
      }).then(result => result as string);
    }
  } catch (error) {
    console.warn('Geolocation not available:', error);
  }

  return detectLanguageFromBrowser();
}

export function isSupportedLanguage(lang: string): boolean {
  return i18n.locales.includes(lang);
}

export function getLanguageDisplayName(langCode: string): string {
  const displayNames: Record<string, string> = {
    'en': 'English',
    'es': 'Español',
    'pt-BR': 'Português (Brasil)',
    'fr': 'Français',
    'de': 'Deutsch',
    'it': 'Italiano',
    'ru': 'Русский',
    'ar': 'العربية',
    'zh-CN': '中文 (简体)',
    'zh-TW': '中文 (繁體)',
    'ja': '日本語',
    'ko': '한국어',
    'tr': 'Türkçe',
    'id': 'Bahasa Indonesia',
    'hi': 'हिन्दी',
  };

  return displayNames[langCode] || langCode;
}

export async function initializeLanguage(): Promise<string> {
  const optimalLang = await getOptimalLanguage();

  // Ensure the language is supported
  if (!isSupportedLanguage(optimalLang)) {
    console.warn(`Unsupported language ${optimalLang}, falling back to English`);
    return 'en';
  }

  return optimalLang;
}

const path = require('path');

module.exports = {
  i18n: {
    defaultLocale: 'en',
    locales: [
      'en',      // English (US, UK, Australia, Canada, India)
      'es',      // Spanish (Argentina, Mexico)
      'pt-BR',   // Portuguese (Brazil)
      'fr',      // French (France, Canada)
      'de',      // German (Germany)
      'it',      // Italian (Italy)
      'ru',      // Russian (Russia)
      'ar',      // Arabic (Saudi Arabia)
      'zh-CN',   // Chinese Simplified (China)
      'zh-TW',   // Chinese Traditional (Taiwan/Hong Kong)
      'ja',      // Japanese (Japan)
      'ko',      // Korean (South Korea)
      'tr',      // Turkish (Turkey)
      'id',      // Indonesian (Indonesia)
      'hi',      // Hindi (India)
    ],
    localeDetection: true,
    localePath: path.resolve('./public/locales'),
  },
  reloadOnPrerender: process.env.NODE_ENV === 'development',
};

import { createInstance, Resource } from 'i18next';
import { initReactI18next } from 'react-i18next/initReactI18next';
import resourcesToBackend from 'i18next-resources-to-backend';
import i18nConfig from '../next-i18next.config.js';

const initI18next = async (lng: string, ns: string) => {
  const i18nInstance = createInstance();

  await i18nInstance
    .use(initReactI18next)
    .use(resourcesToBackend((language: string, namespace: string) => import(`../public/locales/${language}/${namespace}.json`)))
    .init({
      ...i18nConfig,
      lng,
      ns,
      fallbackLng: i18nConfig.i18n.defaultLocale,
      defaultNS: 'common',
      interpolation: {
        escapeValue: false,
      },
    });

  return i18nInstance;
};

export async function useTranslation(lng: string, ns: string = 'common') {
  const i18nInstance = await initI18next(lng, ns);
  return {
    t: i18nInstance.getFixedT(lng, Array.isArray(ns) ? ns[0] : ns),
    i18n: i18nInstance,
  };
}

export default initI18next;

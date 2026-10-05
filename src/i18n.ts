/** Interface text per locale. Locales themselves are configured in astro.config.mjs (Astro i18n). */
import { getRelativeLocaleUrl } from "astro:i18n";

export type Lang = "en" | "es";

const ui = {
	en: { name: "English", skip: "Skip to main content", hours: "Open Tuesdays, 10:00 a.m. – 3:00 p.m.", more: "More", nav: "Main navigation", language: "Language", home: "home", nondisc: "Nondiscrimination Statement and Data Privacy Notice/Tennessen Warning", churchLine: "A ministry of Minnehaha United Methodist Church", notFound: "Page not found", notFoundText: "Sorry, we couldn't find that page.", backHome: "Return to the home page", logoAlt: "Support the Minnehaha Food Shelf", rights: "All rights reserved." },
	es: { name: "Español", skip: "Saltar al contenido principal", hours: "Abierto los martes, 10:00 am – 3:00 pm", more: "Más información", nav: "Navegación principal", language: "Idioma", home: "inicio", nondisc: "Declaración de no discriminación y Aviso de privacidad de datos/Advertencia de Tennessee", churchLine: "Un ministerio de la Iglesia Metodista Unida de Minnehaha", notFound: "Página no encontrada", notFoundText: "Lo sentimos, no pudimos encontrar esa página.", backHome: "Volver a la página de inicio", logoAlt: "Apoye a Minnehaha Food Shelf", rights: "Todos los derechos reservados." },
} as const;

export const defaultLocale: Lang = "en";
/** The page's locale (Astro.currentLocale, set by Astro's i18n routing from the URL). */
export const localeOf = (Astro: { currentLocale?: string }): Lang => (Astro.currentLocale === "es" ? "es" : "en");
export const strings = (lang: Lang) => ui[lang];
export const otherLocale = (lang: Lang): Lang => (lang === "en" ? "es" : "en");
/** URL of a page in a locale ("home" is the home page), without a trailing slash so it matches the hreflang/sitemap URLs EmDash emits (both forms are served). */
export const pathFor = (lang: Lang, slug: string) => {
	const url = getRelativeLocaleUrl(lang, slug === "home" ? "/" : `/${slug}`);
	return url.length > 1 ? url.replace(/\/$/, "") : url;
};
export const homePath = (lang: Lang) => pathFor(lang, "home");

import node from "@astrojs/node";
import react from "@astrojs/react";
import { defineConfig } from "astro/config";
import emdash, { local } from "emdash/astro";
import { sqlite } from "emdash/db";
import { legacyRedirects } from "./legacy-redirects.mjs";

export default defineConfig({
	output: "server",
	redirects: legacyRedirects,
	// EmDash reads this: content entries have a locale. Pass Astro.currentLocale to its queries.
	i18n: {
		defaultLocale: "en",
		locales: ["en", "es"],
		// A page that has no Spanish version falls back to English. (Do not enable prefixDefaultLocale: it breaks the EmDash admin.)
		fallback: { es: "en" },
	},
	adapter: node({
		mode: "standalone",
	}),
	image: {
		layout: "constrained",
		responsiveStyles: true,
	},
	integrations: [
		react(),
		emdash({
			database: sqlite({ url: "file:./data.db" }),
			storage: local({
				directory: "./uploads",
				baseUrl: "/_emdash/api/media/file",
			}),
		}),
	],
	devToolbar: { enabled: false },
});

/**
 * Old minnehaha.org Food Shelf URLs -> this site. Registered as Astro redirects (see astro.config.mjs)
 * because EmDash's admin-managed redirects deliberately skip any URL ending in a file extension (.html).
 * Anything without an extension can instead be added in the admin under Redirects.
 */
const pages = {
	getfoodatfoodshelf: "get-food",
	volunteerfoodshelf: "volunteer",
	aboutthefoodshelf: "about",
	areaservedfoodshelf: "area-served",
	contactusfoodshelf: "contact",
	nondiscriminationstatement: "nondiscrimination",
};

export const legacyRedirects = {
	"/foodshelf.html": "/",
	"/SPA_foodshelf.html": "/es",
	"/foodshelf2.html": "/",
};
for (const [old, slug] of Object.entries(pages)) {
	legacyRedirects[`/Food Shelf/${old}.html`] = `/${slug}`;
	legacyRedirects[`/Food Shelf/SPA_${old}.html`] = `/es/${slug}`;
}

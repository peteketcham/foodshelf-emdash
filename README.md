# Minnehaha Food Shelf – EmDash site

Separate [EmDash](https://github.com/emdash-cms/emdash) (Astro CMS) site for Minnehaha Food Shelf, converted from the Food Shelf pages of the old minnehaha.org site. Same look as the church site (shared theme in `public/layout` and `public/css`), English plus Spanish.

## Run it

```bash
npm install
cp .env.example .env     # then set EMDASH_ENCRYPTION_KEY (openssl rand -hex 32)
npm run content:load     # creates data.db: schema, media library, menus, redirects, content
npm run dev              # http://localhost:4321
```

Open `/_emdash/admin` and finish the setup wizard to create your admin account. `content:load` is safe to re-run (it skips existing rows). To start over: stop the dev server, delete `data.db*` and `uploads/`, run it again (**discards admin edits**). `data.db` and `uploads/` are gitignored; after the first load the database is the source of truth, so back it up. Restart `npm run dev` after changing `package.json`, `.env` or the Astro config.

## Content and languages (i18n)

The site uses Astro's `i18n` config (`astro.config.mjs`: `en` default, `es` under `/es/`) together with EmDash's built-in content translations. There is one **Home page** collection (one entry per language), one **Pages** collection, one **Home cards** collection and one **Main menu**; every entry has a *locale*, and a Spanish entry is linked to its English original (same translation group). In the admin, use the locale switcher to edit Spanish, or open an English entry and choose its Spanish translation (**Translate**) to create or edit its counterpart.

| Where | What |
|---|---|
| `/` and `/es` | **Home page** collection: title, tagline and intro text per language, plus that language's cards |
| `/get-food`, `/volunteer`, `/about`, `/area-served`, `/contact`, `/nondiscrimination` | One entry per locale in **Pages**; the Spanish version of each is at `/es/<same slug>` |
| Cards on the home page | **Home cards**: image, text, link, order, *Archived*, and *Hide after* (the pasta-dinner card hides itself after the dinner). Order, *Archived* and *Hide after* are shared by a card's translations (change them once); text, image and link are per language. Cards without a Spanish counterpart simply don't appear on `/es` |
| Menus | **Main menu**, one per locale (the Menus screen shows the locale). The language switch in the header is not a menu item: it links to the translation of the page you are on (falling back to the other language's home page), and `<link rel="alternate" hreflang>` tags are added for search engines |
| Fixed interface text | Footer, "skip to content", 404 page and contact-form labels live in `src/i18n.ts` and `src/components/ContactForm.astro` |
| Images and PDFs | Media library (folders: Pages, Home cards, Site, Documents). PDFs are served at `/documents/<filename>`; upload a file with the same filename to replace one |
| Old URLs | `legacy-redirects.mjs` maps `foodshelf.html`, `SPA_foodshelf.html` and `Food Shelf/*.html` to the new pages. Extensionless redirects go in the admin's Redirects screen |

How it is wired (this follows the [EmDash i18n guide](https://docs.emdashcms.com/guides/internationalization/)): `astro.config.mjs` sets `i18n` (`fallback: { es: "en" }`, so a page with no Spanish version shows in English at `/es/...`; `prefixDefaultLocale` must stay off because it breaks the admin). One catch-all route, `src/pages/[...slug].astro`, serves every page in every language. Collections have a `urlPattern` (`/` for Home page, `/{slug}` for Pages) so EmDash can emit correct `hreflang` tags and sitemap entries. The language switch uses `getTranslations()`; URLs come from `astro:i18n`.

Adding a language: add it to `i18n.locales` in `astro.config.mjs`, add its strings to `src/i18n.ts` (and the `Lang` type), then translate entries in the admin. No new route files are needed.

> EmDash only applies the URL's locale automatically for signed-in editors, so the page components pass `locale` (`Astro.currentLocale`) explicitly to `getEmDashEntry`, `getEmDashCollection` and `getMenu`, as the guide shows. Keep doing that in new templates. Pass `entry.data.id` (not `entry.id`, which is the slug) to `getTranslations()`.
>
> `hreflang` and sitemap URLs need the site's public URL. In development EmDash derives it from the request; before launch set it (admin Settings, and Astro `site`).

The initial content was generated from `content-src/` (Markdown per page and locale, `cards.yaml` for cards) by `npm run content:migrate`, which rewrites `seed/seed.json`; use a fresh database to apply it. Edit content in the admin afterwards, not in `content-src/`.

Layout: `src/layouts/Base.astro`, `src/components/` (Header, Footer, Card, Home, Page), `src/i18n.ts`, `src/utils/translations.ts`, `src/site.ts` (address, email, links).

## Things to check with the Food Shelf team

- The Spanish *Volunteer* page was out of date, so it was re-translated from the current English page and the Spanish *Contact* page now lists Britt Reuter (as English does). These are machine translations; have a Spanish speaker review them.
- The Spanish home page lacks the newsletter and pasta-dinner cards (their images are English-only). The time-lapse video card was added in Spanish.
- The cards for the March newsletter and the pasta-dinner tickets have no text, only images; add alt text/text if wanted.
- The Contact page form posts to Formspree (like the church site). Set `formspreeId` in `src/site.ts` (create a Formspree form that emails foodshelf@minnehaha.org); until then it will not send. The old site used a PHP script (`php/contact_form.php`) that will not run on Cloudflare.

## Deploying

Needs a Node server (`npm run build && node dist/server/entry.mjs`) with persistent storage for `data.db` and `uploads/`, and `EMDASH_ENCRYPTION_KEY` set. For Cloudflare, EmDash's D1/R2 adapters replace SQLite and local uploads, and `src/pages/documents/[...name].ts` should read from R2 directly. Host not chosen yet.

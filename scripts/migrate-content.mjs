#!/usr/bin/env node
/**
 * Builds seed/seed.json (+ seed/seed-schema.json and seed/media-manifest.json) from content-src/.
 *
 *   node scripts/migrate-content.mjs
 *
 * content-src/{en,es}/*.md     one file per page (front matter: title, subtitle, description)
 * content-src/cards.yaml       homepage cards for both languages
 * public/images, seed/documents  files that go into the media library (see scripts/import-media.mjs)
 *
 * After the first load the database is the source of truth; edit content in the admin, not here.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { imageSize } from "image-size";
import { parse as parseYaml } from "yaml";
import { mdToPortableText, typo, warnings } from "./lib/portable-text.mjs";

const warn = (m) => warnings.push(m);
const SRC = resolve("content-src");
const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml" };
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const mediaId = (src) => {
	const h = createHash("sha1").update(src).digest();
	let out = "01K0000000";
	for (let i = 0; i < 16; i++) out += CROCKFORD[h[i] % 32];
	return out;
};

// ---------- media ----------
const manifest = new Map();
const img = (src, alt = "") => {
	if (!src) return undefined;
	const file = join(resolve("public"), decodeURI(src));
	const ext = extname(src).toLowerCase();
	if (!existsSync(file) || !MIME[ext]) { warn(`image not found: ${src}`); return undefined; }
	let m = manifest.get(src);
	if (!m) {
		let dims = {};
		try { dims = imageSize(readFileSync(file)); } catch { warn(`no dimensions for ${src}`); }
		const id = mediaId(src);
		m = { id, src, filename: basename(src), mimeType: MIME[ext], size: statSync(file).size, width: dims.width, height: dims.height, alt, storageKey: id + ext };
		manifest.set(src, m);
	}
	return { provider: "local", id: m.id, alt, width: m.width, height: m.height, mimeType: m.mimeType, filename: m.filename, meta: { storageKey: m.storageKey } };
};
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "" && v !== false));

function readMd(file) {
	const t = readFileSync(file, "utf8");
	const m = t.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
	return m ? { fm: parseYaml(m[1]) || {}, body: m[2] } : { fm: {}, body: t };
}

// ---------- schema ----------
const F = (slug, label, type, extra = {}) => ({ slug, label, type, ...extra });
const pageFields = [
	F("title", "Title", "string", { required: true, searchable: true }),
	F("subtitle", "Subtitle / tagline", "string"),
	F("description", "Description (search engines)", "text"),
	F("content", "Content", "portableText", { searchable: true }),
];
const cardFields = [
	F("title", "Title (internal name)", "string", { required: true, searchable: true }),
	F("weight", "Display order (lower shows first)", "integer", { translatable: false }),
	F("archived", "Archived (hidden from the home page)", "boolean", { translatable: false }),
	F("expires", "Hide after (card disappears automatically)", "datetime", { translatable: false }),
	F("image", "Image", "image"),
	F("body", "Text", "portableText", { searchable: true }),
	F("link", "Link (URL or /page)", "string"),
	F("external", "Open link in a new tab", "boolean", { translatable: false }),
];
const collections = [
	// urlPattern tells EmDash (hreflang tags, sitemap) where each entry lives; the locale prefix is added for you.
	{ slug: "home", label: "Home page", labelSingular: "Home page", icon: "home", sortOrder: 0, urlPattern: "/", supports: ["drafts", "revisions", "seo"], fields: pageFields },
	{ slug: "pages", label: "Pages", labelSingular: "Page", icon: "file-text", sortOrder: 1, urlPattern: "/{slug}", supports: ["drafts", "revisions", "search", "seo"], fields: pageFields },
	{ slug: "cards", label: "Home cards", labelSingular: "Card", icon: "layout-grid", sortOrder: 2, routable: false, supports: ["drafts", "revisions"], admin: { listColumns: ["archived", "expires", "weight"] }, fields: cardFields },
];

// ---------- content ----------
// One collection per kind; each entry carries a locale, and a Spanish entry points at its English
// original with translationOf (EmDash's built-in i18n). Locales are configured in astro.config.mjs.
const content = { home: [], pages: [], cards: [] };
const LOCALES = ["en", "es"];
const idOf = (coll, slug, locale) => `${coll}-${slug}${locale === "en" ? "" : `-${locale}`}`;

for (const locale of LOCALES) {
	const dir = join(SRC, locale);
	for (const f of readdirSync(dir).filter((x) => x.endsWith(".md")).sort()) {
		const slug = basename(f, ".md");
		const { fm, body } = readMd(join(dir, f));
		const coll = slug === "home" ? "home" : "pages";
		content[coll].push({
			id: idOf(coll, slug, locale), slug, status: "published", locale,
			...(locale !== "en" && existsSync(join(SRC, "en", f)) ? { translationOf: idOf(coll, slug, "en") } : {}),
			data: clean({
				title: typo(fm.title), subtitle: fm.subtitle && typo(fm.subtitle), description: fm.description,
				content: mdToPortableText(body, `${coll}-${slug}-${locale}-`, img),
			}),
		});
	}
}

const cards = parseYaml(readFileSync(join(SRC, "cards.yaml"), "utf8"));
for (const locale of LOCALES) {
	cards[locale].forEach((c, i) => {
		const external = /^https?:/.test(c.link || "");
		const hasEnglish = locale !== "en" && cards.en.some((x) => x.slug === c.slug);
		content.cards.push({
			id: idOf("cards", c.slug, locale), slug: c.slug, status: "published", locale,
			...(hasEnglish ? { translationOf: idOf("cards", c.slug, "en") } : {}),
			data: clean({
				title: c.alt || c.slug, weight: (i + 1) * 10, expires: c.expires,
				image: img(`/images/${c.file}`, c.alt),
				body: c.text ? mdToPortableText(c.text, `cards-${c.slug}-${locale}-`) : undefined,
				link: c.link, external,
			}),
		});
	});
}

// Documents in the media library (served at /documents/<filename>).
const DOC_MIME = { ".pdf": "application/pdf", ".png": "image/png", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
const docsDir = resolve("seed/documents");
if (existsSync(docsDir)) {
	for (const f of readdirSync(docsDir).sort()) {
		const ext = extname(f).toLowerCase();
		if (!DOC_MIME[ext]) { warn(`document skipped (type): ${f}`); continue; }
		const src = `/documents/${f}`;
		const id = mediaId(src);
		manifest.set(src, { id, src, filename: f, mimeType: DOC_MIME[ext], size: statSync(join(docsDir, f)).size, alt: "", storageKey: id + ext, folder: "Documents" });
	}
}
const FOLDER = { home: "Pages", pages: "Pages", cards: "Home cards" };
const byId = new Map([...manifest.values()].map((m) => [m.id, m]));
const tag = (o, folder) => {
	if (Array.isArray(o)) return o.forEach((v) => tag(v, folder));
	if (!o || typeof o !== "object") return;
	const id = o.provider === "local" ? o.id : o.asset?.provider === "local" ? o.asset._ref : undefined;
	if (id && byId.has(id) && !byId.get(id).folder) byId.get(id).folder = folder;
	Object.values(o).forEach((v) => tag(v, folder));
};
for (const [coll, entries] of Object.entries(content)) for (const e of entries) tag(e.data, FOLDER[coll]);
for (const m of manifest.values()) if (!m.folder) m.folder = m.src === "/images/Food Shelf Logo_sm copy.png" ? "Site" : "Other";

// ---------- menus ----------
const L = (label, url, extra = {}) => ({ type: "custom", label, url, ...extra });
const PAYPAL = "https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=4RYVM823H33LC&source=url";
const MAP = "https://www.google.com/maps/place/Minnehaha+United+Methodist+Church/@44.9122631,-93.2207999,17z/data=!3m1!4b1!4m5!3m4!1s0x87f628fdfa9d5cbf:0x1e01a06ebc6f8804!8m2!3d44.9122593!4d-93.2186059";
// The language switch is not a menu item: the header builds it from the page's translations.
const menuItems = (labels, urls) => labels.map((label, i) => L(label, urls[i], label === "DONATE" || label === "DONAR" || label === "DIRECTIONS" || label === "DIRECCIONES" ? { target: "_blank" } : {}));
const menus = [
	{ id: "menu:main:en", name: "main", label: "Main menu", locale: "en", items: menuItems(["HOME", "GET FOOD", "VOLUNTEER", "DONATE", "DIRECTIONS", "CONTACT US"], ["/", "/get-food", "/volunteer", PAYPAL, MAP, "/contact"]) },
	{ id: "menu:main:es", name: "main", label: "Menú principal", locale: "es", translationOf: "menu:main:en", items: menuItems(["HOGAR", "CONSEGUIR COMIDA", "VOLUNTARIO", "DONAR", "DIRECCIONES", "CONTÁCTENOS"], ["/es", "/es/get-food", "/es/volunteer", PAYPAL, MAP, "/es/contact"]) },
];

// Admin-managed redirects (no file extension). Old .html URLs are in legacy-redirects.mjs.
const redirectMap = { "/foodshelf": "/", "/home": "/", "/es/home": "/es" };
const redirects = Object.entries(redirectMap).map(([source, destination]) => ({ source, destination, type: 301, groupName: "Old Food Shelf pages" }));

const seed = {
	$schema: "https://emdashcms.com/seed.schema.json",
	version: "1",
	defaultLocale: "en",
	meta: { name: "Minnehaha Food Shelf", description: "Website for Minnehaha Food Shelf, south Minneapolis", author: "Minnehaha Food Shelf" },
	settings: { title: "Minnehaha Food Shelf", tagline: "Fighting food insecurity in our community" },
	collections, menus, redirects, content,
};

writeFileSync(resolve("seed/media-manifest.json"), JSON.stringify([...manifest.values()], null, "\t") + "\n");
mkdirSync(resolve("seed"), { recursive: true });
writeFileSync(resolve("seed/seed.json"), JSON.stringify(seed, null, "\t") + "\n");
const { content: _omit, ...schemaOnly } = seed;
writeFileSync(resolve("seed/seed-schema.json"), JSON.stringify(schemaOnly, null, "\t") + "\n");
console.log(`media: ${manifest.size} files`);
for (const [k, v] of Object.entries(content)) console.log(`  ${k}: ${v.length}`);
console.log(`menus: ${menus.length}, redirects: ${redirects.length}`);
if (warnings.length) { console.log(`\n${warnings.length} warning(s):`); for (const w of warnings) console.log("  - " + w); }

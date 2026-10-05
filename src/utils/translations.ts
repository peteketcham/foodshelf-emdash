import { getTranslations } from "emdash";
import { pathFor, type Lang } from "../i18n";

export interface Alternate { locale: Lang; href: string }

/**
 * Published translations of an entry, for the language switch. Pass the entry's database id
 * (`entry.data.id`, not `entry.id`, which is the slug). Drafts are filtered out so the switch never links to an unpublished page.
 * (<link rel="alternate" hreflang> tags come from <EmDashHead>.)
 */
export async function alternatesFor(collection: string, dbId: string): Promise<Alternate[]> {
	const { translations } = await getTranslations(collection, dbId);
	return translations
		.filter((t) => t.status === "published" && t.slug && (t.locale === "en" || t.locale === "es"))
		.map((t) => ({ locale: t.locale as Lang, href: pathFor(t.locale as Lang, t.slug as string) }));
}

/**
 * Markdown -> EmDash Portable Text, shared by the migration script.
 * (Same converter as mumc-emdash, plus image support: a paragraph that is only an image becomes a
 * media-library image block; wrap it in a link to make the image clickable.)
 */
import { fromMarkdown } from "mdast-util-from-markdown";

export const warnings = [];
const warn = (m) => warnings.push(m);
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ""));

// Mimic Hugo's goldmark "typographer" so text renders identically.
export function typo(s) {
	return s
		.replace(/---/g, "—")
		.replace(/--/g, "–")
		.replace(/\.\.\./g, "…")
		.replace(/(^|[\s(\[{—–])"/g, "$1“")
		.replace(/"/g, "”")
		.replace(/(^|[\s(\[{—–])'/g, "$1‘")
		.replace(/'/g, "’");
}

// ---------- markdown -> Portable Text ----------
export function mdToPortableText(md, prefix, resolveImage) {
	if (!md || !md.trim()) return [];
	const tree = fromMarkdown(md);
	let n = 0;
	const key = () => `${prefix}${(n++).toString(36)}`;
	const blocks = [];

	function inline(nodes, marks, ctx) {
		for (const node of nodes) {
			switch (node.type) {
				case "text":
					ctx.spans.push({ _type: "span", _key: key(), text: typo(node.value), marks: [...marks] });
					break;
				case "strong":
					inline(node.children, [...marks, "strong"], ctx);
					break;
				case "emphasis":
					inline(node.children, [...marks, "em"], ctx);
					break;
				case "inlineCode":
					ctx.spans.push({ _type: "span", _key: key(), text: node.value, marks: [...marks, "code"] });
					break;
				case "break":
					ctx.spans.push({ _type: "span", _key: key(), text: "\n", marks: [...marks] });
					break;
				case "link": {
					const k = key();
					ctx.markDefs.push({ _type: "link", _key: k, href: node.url });
					inline(node.children, [...marks, k], ctx);
					break;
				}
				case "html": {
					// Inline raw HTML (rare): keep visible text only.
					warn(`${prefix}: inline HTML dropped: ${node.value}`);
					break;
				}
				default:
					warn(`${prefix}: unsupported inline node "${node.type}"`);
			}
		}
	}

	function textBlock(children, style, extra = {}) {
		const ctx = { spans: [], markDefs: [] };
		inline(children, [], ctx);
		if (ctx.spans.length === 0) return;
		blocks.push({ _type: "block", _key: key(), style, markDefs: ctx.markDefs, children: ctx.spans, ...extra });
	}

	function walk(nodes, listCtx) {
		for (const node of nodes) {
			switch (node.type) {
				case "paragraph": {
					// A paragraph holding only images (optionally wrapped in links) becomes image blocks.
					const imgOf = (c) => (c.type === "image" ? { image: c } : c.type === "link" && c.children.length === 1 && c.children[0].type === "image" ? { image: c.children[0], href: c.url } : null);
					const imgs = node.children.map(imgOf);
					if (!listCtx && imgs.length && imgs.every(Boolean) && resolveImage) {
						for (const { image, href } of imgs) {
							const v = resolveImage(image.url, image.alt || "");
							if (!v) continue;
							blocks.push(clean({
								_type: "image", _key: key(),
								asset: { _ref: v.id, url: v.meta?.storageKey ? `/_emdash/api/media/file/${v.meta.storageKey}` : undefined, provider: "local" },
								alt: v.alt, width: v.width, height: v.height,
								link: href ? { href, blank: /^https?:/.test(href) } : undefined,
							}));
						}
						break;
					}
					textBlock(node.children, "normal", listCtx ?? {});
					break;
				}
				case "heading":
					textBlock(node.children, `h${node.depth}`);
					break;
				case "blockquote":
					for (const c of node.children) if (c.type === "paragraph") textBlock(c.children, "blockquote");
					break;
				case "list":
					for (const item of node.children) {
						const level = (listCtx?.level ?? 0) + 1;
						const ctx = { listItem: node.ordered ? "number" : "bullet", level };
						for (const child of item.children) {
							if (child.type === "paragraph") textBlock(child.children, "normal", ctx);
							else if (child.type === "list") walk([child], ctx);
							else warn(`${prefix}: unsupported list child "${child.type}"`);
						}
					}
					break;
				case "html": {
					// Raw HTML: iframes become EmDash's native iframe block; anything else a sanitized HTML block.
					const frames = [...node.value.matchAll(/<iframe\b[^>]*>/gi)];
					if (frames.length) {
						for (const [tag] of frames) {
							const attr = (name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`, "i"))?.[1];
							const src = (attr("src") || "").replace(/&amp;/g, "&");
							const h = parseInt(attr("height") || "", 10);
							const title = src.includes("calendar.google.com") ? "Church calendar" : src.includes("docs.google.com") ? "Chart" : "Embedded content";
							blocks.push(clean({ _type: "iframe", _key: key(), src, title, height: Number.isInteger(h) ? h : undefined }));
						}
						if (node.value.replace(/<iframe\b[^>]*>\s*<\/iframe>/gi, "").replace(/<\/?div[^>]*>/gi, "").trim()) warn(`${prefix}: extra HTML next to iframe dropped`);
					} else {
						blocks.push({ _type: "htmlBlock", _key: key(), html: node.value });
					}
					break;
				}
				case "thematicBreak":
					break;
				default:
					warn(`${prefix}: unsupported block node "${node.type}"`);
			}
		}
	}
	walk(tree.children, null);
	return blocks;
}


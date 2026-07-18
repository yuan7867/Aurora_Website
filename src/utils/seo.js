const SITE_URL = "https://aurorahy.com";
const DEFAULT_TITLE = "Aurora HY | Intelligent AI Software Company";
const DEFAULT_DESCRIPTION = "Aurora develops intelligent AI software for traders, businesses and creative professionals.";

function ensureMeta(selector, create) {
    let element = document.head.querySelector(selector);

    if (!element) {
        element = create();
        document.head.appendChild(element);
    }

    return element;
}

function setMeta(name, content, attribute = "name") {
    const element = ensureMeta(`meta[${attribute}="${name}"]`, () => {
        const meta = document.createElement("meta");
        meta.setAttribute(attribute, name);
        return meta;
    });

    element.setAttribute("content", content);
}

function setCanonical(url) {
    const element = ensureMeta('link[rel="canonical"]', () => {
        const link = document.createElement("link");
        link.setAttribute("rel", "canonical");
        return link;
    });

    element.setAttribute("href", url);
}

export function canonicalUrl(pathname = "/") {
    const normalizedPath = pathname === "/" ? "/" : pathname.replace(/\/$/, "");
    return `${SITE_URL}${normalizedPath}`;
}

export function applySeo({
    title = DEFAULT_TITLE,
    description = DEFAULT_DESCRIPTION,
    canonical = SITE_URL,
    type = "website",
    ogTitle = title,
    ogDescription = description
}) {
    document.title = title;
    setMeta("description", description);
    setCanonical(canonical);
    setMeta("og:title", ogTitle, "property");
    setMeta("og:description", ogDescription, "property");
    setMeta("og:type", type, "property");
    setMeta("og:url", canonical, "property");
    setMeta("twitter:card", "summary");
    setMeta("twitter:title", ogTitle);
    setMeta("twitter:description", ogDescription);
}

export const defaultSeo = {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    canonical: SITE_URL
};

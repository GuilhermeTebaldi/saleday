const buildLinkId = () => `link-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const hasUrlScheme = (value) => /^[a-z][a-z0-9+.-]*:\/\//i.test(value);

const normalizeUrlValue = (value) => {
  if (!value) return '';
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('mailto:') || lower.startsWith('tel:')) {
    return trimmed;
  }
  if (hasUrlScheme(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }
  return `https://${trimmed}`;
};

export const createLinkRow = (overrides = {}) => ({
  id: overrides.id || buildLinkId(),
  label: overrides.label ?? overrides.title ?? '',
  url: overrides.url ?? overrides.link ?? overrides.value ?? ''
});

export const mapStoredLinksToForm = (links) => {
  if (!Array.isArray(links)) return [];
  return links.map((link) =>
    createLinkRow({
      id: link.id,
      label: typeof link.label === 'string' ? link.label : '',
      url: typeof link.url === 'string' ? link.url : ''
    })
  );
};

export const buildLinkPayloadEntries = (links) => {
  if (!Array.isArray(links)) return [];
  return links
    .map((link) => ({
      label: (link.label ?? '').trim(),
      url: normalizeUrlValue(link.url)
    }))
    .filter((entry) => entry.url);
};

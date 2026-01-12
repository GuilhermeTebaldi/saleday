import PropTypes from 'prop-types';
import { createLinkRow } from '../utils/links.js';

export default function LinkListEditor({
  links = [],
  onChange,
  title = 'Links adicionais',
  description = 'Esses links aparecem logo abaixo da descrição no produto.'
}) {
  const handleFieldChange = (id, field, value) => {
    const updated = links.map((link) => (link.id === id ? { ...link, [field]: value } : link));
    onChange(updated);
  };

  const handleAdd = () => {
    onChange([...links, createLinkRow()]);
  };

  const handleRemove = (id) => {
    onChange(links.filter((link) => link.id !== id));
  };

  return (
    <div className="link-list-editor space-y-3 rounded-2xl border border-black/5 bg-[var(--ts-surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--ts-text)]">{title}</p>
          <p className="text-xs text-[var(--ts-muted)]">{description}</p>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="rounded-full border border-[rgba(200,178,106,0.45)] bg-white px-3 py-1 text-xs font-semibold text-[var(--ts-text)] hover:bg-[var(--ts-surface)]"
        >
          Adicionar link
        </button>
      </div>
      <div className="space-y-3">
        {links.length === 0 && (
          <p className="text-xs text-[var(--ts-muted)]">Inclua um ou mais links para complementar a legenda.</p>
        )}
        {links.map((link, index) => (
          <div key={link.id} className="space-y-2 rounded-xl border border-black/5 bg-white p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ts-muted)]">
                Link {index + 1}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(link.id)}
                className="text-[11px] font-semibold text-red-600 hover:text-red-500"
              >
                Remover
              </button>
            </div>
            <input
              name={`link-label-${link.id}`}
              value={link.label}
              onChange={(event) => handleFieldChange(link.id, 'label', event.target.value)}
              placeholder="Legenda (opcional)"
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-[var(--ts-text)] focus:border-[rgba(200,178,106,0.6)] focus:outline-none focus:ring-1 focus:ring-[rgba(200,178,106,0.35)]"
            />
            <input
              name={`link-url-${link.id}`}
              value={link.url}
              onChange={(event) => handleFieldChange(link.id, 'url', event.target.value)}
              placeholder="https://example.com"
              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-[var(--ts-text)] focus:border-[rgba(200,178,106,0.6)] focus:outline-none focus:ring-1 focus:ring-[rgba(200,178,106,0.35)]"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

LinkListEditor.propTypes = {
  links: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string,
      url: PropTypes.string
    })
  ),
  onChange: PropTypes.func.isRequired,
  title: PropTypes.string,
  description: PropTypes.string
};

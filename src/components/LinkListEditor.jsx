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
    <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-700">{title}</p>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50"
        >
          Adicionar link
        </button>
      </div>
      <div className="space-y-3">
        {links.length === 0 && (
          <p className="text-xs text-gray-500">Inclua um ou mais links para complementar a legenda.</p>
        )}
        {links.map((link, index) => (
          <div key={link.id} className="space-y-2 rounded-xl border border-gray-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
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
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200"
            />
            <input
              name={`link-url-${link.id}`}
              value={link.url}
              onChange={(event) => handleFieldChange(link.id, 'url', event.target.value)}
              placeholder="https://example.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200"
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

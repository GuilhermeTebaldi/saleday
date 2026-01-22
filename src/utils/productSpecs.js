// Helpers para mapear campos de produto por categoria
const PROPERTY_SPEC_FIELDS = [
  { key: 'property_type', label: 'Tipo de imóvel' },
  { key: 'surface_area', label: 'Área (m²)' },
  { key: 'bedrooms', label: 'Quartos' },
  { key: 'bathrooms', label: 'Banheiros' },
  { key: 'parking', label: 'Vagas' },
  { key: 'condo_fee', label: 'Condomínio' },
  { key: 'rent_type', label: 'Tipo de aluguel' }
];

const LAND_SPEC_FIELDS = [
  { key: 'property_type', label: 'Tipo de terreno' },
  { key: 'surface_area', label: 'Área (m²)' }
];

const EXTRA_SPEC_FIELDS = [
  { key: 'brand', label: 'Marca' },
  { key: 'model', label: 'Modelo' },
  { key: 'color', label: 'Cor' },
  { key: 'year', label: 'Ano' }
];

const normalizeLabel = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const isLandCategory = (category) => normalizeLabel(category).includes('terreno');

const cleanValue = (value) => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value.trim();
  return String(value);
};

const appendFields = (fields, product, target) => {
  for (const field of fields) {
    const rawValue = product?.[field.key];
    if (rawValue === undefined || rawValue === null) continue;
    if (typeof rawValue === 'string' && rawValue.trim() === '') continue;
    if (!rawValue && rawValue !== 0) continue;
    target.push({
      label: field.label,
      value: cleanValue(rawValue)
    });
  }
};

export function buildProductSpecEntries(product) {
  if (!product) return [];
  const entries = [];
  const propertyFields = isLandCategory(product?.category)
    ? LAND_SPEC_FIELDS
    : PROPERTY_SPEC_FIELDS;
  appendFields(propertyFields, product, entries);
  appendFields(EXTRA_SPEC_FIELDS, product, entries);
  return entries;
}

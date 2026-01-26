// Helpers para mapear campos de produto por categoria
import { MIN_PRODUCT_YEAR } from './product.js';
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

const DEFAULT_EXTRA_LABELS = {
  brand: 'Marca',
  model: 'Modelo',
  color: 'Cor',
  year: 'Ano'
};

const ANTIQUE_EXTRA_LABELS = {
  brand: 'Autor / Fabricante',
  model: 'Estilo / Período',
  color: 'Material / Acabamento',
  year: 'Ano / Época'
};

const EXTRA_SPEC_FIELDS = [
  { key: 'brand', label: DEFAULT_EXTRA_LABELS.brand },
  { key: 'model', label: DEFAULT_EXTRA_LABELS.model },
  { key: 'color', label: DEFAULT_EXTRA_LABELS.color },
  { key: 'year', label: DEFAULT_EXTRA_LABELS.year }
];

const normalizeLabel = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const isLandCategory = (category) => normalizeLabel(category).includes('terreno');

export const isAntiqueCategory = (category) => normalizeLabel(category).includes('antiguidad');

export const getExtraFieldLabel = (key, category) => {
  if (isAntiqueCategory(category)) {
    return ANTIQUE_EXTRA_LABELS[key] || DEFAULT_EXTRA_LABELS[key] || key;
  }
  return DEFAULT_EXTRA_LABELS[key] || key;
};

export const getCategoryYearMin = (category) =>
  isAntiqueCategory(category) ? 1500 : MIN_PRODUCT_YEAR;

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
  const extraFields = EXTRA_SPEC_FIELDS.map((field) => ({
    ...field,
    label: getExtraFieldLabel(field.key, product?.category)
  }));
  appendFields(extraFields, product, entries);
  return entries;
}

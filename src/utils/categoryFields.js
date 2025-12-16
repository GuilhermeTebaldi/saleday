// Defines reusable field groups per product category.
const DEFAULT_DETAILS = [
  { name: 'brand', label: 'Marca', placeholder: 'Ex: Nike' },
  { name: 'model', label: 'Modelo / variação', placeholder: 'Ex: Air Zoom' },
  { name: 'color', label: 'Cor', placeholder: 'Ex: Azul' }
];

const PROPERTY_DETAILS = [
  { name: 'propertyType', label: 'Tipo de imóvel', placeholder: 'Ex: Casa, cobertura, sobrado' },
  { name: 'area', label: 'Área (m²)', placeholder: 'Ex: 120', inputMode: 'numeric' },
  { name: 'bedrooms', label: 'Quartos', placeholder: 'Ex: 3', inputMode: 'numeric' },
  { name: 'bathrooms', label: 'Banheiros', placeholder: 'Ex: 2', inputMode: 'numeric' },
  { name: 'parking', label: 'Vagas', placeholder: 'Ex: 1', inputMode: 'numeric' }
];

const CATEGORY_FIELD_CONFIG = {
  Veículos: [
    { name: 'brand', label: 'Marca', placeholder: 'Ex: Toyota' },
    { name: 'model', label: 'Modelo', placeholder: 'Ex: Corolla XEi' },
    { name: 'color', label: 'Cor', placeholder: 'Ex: Prata' },
    { name: 'year', label: 'Ano', placeholder: 'Ex: 2022', inputMode: 'numeric' }
  ],
  'Eletrônicos e Celulares': [
    { name: 'brand', label: 'Marca', placeholder: 'Ex: Apple' },
    { name: 'model', label: 'Modelo', placeholder: 'Ex: iPhone 15' }
  ],
  'Informática e Games': [
    { name: 'brand', label: 'Marca', placeholder: 'Ex: Intel' },
    { name: 'model', label: 'Modelo', placeholder: 'Ex: Legion 5i' }
  ],
  Imóveis: { fields: PROPERTY_DETAILS, skipDefaults: true }
};

export function getCategoryDetailFields(category) {
  const config = CATEGORY_FIELD_CONFIG[category];
  const specific = Array.isArray(config) ? config : config?.fields ?? [];
  const skipDefaults =
    !!config && !Array.isArray(config) && config.skipDefaults === true;
  const combined = skipDefaults ? specific : [...specific, ...DEFAULT_DETAILS];
  const seen = new Set();
  const result = [];
  for (const field of combined) {
    if (seen.has(field.name)) continue;
    seen.add(field.name);
    result.push(field);
  }
  return result;
}

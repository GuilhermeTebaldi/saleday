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

const RENTAL_EXTRA_DETAILS = [
  ...PROPERTY_DETAILS,
  { name: 'rentType', label: 'Tipo de aluguel', placeholder: 'Ex: Temporada ou mensal' }
];

const SERVICE_FIELDS = [
  { name: 'serviceType', label: 'Tipo de serviço', placeholder: 'Ex: Aulas, consertos ou fotografia' },
  { name: 'serviceDuration', label: 'Duração / carga horária', placeholder: 'Ex: 2h por sessão, 40h/semana' },
  { name: 'serviceRate', label: 'Valor por hora', placeholder: 'Ex: R$ 120,00', inputMode: 'decimal' },
  { name: 'serviceLocation', label: 'Local de atendimento', placeholder: 'Ex: Online, em domicílio ou loja' }
];

const JOB_FIELDS = [
  { name: 'jobTitle', label: 'Cargo', placeholder: 'Ex: Assistente administrativo' },
  { name: 'jobType', label: 'Tipo de vaga', placeholder: 'Ex: CLT, PJ, freelance' },
  { name: 'jobSalary', label: 'Salário', placeholder: 'Ex: R$ 2.500,00', inputMode: 'decimal' },
  { name: 'jobRequirements', label: 'Requisitos', placeholder: 'Ex: Ensino médio completo ou experiência' }
];

const REAL_ESTATE_CONFIG = { fields: PROPERTY_DETAILS, skipDefaults: true };

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
  Imóveis: REAL_ESTATE_CONFIG,
  Terreno: REAL_ESTATE_CONFIG,
  Imóvel: REAL_ESTATE_CONFIG,
  Apartamento: REAL_ESTATE_CONFIG,
  Aluguel: { fields: RENTAL_EXTRA_DETAILS, skipDefaults: true },
  Serviços: { fields: SERVICE_FIELDS, skipDefaults: true },
  Empregos: { fields: JOB_FIELDS, skipDefaults: true }
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

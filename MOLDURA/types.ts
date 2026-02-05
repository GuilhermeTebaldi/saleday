
export type TemplateId = 'classic' | 'impact' | 'split';

export interface PropertyData {
  templateId?: TemplateId;
  empresaNome?: string;
  categoria: string;
  preco: string;
  headline?: string;
  cep?: string;
  rua?: string;
  bairro: string;
  cidade?: string;
  uf?: string;
  tipoImovel: string;
  areaM2?: number | string | null;
  quartos?: number | string | null;
  banheiros?: number | string | null;
  vagas?: number | string | null;
}

export const isValidValue = (val: any): boolean => {
  if (val === null || val === undefined || val === '') return false;
  const strVal = String(val).toLowerCase().trim();
  const invalidKeywords = ['não informado', 'nao informado', 'não informada', 'nao informada'];
  return !invalidKeywords.includes(strVal);
};

export const formatCEP = (cep?: string): string => {
  if (!cep) return '';
  const digits = cep.replace(/\D/g, '');
  if (digits.length === 8) {
    return digits.replace(/(\d{5})(\d{3})/, '$1-$2');
  }
  return cep;
};

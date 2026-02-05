
import React, { useMemo } from 'react';
import { PropertyData } from '../types';
import { PRODUCT_CATEGORIES } from '../../src/data/productCategories.js';
import { getCategoryDetailFields } from '../../src/utils/categoryFields.js';

interface EditorFormProps {
  data: PropertyData;
  onUpdate: (data: PropertyData) => void;
}

export const EditorForm: React.FC<EditorFormProps> = ({ data, onUpdate }) => {
  const categoryDetails = useMemo(
    () => getCategoryDetailFields(data.category || data.categoria),
    [data.category, data.categoria]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const next = { ...data, [name]: value };

    // Mantém compatibilidade entre o novo sistema de categoria e os campos legados.
    if (name === 'category') {
      next.category = value;
      next.categoria = value || next.categoria;
    }
    if (name === 'tipoImovel') {
      next.propertyType = value;
    }
    if (name === 'propertyType') {
      next.tipoImovel = value;
    }
    if (name === 'areaM2') {
      next.area = value;
    }
    if (name === 'area') {
      next.areaM2 = value;
    }
    if (name === 'quartos') {
      next.bedrooms = value;
    }
    if (name === 'bedrooms') {
      next.quartos = value;
    }
    if (name === 'banheiros') {
      next.bathrooms = value;
    }
    if (name === 'bathrooms') {
      next.banheiros = value;
    }
    if (name === 'vagas') {
      next.parking = value;
    }
    if (name === 'parking') {
      next.vagas = value;
    }

    onUpdate(next);
  };

  const labelClass = "text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block";
  const inputClass = "w-full p-3.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#19C37D] focus:border-transparent outline-none transition-all text-sm font-semibold text-gray-700 placeholder:text-gray-300";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="md:col-span-2 space-y-4">
        <h3 className="text-xs font-black text-[#19C37D] uppercase tracking-widest flex items-center gap-2">
           <span className="w-1 h-1 bg-[#19C37D] rounded-full"></span>
           Branding & Headline
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className={labelClass}>Empresa</label>
            <input name="empresaNome" value={data.empresaNome || ''} onChange={handleChange} className={inputClass} placeholder="Ex: Portal Imóveis" />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Headline Hero</label>
            <input name="headline" value={data.headline || ''} onChange={handleChange} className={inputClass} placeholder="Ex: OPORTUNIDADE" />
          </div>
        </div>
      </div>

      <div className="md:col-span-2 space-y-4 pt-4 border-t border-gray-50">
        <h3 className="text-xs font-black text-[#19C37D] uppercase tracking-widest flex items-center gap-2">
           <span className="w-1 h-1 bg-[#19C37D] rounded-full"></span>
           Informações Financeiras
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className={labelClass}>Categoria do Post</label>
            <input name="categoria" value={data.categoria} onChange={handleChange} className={inputClass} placeholder="Ex: LANÇAMENTO" />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Preço de Venda</label>
            <input name="preco" value={data.preco} onChange={handleChange} className={inputClass} placeholder="Ex: R$ 590.000,00" />
          </div>
        </div>
      </div>

      <div className="md:col-span-2 space-y-4 pt-4 border-t border-gray-50">
        <h3 className="text-xs font-black text-[#19C37D] uppercase tracking-widest flex items-center gap-2">
           <span className="w-1 h-1 bg-[#19C37D] rounded-full"></span>
           Localização e Tipo
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className={labelClass}>Tipo de Imóvel</label>
            <input name="tipoImovel" value={data.tipoImovel} onChange={handleChange} className={inputClass} placeholder="Ex: Apartamento" />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Bairro</label>
            <input name="bairro" value={data.bairro} onChange={handleChange} className={inputClass} placeholder="Ex: Jardins" />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>CEP</label>
            <input name="cep" value={data.cep || ''} onChange={handleChange} className={inputClass} placeholder="Ex: 89811442" />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Cidade/UF</label>
            <div className="flex gap-2">
              <input name="cidade" value={data.cidade || ''} onChange={handleChange} className={inputClass} placeholder="Chapecó" />
              <input name="uf" value={data.uf || ''} onChange={handleChange} className="w-20 p-3.5 bg-gray-50 border border-gray-100 rounded-xl outline-none font-semibold text-sm" placeholder="UF" maxLength={2} />
            </div>
          </div>
        </div>
      </div>

      <div className="md:col-span-2 space-y-4 pt-4 border-t border-gray-50">
        <h3 className="text-xs font-black text-[#19C37D] uppercase tracking-widest flex items-center gap-2">
           <span className="w-1 h-1 bg-[#19C37D] rounded-full"></span>
           Características Técnicas
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1 md:col-span-2">
            <label className={labelClass}>Categoria do Produto</label>
            <select
              name="category"
              value={data.category || ''}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="">Selecione uma categoria</option>
              {PRODUCT_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>

        {categoryDetails.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {categoryDetails.map((field) => (
              <div key={field.name} className="space-y-1">
                <label className={labelClass}>{field.label}</label>
                <input
                  name={field.name}
                  value={(data as Record<string, any>)[field.name] ?? ''}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder={field.placeholder}
                  inputMode={field.inputMode}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">
            Selecione uma categoria para exibir os campos técnicos.
          </p>
        )}
      </div>
    </div>
  );
};

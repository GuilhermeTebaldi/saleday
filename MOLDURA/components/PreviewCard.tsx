
import React from 'react';
import { PropertyData, isValidValue, formatCEP } from '../types';

interface PreviewCardProps {
  data: PropertyData;
  heroImage: string | null;
  logoImage: string | null;
}

// Componentes Atômicos Compartilhados
const Badge: React.FC<{ icon: React.ReactNode; label: string; dark?: boolean }> = ({ icon, label, dark }) => (
  <div className={`flex items-center gap-3 py-3 px-5 rounded-2xl border ${dark ? 'bg-black/40 border-white/10 text-white backdrop-blur-md' : 'bg-[#F8F9FA] border-gray-100 text-[#0B0B0B]'}`}>
    <div className="flex items-center justify-center scale-110">{icon}</div>
    <span className="text-xl font-black uppercase tracking-tight leading-none">{label}</span>
  </div>
);

const PriceTag: React.FC<{ preco: string; className?: string }> = ({ preco, className }) => (
  <div className={`bg-[#19C37D] py-5 px-10 rounded-[2rem] shadow-[0_15px_40px_rgba(25,195,125,0.3)] flex flex-col items-center justify-center ${className}`}>
    <span className="text-white text-[11px] font-black uppercase tracking-[0.4em] mb-2 opacity-90">Valor do Investimento</span>
    <span className="text-white text-6xl font-black tracking-tighter leading-none">
      {isValidValue(preco) ? preco : 'CONSULTE'}
    </span>
  </div>
);

const CommonBadges: React.FC<{ data: PropertyData; dark?: boolean }> = ({ data, dark }) => {
  const { areaM2, quartos, banheiros, vagas } = data;
  return (
    <div className="flex flex-wrap gap-4">
      {isValidValue(areaM2) && <Badge dark={dark} label={`${areaM2} m²`} icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19h16"></path><path d="M4 5v14"></path><path d="M12 5v14"></path><path d="M20 5v14"></path><path d="M4 12h16"></path></svg>} />}
      {isValidValue(quartos) && <Badge dark={dark} label={`${quartos} Qts`} icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"></path><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"></path></svg>} />}
      {isValidValue(vagas) && <Badge dark={dark} label={`${vagas} Vagas`} icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="22" height="13" rx="2" ry="2"></rect><path d="M8 21h8"></path></svg>} />}
    </div>
  );
};

export const PreviewCard: React.FC<PreviewCardProps> = ({ data, heroImage, logoImage }) => {
  const { templateId = 'classic', empresaNome, categoria, preco, headline, cep, bairro, cidade, uf, tipoImovel } = data;

  const renderHero = () => (
    <div className="absolute inset-0 bg-[#E2E8F0] overflow-hidden">
      {heroImage ? (
        <img src={heroImage} alt="Hero" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl font-black">FOTO HERO</div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-90" />
    </div>
  );

  const renderLogo = (isDark: boolean = true) => (
    <div className="flex items-center">
      {logoImage ? (
        <img src={logoImage} alt="Logo" className="h-[75px] w-auto object-contain" />
      ) : (
        isValidValue(empresaNome) && (
          <span className={`${isDark ? 'text-white' : 'text-[#0B0B0B]'} text-4xl font-black uppercase tracking-tighter leading-none`}>
            {empresaNome}
          </span>
        )
      )}
    </div>
  );

  // --- LAYOUT: CLASSIC PRO (RESTAURADO) ---
  if (templateId === 'classic') {
    return (
      <div className="w-[1080px] h-[1080px] flex flex-col bg-white font-['Inter'] relative select-none">
        {/* ZONA A: BARRA SUPERIOR (130px) */}
        <div className="h-[130px] bg-[#0B0B0B] flex items-center justify-between px-12 z-20">
          {renderLogo()}
          <div className="flex flex-col items-end">
             <span className="text-[#19C37D] text-xs font-black tracking-[0.4em] uppercase mb-1">Destaque</span>
             <span className="text-white text-4xl font-black uppercase tracking-[0.1em] leading-none">
               {isValidValue(categoria) ? categoria : 'IMÓVEIS'}
             </span>
          </div>
        </div>

        {/* ZONA B: FOTO HERO (630px aprox) */}
        <div className="flex-grow relative overflow-hidden">
          {renderHero()}
          {isValidValue(headline) && (
            <div className="absolute bottom-12 left-12 right-12 z-10">
               <h2 className="text-white text-[120px] font-black uppercase leading-[0.85] tracking-tighter drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                  {headline}
               </h2>
            </div>
          )}
        </div>

        {/* ZONA C: FAIXA INFERIOR (320px) - SEM BORDA VERDE INVASIVA NO TOPO */}
        <div className="h-[320px] bg-white flex flex-col p-12 justify-between z-20">
          <div className="flex justify-between items-start w-full">
            <div className="flex flex-col">
              <div className="inline-flex items-center bg-emerald-50 text-[#19C37D] px-4 py-2 rounded-lg mb-4 self-start">
                 <span className="text-2xl font-black uppercase tracking-widest leading-none">{tipoImovel}</span>
              </div>
              <div className="flex items-center gap-3">
                 <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#19C37D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                 <span className="text-[#0B0B0B] text-4xl font-black uppercase tracking-tight">{bairro}</span>
                 {isValidValue(cidade) && (
                   <span className="text-gray-400 text-3xl font-bold"> • {cidade}/{uf}</span>
                 )}
              </div>
              {isValidValue(cep) && <span className="text-gray-400 text-xl font-bold tracking-widest mt-2">CEP {formatCEP(cep)}</span>}
            </div>

            {/* PREÇO COMO PILL DESTAQUE NA ZONA C */}
            <PriceTag preco={preco} className="-mt-20 z-30" />
          </div>

          <div className="mt-auto">
            <CommonBadges data={data} />
          </div>
        </div>
      </div>
    );
  }

  // --- LAYOUT: IMPACT HERO (Full Background) ---
  if (templateId === 'impact') {
    return (
      <div className="w-[1080px] h-[1080px] bg-black font-['Inter'] relative overflow-hidden">
        {renderHero()}
        <div className="absolute top-12 left-12 right-12 flex justify-between items-center z-10">
          {renderLogo()}
          <div className="bg-[#19C37D] py-2 px-6 rounded-full text-white font-black uppercase tracking-widest text-xl">
            {categoria}
          </div>
        </div>
        
        <div className="absolute inset-x-12 bottom-12 space-y-8 z-10">
          <div>
            <span className="text-[#19C37D] text-2xl font-black uppercase tracking-[0.4em] block mb-2">Exclusividade</span>
            <h2 className="text-white text-[120px] font-black uppercase leading-[0.8] tracking-tighter mb-4">
              {isValidValue(headline) ? headline : tipoImovel}
            </h2>
            <div className="text-white text-3xl font-bold opacity-90 uppercase tracking-tight flex items-center gap-2">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path></svg>
              {bairro}, {cidade}
            </div>
          </div>
          
          <div className="flex items-end justify-between">
            <CommonBadges data={data} dark />
            <div className="bg-white p-1 rounded-[2.5rem] shadow-2xl">
              <PriceTag preco={preco} className="!rounded-[2.2rem] !py-8 !px-12" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- LAYOUT: MODERN SPLIT (50/50 Geometric) ---
  if (templateId === 'split') {
    return (
      <div className="w-[1080px] h-[1080px] bg-[#0B0B0B] font-['Inter'] relative flex flex-col">
        <div className="h-[600px] w-full relative">
          {renderHero()}
          <div className="absolute top-10 left-10 bg-black/60 backdrop-blur-md p-4 rounded-2xl">
            {renderLogo()}
          </div>
          <div className="absolute -bottom-1 w-full h-24 bg-gradient-to-t from-[#0B0B0B] to-transparent" />
        </div>
        
        <div className="flex-grow bg-[#0B0B0B] px-12 pb-12 pt-4 flex flex-col relative">
          <PriceTag preco={preco} className="absolute -top-16 right-12 !rounded-3xl !scale-110 !shadow-[0_20px_60px_rgba(0,0,0,0.5)]" />
          
          <div className="flex flex-col gap-1 mb-8">
            <span className="text-[#19C37D] text-2xl font-black uppercase tracking-[0.5em]">{categoria}</span>
            <h2 className="text-white text-[90px] font-black uppercase leading-none tracking-tighter">
              {tipoImovel} <span className="text-gray-600">No {bairro}</span>
            </h2>
          </div>
          
          <div className="mt-auto flex justify-between items-center bg-white/5 p-8 rounded-[2.5rem] border border-white/5">
            <div className="space-y-1">
              <span className="text-white text-2xl font-black uppercase">{bairro}</span>
              <p className="text-gray-500 text-lg font-bold">{cidade} • CEP {formatCEP(cep)}</p>
            </div>
            <CommonBadges data={data} dark />
          </div>
        </div>
      </div>
    );
  }

  return null;
};

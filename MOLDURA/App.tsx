
import React, { useState, useRef, useCallback } from 'react';
import { toPng } from 'html-to-image';
import { PropertyData, isValidValue } from './types';
import { PreviewCard } from './components/PreviewCard';
import { EditorForm } from './components/EditorForm';

const INITIAL_DATA: PropertyData = {
  templateId: 'classic',
  empresaNome: "NOME DA IMOBILIÁRIA",
  categoria: "Imóveis",
  preco: "R$ 400.000,00",
  headline: "TERRENO",
  cep: "89811442",
  rua: "",
  bairro: "Desbravador",
  cidade: "Chapecó",
  uf: "SC",
  tipoImovel: "Terreno",
  areaM2: 360,
  quartos: null,
  banheiros: null,
  vagas: null
};

const App: React.FC = () => {
  const [data, setData] = useState<PropertyData>(INITIAL_DATA);
  const [heroImage, setHeroImage] = useState<string | null>('https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&q=80&w=1080&h=1080');
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleDataUpdate = (newData: PropertyData) => {
    setData(newData);
  };

  const handleHeroUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setHeroImage(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setLogoImage(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleDownload = useCallback(async () => {
    if (cardRef.current === null) return;
    setIsExporting(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 1,
        width: 1080,
        height: 1080,
        style: { transform: 'scale(1)', transformOrigin: 'top left' }
      });
      
      const link = document.createElement('a');
      link.download = `imobiframe-${data.templateId || 'classic'}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Erro export:', err);
      alert('Erro ao gerar imagem.');
    } finally {
      setIsExporting(false);
    }
  }, [data]);

  return (
    <div className="min-h-screen bg-[#f1f5f9] p-4 md:p-8 flex flex-col items-center">
      <header className="w-full max-w-7xl flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-4xl font-black text-[#0B0B0B] tracking-tighter">
            TEMPLE<span className="text-[#19C37D]">SALE</span>
          </h1>
          <p className="text-gray-500 font-bold uppercase text-[10px] tracking-[0.3em]">Advanced Creative Engine</p>
        </div>
        
        <button
          onClick={handleDownload}
          disabled={isExporting}
          className="px-8 py-4 bg-[#19C37D] hover:bg-[#15a368] text-white font-black rounded-2xl shadow-xl transition-all transform active:scale-95 flex items-center gap-3 disabled:opacity-50 uppercase text-xs tracking-widest"
        >
          {isExporting ? 'PROCESSANDO...' : 'BAIXAR PNG 1080x1080'}
        </button>
      </header>

      <main className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <section className="lg:col-span-5 bg-white p-6 md:p-8 rounded-[2.5rem] shadow-xl border border-gray-100 space-y-8">
          
          <div className="space-y-4">
             <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
               <span className="w-2 h-2 bg-[#19C37D] rounded-full"></span>
               Escolha sua Moldura
             </h3>
             <div className="grid grid-cols-3 gap-3">
                {(['classic', 'impact', 'split'] as const).map((id) => (
                  <button
                    key={id}
                    onClick={() => handleDataUpdate({ ...data, templateId: id })}
                    className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                      data.templateId === id 
                      ? 'border-[#19C37D] bg-emerald-50' 
                      : 'border-gray-100 hover:border-gray-200 bg-white'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-md ${id === 'classic' ? 'bg-gray-800' : id === 'impact' ? 'bg-emerald-400' : 'bg-gray-200'}`}></div>
                    <span className="text-[10px] font-black uppercase tracking-tight text-gray-600">{id}</span>
                  </button>
                ))}
             </div>
          </div>

          <EditorForm data={data} onUpdate={handleDataUpdate} />
          
          <div className="grid grid-cols-1 gap-4 pt-6 border-t border-gray-50">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Foto do Imóvel</label>
              <input type="file" accept="image/*" onChange={handleHeroUpload} className="w-full text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-gray-100 file:text-gray-600 hover:file:bg-gray-200 cursor-pointer" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Logo (PNG)</label>
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="w-full text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:bg-gray-100 file:text-gray-600 hover:file:bg-gray-200 cursor-pointer" />
            </div>
          </div>
        </section>

        <section className="lg:col-span-7 flex flex-col items-center sticky top-8">
           <div className="bg-white p-2 rounded-[2rem] shadow-2xl border border-white/50 transform scale-[0.35] sm:scale-[0.45] md:scale-[0.55] lg:scale-[0.6] xl:scale-[0.65] origin-top transition-all">
             <div ref={cardRef} className="export-area overflow-hidden bg-white">
               <PreviewCard data={data} heroImage={heroImage} logoImage={logoImage} />
             </div>
           </div>
        </section>
      </main>
    </div>
  );
};

export default App;

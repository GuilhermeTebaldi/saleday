import useReturnNavigation from '../hooks/useReturnNavigation.js';
import { ChevronLeft } from 'lucide-react';
export default function CloseBackButton({ className = '', ...props }) {
  const handleGoBack = useReturnNavigation();

  return (
    <button
      type="button"
      onClick={handleGoBack}
      className={`templesale-back-button ${className}`}
      aria-label="Voltar para a página anterior"
      
        {...props}
      >
       <ChevronLeft size={14} />
      
    </button>
  );
}

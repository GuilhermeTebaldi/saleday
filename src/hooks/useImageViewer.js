import { useCallback, useState } from 'react';

export default function useImageViewer() {
  const [viewerState, setViewerState] = useState({ src: '', alt: '' });

  const openViewer = useCallback((src, alt = 'Imagem') => {
    if (!src) return;
    setViewerState({ src, alt: alt || 'Imagem' });
  }, []);

  const closeViewer = useCallback(() => {
    setViewerState({ src: '', alt: '' });
  }, []);

  return {
    isOpen: Boolean(viewerState.src),
    src: viewerState.src,
    alt: viewerState.alt,
    openViewer,
    closeViewer
  };
}

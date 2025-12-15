import { useEffect, useMemo } from 'react';

const EMPTY_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAP///////ywAAAAAAQABAAACAkQBADs=';

const buildSelectorsKey = (selectors = []) =>
  selectors.filter(Boolean).join('\u0000');

export default function usePreventDrag(selectors = []) {
  const guardKey = buildSelectorsKey(selectors);
  const dragImage = useMemo(() => {
    const img = new Image();
    img.src = EMPTY_IMAGE;
    return img;
  }, []);

  useEffect(() => {
    if (!guardKey || typeof document === 'undefined') {
      return undefined;
    }

    const guardSelectors = guardKey.split('\u0000');
    const handler = (event) => {
      const target = event.target;
      if (!target || !target.closest) return;
      const matches = guardSelectors.some((selector) =>
        target.closest(selector)
      );
      if (!matches) return;
      if (event.preventDefault) {
        event.preventDefault();
      }
      if (event.dataTransfer) {
        event.dataTransfer.setDragImage(dragImage, 0, 0);
      }
    };

    document.addEventListener('dragstart', handler, true);
    return () => {
      document.removeEventListener('dragstart', handler, true);
    };
  }, [guardKey, dragImage]);
}

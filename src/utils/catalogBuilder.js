import QRCode from 'qrcode';
import { DICTS } from '../i18n/dictionaries.js';
import { buildProductSpecEntries } from './productSpecs.js';
import { getProductPriceLabel, isProductFree } from './product.js';
import { makeAbsolute } from './urlHelpers.js';

const DEFAULT_CATALOG_LOCALE = 'pt-BR';

function createCatalogTranslator(locale) {
  const dict = DICTS[locale] || DICTS[DEFAULT_CATALOG_LOCALE] || {};
  return (key, fallback) => {
    if (!key) return fallback ?? '';
    if (dict[key]) return dict[key];
    if (fallback != null) return fallback;
    return key;
  };
}

function translateSpecLine(translate, spec) {
  if (!spec) return '';
  const label = spec.label?.trim();
  const value = spec.value ?? '';
  if (!label) {
    return value ? `• ${value}` : '';
  }
  const translatedLabel = translate(label, label);
  if (value) {
    return `• ${translatedLabel}: ${value}`;
  }
  return `• ${translatedLabel}`;
}

const translatePriceLabel = (product, translate) => {
  if (typeof translate !== 'function') {
    return getProductPriceLabel(product);
  }
  const fallback = translate('Valor a negociar', 'Price upon request');
  const rawLabel = getProductPriceLabel(product, fallback);
  return translate(rawLabel, rawLabel);
};

async function fetchImageAsDataUrl(imageUrl) {
  if (!imageUrl || typeof window === 'undefined') return null;
  try {
    const resolved = makeAbsolute(imageUrl);
    const response = await fetch(resolved, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function drawPremiumCatalog({
  doc,
  margin,
  pageWidth,
  pageHeight,
  sellerDisplayName,
  selectedProductsForCatalog,
  translate
}) {
  const headerHeight = 100;
  doc.setFillColor(3, 37, 76);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(38);
  doc.setTextColor(255, 214, 0);
  doc.text('SaleDay', margin + 5, 52);
  doc.setFontSize(14);
  doc.setTextColor(255);
  doc.text('', margin + 5, 72);
  doc.setFontSize(12);
  const catalogLabel = `${translate('Catálogo de', 'Catalog of')} ${sellerDisplayName}`;
  doc.text(catalogLabel, margin + 5, headerHeight - 8);
  let cursorY = headerHeight + 20;

  for (const product of selectedProductsForCatalog) {
    const cardHeight = 210;
    const cardWidth = pageWidth - margin * 2;
    if (cursorY + cardHeight > pageHeight - margin) {
      doc.addPage();
      cursorY = margin;
    }

    doc.setFillColor(240, 244, 249);
    doc.roundedRect(margin - 2, cursorY - 2, cardWidth + 4, cardHeight + 4, 18, 18, 'F');
    doc.setFillColor(255);
    doc.roundedRect(margin, cursorY, cardWidth, cardHeight, 16, 16, 'F');

    const imageWidth = 150;
    const priceLabel = translatePriceLabel(product, translate);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    const initialPriceLines = doc.splitTextToSize(
      priceLabel,
      cardWidth - imageWidth - 40
    );
    const multipleLines = initialPriceLines.length > 1;
    const priceFontSize = multipleLines ? 14 : 16;
    doc.setFontSize(priceFontSize);
    const priceLines = doc.splitTextToSize(
      priceLabel,
      cardWidth - imageWidth - 40
    ).slice(0, 2);
    const priceLineSpacing = priceFontSize + 4;
    const priceBlockHeight = priceLines.length * priceLineSpacing;
    const baseHeaderHeight = 42;
    const headerHeight = baseHeaderHeight + Math.max(0, priceBlockHeight - 18);
    const headerDelta = headerHeight - baseHeaderHeight;
    const imageHeight = Math.max(cardHeight - 70 - headerDelta, 60);
    const imageX = margin + cardWidth - imageWidth - 20;
    const imageY = cursorY + 55 + headerDelta;
    const productImageUrl =
      (Array.isArray(product.image_urls) && product.image_urls[0]) ||
      product.image_url ||
      '';
    if (productImageUrl) {
      const productImageData = await fetchImageAsDataUrl(productImageUrl);
      if (productImageData) {
        doc.setFillColor(229, 232, 238);
        doc.roundedRect(imageX - 2, imageY - 2, imageWidth + 4, imageHeight + 4, 10, 10, 'F');
        doc.addImage(productImageData, 'PNG', imageX, imageY, imageWidth, imageHeight);
      } else {
        doc.setFillColor(229, 232, 238);
        doc.roundedRect(imageX, imageY, imageWidth, imageHeight, 10, 10, 'F');
        doc.setFontSize(10);
        doc.setTextColor(148, 163, 184);
        doc.text(
          translate('Imagem indisponível', 'Image unavailable'),
          imageX + imageWidth / 2,
          imageY + imageHeight / 2,
          {
            align: 'center'
          }
        );
      }
    } else {
      doc.setFillColor(229, 232, 238);
      doc.roundedRect(imageX, imageY, imageWidth, imageHeight, 10, 10, 'F');
      doc.setFontSize(10);
      doc.setTextColor(148, 163, 184);
      doc.text(
        translate('Imagem não definida', 'Image not set'),
        imageX + imageWidth / 2,
        imageY + imageHeight / 2,
        {
          align: 'center'
        }
      );
    }

    doc.setFillColor(12, 97, 168);
    doc.roundedRect(margin, cursorY, cardWidth, headerHeight, 16, 16, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(255);
    const title = (product.title || 'Produto SaleDay').trim();
    doc.text(title, margin + 16, cursorY + 24, {
      maxWidth: cardWidth - imageWidth - 40
    });
    doc.setFontSize(priceFontSize);
    doc.setTextColor(255, 214, 0);
    const priceRightX = margin + cardWidth - imageWidth - 10;
    const priceMaxWidth = Math.min(cardWidth - imageWidth - 30, 150);
    let priceY = Math.max(
      cursorY + 38,
      cursorY + headerHeight - 12 - priceBlockHeight
    );
    priceLines.forEach((line) => {
      doc.text(line, priceRightX, priceY, {
        maxWidth: priceMaxWidth,
        align: 'right'
      });
      priceY += priceLineSpacing;
    });
    let textY = cursorY + headerHeight + 20;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(55, 63, 104);
    const locationLabel = [product.city, product.state, product.country]
      .filter(Boolean)
      .join(' · ');
    if (locationLabel) {
      doc.text(locationLabel, margin + 16, textY, {
        maxWidth: cardWidth - imageWidth - 50
      });
      textY += 14;
    }

    const specs = buildProductSpecEntries(product);
    specs.slice(0, 3).forEach((spec) => {
      const specLine = translateSpecLine(translate, spec);
      if (!specLine) return;
      doc.text(specLine, margin + 16, textY, {
        maxWidth: cardWidth - imageWidth - 50
      });
      textY += 12;
    });

    const description = product.description?.trim();
    if (description) {
      const descriptionLines = doc.splitTextToSize(
        description,
        cardWidth - imageWidth - 50
      );
      descriptionLines.slice(0, 3).forEach((line) => {
        doc.text(line, margin + 16, textY);
        textY += 10;
      });
    }

    try {
      const productUrl = `${window.location.origin}/product/${product.id}`;
      const qrDataUrl = await QRCode.toDataURL(productUrl, { width: 80, margin: 0 });
      const qrSize = 70;
      const qrX = margin + 16;
      const qrY = cursorY + cardHeight - qrSize - 20;
      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
      doc.setFontSize(8);
      doc.setTextColor(75, 85, 99);
      doc.text(
        translate('Escaneie para ver o produto', 'Scan to view the product'),
        qrX + qrSize / 2,
        qrY + qrSize + 10,
        {
          align: 'center'
        }
      );
    } catch {
      // QR falhou, continuar
    }

    cursorY += cardHeight + 20;
  }

  let footerY = pageHeight - margin - 60;
  if (cursorY + 70 > pageHeight - margin) {
    doc.addPage();
    footerY = pageHeight - margin - 60;
  }
  doc.setFillColor(3, 37, 76);
  doc.roundedRect(margin, footerY, pageWidth - margin * 2, 60, 14, 14, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255);
  doc.text(
    translate('Venda na SaleDay', 'Sell on SaleDay'),
    margin + 16,
    footerY + 26
  );
  doc.setFontSize(10);
  doc.setTextColor(226, 232, 240);
  doc.text('www.saleday.com.br', margin + 16, footerY + 44);
}

const VIBRANT_PALETTE = [
  // “Vibrante” aqui = impacto e contraste (não arco-íris).
  { card: [255, 255, 255], accent: [248, 211, 91], text: [15, 23, 42] }
];

async function drawClassicCatalog({
  doc,
  margin,
  pageWidth,
  pageHeight,
  sellerDisplayName,
  selectedProductsForCatalog,
  translate
}) {
  const gap = 14;
  const inset = margin;

  const contentX = inset;
  const contentY = inset;
  const contentW = pageWidth - inset * 2;
  const contentH = pageHeight - inset * 2;

  const leftW = Math.min(260, Math.max(220, contentW * 0.42));
  const rightW = Math.max(10, contentW - leftW - gap);

  const leftX = contentX;
  const rightX = leftX + leftW + gap;

  const drawImageBox = async (url, x, y, w, h, label) => {
    if (!url) return;

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, w, h, 14, 14, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(1);
    doc.roundedRect(x, y, w, h, 14, 14, 'S');

    if (url) {
      const img = await fetchImageAsDataUrl(url);
      if (img) {
        doc.addImage(img, 'PNG', x, y, w, h);
      } else {
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(x + 1, y + 1, w - 2, h - 2, 14, 14, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(148, 163, 184);
        doc.text(
          translate('Imagem indisponível', 'Image unavailable'),
          x + w / 2,
          y + h / 2,
          { align: 'center' }
        );
      }
    }

    const capH = 28;
    doc.setFillColor(17, 24, 39);
    doc.rect(x, y + h - capH, w, capH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255);
    doc.text(label, x + 12, y + h - 10, { maxWidth: w - 24 });
  };

  for (let index = 0; index < selectedProductsForCatalog.length; index += 1) {
    const product = selectedProductsForCatalog[index];

    if (index > 0) doc.addPage();

    // page background
    doc.setFillColor(250, 250, 250);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(1);
    doc.roundedRect(contentX, contentY, contentW, contentH, 18, 18, 'S');

    // left panel base
    doc.setFillColor(246, 244, 239);
    doc.rect(leftX, contentY, leftW, contentH, 'F');

    // price band (top)
    const priceLabel = translatePriceLabel(product, translate);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(255);
    const initialPriceLines = doc.splitTextToSize(priceLabel, leftW - 32);
    const refinedFontSize = initialPriceLines.length > 1 ? 24 : 28;
    doc.setFontSize(refinedFontSize);
    const priceLines = doc
      .splitTextToSize(priceLabel, leftW - 32)
      .slice(0, 2);
    const priceLineHeight = refinedFontSize + 6;
    const priceBlockHeight = priceLines.length * priceLineHeight;
    const bandH = Math.max(112, priceBlockHeight + 32);

    doc.setFillColor(145, 139, 120);
    doc.rect(leftX, contentY, leftW, bandH, 'F');

    // subtle accent line
    doc.setFillColor(255, 214, 0);
    doc.rect(leftX, contentY + bandH - 4, leftW, 4, 'F');

    // brand + seller
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(255);
    doc.text('SaleDay', leftX + 16, contentY + 32);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(238, 238, 238);
    doc.text(
      `${translate('Catálogo de', 'Catalog of')} ${sellerDisplayName}`,
      leftX + 16,
      contentY + 48,
      {
        maxWidth: leftW - 32
      }
    );

    // price big
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255);
    let priceY = contentY + bandH - 12 - priceBlockHeight;
    priceLines.forEach((line) => {
      doc.text(line, leftX + 16, priceY, {
        maxWidth: leftW - 32
      });
      priceY += priceLineHeight;
    });

    // title + location
    let textY = contentY + bandH + 26;

    const title = (product.title || 'Produto SaleDay').trim();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text(title, leftX + 16, textY, { maxWidth: leftW - 32 });
    textY += 18;

    const locationLabel = [product.city, product.state, product.country]
      .filter(Boolean)
      .join(' · ');
    if (locationLabel) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(locationLabel, leftX + 16, textY, { maxWidth: leftW - 32 });
      textY += 16;
    }

    // "Sobre"
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text(translate('Sobre', 'About'), leftX + 16, textY);
    textY += 10;

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(1);
    doc.line(leftX + 16, textY, leftX + leftW - 16, textY);
    textY += 12;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(71, 85, 105);

    const description = product.description?.trim();
    if (description) {
      const lines = doc.splitTextToSize(description, leftW - 32);
      lines.slice(0, 7).forEach((line) => {
        doc.text(line, leftX + 16, textY, { maxWidth: leftW - 32 });
        textY += 11;
      });
    } else {
      doc.text(
        translate('Descrição não informada.', 'Description not provided.'),
        leftX + 16,
        textY,
        { maxWidth: leftW - 32 }
      );
      textY += 12;
    }

    textY += 8;

    // "Destaques"
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text(translate('Destaques', 'Highlights'), leftX + 16, textY);
    textY += 10;

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(1);
    doc.line(leftX + 16, textY, leftX + leftW - 16, textY);
    textY += 12;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(71, 85, 105);

    const specs = buildProductSpecEntries(product);
    specs.slice(0, 7).forEach((spec) => {
      const specLine = translateSpecLine(translate, spec);
      if (!specLine) return;
      doc.text(specLine, leftX + 18, textY, {
        maxWidth: leftW - 34
      });
      textY += 11;
    });

    // CTA footer (left)
    const footerH = 120;
    const footerY = contentY + contentH - footerH;

    doc.setFillColor(60, 56, 48);
    doc.rect(leftX, footerY, leftW, footerH, 'F');

    // QR + CTA text
    const qrSize = 70;
    const qrX = leftX + 16;
    const qrY = footerY + 18;

    try {
      const productUrl = `${window.location.origin}/product/${product.id}`;
      const qrDataUrl = await QRCode.toDataURL(productUrl, { width: 110, margin: 0 });

      doc.setFillColor(255, 255, 255);
      doc.roundedRect(qrX - 3, qrY - 3, qrSize + 6, qrSize + 6, 10, 10, 'F');
      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
    } catch {
      // ignore
    }

    const ctaX = qrX + qrSize + 14;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(255);
    doc.text(
      translate('Chame no chat', 'Chat with us'),
      ctaX,
      footerY + 36,
      { maxWidth: leftW - (ctaX - leftX) - 14 }
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(226, 232, 240);
    doc.text(
      translate('Escaneie o QR para abrir o produto', 'Scan the QR to open the product'),
      ctaX,
      footerY + 54,
      {
        maxWidth: leftW - (ctaX - leftX) - 14
      }
    );
    doc.setFontSize(9);
    doc.text('www.saleday.com.br', ctaX, footerY + 74, {
      maxWidth: leftW - (ctaX - leftX) - 14
    });

    // right images (3 stacked)
    const imgGap = 10;
    const imgH = Math.floor((contentH - imgGap * 2) / 3);
    const imgW = rightW;

    const images = Array.isArray(product.image_urls) ? product.image_urls : [];
    const first = (images[0] || product.image_url || '').trim();
    const second = (images[1] || '').trim();
    const third = (images[2] || '').trim();
    const imgUrls = [first, second, third];
    

    const labels = [
      translate('Imagem principal', 'Main image'),
      translate('Detalhe', 'Detail'),
      translate('Mais detalhes', 'More details')
    ];

    for (let k = 0; k < 3; k += 1) {
      const y = contentY + k * (imgH + imgGap);
      await drawImageBox(imgUrls[k], rightX, y, imgW, imgH, labels[k]);
    }
  }
}

const CATALOG_STYLE_OPTIONS = [
  { key: 'premium', label: 'Premium' },
  { key: 'classic', label: 'Clássico' },
  { key: 'vibrant', label: 'Vibrante' },
  { key: 'modern', label: 'Moderno' }
];

const CATALOG_PREVIEW_META = {
  premium: {
    badge: 'Premium',
    title: 'Capas amplas com contraste suave',
    description:
      '/Header com logo dourado, tipografia elegante e espaço para uma hero image impactante sem perder clareza.',
    gradient: 'linear-gradient(135deg, #070c24, #1d2c63)',
    accent: '#FCE043',
    bullets: [
      'Manchete ampla com logo SaleDay',
      'Imagem principal envolvente em destaque',
      'Área de detalhes e QR discreto'
    ]
  },
  classic: {
    badge: 'Clássico',
    title: 'Brochure premium com estrutura e impacto',
    description:
      'Estilo “folheto” moderno: painel lateral com preço/descrição/destaques e coluna de 3 imagens com legendas.',
    gradient: 'linear-gradient(135deg, #f8fafc, #f1f5f9)',
    accent: '#1f2937',
    bullets: [
      'Painel lateral com preço grande e seções claras',
      'Coluna de 3 imagens com faixa/legenda',
      'CTA + QR bem integrado e discreto'
    ]
  },

  vibrant: {
    badge: 'Vibrante',
    title: 'Impacto moderno (clean) com contraste premium',
    description:
      'Visual tipo site: header escuro, cards brancos com borda/sombra leve e acento discreto para ficar sério e “caro”.',
    gradient: 'linear-gradient(135deg, #0f172a, #111827)',
    accent: '#F8D35B',
    bullets: [
      'Header dark + linha de acento fina',
      'Cards brancos com grid e tipografia forte',
      'QR discreto e detalhes bem alinhados'
    ]
  },

  modern: {
    badge: 'Moderno',
    title: 'Layout tipo site (hero + grid + CTA)',
    description:
      'Visual super moderno e profissional: topo dark minimalista, hero grande com thumbnails e cards clean com tipografia forte.',
    gradient: 'linear-gradient(135deg, #0f172a, #f8fafc)',
    accent: '#38bdf8',
    bullets: [
      'Topbar dark + linha de acento fina',
      'Hero grande com thumbnails (sem duplicar imagens)',
      'Cards limpos + CTA com QR no rodapé'
    ]
  }

};

const CATALOG_THUMBNAILS = {
  premium: '/catalogo/premium-mini.png',
  classic: '/catalogo/classic-mini.png',
  vibrant: '/catalogo/vibrant-mini.png',
  modern: '/catalogo/modern-mini.png'
};
async function drawVibrantCatalog({
  doc,
  margin,
  pageWidth,
  pageHeight,
  sellerDisplayName,
  selectedProductsForCatalog,
  translate
}) {
  const headerHeight = 118;
  const footerHeight = 44;
  const contentTop = headerHeight + 22;
  const contentBottom = pageHeight - margin - footerHeight;

  const safeTextWidth = (text) => {
    try {
      return typeof doc.getTextWidth === 'function' ? doc.getTextWidth(text) : text.length * 5.2;
    } catch {
      return text.length * 5.2;
    }
  };

  const drawBackground = () => {
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
  };

  const drawHeader = (pageNumber) => {
    // header escuro (moderno)
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, headerHeight, 'F');

    // linha de acento fina (impacto sem parecer infantil)
    doc.setFillColor(248, 211, 91);
    doc.rect(0, headerHeight - 3, pageWidth, 3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(34);
    doc.setTextColor(255);
    doc.text('SaleDay', margin + 6, 58);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(203, 213, 225);
    doc.text(translate('Catálogo', 'Catalog'), margin + 6, 82);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(226, 232, 240);
    doc.text(
      `${translate('Vendedor:', 'Seller:')} ${sellerDisplayName}`,
      margin + 6,
      104
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `${translate('Página', 'Page')} ${pageNumber}`,
      pageWidth - margin - 60,
      104
    );
  };

  const drawFooter = (pageNumber) => {
    const y = pageHeight - margin - 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('SaleDay.', margin, y);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(
      `${translate('Pág.', 'Pg.')} ${pageNumber}`,
      pageWidth - margin - 40,
      y
    );
  };

  let pageNumber = 1;
  drawBackground();
  drawHeader(pageNumber);

  let cursorY = contentTop;

  for (const [index, product] of selectedProductsForCatalog.entries()) {
    const palette = VIBRANT_PALETTE[index % VIBRANT_PALETTE.length];

    const cardWidth = pageWidth - margin * 2;
    const cardHeight = 222;

    if (cursorY + cardHeight > contentBottom) {
      drawFooter(pageNumber);
      doc.addPage();
      pageNumber += 1;
      drawBackground();
      drawHeader(pageNumber);
      cursorY = contentTop;
    }

    // “shadow” leve + card branco com borda (visual de site)
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(margin + 2, cursorY + 2, cardWidth, cardHeight, 18, 18, 'F');

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(1);
    doc.roundedRect(margin, cursorY, cardWidth, cardHeight, 18, 18, 'FD');

    // top hairline (accent)
    doc.setFillColor(...palette.accent);
    doc.rect(margin, cursorY, cardWidth, 4, 'F');

    const pad = 18;
    const imageW = 158;
    const imageH = 158;

    const imageX = margin + cardWidth - pad - imageW;
    const imageY = cursorY + pad + 12;

    const textX = margin + pad;
    const titleMaxW = Math.max(10, imageX - textX - 16);

    // imagem com frame
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(imageX - 3, imageY - 3, imageW + 6, imageH + 6, 14, 14, 'F');
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(imageX, imageY, imageW, imageH, 12, 12, 'F');

    const productImageUrl =
      (Array.isArray(product.image_urls) && product.image_urls[0]) ||
      product.image_url ||
      '';
    if (productImageUrl) {
      const productImageData = await fetchImageAsDataUrl(productImageUrl);
      if (productImageData) {
        doc.addImage(productImageData, 'PNG', imageX, imageY, imageW, imageH);
      } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(148, 163, 184);
      doc.text(
        translate('Imagem indisponível', 'Image unavailable'),
        imageX + imageW / 2,
        imageY + imageH / 2,
        { align: 'center' }
      );
      }
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(148, 163, 184);
      doc.text(
        translate('Sem imagem', 'No image'),
        imageX + imageW / 2,
        imageY + imageH / 2,
        { align: 'center' }
      );
    }

    // título
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...palette.text);
    const title = (product.title || 'Produto SaleDay').trim();
    const titleLines = doc.splitTextToSize(title, titleMaxW);
    doc.text(titleLines.slice(0, 2), textX, cursorY + 42);

    // badge (Grátis)
    let badgeX = textX;
    const badgeY = cursorY + 70;
    if (isProductFree(product)) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      const label = translate('Grátis', 'Free');
      const w = safeTextWidth(label) + 16;
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(badgeX, badgeY - 12, w, 18, 9, 9, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text(label, badgeX + 8, badgeY + 2);
      badgeX += w + 8;
    }

    // preço (pill clean)
    const priceLabel = translatePriceLabel(product, translate);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    const priceW = Math.min(safeTextWidth(priceLabel) + 18, titleMaxW);
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(textX, badgeY + 8, priceW, 24, 12, 12, 'F');
    doc.setTextColor(15, 23, 42);
    doc.text(priceLabel, textX + 10, badgeY + 25);

    // localização (discreta)
    const locationLabel = [product.city, product.state, product.country].filter(Boolean).join(' · ');
    if (locationLabel) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(locationLabel, textX, badgeY + 52, { maxWidth: titleMaxW });
    }

    // specs
    let infoY = badgeY + 74;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    const specs = buildProductSpecEntries(product);
    specs.slice(0, 4).forEach((spec) => {
      const specLine = translateSpecLine(translate, spec);
      if (!specLine) return;
      doc.text(specLine, textX, infoY, { maxWidth: titleMaxW });
      infoY += 13;
    });

    // descrição (até 2 linhas)
    const description = product.description?.trim();
    if (description) {
      doc.setFontSize(9.5);
      doc.setTextColor(100, 116, 139);
      const descLines = doc.splitTextToSize(description, titleMaxW);
      descLines.slice(0, 2).forEach((line) => {
        doc.text(line, textX, infoY, { maxWidth: titleMaxW });
        infoY += 11;
      });
    }

    // QR (baixo, clean)
    try {
      const productUrl = `${window.location.origin}/product/${product.id}`;
      const qrDataUrl = await QRCode.toDataURL(productUrl, { width: 80, margin: 0 });
      const qrSize = 56;
      const qrX = imageX;
      const qrY = cursorY + cardHeight - qrSize - 16;

      doc.setFillColor(241, 245, 249);
      doc.roundedRect(qrX - 3, qrY - 3, qrSize + 6, qrSize + 6, 12, 12, 'F');
      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        translate('Abrir no site', 'Open on the site'),
        qrX + qrSize / 2,
        qrY + qrSize + 12,
        { align: 'center' }
      );
    } catch {
      // ignore
    }

    cursorY += cardHeight + 14;
  }

  drawFooter(pageNumber);
}

async function drawModernCatalog({
  doc,
  margin,
  pageWidth,
  pageHeight,
  sellerDisplayName,
  selectedProductsForCatalog,
  translate
}) {
  const safeTextWidth = (text) => {
    try {
      return typeof doc.getTextWidth === 'function' ? doc.getTextWidth(text) : text.length * 5.2;
    } catch {
      return text.length * 5.2;
    }
  };

  const drawHero = async (imageUrl, x, y, w, h) => {
    // shadow
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(x + 2, y + 2, w, h, 18, 18, 'F');

    // frame
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(1);
    doc.roundedRect(x, y, w, h, 18, 18, 'FD');

    // image or subtle placeholder (hero sempre “parece site”)
    if (imageUrl) {
      const data = await fetchImageAsDataUrl(imageUrl);
      if (data) {
        doc.addImage(data, 'PNG', x + 2, y + 2, w - 4, h - 4);
        return;
      }
    }

    doc.setFillColor(241, 245, 249);
    doc.roundedRect(x + 2, y + 2, w - 4, h - 4, 16, 16, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(translate('Sem imagem', 'No image'), x + 16, y + h - 16);
  };

  const drawThumb = async (imageUrl, x, y, w, h) => {
    if (!imageUrl) return; // não desenhar nada: evita “vazio feio”

    doc.setFillColor(226, 232, 240);
    doc.roundedRect(x + 2, y + 2, w, h, 16, 16, 'F');

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(1);
    doc.roundedRect(x, y, w, h, 16, 16, 'FD');

    const data = await fetchImageAsDataUrl(imageUrl);
    if (data) {
      doc.addImage(data, 'PNG', x + 2, y + 2, w - 4, h - 4);
      return;
    }

    doc.setFillColor(241, 245, 249);
    doc.roundedRect(x + 2, y + 2, w - 4, h - 4, 14, 14, 'F');
  };

  let pageNumber = 1;

  for (const product of selectedProductsForCatalog) {
    if (pageNumber > 1) doc.addPage();

    // ===== base background (clean, tipo web)
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // ===== topbar
    const topBarH = 78;
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, topBarH, 'F');
    doc.setFillColor(56, 189, 248);
    doc.rect(0, topBarH - 3, pageWidth, 3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.setTextColor(255);
    doc.text('SaleDay', margin, 46);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(203, 213, 225);
    doc.text(
      `${translate('Catálogo', 'Catalog')} · ${sellerDisplayName}`,
      margin,
      66,
      {
        maxWidth: pageWidth - margin * 2 - 90
      }
    );

    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(`Pág. ${pageNumber}`, pageWidth - margin, 66, { align: 'right' });

    // ===== layout
    const innerW = pageWidth - margin * 2;
    const gutter = 14;
    const contentTop = topBarH + 22;

    const leftW = Math.min(292, innerW * 0.52);
    const rightW = innerW - leftW - gutter;

    const leftX = margin;
    const rightX = margin + leftW + gutter;

    // ===== images (sem duplicar thumbs)
    const images = Array.isArray(product.image_urls) ? product.image_urls.filter(Boolean) : [];
    const heroUrl = ((images[0] || product.image_url) ?? '').trim();
    const thumb1Url = (images[1] ?? '').trim();
    const thumb2Url = (images[2] ?? '').trim();

    const thumbs = [thumb1Url, thumb2Url].filter(Boolean);
    const thumbsCount = thumbs.length;

    const heroY = contentTop;
    const heroH = thumbsCount === 0 ? 428 : thumbsCount === 1 ? 372 : 320;

    await drawHero(heroUrl, rightX, heroY, rightW, heroH);

    // thumbs: 2 -> grid; 1 -> full width; 0 -> nada
    const thumbGap = 12;
    const thumbH = 94;
    const thumbY = heroY + heroH + thumbGap;

    if (thumbsCount === 1) {
      await drawThumb(thumbs[0], rightX, thumbY, rightW, thumbH);
    } else if (thumbsCount === 2) {
      const thumbW = (rightW - thumbGap) / 2;
      await drawThumb(thumbs[0], rightX, thumbY, thumbW, thumbH);
      await drawThumb(thumbs[1], rightX + thumbW + thumbGap, thumbY, thumbW, thumbH);
    }

    // ===== left column: title / badges / prices / cards
    const title = ((product.title || 'Produto SaleDay') + '').trim();
    const priceLabel = translatePriceLabel(product, translate);

    let y = contentTop + 14;

    // title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42);
    const titleLines = doc.splitTextToSize(title, leftW);
    doc.text(titleLines.slice(0, 2), leftX, y, { maxWidth: leftW });
    y += titleLines.length > 1 ? 30 : 24;

    // badges row
    let badgeX = leftX;
    const badgeY = y + 6;

    if (isProductFree(product)) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      const label = translate('Grátis', 'Free');
      const w = safeTextWidth(label) + 18;
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(badgeX, badgeY - 14, w, 22, 11, 11, 'F');
      doc.setTextColor(255);
      doc.text(label, badgeX + 9, badgeY + 2);
      badgeX += w + 8;
    }

    // price chip
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    const priceW = Math.min(safeTextWidth(priceLabel) + 20, leftW - (badgeX - leftX));
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(badgeX, badgeY - 14, priceW, 22, 11, 11, 'F');
    doc.setTextColor(15, 23, 42);
    doc.text(priceLabel, badgeX + 10, badgeY + 2);

    y += 24;

    // location
    const locationLabel = [product.city, product.state, product.country].filter(Boolean).join(' · ');
    if (locationLabel) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(locationLabel, leftX, y + 12, { maxWidth: leftW });
      y += 22;
    } else {
      y += 8;
    }

    // specs card (chips clean)
    const specs = buildProductSpecEntries(product).slice(0, 6);
    const specsH = 126;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(1);
    doc.roundedRect(leftX, y, leftW, specsH, 16, 16, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(translate('Destaques', 'Highlights'), leftX + 14, y + 26);

    let chipY = y + 42;
    let chipX = leftX + 14;
    const chipMaxX = leftX + leftW - 14;
    const chipH = 20;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);

    specs.forEach((spec) => {
      const specLine = translateSpecLine(translate, spec);
      if (!specLine) return;
      const w = Math.min(safeTextWidth(specLine) + 16, leftW - 28);

      if (chipX + w > chipMaxX) {
        chipX = leftX + 14;
        chipY += chipH + 8;
      }

      if (chipY + chipH > y + specsH - 12) return;

      doc.setFillColor(241, 245, 249);
      doc.roundedRect(chipX, chipY - 14, w, chipH, 10, 10, 'F');
      doc.setTextColor(71, 85, 105);
      doc.text(specLine, chipX + 8, chipY);
      chipX += w + 8;
    });

    y += specsH + 12;

    // CTA bar reserve
    const ctaH = 86;
    const ctaY = pageHeight - margin - ctaH;

    // description card (auto fit)
    const minDescH = 130;
    const maxDescH = 190;
    const descH = Math.max(minDescH, Math.min(maxDescH, ctaY - y - 12));

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(1);
    doc.roundedRect(leftX, y, leftW, descH, 16, 16, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(translate('Sobre', 'About'), leftX + 14, y + 26);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);

    const description = (product.description || '').trim();
    const descText = description || translate('Descrição não informada.', 'Description not provided.');
    const descLines = doc.splitTextToSize(descText, leftW - 28);
    const maxLines = Math.max(5, Math.floor((descH - 54) / 12));
    descLines.slice(0, maxLines).forEach((line, i) => {
      doc.text(line, leftX + 14, y + 48 + i * 12, { maxWidth: leftW - 28 });
    });

    // ===== CTA bar (full width, premium)
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(1);
    doc.roundedRect(margin, ctaY, innerW, ctaH, 18, 18, 'FD');

    // accent stripe
    doc.setFillColor(56, 189, 248);
    doc.rect(margin, ctaY, innerW, 3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(
      translate('Abrir no SaleDay', 'Open on SaleDay'),
      margin + 16,
      ctaY + 30
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      translate(
        'Escaneie o QR para ver o anúncio completo e conversar no chat.',
        'Scan the QR to view the full listing and chat.'
      ),
      margin + 16,
      ctaY + 48,
      {
        maxWidth: innerW - 130
      }
    );

    // QR
    try {
      const productUrl = `${window.location.origin}/product/${product.id}`;
      const qrSize = 64;
      const qrX = pageWidth - margin - qrSize - 14;
      const qrY = ctaY + 11;
      const qrDataUrl = await QRCode.toDataURL(productUrl, { width: qrSize, margin: 0 });

      doc.setFillColor(241, 245, 249);
      doc.roundedRect(qrX - 3, qrY - 3, qrSize + 6, qrSize + 6, 14, 14, 'F');
      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
    } catch {
      // ignore
    }

    pageNumber += 1;
  }
}


export {
  DEFAULT_CATALOG_LOCALE,
  createCatalogTranslator,
  CATALOG_STYLE_OPTIONS,
  CATALOG_PREVIEW_META,
  CATALOG_THUMBNAILS,
  drawPremiumCatalog,
  drawClassicCatalog,
  drawVibrantCatalog,
  drawModernCatalog
};

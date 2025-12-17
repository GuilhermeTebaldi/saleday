// frontend/src/pages/SellerProfile.jsx
// rede social
// Página com o perfil público de um vendedor e seus produtos.
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import api from '../api/api.js';
import { AuthContext } from '../context/AuthContext.jsx';
import GeoContext from '../context/GeoContext.jsx';
import { asStars } from '../utils/rating.js';
import { isProductFree } from '../utils/product.js';
import formatProductPrice from '../utils/currency.js';
import { Share2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { localeFromCountry } from '../i18n/localeMap.js';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { buildProductSpecEntries } from '../utils/productSpecs.js';
import { DICTS } from '../i18n/dictionaries.js';

function getInitial(name) {
  if (!name) return 'U';
  const c = name.trim().charAt(0);
  return c ? c.toUpperCase() : 'U';
}

// força URL absoluta usando base do backend configurado
function makeAbsolute(urlLike) {
  if (!urlLike) return '';
  const trimmed = String(urlLike).trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:image/')) return trimmed;
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const base =
    api.defaults?.baseURL ||
    import.meta.env.VITE_API_BASE_URL ||
    `${window.location.protocol}//${window.location.host}`;
  try {
    return new URL(path, base).toString();
  } catch {
    return path;
  }
}

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
    const imageHeight = cardHeight - 70;
    const imageX = margin + cardWidth - imageWidth - 20;
    const imageY = cursorY + 55;
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
    doc.roundedRect(margin, cursorY, cardWidth, 42, 16, 16, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(255);
    const title = (product.title || 'Produto SaleDay').trim();
    doc.text(title, margin + 16, cursorY + 24, {
      maxWidth: cardWidth - imageWidth - 40
    });
    const priceLabel =
      product.price != null
        ? formatProductPrice(product.price, product.country || 'BR')
        : translate('Preço a combinar', 'Price upon request');
    doc.setFontSize(16);
    doc.setTextColor(255, 214, 0);
    doc.text(priceLabel, margin + cardWidth - imageWidth - 20, cursorY + 26, {
      maxWidth: cardWidth - imageWidth - 30,
      align: 'right'
    });

    let textY = cursorY + 62;
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
    const bandH = 112;
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
    const priceLabel =
      product.price != null
        ? formatProductPrice(product.price, product.country || 'BR')
        : translate('Preço a combinar', 'Price upon request');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(255);
    const priceLines = doc.splitTextToSize(priceLabel, leftW - 32);
    doc.text(priceLines[0] || priceLabel, leftX + 16, contentY + 88, {
      maxWidth: leftW - 32
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
    const priceLabel =
      product.price != null
        ? formatProductPrice(product.price, product.country || 'BR')
        : translate('Preço a combinar', 'Price upon request');
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
    const priceLabel =
      product.price != null
        ? formatProductPrice(product.price, product.country || 'BR')
        : translate('Preço a combinar', 'Price upon request');

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



export default function SellerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token } = useContext(AuthContext);
  const geo = useContext(GeoContext);

  const [seller, setSeller] = useState(null);
  const [products, setProducts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [activeTab, setActiveTab] = useState('products');
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [editingReviewText, setEditingReviewText] = useState('');
  const [savingReviewId, setSavingReviewId] = useState(null);
  const [deletingReviewId, setDeletingReviewId] = useState(null);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const shareMenuRef = useRef(null);
  const [catalogSelection, setCatalogSelection] = useState([]);
  const [generatingCatalog, setGeneratingCatalog] = useState(false);

  const [reviewStatus, setReviewStatus] = useState({
    loading: false,
    data: null
  });
  const [reviewStatusTrigger, setReviewStatusTrigger] = useState(0);
  const [reviewsRefreshTrigger, setReviewsRefreshTrigger] = useState(0);
  const refreshReviewStatus = useCallback(
    () => setReviewStatusTrigger((prev) => prev + 1),
    []
  );
  const refreshReviews = useCallback(
    () => setReviewsRefreshTrigger((prev) => prev + 1),
    []
  );

  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState('');
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const avatarMenuRef = useRef(null);

  // modal avaliar
  const [rateOpen, setRateOpen] = useState(false);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [sendingReview, setSendingReview] = useState(false);

  const isSelf = user && Number(user.id) === Number(id);
  const showReviewActions = Boolean(user && !isSelf);
  const isReviewButtonEnabled = Boolean(reviewStatus.data?.canReview);
  const reviewButtonDisabled = !isReviewButtonEnabled || reviewStatus.loading;
  const isSellerOnline = isSelf || Boolean(seller?.is_online);

  // métricas vindas direto do seller
  const avgRating = useMemo(
    () => Number(seller?.rating_avg ?? 0),
    [seller?.rating_avg]
  );
  const ratingCount = Number(seller?.rating_count ?? 0);
  const hasRatings = ratingCount > 0;
  const { full, half, empty } = useMemo(
    () => asStars(avgRating),
    [avgRating]
  );
  const fallbackSalesCount = useMemo(
    () => products.reduce((total, p) => total + (p.status === 'sold' ? 1 : 0), 0),
    [products]
  );
  const salesCount = Number.isFinite(Number(seller?.sales_count))
    ? Number(seller.sales_count)
    : fallbackSalesCount;
  const purchasesCount = Number.isFinite(Number(seller?.purchase_count))
    ? Number(seller.purchase_count)
    : 0;
  const sellerDisplayName = seller?.username || 'Vendedor SaleDay';
  const selectedProductsForCatalog = useMemo(() => {
    if (!catalogSelection.length) return [];
    const ids = new Set(catalogSelection);
    return products.filter((product) => product?.id && ids.has(String(product.id)));
  }, [catalogSelection, products]);
  const catalogSelectionCount = catalogSelection.length;
  const isCatalogReady = selectedProductsForCatalog.length > 0;
  const [catalogStyle, setCatalogStyle] = useState('premium');
  const [catalogPanelOpen, setCatalogPanelOpen] = useState(false);
  const catalogLocale = useMemo(() => {
    if (user?.country) return localeFromCountry(user.country);
    if (seller?.country) return localeFromCountry(seller.country);
    if (geo?.locale) return geo.locale;
    if (geo?.country) return localeFromCountry(geo.country);
    return DEFAULT_CATALOG_LOCALE;
  }, [user?.country, seller?.country, geo?.locale, geo?.country]);
  const catalogTranslator = useMemo(
    () => createCatalogTranslator(catalogLocale),
    [catalogLocale]
  );

  const handleGenerateCatalog = useCallback(async () => {
    if (selectedProductsForCatalog.length === 0) {
      toast.error(
        catalogTranslator(
          'Selecione ao menos um produto para gerar o catálogo.',
          'Select at least one product to generate the catalog.'
        )
      );
      return;
    }
    if (typeof window === 'undefined') {
      toast.error(
        catalogTranslator(
          'Não foi possível gerar o catálogo neste ambiente.',
          'Could not generate the catalog in this environment.'
        )
      );
      return;
    }
    setGeneratingCatalog(true);
    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 30;
      const props = {
        doc,
        margin,
        pageWidth,
        pageHeight,
        sellerDisplayName,
        selectedProductsForCatalog,
        translate: catalogTranslator
      };
      if (catalogStyle === 'classic') {
        await drawClassicCatalog(props);
      } else if (catalogStyle === 'vibrant') {
        await drawVibrantCatalog(props);
      } else if (catalogStyle === 'modern') {
        await drawModernCatalog(props);
      } else {
        await drawPremiumCatalog(props);
      }
      const safeName = (
        (sellerDisplayName || 'SaleDay')
          .replace(/\s+/g, '_')
          .replace(/[^a-zA-Z0-9-_]/g, '') || 'SaleDay'
      );
      doc.save(`${safeName}-catalogo.pdf`);
      toast.success(
        catalogTranslator(
          'Catálogo gerado com sucesso.',
          'Catalog generated successfully.'
        )
      );
    } catch (error) {
      console.error(error);
      toast.error(
        catalogTranslator(
          'Não foi possível gerar o catálogo.',
          'Could not generate the catalog.'
        )
      );
    } finally {
      setGeneratingCatalog(false);
    }
  }, [
    catalogStyle,
    selectedProductsForCatalog,
    sellerDisplayName,
    catalogTranslator
  ]);

  const toggleProductSelection = useCallback((productId) => {
    if (!productId) return;
    const normalizedId = String(productId);
    setCatalogSelection((prev) => {
      if (prev.includes(normalizedId)) {
        return prev.filter((id) => id !== normalizedId);
      }
      return [...prev, normalizedId];
    });
  }, []);

  // carregar vendedor + produtos
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [sellerRes, prodRes] = await Promise.all([
          api.get(`/users/${id}`),
          api.get(`/users/${id}/products`, { params: { status: 'active' } })
        ]);

        if (!active) return;

        if (!sellerRes.data?.data) {
          setErrMsg('Vendedor não encontrado.');
          setSeller(null);
          setProducts([]);
        } else {
          setSeller(sellerRes.data.data);
          setProducts(Array.isArray(prodRes.data?.data) ? prodRes.data.data : []);
        }
      } catch (e) {
        if (!active) return;
        setErrMsg('Vendedor não encontrado.');
        setSeller(null);
        setProducts([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    let active = true;
    setLoadingReviews(true);
    api
      .get(`/users/${id}/reviews`, { params: { limit: 30 } })
      .then((res) => {
        if (!active) return;
        const list = Array.isArray(res.data?.data) ? res.data.data : [];
        setReviews(list);
      })
      .catch(() => {
        if (!active) return;
        setReviews([]);
      })
      .finally(() => {
        if (active) setLoadingReviews(false);
      });
    return () => {
      active = false;
    };
  }, [id, reviewsRefreshTrigger]);

  useEffect(() => {
    let active = true;
    if (!user) {
      setReviewStatus({ loading: false, data: null });
      return () => {
        active = false;
      };
    }

    setReviewStatus((prev) => ({ ...prev, loading: true }));
    api
      .get(`/users/${id}/reviews/status`)
      .then((res) => {
        if (!active) return;
        setReviewStatus({ loading: false, data: res.data?.data ?? null });
      })
      .catch(() => {
        if (!active) return;
        setReviewStatus((prev) => ({ ...prev, loading: false }));
      });

    return () => {
      active = false;
    };
  }, [id, user, reviewStatusTrigger]);

  useEffect(() => {
    if (!showAvatarMenu || typeof document === 'undefined') return undefined;
    const handleClickOutside = (event) => {
      if (typeof event.target === 'object' && event.target !== null) {
        if (avatarMenuRef.current && !avatarMenuRef.current.contains(event.target)) {
          setShowAvatarMenu(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAvatarMenu]);

  useEffect(() => {
    if (!isSelf && showAvatarMenu) {
      setShowAvatarMenu(false);
    }
  }, [isSelf, showAvatarMenu]);

  useEffect(() => {
    if (!shareMenuOpen || typeof document === 'undefined') return undefined;
    const handleClickOutside = (event) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target)) {
        setShareMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [shareMenuOpen]);

  const reloadSellerProfile = useCallback(async () => {
    try {
      const sellerRes = await api.get(`/users/${id}`);
      if (sellerRes.data?.data) {
        setSeller(sellerRes.data.data);
      }
    } catch {
      // manter estado atual em caso de falha
    }
  }, [id]);

  const toggleCatalogPanel = useCallback(() => {
    setCatalogPanelOpen((prev) => !prev);
  }, []);

  // enviar review (aqui continua chamando POST /users/:id/reviews
  // se seu backend também não tem isso ainda você pode remover todo esse bloco e o modal)
  const sendReview = async () => {
    if (!token) {
      toast.error('Faça login.');
      return;
    }
    if (!stars || stars < 1 || stars > 5) {
      toast.error('Nota inválida.');
      return;
    }
    setSendingReview(true);
    try {
      const res = await api.post(
        `/users/${id}/reviews`,
        { stars, comment },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data?.success) {
        toast.success('Avaliação enviada.');
        setRateOpen(false);
        setStars(5);
        setComment('');
        refreshReviewStatus();
        refreshReviews();
        // opcional: atualizar média do seller após avaliar
        await reloadSellerProfile();
      } else {
        toast.error(res.data?.message || 'Erro.');
      }
    } catch (e) {
      const msg = e?.response?.data?.message || 'Erro.';
      toast.error(msg);
    } finally {
      setSendingReview(false);
    }
  };

  const startEditingReview = useCallback((review) => {
    if (!review) return;
    setEditingReviewId(review.id);
    setEditingReviewText(review.comment ?? '');
  }, []);

  const cancelEditingReview = useCallback(() => {
    setEditingReviewId(null);
    setEditingReviewText('');
  }, []);

  const handleSaveReview = async (reviewId) => {
    if (!reviewId) return;
    if (!token) {
      toast.error('Faça login.');
      return;
    }
    setSavingReviewId(reviewId);
    try {
      const normalizedComment = editingReviewText.trim();
      const res = await api.patch(
        `/users/${id}/reviews/${reviewId}`,
        { comment: normalizedComment || null },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data?.success) {
        toast.success('Comentário atualizado.');
        cancelEditingReview();
        refreshReviews();
      } else {
        toast.error(res.data?.message || 'Erro ao atualizar comentário.');
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Erro ao atualizar comentário.';
      toast.error(msg);
    } finally {
      setSavingReviewId(null);
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!reviewId) return;
    if (!token) {
      toast.error('Faça login.');
      return;
    }
    setDeletingReviewId(reviewId);
    try {
      const res = await api.delete(`/users/${id}/reviews/${reviewId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        toast.success('Comentário excluído.');
        refreshReviews();
        refreshReviewStatus();
        await reloadSellerProfile();
        if (editingReviewId === reviewId) {
          cancelEditingReview();
        }
      } else {
        toast.error(res.data?.message || 'Erro ao excluir comentário.');
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Erro ao excluir comentário.';
      toast.error(msg);
    } finally {
      setDeletingReviewId(null);
    }
  };

  useEffect(() => {
    if (
      editingReviewId &&
      !reviews.some((review) => review.id === editingReviewId)
    ) {
      cancelEditingReview();
    }
  }, [cancelEditingReview, editingReviewId, reviews]);

  if (loading) {
    return (
      <section className="ig-wrap">
        <div className="ig-card ig-center ig-muted">Carregando...</div>
      </section>
    );
  }

  if (errMsg || !seller) {
    return (
      <section className="ig-wrap">
        <div className="ig-card ig-center ig-error">{errMsg || 'Erro'}</div>
      </section>
    );
  }

  // avatar
  const rawAvatar =
    seller.profile_image_url ||
    seller.avatar_url ||
    seller.profile_image ||
    seller.avatar ||
    '';
  const avatarUrl = rawAvatar ? makeAbsolute(rawAvatar) : '';

  const initials = getInitial(seller.username || seller.email || 'U');
  const city = seller.city || '';
  const state = seller.state || '';
  const country = seller.country || '';
  const locationStr =
    [city, state, country].filter(Boolean).join(', ') ||
    'Localização não informada';
  const handleAvatarClick = () => {
    if (!isSelf) return;
    setShowAvatarMenu((prev) => !prev);
  };
  const shareLogoSrc = '/logo-saleday.png';

  const profileUrl = seller?.id
    ? typeof window === 'undefined'
      ? `/users/${seller.id}`
      : `${window.location.origin}/users/${seller.id}`
    : '';
  const shareLabel = `${sellerDisplayName} · SaleDay`;
  const shareMessage = profileUrl
    ? `${shareLabel}\nConfira o perfil completo: ${profileUrl}`
    : `${shareLabel}\nVeja as novidades do vendedor na SaleDay.`;
  const encodedShareMessage = encodeURIComponent(shareMessage);
  const whatsappShareHref = `https://wa.me/?text=${encodedShareMessage}`;
  const emailSubject = encodeURIComponent(`Perfil de ${sellerDisplayName} no SaleDay`);
  const emailBody = encodeURIComponent(`${shareLabel}\n${profileUrl || 'https://saleday.com'}`);
  const emailShareHref = `mailto:?subject=${emailSubject}&body=${emailBody}`;
  const displayProfileLink = profileUrl ? profileUrl.replace(/^https?:\/\//, '') : '';
  const handleCopyProfileLink = async () => {
    if (!profileUrl) return;
    try {
      await navigator.clipboard.writeText(profileUrl);
      toast.success('Link copiado.');
    } catch {
      toast.error('Falha ao copiar o link.');
    }
  };

  function registerClick(productId) {
    if (!productId) return;
    api.put(`/products/${productId}/click`).catch(() => {});
  }

  const handleOpenSellerChat = () => {
    const params = new URLSearchParams();
    params.set('seller', String(seller.id));
    if (seller.username) {
      params.set('sellerName', seller.username);
    }
    navigate(`/messages?${params.toString()}`);
  };

  const handleOpenProductChat = (product) => {
    if (isSelf) {
      toast.error('Você não pode iniciar uma conversa com você mesmo.');
      return;
    }
    if (!product?.id) {
      toast.error('Produto inválido.');
      return;
    }
    const params = new URLSearchParams();
    params.set('product', String(product.id));
    params.set('seller', String(seller.id));
    if (product.title) {
      params.set('productTitle', product.title);
    }
    if (seller.username) {
      params.set('sellerName', seller.username);
    }
    const primaryImage =
      (Array.isArray(product.image_urls) && product.image_urls[0]) ||
      product.image_url ||
      '';
    const productPrice =
      product.price != null && product.country
        ? formatProductPrice(product.price, product.country)
        : null;
    const locationLabel = [product.city, product.state, product.country]
      .filter(Boolean)
      .join(', ');
    if (primaryImage) {
      params.set('productImage', makeAbsolute(primaryImage));
    }
    if (productPrice) {
      params.set('productPrice', productPrice);
    }
    if (locationLabel) {
      params.set('productLocation', locationLabel);
    }
    navigate(`/messages?${params.toString()}`);
  };

  const reviewLocale =
    (user?.country ? localeFromCountry(user.country) : null) || geo?.locale || 'pt-BR';

  const formatReviewDate = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(reviewLocale || 'pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <>
      <section className="ig-wrap ig-wrap--wide min-h-[calc(100vh-64px)] bg-gradient-to-b from-slate-50 to-slate-100 py-6 px-3">
        <div className="max-w-[1400px] w-full mx-auto bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {/* HEADER / INFO PRINCIPAL */}
          <header className="flex flex-col md:flex-row md:items-center gap-6 p-6">
            {/* Avatar */}
            <div className="flex justify-center md:block">
              <div className="relative" ref={avatarMenuRef}>
                <button
                  type="button"
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                  onClick={handleAvatarClick}
                  aria-label={isSelf ? 'Editar foto do perfil' : 'Foto do perfil'}
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={seller.username || 'Usuário'}
                      className="h-24 w-24 md:h-28 md:w-28 rounded-full object-cover border-2 border-slate-200 shadow-sm"
                    />
                  ) : (
                    <div className="h-24 w-24 md:h-28 md:w-28 rounded-full bg-slate-200 flex items-center justify-center text-3xl font-semibold text-slate-700 border border-slate-300">
                      {initials}
                    </div>
                  )}
                </button>
                {isSellerOnline && (
                  <span className="absolute -bottom-1 -right-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500 text-[10px] font-medium text-white shadow">
                    • Online agora
                  </span>
                )}
                {isSelf && showAvatarMenu && (
                  <div className="absolute left-1/2 top-full z-10 mt-2 w-48 -translate-x-1/2 rounded-2xl border border-slate-200 bg-white py-2 shadow-lg">
                    <Link
                      to="/edit-profile"
                      className="mx-2 inline-flex w-full items-center justify-center rounded-full border border-slate-200 px-3 py-1 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition"
                      onClick={() => setShowAvatarMenu(false)}
                    >
                      Editar foto
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Nome, rating e localização */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex flex-col gap-1">
                <h1 className="text-xl md:text-2xl font-semibold text-slate-900 truncate">
                  {seller.username || 'Vendedor'}
                </h1>
                <p className="text-xs md:text-sm text-slate-500 truncate">
                  @{(seller.username || seller.email || 'usuario').toLowerCase()}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <div className="flex items-center gap-1">
                  <span className="text-lg text-amber-400">
                    {'★'.repeat(full)}
                    {half ? '☆' : ''}
                    {'✩'.repeat(empty)}
                  </span>
                  <span className="text-xs text-slate-600">
                    {hasRatings ? (
                      <>
                        {avgRating.toFixed(1)} / 5
                        <span className="text-slate-400">
                          {' '}
                          · {ratingCount}{' '}
                          {ratingCount === 1 ? 'avaliação' : 'avaliações'}
                        </span>
                      </>
                    ) : (
                      'Nenhuma venda'
                    )}
                  </span>
                </div>

                <div className="h-4 w-px bg-slate-200 hidden sm:block" />

                <p className="flex items-center gap-1 text-xs md:text-sm text-slate-500">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      isSellerOnline ? 'bg-emerald-400' : 'bg-slate-300'
                    }`}
                  />
                  {locationStr}
                </p>
              </div>
            </div>

            {/* Ações principais */}
            <div className="flex flex-col gap-2 w-full md:w-auto md:items-end">
              {showReviewActions && (
                <>
                  <button
                    type="button"
                    className="w-full md:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 text-white text-sm px-4 py-2 shadow-sm hover:bg-slate-800 transition"
                    onClick={handleOpenSellerChat}
                  >
                    Mensagem
                  </button>
                  <div className="w-full md:w-auto flex flex-col gap-1">
                    <button
                      type="button"
                      className={`w-full md:w-auto inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 text-slate-700 text-xs px-4 py-1.5 transition ${
                        reviewButtonDisabled
                          ? 'cursor-not-allowed opacity-60'
                          : 'hover:bg-slate-50'
                      }`}
                      disabled={reviewButtonDisabled}
                      onClick={() => {
                        if (reviewButtonDisabled) return;
                        setRateOpen(true);
                      }}
                    >
                      Avaliar vendedor
                    </button>
                    {!reviewStatus.loading &&
                      reviewStatus.data &&
                      !reviewStatus.data.canReview && (
                        <span className="text-[11px] text-slate-500 text-right">
                          Avaliação liberada após confirmar nova compra com este vendedor.
                        </span>
                      )}
                  </div>
                </>
              )}

              <div ref={shareMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setShareMenuOpen((prev) => !prev)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring focus-visible:ring-slate-400"
                >
                  <Share2 size={14} className="text-slate-500" />
                  Compartilhar perfil
                </button>
                {shareMenuOpen && (
                  <div className="absolute right-0 z-20 mt-2 w-64 space-y-2 rounded-2xl border border-slate-200 bg-white py-3 px-3 shadow-lg">
                    <div className="space-y-1 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 px-3 py-2 text-white shadow">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-wider text-slate-200 font-semibold">SaleDay · Perfil</p>
                          <p className="truncate text-sm font-semibold">{sellerDisplayName}</p>
                        </div>
                        <img
                          src={shareLogoSrc}
                          alt="SaleDay logo"
                          className="h-10 w-10 rounded-full border border-white/30 bg-white/10 object-contain p-1"
                        />
                      </div>
                      {displayProfileLink && (
                        <div className="mt-1 flex items-center justify-between gap-3 rounded-xl bg-white/20 px-3 py-1 text-[10px] font-semibold tracking-wide text-slate-100">
                          <span className="truncate">{displayProfileLink}</span>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              handleCopyProfileLink();
                            }}
                            className="rounded-full border border-white/40 px-2 py-0.5 text-[9px]"
                          >
                            Copiar
                          </button>
                        </div>
                      )}
                    </div>
                    <a
                      href={whatsappShareHref}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white"
                    >
                      WhatsApp
                      <span className="text-[10px] text-slate-500">↗</span>
                    </a>
                    <a
                      href={emailShareHref}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white"
                    >
                      E-mail
                      <span className="text-[10px] text-slate-500">✉</span>
                    </a>
                  </div>
                )}
              </div>

              {isSelf && (
                <span className="inline-flex items-center rounded-full bg-slate-100 text-[11px] text-slate-600 px-3 py-1 mt-1">
                Este é o seu perfil público
                </span>
              )}
            </div>
          </header>

        {/* BARRA DE RESUMO */}
        <div className="bg-white border-t border-slate-200 px-3 py-3 shadow-sm w-full min-h-[110px]">
          <div className="grid grid-cols-4 gap-2 w-full">

            {/* PUBLICAÇÕES */}
            <div className="flex flex-col items-center rounded-lg bg-slate-50 py-2">
              <span className="text-sm font-extrabold text-blue-700 leading-none">
                {products.length}
              </span>
              <span className="text-[10px] tracking-wide text-slate-500 mt-0.5 leading-tight">
                {products.length === 1 ? 'Publicação' : 'Publicações'}
              </span>
            </div>

            {/* NOTA MÉDIA */}
            <div className="flex flex-col items-center rounded-lg bg-slate-50 py-2">
              <span className="text-sm font-extrabold text-yellow-600 leading-none">
                {hasRatings ? avgRating.toFixed(1) : '—'}
              </span>
              <span className="text-[10px] tracking-wide text-slate-500 mt-0.5 leading-tight">
                Nota média
              </span>
            </div>

            {/* VENDAS */}
            <div className="flex flex-col items-center rounded-lg bg-slate-50 py-2">
              <span className="text-sm font-extrabold text-green-600 leading-none">
                {salesCount}
              </span>
              <span className="text-[10px] tracking-wide text-slate-500 mt-0.5 leading-tight">
                {salesCount === 1 ? 'Venda' : 'Vendas'}
              </span>
            </div>

            {/* COMPRAS */}
            <div className="flex flex-col items-center rounded-lg bg-slate-50 py-2">
              <span className="text-sm font-extrabold text-blue-600 leading-none">
                {purchasesCount}
              </span>
              <span className="text-[10px] tracking-wide text-slate-500 mt-0.5 leading-tight">
                {purchasesCount === 1 ? 'Compra' : 'Compras'}
              </span>
            </div>

          </div>
          
        </div>


        {isSelf && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-0 text-sm text-slate-600 shadow-sm">
            <button
              type="button"
              onClick={toggleCatalogPanel}
              aria-expanded={catalogPanelOpen}
              className="flex w-full items-center justify-between gap-3 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 px-3 py-2 text-left text-white transition hover:from-slate-800 hover:to-slate-700 focus-visible:outline-none focus-visible:ring focus-visible:ring-blue-400"
            >
              <div>
                <p className="text-[10px] uppercase tracking-wide text-blue-200">Catálogo SaleDay</p>
                <p className="text-sm font-semibold leading-tight text-white">
                  {catalogSelectionCount} produto{catalogSelectionCount === 1 ? '' : 's'}
                </p>
               
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider">
                <span>{catalogPanelOpen ? 'Ocultar' : 'Modelos'}</span>
                <span
                  className={`inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/30 text-[12px] transition ${
                    catalogPanelOpen ? 'rotate-180' : ''
                  }`}
                >
                  ⌄
                </span>
              </span>
            </button>
            {catalogPanelOpen && (
              <div className="border-t border-slate-100 bg-white p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                
                  <button
                    type="button"
                    className={`inline-flex items-center justify-center rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-wider transition md:order-1 ${
                      isCatalogReady
                        ? 'bg-slate-900 text-white shadow-sm hover:bg-slate-800'
                        : 'border border-slate-200 bg-white text-slate-500 cursor-not-allowed'
                    }`}
                    disabled={!isCatalogReady || generatingCatalog}
                    onClick={handleGenerateCatalog}
                  >
                    {generatingCatalog ? 'Gerando catálogo...' : 'Gerar meu catálogo SaleDay'}
                  </button>
                </div>
                <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-500">
                    <span>Roleta de catálogo</span>
                    <span className="text-[9px] text-slate-400">Miniaturas</span>
                  </div>
                  <div className="mt-3 flex gap-3 overflow-x-auto px-1 py-2">
                    {CATALOG_STYLE_OPTIONS.map((option) => {
                      const meta = CATALOG_PREVIEW_META[option.key];
                      const thumbSrc = CATALOG_THUMBNAILS[option.key] || '/catalogo/catalogo.jpg';
                      const selected = catalogStyle === option.key;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => setCatalogStyle(option.key)}
                          className={`flex-shrink-0 w-32 sm:w-36 rounded-2xl border p-2 text-left transition ${
                            selected
                              ? 'border-slate-900 bg-slate-50 shadow-lg'
                              : 'border-slate-200 bg-white hover:border-slate-400'
                          }`}
                        >
                          <div className="h-24 w-full overflow-hidden rounded-xl bg-slate-100">
                            <img
                              src={thumbSrc}
                              alt={`${option.label} SaleDay`}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="mt-2 space-y-0.5">
                            <p className="text-xs font-semibold text-slate-900">{option.label}</p>
                            {meta?.badge && (
                              <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500">
                                {meta.badge}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {isCatalogReady && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                    {selectedProductsForCatalog.slice(0, 5).map((product) => (
                      <span
                        key={product.id}
                        className="max-w-[13rem] truncate rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600 shadow-sm"
                      >
                        {product.title}
                      </span>
                    ))}
                    {selectedProductsForCatalog.length > 5 && (
                      <span className="rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        +{selectedProductsForCatalog.length - 5} outros
                      </span>
                    )}
                  </div>
                )}
                
              </div>
            )}
          </div>
        )}


          {/* GRID / COMENTÁRIOS */}
          <section className="p-4 md:p-6">
            <div className="flex flex-wrap gap-2 mb-6">
              <button
                type="button"
                onClick={() => setActiveTab('products')}
                className={`px-4 py-2 rounded-full text-xs font-semibold tracking-wide uppercase transition ${
                  activeTab === 'products'
                    ? 'bg-slate-900 text-white shadow'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Publicações do vendedor
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('comments')}
                className={`px-4 py-2 rounded-full text-xs font-semibold tracking-wide uppercase transition ${
                  activeTab === 'comments'
                    ? 'bg-slate-900 text-white shadow'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Comentários
              </button>
            </div>

            {activeTab === 'products' ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
                    Publicações do vendedor
                  </h2>
                  {products.length > 0 && (
                    <span className="text-xs text-slate-500">
                      Mostrando {products.length} item{products.length > 1 && 's'}
                    </span>
                  )}
                </div>
                {products.length === 0 ? (
                  <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 py-10 px-4 text-center">
                    <p className="text-sm text-slate-500 max-w-sm">
                      Nenhuma publicação ainda.
                      {isSelf
                        ? ' Comece anunciando seu primeiro produto para aparecer aqui.'
                        : ' Assim que este vendedor publicar algo, os anúncios vão aparecer aqui.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
                    {products.map((p) => {
                      const img = p.image_urls?.[0] || p.image_url || '';
                      const free = isProductFree(p);
                      const normalizedProductId = p.id ? String(p.id) : '';
                      const isSelectedForCatalog =
                        normalizedProductId && catalogSelection.includes(normalizedProductId);

                      return (
                        <Link
                          to={`/product/${p.id}`}
                          state={{ fromSellerProfile: true, sellerId: seller?.id }}
                          key={p.id}
                          className="group relative overflow-hidden rounded-xl bg-slate-50 border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
                          onClick={() => registerClick(p.id)}
                        >
                          {img ? (
                            <div className="aspect-[4/5] w-full overflow-hidden bg-slate-100">
                              <img
                                src={img}
                                alt={p.title || 'Produto'}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                            </div>
                          ) : (
                            <div className="aspect-[4/5] w-full bg-slate-100 flex items-center justify-center text-xs text-slate-400">
                              Sem imagem
                            </div>
                          )}
                          <div className="absolute top-2 left-2 flex flex-col gap-1">
                            {free && (
                              <span className="inline-flex items-center rounded-full bg-emerald-500/90 text-[10px] font-medium text-white px-2 py-0.5 shadow-sm">
                                Grátis
                              </span>
                            )}
                            {p.status === 'sold' && (
                              <span className="inline-flex items-center rounded-full bg-slate-900/95 text-[10px] font-medium text-white px-2 py-0.5 shadow-sm">
                                Vendido
                              </span>
                            )}
                          </div>
                          <div className="px-2.5 py-2 space-y-1">
                            <p className="text-xs font-medium text-slate-900 line-clamp-2">
                              {p.title || 'Produto'}
                            </p>
                            <p className="text-xs font-semibold text-emerald-600">
                              {p.price != null
                                ? Number(p.price).toLocaleString('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL'
                                  })
                                : 'Preço a combinar'}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">
                              {[p.city, p.state].filter(Boolean).join(' · ') || 'Local não informado'}
                            </p>
                            {isSelf ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  toggleProductSelection(p.id);
                                }}
                                className={`inline-flex items-center justify-center rounded-full border px-2 py-1 text-[10px] font-semibold transition ${
                                  isSelectedForCatalog
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-600 shadow-sm'
                                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                                }`}
                              >
                                {isSelectedForCatalog ? 'Remover do catálogo' : 'Adicionar ao catálogo'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  handleOpenProductChat(p);
                                }}
                              >
                                Abrir conversa com o vendedor
                              </button>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
                    Comentários sobre o vendedor
                  </h2>
                  {!loadingReviews && reviews.length > 0 && (
                    <span className="text-xs text-slate-500">
                      {reviews.length}{' '}
                      {reviews.length === 1 ? 'comentário recente' : 'comentários recentes'}
                    </span>
                  )}
                </div>
                {loadingReviews ? (
                  <p className="text-sm text-slate-500 py-6 text-center">Carregando comentários...</p>
                ) : reviews.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center">
                    {isSelf
                      ? 'Ainda não há comentários. Assim que suas vendas forem avaliadas, eles aparecem aqui.'
                      : 'Este vendedor ainda não recebeu comentários de compradores.'}
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {reviews.map((review) => {
                      const reviewerName = review.reviewer_name || 'Cliente SaleDay';
                      const reviewerInitial = getInitial(reviewerName);
                      const reviewerAvatar = review.reviewer_avatar ? makeAbsolute(review.reviewer_avatar) : '';
                      const starsValueRaw = Math.max(0, Math.min(5, Number(review.stars) || 0));
                      const starsValue = Math.round(starsValueRaw);
                      const emptyStars = Math.max(0, 5 - starsValue);
                      const commentText = review.comment?.trim() || 'Sem comentário adicional.';
                      const purchaseRawImage =
                        review.product_image_url ||
                        (Array.isArray(review.image_urls) ? review.image_urls[0] : '');
                      const purchaseImageUrl = purchaseRawImage ? makeAbsolute(purchaseRawImage) : '';
                      const purchaseTitle = review.product_title?.trim();
                      const reviewerId = Number(review.reviewer_id ?? 0);
                      const currentUserId = Number(user?.id ?? 0);
                      const isReviewOwner = reviewerId > 0 && currentUserId > 0 && reviewerId === currentUserId;
                      const editingThisReview = editingReviewId === review.id;
                      const isSaving = savingReviewId === review.id;
                      const isDeleting = deletingReviewId === review.id;
                      const createdAtDate = review.created_at ? new Date(review.created_at) : null;
                      const updatedAtDate = review.updated_at ? new Date(review.updated_at) : null;
                      const wasEdited =
                        updatedAtDate &&
                        createdAtDate &&
                        typeof updatedAtDate.getTime === 'function' &&
                        typeof createdAtDate.getTime === 'function' &&
                        updatedAtDate.getTime() > createdAtDate.getTime();
                      const editedLabel = wasEdited ? formatReviewDate(review.updated_at) : null;

                      return (
                        <li
                          key={review.id}
                          className="flex gap-3 rounded-xl border border-slate-100 bg-white/60 p-3"
                        >
                          <div className="h-10 w-10 rounded-full bg-slate-100 overflow-hidden flex items-center justify-center text-sm font-semibold text-slate-600">
                            {reviewerAvatar ? (
                              <img src={reviewerAvatar} alt={reviewerName} className="h-full w-full object-cover" />
                            ) : (
                              reviewerInitial
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-700">{reviewerName}</span>
                                {purchaseImageUrl && (
                                  <img
                                    src={purchaseImageUrl}
                                    alt={purchaseTitle || 'Produto comprado'}
                                    className="h-6 w-6 rounded-lg border border-slate-100 shadow-sm object-cover"
                                  />
                                )}
                                {purchaseTitle && (
                                  <span className="text-[11px] text-slate-400 max-w-[10rem] truncate">
                                    {purchaseTitle}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span>{formatReviewDate(review.created_at)}</span>
                                {isReviewOwner && (
                                  <div className="flex items-center gap-2">
                                    {!editingThisReview && (
                                      <button
                                        type="button"
                                        className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 transition"
                                        onClick={() => startEditingReview(review)}
                                        disabled={isSaving || isDeleting}
                                      >
                                        Editar
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      className="text-[11px] font-semibold text-rose-500 hover:text-rose-600 transition"
                                      onClick={() => handleDeleteReview(review.id)}
                                      disabled={isDeleting}
                                    >
                                      {isDeleting ? 'Excluindo...' : 'Excluir'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-amber-400 text-sm">
                              <span>{'★'.repeat(starsValue)}{'☆'.repeat(emptyStars)}</span>
                              <span className="text-[11px] text-slate-500">{starsValue} / 5</span>
                            </div>
                            {editingThisReview ? (
                              <div className="mt-3 space-y-2">
                                <textarea
                                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
                                  rows={3}
                                  value={editingReviewText}
                                  onChange={(event) => setEditingReviewText(event.target.value)}
                                  disabled={isSaving}
                                />
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    className="inline-flex items-center justify-center rounded-full bg-slate-900 text-white text-xs font-semibold px-4 py-1.5 shadow-sm hover:bg-slate-800 transition disabled:cursor-not-allowed disabled:opacity-60"
                                    disabled={isSaving || isDeleting}
                                    onClick={() => handleSaveReview(review.id)}
                                  >
                                    {isSaving ? 'Salvando...' : 'Salvar'}
                                  </button>
                                  <button
                                    type="button"
                                    className="inline-flex items-center justify-center rounded-full border border-slate-200 text-xs font-semibold text-slate-600 px-4 py-1.5 hover:bg-slate-100 transition"
                                    onClick={cancelEditingReview}
                                    disabled={isSaving}
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="text-sm text-slate-700 mt-1">{commentText}</p>
                                {editedLabel && (
                                  <span className="mt-1 inline-block text-[10px] text-slate-400 uppercase tracking-wide">
                                    Editado dia {editedLabel}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </section>
        </div>
      </section>

      {/* modal de avaliação */}
      {rateOpen && (
        <div className="ig-rate-overlay">
          <div className="ig-rate-sheet">
            <div className="ig-rate-handle" />

            <p className="ig-rate-title">
              Avaliar {seller.username || 'vendedor'}
            </p>

            <div className="ig-rate-stars-row">
              <label className="ig-rate-label">
                Nota
                <select
                  className="ig-rate-select"
                  value={stars}
                  onChange={(e) => setStars(Number(e.target.value))}
                >
                  {[5,4,3,2,1].map(n => (
                    <option key={n} value={n}>{n} estrela(s)</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="ig-rate-label ig-rate-label-full">
              Comentário (opcional)
              <textarea
                className="ig-rate-textarea"
                placeholder="Conte rapidamente como foi negociar"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </label>

            <div className="ig-rate-actions">
              <button
                type="button"
                className="ig-rate-cancel"
                onClick={() => {
                  if (!sendingReview) setRateOpen(false);
                }}
              >
                Fechar
              </button>

              <button
                type="button"
                className="ig-rate-send"
                disabled={sendingReview}
                onClick={sendReview}
              >
                {sendingReview ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import SoldBadge from './SoldBadge.jsx';
import formatProductPrice from '../utils/currency.js';
import { isProductFree } from '../utils/product.js';
import api from '../api/api.js';

export default function ProductCard({ product }) {
  const onClickOpen = async () => {
    if (!product?.id) return;
    try {
      await api.put(`/products/${product.id}/click`);
    } catch {
      // falha silenciosa evita travar UX
    }
  };

  const mainImage = product.image_urls?.[0] || product.image_url;
  const freeTag = isProductFree(product);
  const price = freeTag ? 'Grátis' : formatProductPrice(product.price, product.country);
  const priceClass = `product-card__price${freeTag ? ' product-card__price--free' : ''}`;
  const detailParts = [
    product.brand,
    product.model,
    product.year ? `Ano ${product.year}` : null,
    product.color ? `Cor ${product.color}` : null
  ].filter(Boolean);


  return (
    <motion.article
      className="product-card card"
      layout={false}
      whileHover={{ scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
    >
      <div className="product-card__media">
        {product.status !== 'sold' &&
          typeof product.seller_rating_avg !== 'undefined' &&
          product.seller_rating_avg !== null && (
          <span className="product-card__badge product-card__badge--rating">
            ⭐ {Number(product.seller_rating_avg).toFixed(1)}
          </span>
        )}
        {mainImage ? (
          <img src={mainImage} alt={product.title} loading="lazy" decoding="async" />
        ) : (
          <div className="product-card__placeholder">Sem imagem</div>
        )}
        {product.status === 'sold' && <SoldBadge className="product-card__sold" />}
        {freeTag && product.status !== 'sold' && (
          <span className="product-card__badge product-card__badge--free">Grátis</span>
        )}
      </div>
      <div className="product-card__body">
        <h3 className="product-card__title">{product.title}</h3>
        <p className={priceClass}>{price}</p>
        {detailParts.length > 0 && (
          <p className="product-card__details">{detailParts.join(' • ')}</p>
        )}
      </div>
      <div className="product-card__actions">
        <Link
          to={`/product/${product.id}`}
          onClick={onClickOpen}
          data-product-id={product.id}
          className="product-card__link"
        >
          Ver detalhes
        </Link>
      </div>
    </motion.article>
  );
}

import { Link } from 'react-router-dom';
import ProductImageGallery from './ProductImageGallery.jsx';

const getInitial = (value) => {
  if (!value) return 'V';
  const letter = value.trim().charAt(0);
  return letter ? letter.toUpperCase() : 'V';
};

export default function ProductCardHome({
  product,
  images,
  imageKinds,
  galleryKey,
  priceLabel,
  locationLabel,
  onClick
}) {
  const title = product?.title || 'Produto';
  const productId = product?.id;
  const sellerId = product?.user_id ?? product?.seller_id;
  const sellerName = product?.seller_name || 'Vendedor';
  const sellerAvatar = product?.seller_avatar || '';
  const sellerInitial = getInitial(sellerName);
  const sellerProfilePath = sellerId ? `/users/${sellerId}` : '';

  return (
    <article data-product-id={productId} className="home-card home-card--gallery">
      {sellerProfilePath && (
        <Link
          to={sellerProfilePath}
          className="home-card__seller-avatar"
          aria-label={`Ver perfil de ${sellerName}`}
          title={`Ver perfil de ${sellerName}`}
          onClick={(event) => event.stopPropagation()}
        >
          {sellerAvatar ? (
            <img src={sellerAvatar} alt={sellerName} loading="lazy" />
          ) : (
            <span>{sellerInitial}</span>
          )}
        </Link>
      )}
      <Link
        to={`/product/${productId}`}
        className="home-card__link"
        draggable="false"
        onDragStart={(event) => event.preventDefault()}
        onClick={onClick}
      >
        <div className="home-card__media home-card__media--portrait">
          <ProductImageGallery
            images={images}
            imageKinds={imageKinds}
            alt={title}
            productId={productId}
            galleryKey={galleryKey}
          />
        </div>

        <div className="home-card__content home-card__content--gallery">
          <p className="home-card__price home-card__price--gallery">{priceLabel}</p>
          {locationLabel && (
            <p className="home-card__location home-card__location--gallery">{locationLabel}</p>
          )}
          <p className="home-card__title home-card__title--gallery" title={title}>
            {title}
          </p>
        </div>
      </Link>
    </article>
  );
}

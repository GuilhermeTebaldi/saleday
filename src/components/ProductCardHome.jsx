import { Link } from 'react-router-dom';
import ProductImageGallery from './ProductImageGallery.jsx';

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

  return (
    <Link
      to={`/product/${productId}`}
      key={productId}
      data-product-id={productId}
      className="home-card home-card--gallery"
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
  );
}

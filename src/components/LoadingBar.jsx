export default function LoadingBar({
  message = 'Carregando...',
  className = '',
  size = 'md',
  variant = 'stacked'
}) {
  const sizeClass =
    size === 'sm' ? 'loading-bar--sm' : size === 'lg' ? 'loading-bar--lg' : '';
  const variantClass = variant === 'inline' ? 'loading-bar--inline' : '';

  return (
    <div
      className={`loading-bar ${sizeClass} ${variantClass} ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <img src="/caregando.png" alt="" aria-hidden="true" className="loading-bar__image" />
      {message ? <span className="loading-bar__text">{message}</span> : null}
    </div>
  );
}

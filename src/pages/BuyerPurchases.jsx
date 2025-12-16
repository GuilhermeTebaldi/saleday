import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import BuyerOrdersList from '../components/BuyerOrdersList.jsx';
import { usePurchaseNotifications } from '../context/PurchaseNotificationsContext.jsx';

export default function BuyerPurchases() {
  const { orders: buyerOrders, markOrdersSeen } = usePurchaseNotifications();

  useEffect(() => {
    markOrdersSeen?.();
  }, [markOrdersSeen]);

  return (
    <section className="buyer-purchases-page px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white/80 px-5 py-4 shadow-lg">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Compras seguras</p>
            <h1 className="text-2xl font-semibold text-slate-900">
              {buyerOrders.length
                ? `Você tem ${buyerOrders.length} compra${buyerOrders.length > 1 ? 's' : ''} confirmada${buyerOrders.length > 1 ? 's' : ''}`
                : 'Nenhuma compra confirmada ainda'}
            </h1>
            <p className="text-sm text-slate-500">
              Aqui você pode conferir produtos já confirmados e avaliar os vendedores assim que receber.
            </p>
          </div>
          <Link
            to="/dashboard"
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:shadow"
          >
            Voltar ao painel
          </Link>
        </header>

        <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl">
          {buyerOrders.length === 0 ? (
            <p className="text-center text-sm text-slate-500">
              Assim que uma compra for confirmada pelo vendedor, você verá o produto aqui e poderá acompanhar o contato.
            </p>
          ) : (
            <div className="space-y-4">
              <BuyerOrdersList orders={buyerOrders} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

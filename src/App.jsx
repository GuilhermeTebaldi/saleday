//frontend/src/App.jsx
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext.jsx';
import { GeoProvider } from './context/GeoContext.jsx';
import Auth0ProviderWrapper from './context/Auth0Provider.jsx';
import Header from './components/Header.jsx';
import BanBanner from './components/BanBanner.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AdminProtectedRoute from './components/AdminProtectedRoute.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import Dashboard from './pages/Dashboard.jsx';
import EditProfile from './pages/EditProfile.jsx';
import NewProduct from './pages/NewProduct.jsx';
import MyProducts from './pages/MyProducts.jsx';
import Messages from './pages/Messages.jsx';
import SellerCatalog from './pages/SellerCatalog.jsx';
import DashboardBoost, { DashboardBoostPlan } from './pages/DashboardBoost.jsx';
import SellerProfile from './pages/SellerProfile.jsx';
import SellerSearch from './pages/SellerSearch.jsx';
import EditProduct from './pages/EditProduct.jsx';
import SalesRequests from './pages/SalesRequests.jsx';
import BuyerPurchases from './pages/BuyerPurchases.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import AdminOverview from './pages/admin/AdminOverview.jsx';
import AdminUsers from './pages/admin/AdminUsers.jsx';
import AdminProducts from './pages/admin/AdminProducts.jsx';
import AdminRanking from './pages/admin/AdminRanking.jsx';
import AdminHistory from './pages/admin/AdminHistory.jsx';
import AdminSupport from './pages/admin/AdminSupport.jsx';
import Legal from './pages/Legal.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import ScrollRestoration from './components/ScrollRestoration.jsx';

// i18n automático por país do usuário
import AutoI18n from './i18n/AutoI18n.jsx';
import { registerBanReasonListener } from './utils/banNotice.js';
import PurchaseNotificationBanner from './components/PurchaseNotificationBanner.jsx';
import { PurchaseNotificationsProvider } from './context/PurchaseNotificationsContext.jsx';

export default function App() {
  const [banMessage, setBanMessage] = useState(null);
  const [splashVisible, setSplashVisible] = useState(true);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    return registerBanReasonListener((reason) => {
      setBanMessage(reason);
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return undefined;
    }
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister().then(() => {
          console.log('[SW] Desregistrado com sucesso', registration.scope);
        });
      });
    });
    return undefined;
  }, []);

  useEffect(() => {
    document.body.classList.add('is-splashing');
    const fadeTimer = setTimeout(() => setSplashVisible(false), 1400);
    const doneTimer = setTimeout(() => {
      setSplashDone(true);
      document.body.classList.remove('is-splashing');
    }, 2100);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
      document.body.classList.remove('is-splashing');
    };
  }, []);

  return (
    <Auth0ProviderWrapper>
      <AuthProvider>
        <PurchaseNotificationsProvider>
          <GeoProvider>
            <BrowserRouter>
              <ScrollRestoration />
              {!splashDone && (
                <div
                  className={`splash-screen ${splashVisible ? 'is-active' : 'is-fading'}`}
                  role="presentation"
                >
                  <img src="/mira.png" alt="Mira" className="splash-screen__logo" />
                </div>
              )}
              <AutoI18n />
              <BanBanner message={banMessage} />
              <Header />
              <PurchaseNotificationBanner />
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/politica-de-privacidade" element={<Legal />} />
                <Route path="/users/:id" element={<SellerProfile />} />
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route
                  path="/admin"
                  element={
                    <AdminProtectedRoute>
                      <AdminLayout />
                    </AdminProtectedRoute>
                  }
                >
                  <Route index element={<AdminOverview />} />
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="ranking" element={<AdminRanking />} />
                  <Route path="products" element={<AdminProducts />} />
                  <Route path="support" element={<AdminSupport />} />
                  <Route path="history" element={<AdminHistory />} />
                </Route>
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard/impulsiona"
                  element={
                    <ProtectedRoute>
                      <DashboardBoost />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard/impulsiona/:productId"
                  element={
                    <ProtectedRoute>
                      <DashboardBoostPlan />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/my-products"
                  element={
                    <ProtectedRoute>
                      <ErrorBoundary>
                        <MyProducts />
                      </ErrorBoundary>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/new-product"
                  element={
                    <ProtectedRoute>
                      <NewProduct />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/edit-profile"
                  element={
                    <ProtectedRoute>
                      <EditProfile />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/messages"
                  element={
                    <ProtectedRoute>
                      <Messages />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/catalogo"
                  element={
                    <ProtectedRoute>
                      <SellerCatalog />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/sales-requests"
                  element={
                    <ProtectedRoute>
                      <SalesRequests />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/buyer-purchases"
                  element={
                    <ProtectedRoute>
                      <BuyerPurchases />
                    </ProtectedRoute>
                  }
                />
                <Route path="/sellers/search" element={<SellerSearch />} />
                <Route
                  path="/edit-product/:id"
                  element={
                    <ProtectedRoute>
                      <EditProduct />
                    </ProtectedRoute>
                  }
                />
              </Routes>
              <Toaster
                position="top-right"
                containerStyle={{ zIndex: 10000 }}
                toastOptions={{ duration: 6500, style: { zIndex: 10000 } }}
              />
            </BrowserRouter>
          </GeoProvider>
        </PurchaseNotificationsProvider>
      </AuthProvider>
    </Auth0ProviderWrapper>
  );
}

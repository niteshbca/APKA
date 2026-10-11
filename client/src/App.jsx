import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BranchProvider } from './context/BranchContext';
import { SyncProvider } from './context/SyncContext';
import { ToastProvider } from './context/ToastContext';
import LicenseGate from './components/LicenseGate';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';

import Login from './pages/Login';
import Downloads from './pages/Downloads';
import Dashboard from './pages/Dashboard';
import Billing from './pages/Billing';
import Products from './pages/Products';
import Categories from './pages/Categories';
import Customers from './pages/Customers';
import Purchases from './pages/Purchases';
import Inventory from './pages/Inventory';
import Invoices from './pages/Invoices';
import Reports from './pages/Reports';
import Users from './pages/Users';
import Branches from './pages/Branches';
import LicensePage from './pages/LicensePage';
import LicenseAdmin from './pages/LicenseAdmin';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';

function Protected({ children }) {
  const { ready } = useAuth();
  if (!ready) return <Navigate to="/login" replace />;
  return children;
}

function PermRoute({ perm, superadminOnly, children }) {
  const { user, hasPermission, isSuperAdmin } = useAuth();
  if (superadminOnly) {
    return isSuperAdmin ? children : <Navigate to="/" replace />;
  }
  if (user && hasPermission(perm)) return children;
  return <Navigate to="/" replace />;
}

function AppRoutes() {
  const location = useLocation();
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/downloads" element={<Downloads />} />
      <Route
        path="*"
        element={
          <Protected>
            <LicenseGate>
              <BranchProvider>
                <SyncProvider>
                  <Layout>
                    <ErrorBoundary key={location.pathname}>
                      <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/billing" element={<Billing />} />
                        <Route path="/products" element={<PermRoute perm="products.view"><Products /></PermRoute>} />
                        <Route path="/categories" element={<PermRoute perm="categories.view"><Categories /></PermRoute>} />
                        <Route path="/customers" element={<PermRoute perm="customers.view"><Customers /></PermRoute>} />
                        <Route path="/purchases" element={<PermRoute perm="purchases.view"><Purchases /></PermRoute>} />
                        <Route path="/inventory" element={<PermRoute perm="inventory.view"><Inventory /></PermRoute>} />
                        <Route path="/invoices" element={<PermRoute perm="sales.view"><Invoices /></PermRoute>} />
                        <Route path="/reports" element={<PermRoute perm="reports.view"><Reports /></PermRoute>} />
                        <Route path="/branches" element={<PermRoute perm="branches.view"><Branches /></PermRoute>} />
                        <Route path="/users" element={<PermRoute perm="users.view"><Users /></PermRoute>} />
                        <Route path="/license" element={<PermRoute perm="license.manage"><LicensePage /></PermRoute>} />
                        <Route path="/license-admin" element={<PermRoute superadminOnly><LicenseAdmin /></PermRoute>} />
                        <Route path="/settings" element={<PermRoute perm="settings.view"><Settings /></PermRoute>} />
                        <Route path="/notifications" element={<PermRoute perm="settings.view"><Notifications /></PermRoute>} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </ErrorBoundary>
                  </Layout>
                </SyncProvider>
              </BranchProvider>
            </LicenseGate>
          </Protected>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ToastProvider>
  );
}
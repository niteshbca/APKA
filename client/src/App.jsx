import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SyncProvider } from './context/SyncContext';
import { ToastProvider } from './context/ToastContext';
import LicenseGate from './components/LicenseGate';
import Layout from './components/Layout';

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
import LicensePage from './pages/LicensePage';
import LicenseAdmin from './pages/LicenseAdmin';
import Settings from './pages/Settings';

function Protected({ children }) {
  const { ready } = useAuth();
  if (!ready) return <Navigate to="/login" replace />;
  return children;
}

function RoleRoute({ roles, children }) {
  const { user } = useAuth();
  if (user && roles.includes(user.role)) return children;
  return <Navigate to="/" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/downloads" element={<Downloads />} />
      <Route
        path="*"
        element={
          <Protected>
            <LicenseGate>
              <SyncProvider>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/billing" element={<Billing />} />
                    <Route path="/products" element={<Products />} />
                    <Route path="/categories" element={<RoleRoute roles={['superadmin', 'admin']}><Categories /></RoleRoute>} />
                    <Route path="/customers" element={<Customers />} />
                    <Route path="/purchases" element={<RoleRoute roles={['superadmin', 'admin']}><Purchases /></RoleRoute>} />
                    <Route path="/inventory" element={<Inventory />} />
                    <Route path="/invoices" element={<Invoices />} />
                    <Route path="/reports" element={<RoleRoute roles={['superadmin', 'admin']}><Reports /></RoleRoute>} />
                    <Route path="/users" element={<RoleRoute roles={['superadmin', 'admin']}><Users /></RoleRoute>} />
                    <Route path="/license" element={<LicensePage />} />
                    <Route path="/license-admin" element={<RoleRoute roles={['superadmin']}><LicenseAdmin /></RoleRoute>} />
                    <Route path="/settings" element={<RoleRoute roles={['superadmin', 'admin']}><Settings /></RoleRoute>} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Layout>
              </SyncProvider>
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

import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import api from './api/axios';
import { applyAccent } from './utils/theme';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BranchProvider } from './context/BranchContext';
import { SyncProvider } from './context/SyncContext';
import { ToastProvider } from './context/ToastContext';
import { ModulesProvider, useModules } from './context/ModulesContext';
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
import LabelPrinting from './pages/LabelPrinting';
import Modules from './pages/Modules';
import PlatformAdmin from './pages/PlatformAdmin';
import ModulePlaceholder from './pages/ModulePlaceholder';
import HR from './pages/HR';
import Accounts from './pages/Accounts';
import Tasks from './pages/Tasks';
import AiAssistant from './pages/AiAssistant';
import Masters from './pages/Masters';
import Marketing from './pages/Marketing';
import Operations from './pages/Operations';
import Integrations from './pages/Integrations';
import WorkReports from './pages/WorkReports';
import AuditLog from './pages/AuditLog';
import Backup from './pages/Backup';

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

function ModuleRoute({ module, children }) {
  const { isEnabled } = useModules();
  return isEnabled(module) ? children : <Navigate to="/" replace />;
}

/**
 * Shared providers for every authenticated screen: auth guard, license gate and
 * the tenant/branch/sync contexts. Extracted so the fullscreen Billing screen
 * can reuse them without the sidebar Layout chrome.
 */
function AppProviders({ children }) {
  // Keep the brand accent in sync with the business settings on every screen
  // (the fullscreen Billing screen has no sidebar Layout, so it needs this too).
  React.useEffect(() => {
    api.get('/settings')
      .then((r) => { const c = r.data?.data?.accentColor; if (c) applyAccent(c); })
      .catch(() => {});
  }, []);

  return (
    <Protected>
      <LicenseGate>
        <ModulesProvider>
          <BranchProvider>
            <SyncProvider>{children}</SyncProvider>
          </BranchProvider>
        </ModulesProvider>
      </LicenseGate>
    </Protected>
  );
}

function AppRoutes() {
  const location = useLocation();
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/downloads" element={<Downloads />} />
      <Route path="/billing" element={<AppProviders><Billing /></AppProviders>} />
      <Route
        path="*"
        element={
          <AppProviders>
            <Layout>
              <ErrorBoundary key={location.pathname}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/products" element={<PermRoute perm="products.view"><Products /></PermRoute>} />
                  <Route path="/categories" element={<PermRoute perm="categories.view"><Categories /></PermRoute>} />
                  <Route path="/customers" element={<PermRoute perm="customers.view"><Customers /></PermRoute>} />
                  <Route path="/purchases" element={<PermRoute perm="purchases.view"><Purchases /></PermRoute>} />
                  <Route path="/inventory" element={<PermRoute perm="inventory.view"><Inventory /></PermRoute>} />
                  <Route path="/invoices" element={<PermRoute perm="sales.view"><Invoices /></PermRoute>} />
                  <Route path="/labels" element={<ModuleRoute module="labels"><PermRoute perm="labels.view"><LabelPrinting /></PermRoute></ModuleRoute>} />
                  <Route path="/reports" element={<PermRoute perm="reports.view"><Reports /></PermRoute>} />
                  <Route path="/branches" element={<PermRoute perm="branches.view"><Branches /></PermRoute>} />
                  <Route path="/users" element={<PermRoute perm="users.view"><Users /></PermRoute>} />
                  <Route path="/modules" element={<PermRoute perm="settings.edit"><Modules /></PermRoute>} />
                  <Route path="/license" element={<PermRoute perm="license.manage"><LicensePage /></PermRoute>} />
                  <Route path="/license-admin" element={<PermRoute superadminOnly><LicenseAdmin /></PermRoute>} />
                  <Route path="/platform" element={<PermRoute superadminOnly><PlatformAdmin /></PermRoute>} />
                  <Route path="/settings" element={<PermRoute perm="settings.view"><Settings /></PermRoute>} />
                  <Route path="/notifications" element={<PermRoute perm="settings.view"><Notifications /></PermRoute>} />
                  <Route path="/hr" element={<ModuleRoute module="hr"><PermRoute perm="hr.view"><HR /></PermRoute></ModuleRoute>} />
                  <Route path="/accounts" element={<ModuleRoute module="accounts"><PermRoute perm="accounts.view"><Accounts /></PermRoute></ModuleRoute>} />
                  <Route path="/tasks" element={<ModuleRoute module="tasks"><PermRoute perm="tasks.view"><Tasks /></PermRoute></ModuleRoute>} />
                  <Route path="/ai" element={<ModuleRoute module="ai"><PermRoute perm="ai.view"><AiAssistant /></PermRoute></ModuleRoute>} />
                  <Route path="/masters" element={<ModuleRoute module="master"><PermRoute perm="master.view"><Masters /></PermRoute></ModuleRoute>} />
                  <Route path="/marketing" element={<ModuleRoute module="marketing"><PermRoute perm="marketing.view"><Marketing /></PermRoute></ModuleRoute>} />
                  <Route path="/operations" element={<ModuleRoute module="operations"><PermRoute perm="operations.view"><Operations /></PermRoute></ModuleRoute>} />
                  <Route path="/integrations" element={<ModuleRoute module="integrations"><PermRoute perm="integrations.view"><Integrations /></PermRoute></ModuleRoute>} />
                  <Route path="/work-reports" element={<ModuleRoute module="workreports"><PermRoute perm="workreports.view"><WorkReports /></PermRoute></ModuleRoute>} />
                  <Route path="/edit-log" element={<ModuleRoute module="audit"><PermRoute perm="audit.view"><AuditLog /></PermRoute></ModuleRoute>} />
                  <Route path="/backup" element={<ModuleRoute module="backup"><PermRoute perm="backup.view"><Backup /></PermRoute></ModuleRoute>} />
                  <Route path="/module/:key" element={<ModulePlaceholder />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </ErrorBoundary>
            </Layout>
          </AppProviders>
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
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './components/theme/ThemeProvider';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import PurchasePage from './pages/PurchasePage';
import ComparePage from './pages/ComparePage';
import ExpensePage from './pages/ExpensePage';
import FlowPage from './pages/FlowPage';
import TipsPage from './pages/TipsPage';
import ToolsPage from './pages/ToolsPage';
import AccountPage from './pages/AccountPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CategoryManagePage from './pages/CategoryManagePage';
import ThemeSettingsPage from './pages/ThemeSettingsPage';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/purchase" element={<PurchasePage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/expense" element={<ExpensePage />} />
            <Route path="/flow" element={<FlowPage />} />
            <Route path="/tips" element={<TipsPage />} />
            <Route path="/tools" element={<ToolsPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/category-manage" element={<CategoryManagePage />} />
            <Route path="/theme-settings" element={<ThemeSettingsPage />} />
          </Route>
        </Routes>
      </ThemeProvider>
    </BrowserRouter>
  );
};

export default App;

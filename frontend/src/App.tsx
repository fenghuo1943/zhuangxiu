import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import PurchasePage from './pages/PurchasePage';
import ComparePage from './pages/ComparePage';
import ExpensePage from './pages/ExpensePage';
import FlowPage from './pages/FlowPage';
import ToolsPage from './pages/ToolsPage';
import NoticesPage from './pages/NoticesPage';
import AccountPage from './pages/AccountPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<HomePage />} />
        <Route path="/purchase" element={<PurchasePage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/expense" element={<ExpensePage />} />
        <Route path="/flow" element={<FlowPage />} />
        <Route path="/tools" element={<ToolsPage />} />
        <Route path="/notices" element={<NoticesPage />} />
        <Route path="/account" element={<AccountPage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;

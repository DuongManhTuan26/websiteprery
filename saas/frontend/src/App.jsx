import { Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home.jsx';
import { Login } from './pages/Login.jsx';
import { Register } from './pages/Register.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { DashboardLayout } from './pages/dashboard/DashboardLayout.jsx';
import { Overview } from './pages/dashboard/Overview.jsx';
import { Inbox } from './pages/dashboard/Inbox.jsx';
import { Customers } from './pages/dashboard/Customers.jsx';
import { Chatbots } from './pages/dashboard/Chatbots.jsx';
import { Fanpages } from './pages/dashboard/Fanpages.jsx';
import { Orders } from './pages/dashboard/Orders.jsx';
import { Products } from './pages/dashboard/Products.jsx';
import { AdminLeads } from './pages/admin/AdminLeads.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/dang-nhap" element={<Login />} />
      <Route path="/dang-ky" element={<Register />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Overview />} />
        <Route path="inbox" element={<Inbox />} />
        <Route path="customers" element={<Customers />} />
        <Route path="chatbots" element={<Chatbots />} />
        <Route path="fanpages" element={<Fanpages />} />
        <Route path="orders" element={<Orders />} />
        <Route path="products" element={<Products />} />
      </Route>
      <Route path="/admin/leads" element={<AdminLeads />} />
    </Routes>
  );
}

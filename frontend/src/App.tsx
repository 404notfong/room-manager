import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { useAuthStore } from '@/stores/authStore';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import BuildingsPage from '@/pages/buildings/BuildingsPage';
import RoomsPage from '@/pages/rooms/RoomsPage';
import TenantsPage from '@/pages/tenants/TenantsPage';
import TenantHistoryPage from '@/pages/tenants/TenantHistoryPage';
import ContractsPage from '@/pages/contracts/ContractsPage';
import InvoicesPage from '@/pages/invoices/InvoicesPage';
import PaymentsPage from '@/pages/payments/PaymentsPage';
import RoomGroupsPage from '@/pages/room-groups/RoomGroupsPage';
import ServicesPage from '@/pages/services/ServicesPage';
import DashboardLayout from '@/layouts/DashboardLayout';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { token } = useAuthStore();
    return token ? <>{children}</> : <Navigate to="/login" replace />;
}

function App() {
    return (
        <Router>
            <Toaster />
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />

                <Route
                    path="/"
                    element={
                        <ProtectedRoute>
                            <DashboardLayout />
                        </ProtectedRoute>
                    }
                >
                    <Route index element={<DashboardPage />} />
                    <Route path="buildings" element={<BuildingsPage />} />
                    <Route path="rooms" element={<RoomsPage />} />
                    <Route path="tenants/:id/history" element={<TenantHistoryPage />} />
                    <Route path="tenants" element={<TenantsPage />} />
                    <Route path="contracts" element={<ContractsPage />} />
                    <Route path="invoices" element={<InvoicesPage />} />
                    <Route path="payments" element={<PaymentsPage />} />
                    <Route path="room-groups" element={<RoomGroupsPage />} />
                    <Route path="services" element={<ServicesPage />} />
                </Route>
            </Routes>
        </Router>
    );
}

export default App;

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { useAuthStore } from '@/stores/authStore';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import BuildingsPage from '@/pages/buildings/BuildingsPage';
import BuildingCreatePage from '@/pages/buildings/BuildingCreatePage';
import BuildingEditPage from '@/pages/buildings/BuildingEditPage';
import RoomsPage from '@/pages/rooms/RoomsPage';
import RoomCreatePage from '@/pages/rooms/RoomCreatePage';
import RoomEditPage from '@/pages/rooms/RoomEditPage';
import TenantsPage from '@/pages/tenants/TenantsPage';
import TenantCreatePage from '@/pages/tenants/TenantCreatePage';
import TenantEditPage from '@/pages/tenants/TenantEditPage';
import TenantDetailPage from '@/pages/tenants/TenantDetailPage';
import TenantHistoryPage from '@/pages/tenants/TenantHistoryPage';
import ContractsPage from '@/pages/contracts/ContractsPage';
import ContractCreatePage from '@/pages/contracts/ContractCreatePage';
import ContractEditPage from '@/pages/contracts/ContractEditPage';
import ContractDetailPage from '@/pages/contracts/ContractDetailPage';
import TerminateContractPage from '@/pages/contracts/TerminateContractPage';
import InvoicesPage from '@/pages/invoices/InvoicesPage';
import InvoiceCreatePage from '@/pages/invoices/InvoiceCreatePage';
import InvoiceDetailPage from '@/pages/invoices/InvoiceDetailPage';
import PaymentsPage from '@/pages/payments/PaymentsPage';
import RoomGroupsPage from '@/pages/room-groups/RoomGroupsPage';
import RoomGroupCreatePage from '@/pages/room-groups/RoomGroupCreatePage';
import RoomGroupEditPage from '@/pages/room-groups/RoomGroupEditPage';
import ServicesPage from '@/pages/services/ServicesPage';
import ServiceCreatePage from '@/pages/services/ServiceCreatePage';
import ServiceEditPage from '@/pages/services/ServiceEditPage';
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
                    <Route path="buildings/new" element={<BuildingCreatePage />} />
                    <Route path="buildings/:id/edit" element={<BuildingEditPage />} />
                    <Route path="rooms" element={<RoomsPage />} />
                    <Route path="rooms/new" element={<RoomCreatePage />} />
                    <Route path="rooms/:id/edit" element={<RoomEditPage />} />
                    <Route path="tenants" element={<TenantsPage />} />
                    <Route path="tenants/new" element={<TenantCreatePage />} />
                    <Route path="tenants/:id" element={<TenantDetailPage />} />
                    <Route path="tenants/:id/edit" element={<TenantEditPage />} />
                    <Route path="tenants/:id/history" element={<TenantHistoryPage />} />
                    <Route path="contracts" element={<ContractsPage />} />
                    <Route path="contracts/new" element={<ContractCreatePage />} />
                    <Route path="contracts/:id" element={<ContractDetailPage />} />
                    <Route path="contracts/:id/edit" element={<ContractEditPage />} />
                    <Route path="contracts/:id/terminate" element={<TerminateContractPage />} />
                    <Route path="invoices" element={<InvoicesPage />} />
                    <Route path="invoices/new" element={<InvoiceCreatePage />} />
                    <Route path="invoices/:id" element={<InvoiceDetailPage />} />
                    <Route path="payments" element={<PaymentsPage />} />
                    <Route path="room-groups" element={<RoomGroupsPage />} />
                    <Route path="room-groups/new" element={<RoomGroupCreatePage />} />
                    <Route path="room-groups/:id/edit" element={<RoomGroupEditPage />} />
                    <Route path="services" element={<ServicesPage />} />
                    <Route path="services/new" element={<ServiceCreatePage />} />
                    <Route path="services/:id/edit" element={<ServiceEditPage />} />
                </Route>
            </Routes>
        </Router>
    );
}

export default App;


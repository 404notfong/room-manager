import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, DoorOpen, Users, Receipt } from 'lucide-react';
import apiClient from '@/api/client';
import RoomStatusOverview from '@/components/dashboard/RoomStatusOverview';
import ContractForm from '@/pages/contracts/ContractForm';
import ContractViewModal from '@/components/ContractViewModal';
import { ActivateContractDialog } from '@/components/ActivateContractDialog';
import { toast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// Fetch contract by ID for viewing
const fetchContract = async (contractId: string) => {
    const response = await apiClient.get(`/contracts/${contractId}`);
    return response.data;
};

export default function DashboardPage() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();

    // Contract modal states
    const [isContractFormOpen, setIsContractFormOpen] = useState(false);
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
    const [isContractViewOpen, setIsContractViewOpen] = useState(false);
    const [selectedContractId, setSelectedContractId] = useState<string | null>(null);

    // Edit & Activate states
    const [isActivateOpen, setIsActivateOpen] = useState(false);
    const [contractToActivate, setContractToActivate] = useState<{ _id: string; startDate: string; endDate?: string } | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);

    // Fetch contract data when viewing or editing
    const { data: selectedContract } = useQuery({
        queryKey: ['contract', selectedContractId],
        queryFn: () => fetchContract(selectedContractId!),
        enabled: !!selectedContractId && (isContractViewOpen || isEditMode),
    });

    const activateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string, data: any }) => {
            return (await apiClient.put(`/contracts/${id}/activate`, data)).data;
        },
        // onSuccess handled via callback in component
    });

    const handleActivateSuccess = () => {
        queryClient.invalidateQueries({ queryKey: ['rooms-dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['rooms'] });
        setIsActivateOpen(false);
        setContractToActivate(null);
        toast({ title: t('contracts.activateSuccess') });
    };

    const handleCreateContract = (roomId: string) => {
        setSelectedRoomId(roomId);
        setIsContractFormOpen(true);
        setIsEditMode(false);
        setSelectedContractId(null);
    };

    const handleViewContract = (contractId: string) => {
        setSelectedContractId(contractId);
        setIsContractViewOpen(true);
    };

    const handleEditContract = (contractId: string) => {
        setSelectedContractId(contractId);
        setIsEditMode(true);
        setIsContractFormOpen(true);
    };

    const handleActivateContract = (contract: { _id: string; startDate: string; endDate?: string }) => {
        setContractToActivate(contract);
        setIsActivateOpen(true);
    };

    const stats = [
        {
            title: t('dashboard.totalBuildings'),
            value: '0',
            icon: Building2,
            description: t('dashboard.buildingsDesc'),
            color: 'text-blue-600',
            bgColor: 'bg-blue-100',
        },
        {
            title: t('dashboard.totalRooms'),
            value: '0',
            icon: DoorOpen,
            description: t('dashboard.roomsDesc'),
            color: 'text-green-600',
            bgColor: 'bg-green-100',
        },
        {
            title: t('dashboard.totalTenants'),
            value: '0',
            icon: Users,
            description: t('dashboard.tenantsDesc'),
            color: 'text-purple-600',
            bgColor: 'bg-purple-100',
        },
        {
            title: t('dashboard.pendingInvoices'),
            value: '0',
            icon: Receipt,
            description: t('dashboard.invoicesDesc'),
            color: 'text-orange-600',
            bgColor: 'bg-orange-100',
        },
    ];

    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">{t('dashboard.title')}</h1>
                <p className="text-muted-foreground">{t('dashboard.subtitle')}</p>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => (
                    <Card key={stat.title}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                            <div className={`rounded-full p-2 ${stat.bgColor}`}>
                                <stat.icon className={`h-4 w-4 ${stat.color}`} />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stat.value}</div>
                            <p className="text-xs text-muted-foreground">{stat.description}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Room Status Overview */}
            <RoomStatusOverview
                onCreateContract={handleCreateContract}
                onViewContract={handleViewContract}
                onEditContract={handleEditContract}
                onActivateContract={handleActivateContract}
            />

            {/* Contract Form Modal */}
            <ContractForm
                open={isContractFormOpen}
                onOpenChange={(open) => {
                    setIsContractFormOpen(open);
                    if (!open) {
                        setSelectedRoomId(null);
                        setIsEditMode(false);
                        setSelectedContractId(null);
                    }
                }}
                preSelectedRoomId={selectedRoomId || undefined}
                contract={isEditMode ? selectedContract : undefined}
            />

            {/* Contract View Modal */}
            <ContractViewModal
                contract={selectedContract}
                open={isContractViewOpen}
                onOpenChange={(open) => {
                    setIsContractViewOpen(open);
                    if (!open) setSelectedContractId(null);
                }}
            />

            {/* Activate Contract Dialog */}
            {contractToActivate && (
                <ActivateContractDialog
                    isOpen={isActivateOpen}
                    onClose={() => setIsActivateOpen(false)}
                    initialData={{
                        startDate: contractToActivate.startDate || new Date().toISOString(),
                        endDate: contractToActivate.endDate,
                    }}
                    onConfirm={(data) => {
                        activateMutation.mutate(
                            { id: contractToActivate._id, data },
                            { onSuccess: handleActivateSuccess, onError: (err: any) => toast({ variant: 'destructive', title: err.response?.data?.message || 'Error' }) }
                        )
                    }}
                    isSubmitting={activateMutation.isPending}
                />
            )}
        </div>
    );
}

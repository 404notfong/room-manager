import apiClient from '@/api/client';
import { ActivateContractDialog } from '@/components/ActivateContractDialog';
import BigCalendar from '@/components/dashboard/calendar/BigCalendar';
import RoomStatusOverview from '@/components/dashboard/RoomStatusOverview';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, DoorOpen, Receipt, Users } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // Activate states
    const [isActivateOpen, setIsActivateOpen] = useState(false);
    const [contractToActivate, setContractToActivate] = useState<{ 
        _id: string; 
        startDate: string; 
        endDate?: string; 
        contractType?: string; 
        roomType?: string;
        paymentCycleMonths?: number;
        paymentDueDay?: number;
    } | null>(null);

    const activateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string, data: any }) => {
            return (await apiClient.put(`/contracts/${id}/activate`, data)).data;
        },
    });

    const handleActivateSuccess = () => {
        queryClient.invalidateQueries({ queryKey: ['rooms-dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['rooms'] });
        setIsActivateOpen(false);
        setContractToActivate(null);
        toast({ title: t('contracts.activateSuccess') });
    };

    const handleCreateContract = (roomId: string) => {
        navigate(`/contracts/new?roomId=${roomId}`);
    };

    const handleViewContract = (contractId: string) => {
        navigate(`/contracts/${contractId}`);
    };

    const handleEditContract = (contractId: string) => {
        navigate(`/contracts/${contractId}/edit`);
    };

    const handleActivateContract = (contract: { 
        _id: string; 
        startDate: string; 
        endDate?: string; 
        contractType?: string; 
        roomType?: string;
        paymentCycleMonths?: number;
        paymentDueDay?: number;
    }) => {
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

            <Tabs defaultValue="dashboard" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="dashboard">{t('dashboard.title')}</TabsTrigger>
                    <TabsTrigger value="board">{t('dashboard.roomOverview')}</TabsTrigger>
                </TabsList>

                <TabsContent value="dashboard" className="space-y-4">
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

                    {/* Calendar */}
                    <BigCalendar />
                </TabsContent>

                <TabsContent value="board" className="space-y-4">
                    {/* Room Status Overview */}
                    <RoomStatusOverview
                        onCreateContract={handleCreateContract}
                        onViewContract={handleViewContract}
                        onEditContract={handleEditContract}
                        onActivateContract={handleActivateContract}
                    />
                </TabsContent>

            </Tabs>

            {/* Activate Contract Dialog */}
            {contractToActivate && (
                <ActivateContractDialog
                    isOpen={isActivateOpen}
                    onClose={() => setIsActivateOpen(false)}
                    initialData={{
                        startDate: contractToActivate.startDate || new Date().toISOString(),
                        endDate: contractToActivate.endDate,
                    }}
                    contractType={(contractToActivate.contractType || contractToActivate.roomType || 'LONG_TERM') as 'SHORT_TERM' | 'LONG_TERM'}
                    paymentCycleMonths={contractToActivate.paymentCycleMonths}
                    paymentDueDay={contractToActivate.paymentDueDay}
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

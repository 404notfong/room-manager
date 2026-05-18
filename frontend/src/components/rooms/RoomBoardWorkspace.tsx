import apiClient from '@/api/client';
import { ActivateContractDialog } from '@/components/ActivateContractDialog';
import RoomStatusOverview from '@/components/dashboard/RoomStatusOverview';
import { toast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

type ActivatableContract = {
    _id: string;
    startDate: string;
    endDate?: string;
    contractType?: string;
    roomType?: string;
    paymentCycleMonths?: number;
    paymentDueDay?: number;
};

export default function RoomBoardWorkspace() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [isActivateOpen, setIsActivateOpen] = useState(false);
    const [contractToActivate, setContractToActivate] = useState<ActivatableContract | null>(null);

    const activateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: unknown }) => {
            return (await apiClient.put(`/contracts/${id}/activate`, data)).data;
        },
    });

    const handleActivateSuccess = () => {
        queryClient.invalidateQueries({ queryKey: ['rooms-dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['rooms'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        setIsActivateOpen(false);
        setContractToActivate(null);
        toast({ variant: 'success', title: t('contracts.activateSuccess') });
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

    const handleActivateContract = (contract: ActivatableContract) => {
        setContractToActivate(contract);
        setIsActivateOpen(true);
    };

    return (
        <>
            <RoomStatusOverview
                onCreateContract={handleCreateContract}
                onViewContract={handleViewContract}
                onEditContract={handleEditContract}
                onActivateContract={handleActivateContract}
            />

            {contractToActivate ? (
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
                            {
                                onSuccess: handleActivateSuccess,
                                onError: (error: any) =>
                                    toast({
                                        variant: 'destructive',
                                        title: error.response?.data?.message || 'Error',
                                    }),
                            },
                        );
                    }}
                    isSubmitting={activateMutation.isPending}
                />
            ) : null}
        </>
    );
}

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, FileText, Calendar, Pencil, Trash2, Search, Zap, Droplets } from 'lucide-react';
import { PriceTablePopover } from '@/components/PriceTablePopover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

import { toast } from '@/hooks/use-toast';
import apiClient from '@/api/client';
import Pagination from '@/components/Pagination';
import { useBuildingStore } from '@/stores/buildingStore';
import { useDebounce } from '@/hooks/useDebounce';
import { useColumnVisibility, ColumnConfig } from '@/hooks/useColumnVisibility';
import { ColumnVisibilityToggle } from '@/components/ColumnVisibilityToggle';
import { formatPhoneNumber, formatDate } from '@/lib/utils';

interface Contract {
    _id: string;
    contractCode: string;
    tenantId: { _id: string; fullName: string; phone: string };
    roomId: { _id: string; roomCode: string; roomName: string; buildingId?: { _id: string; name: string } };
    startDate: string;
    endDate: string;
    rentPrice: number;
    depositAmount: number;
    electricityPrice?: number;
    waterPrice?: number;
    initialElectricIndex?: number;
    initialWaterIndex?: number;
    contractType?: 'LONG_TERM' | 'SHORT_TERM'; // Made optional as roomType might be used
    roomType?: 'LONG_TERM' | 'SHORT_TERM';
    shortTermPricingType?: 'HOURLY' | 'DAILY' | 'FIXED';
    hourlyPricingMode?: 'PER_HOUR' | 'TABLE';
    pricePerHour?: number;
    fixedPrice?: number;
    shortTermPrices?: any[];
    paymentDueDay?: number;
    paymentCycle: 'MONTHLY' | 'MONTHLY_2' | 'QUARTERLY' | 'MONTHLY_6' | 'MONTHLY_12' | 'CUSTOM';
    paymentCycleMonths?: number;
    serviceCharges: Array<{ name: string; amount: number; quantity?: number; isRecurring: boolean }>;
    status: 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED';
    createdAt: string;
}

const contractsApi = {
    getAll: async (params: any): Promise<any> => {
        const response = await apiClient.get('/contracts', { params });
        return response.data;
    },
    create: async (data: Partial<Contract>) => {
        const response = await apiClient.post('/contracts', data);
        return response.data;
    },
    update: async (id: string, data: Partial<Contract>) => {
        const response = await apiClient.put(`/contracts/${id}`, data);
        return response.data;
    },
    delete: async (id: string) => {
        const response = await apiClient.delete(`/contracts/${id}`);
        return response.data;
    },
    activate: async (id: string, data: { startDate: string; endDate?: string | null }) => {
        const response = await apiClient.put(`/contracts/${id}/activate`, data);
        return response.data;
    },
};

import ContractForm from './ContractForm';
import { ActivateContractDialog } from '@/components/ActivateContractDialog';
import ContractViewModal from '@/components/ContractViewModal';

export default function ContractsPage() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { selectedBuildingId } = useBuildingStore();
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isActivateOpen, setIsActivateOpen] = useState(false);
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Column visibility configuration
    const columnConfig: ColumnConfig[] = [
        { id: 'code', label: t('contracts.code') },
        { id: 'tenant', label: t('contracts.tenant') },
        { id: 'room', label: t('contracts.room') },
        { id: 'type', label: t('contracts.type') },
        { id: 'period', label: t('contracts.period') },
        { id: 'rentPrice', label: t('contracts.rentPrice') },
        { id: 'deposit', label: t('contracts.deposit'), defaultVisible: false },
        { id: 'totalService', label: t('contracts.totalServiceAmount'), defaultVisible: false },
        { id: 'status', label: t('common.status') },
    ];
    const columnVisibility = useColumnVisibility('contracts', columnConfig);

    const { data: contractsData, isLoading } = useQuery({
        queryKey: ['contracts', { page: currentPage, limit: pageSize, search: debouncedSearchTerm, buildingId: selectedBuildingId }],
        queryFn: () => contractsApi.getAll({
            page: currentPage,
            limit: pageSize,
            search: debouncedSearchTerm,
            buildingId: selectedBuildingId || undefined
        }),
    });

    const contracts: Contract[] = Array.isArray(contractsData?.data) ? contractsData.data : [];
    const meta = contractsData?.meta || { total: 0, totalPages: 0 };

    const deleteMutation = useMutation({
        mutationFn: contractsApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contracts'] });
            setIsDeleteOpen(false);
            setSelectedContract(null);
            toast({ title: t('contracts.deleteSuccess') });
        },
        onError: () => {
            toast({ variant: 'destructive', title: t('contracts.deleteError') });
        },
    });

    const activateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string, data: any }) => contractsApi.activate(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contracts'] });
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
            queryClient.invalidateQueries({ queryKey: ['tenants'] });
            setIsActivateOpen(false);
            setSelectedContract(null);
            toast({ title: t('contracts.activateSuccess') });
        },
        onError: (err: any) => {
            toast({ variant: 'destructive', title: err.response?.data?.message || t('contracts.activateError') });
        }
    });

    const handleActivate = (contract: Contract) => {
        setSelectedContract(contract);
        setIsActivateOpen(true);
    };

    const handleViewContract = (contract: Contract) => {
        setSelectedContract(contract);
        setIsViewOpen(true);
    };

    const handleDelete = (contract: Contract) => {
        setSelectedContract(contract);
        setIsDeleteOpen(true);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ACTIVE':
                return <Badge className="bg-emerald-500 text-white border-0">{t('contracts.statusActive')}</Badge>;
            case 'EXPIRED':
                return <Badge className="bg-gray-500 text-white border-0">{t('contracts.statusExpired')}</Badge>;
            case 'TERMINATED':
                return <Badge className="bg-red-500 text-white border-0">{t('contracts.statusTerminated')}</Badge>;
            case 'DRAFT':
                return <Badge className="bg-orange-500 text-white border-0">{t('contracts.statusDraft')}</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };



    const formatCurrency = (amount: number | undefined) => {
        if (amount === undefined || amount === null) return '-';
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    const getContractTypeBadge = (roomType: string | undefined, contractType: string | undefined) => {
        // roomType is the definitive Long/Short term indicator
        if (roomType === 'LONG_TERM' || contractType === 'LONG_TERM') {
            return <Badge variant="outline" className="border-green-500 text-green-600 font-medium">{t('contracts.roomTypeLongTerm')}</Badge>;
        }
        return <Badge variant="outline" className="border-orange-500 text-orange-600 font-medium">{t('contracts.roomTypeShortTerm')}</Badge>;
    };

    const getRentPriceDisplay = (contract: Contract) => {
        const type = contract.roomType || (contract.contractType === 'LONG_TERM' ? 'LONG_TERM' : 'SHORT_TERM');

        if (type === 'LONG_TERM') {
            return (
                <div className="flex flex-col gap-1 text-sm items-end">
                    <div className="font-medium whitespace-nowrap">
                        {formatCurrency(contract.rentPrice)}
                        <span className="text-muted-foreground text-xs font-normal"> / {contract.paymentCycleMonths || 1} {t('rooms.month')}</span>
                    </div>
                    {(contract.electricityPrice !== undefined || contract.waterPrice !== undefined) && (
                        <div className="flex gap-2 text-xs text-muted-foreground">
                            {contract.electricityPrice !== undefined && (
                                <span className="flex items-center gap-1" title={t('contracts.electricPrice')}>
                                    <Zap className="h-3 w-3" />
                                    {formatCurrency(contract.electricityPrice)}
                                </span>
                            )}
                            {contract.waterPrice !== undefined && (
                                <span className="flex items-center gap-1" title={t('contracts.waterPrice')}>
                                    <Droplets className="h-3 w-3" />
                                    {formatCurrency(contract.waterPrice)}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            );
        }

        // Short term logic
        switch (contract.shortTermPricingType) {
            case 'HOURLY':
                if (contract.hourlyPricingMode === 'PER_HOUR') {
                    return `${formatCurrency(contract.pricePerHour)}/h`;
                }
                if (contract.hourlyPricingMode === 'TABLE' && contract.shortTermPrices) {
                    return <PriceTablePopover shortTermPrices={contract.shortTermPrices} pricingType="HOURLY" />;
                }
                return t('rooms.tableMode');
            case 'DAILY':
                if (contract.shortTermPrices) {
                    return <PriceTablePopover shortTermPrices={contract.shortTermPrices} pricingType="DAILY" />;
                }
                return t('rooms.pricingDaily');
            case 'FIXED':
                return formatCurrency(contract.fixedPrice);
            default:
                return formatCurrency(contract.rentPrice);
        }
    };

    const getPaymentCycleLabel = (contract: Contract) => {
        const type = contract.roomType || (contract.contractType === 'LONG_TERM' ? 'LONG_TERM' : 'SHORT_TERM');
        if (type === 'SHORT_TERM') {
            switch (contract.shortTermPricingType) {
                case 'HOURLY': return t('rooms.pricingHourly');
                case 'DAILY': return t('rooms.pricingDaily');
                case 'FIXED': return t('rooms.pricingFixed');
                default: return '-';
            }
        }

        switch (contract.paymentCycle) {
            case 'MONTHLY':
                return t('contracts.cycleMonthly');
            case 'MONTHLY_2':
                return t('contracts.cycleMonthly2');
            case 'QUARTERLY':
                return t('contracts.cycleQuarterly');
            case 'MONTHLY_6':
                return t('contracts.cycleHalfYearly');
            case 'MONTHLY_12':
                return t('contracts.cycleYearly');
            case 'CUSTOM':
                return `${contract.paymentCycleMonths} ${t('rooms.month')}`;
            default:
                return contract.paymentCycle;
        }
    };

    const getTotalServices = (contract: Contract) => {
        if (!contract.serviceCharges || !Array.isArray(contract.serviceCharges)) return 0;
        return contract.serviceCharges.reduce((sum, service) => sum + (service.amount * (service.quantity || 1)), 0);
    };

    const handleSearchChange = (value: string) => {
        setSearchTerm(value);
        setCurrentPage(1);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{t('contracts.title')}</h1>
                    <p className="text-muted-foreground">{t('contracts.subtitle')}</p>
                </div>
                <Button onClick={() => {
                    setSelectedContract(null);
                    setIsCreateOpen(true);
                }}>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('contracts.add')}
                </Button>
            </div>

            {/* Search */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder={t('common.search')}
                        value={searchTerm}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            {/* Table */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            {t('contracts.list')}
                        </CardTitle>
                        <CardDescription>
                            {t('contracts.totalCount', { count: meta.total })}
                        </CardDescription>
                    </div>
                    <ColumnVisibilityToggle {...columnVisibility} />
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
                    ) : contracts.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">{t('contracts.noData')}</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {columnVisibility.isVisible('code') && <TableHead className="w-[120px]">{t('contracts.code')}</TableHead>}
                                    {columnVisibility.isVisible('tenant') && <TableHead className="w-[180px]">{t('contracts.tenant')}</TableHead>}
                                    {columnVisibility.isVisible('room') && <TableHead className="w-[150px]">{t('contracts.room')}</TableHead>}
                                    {columnVisibility.isVisible('type') && <TableHead className="text-center w-[100px]">{t('contracts.type')}</TableHead>}
                                    {columnVisibility.isVisible('period') && <TableHead className="w-[120px]">{t('contracts.period')}</TableHead>}
                                    {columnVisibility.isVisible('rentPrice') && <TableHead className="text-right w-[150px]">{t('contracts.rentPrice')}</TableHead>}
                                    {columnVisibility.isVisible('deposit') && <TableHead className="text-right w-[120px]">{t('contracts.deposit')}</TableHead>}
                                    {columnVisibility.isVisible('totalService') && <TableHead className="text-right w-[130px]">{t('contracts.totalServiceAmount')}</TableHead>}
                                    {columnVisibility.isVisible('status') && <TableHead className="text-center w-[120px]">{t('common.status')}</TableHead>}
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {contracts.map((contract) => (
                                    <TableRow key={contract._id}>
                                        {columnVisibility.isVisible('code') && (
                                            <TableCell
                                                className="font-mono text-xs font-medium cursor-pointer hover:text-primary hover:underline"
                                                onClick={() => handleViewContract(contract)}
                                            >
                                                {contract.contractCode || '-'}
                                            </TableCell>
                                        )}
                                        {columnVisibility.isVisible('tenant') && (
                                            <TableCell>
                                                <div className="font-medium">{contract.tenantId?.fullName || '-'}</div>
                                                <div className="text-xs text-muted-foreground">{formatPhoneNumber(contract.tenantId?.phone)}</div>
                                            </TableCell>
                                        )}
                                        {columnVisibility.isVisible('room') && (
                                            <TableCell>
                                                <div className="font-medium">{contract.roomId?.roomName || contract.roomId?.roomCode || '-'}</div>
                                                <div className="text-xs text-muted-foreground">{contract.roomId?.buildingId?.name || '-'}</div>
                                            </TableCell>
                                        )}
                                        {columnVisibility.isVisible('type') && (
                                            <TableCell className="text-center">{getContractTypeBadge(contract.roomType, contract.contractType)}</TableCell>
                                        )}
                                        {columnVisibility.isVisible('period') && (
                                            <TableCell>
                                                <div className="flex flex-col gap-1 text-sm">
                                                    <div className="flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" />
                                                        {formatDate(contract.startDate)}
                                                    </div>
                                                    <div className="flex items-center gap-1 text-muted-foreground text-xs font-normal">
                                                        <Calendar className="h-3 w-3 invisible" />
                                                        {contract.endDate ? formatDate(contract.endDate) : t('contracts.noEndDate')}
                                                    </div>
                                                </div>
                                            </TableCell>
                                        )}
                                        {columnVisibility.isVisible('rentPrice') && (
                                            <TableCell className="text-right">
                                                <div className="flex flex-col gap-1 text-sm items-end">
                                                    <div className="font-medium whitespace-nowrap">
                                                        {getRentPriceDisplay(contract)}
                                                    </div>
                                                    <div className="text-muted-foreground text-xs font-normal">
                                                        {getPaymentCycleLabel(contract)}
                                                    </div>
                                                </div>
                                            </TableCell>
                                        )}
                                        {columnVisibility.isVisible('deposit') && (
                                            <TableCell className="text-right font-medium">
                                                {formatCurrency(contract.depositAmount)}
                                            </TableCell>
                                        )}
                                        {columnVisibility.isVisible('totalService') && (
                                            <TableCell className="text-right">
                                                {formatCurrency(getTotalServices(contract))}
                                            </TableCell>
                                        )}
                                        {columnVisibility.isVisible('status') && (
                                            <TableCell className="text-center">{getStatusBadge(contract.status)}</TableCell>
                                        )}
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => {
                                                    setSelectedContract(contract);
                                                    setIsCreateOpen(true);
                                                }}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                {contract.status === 'DRAFT' && (
                                                    <>
                                                        <Button variant="ghost" size="icon" onClick={() => handleActivate(contract)} className="text-blue-600 hover:text-blue-600">
                                                            <Calendar className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(contract)} className="text-destructive hover:text-destructive">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                    {meta.total > 0 && (
                        <Pagination
                            currentPage={currentPage}
                            totalPages={meta.totalPages}
                            pageSize={pageSize}
                            totalItems={meta.total}
                            onPageChange={setCurrentPage}
                            onPageSizeChange={(size) => {
                                setPageSize(size);
                                setCurrentPage(1);
                            }}
                        />
                    )}
                </CardContent>
            </Card>

            {/* Delete Dialog */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('contracts.deleteTitle')}</DialogTitle>
                        <DialogDescription>
                            {selectedContract?.status === 'DRAFT'
                                ? t('contracts.deleteDraftConfirm')
                                : t('contracts.deleteConfirm')}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => selectedContract && deleteMutation.mutate(selectedContract._id)}
                            disabled={deleteMutation.isPending}
                        >
                            {t('common.delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ContractForm
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                contract={selectedContract && isCreateOpen ? selectedContract : undefined}
            />

            {selectedContract && (
                <ActivateContractDialog
                    isOpen={isActivateOpen}
                    onClose={() => setIsActivateOpen(false)}
                    initialData={{
                        startDate: selectedContract.startDate,
                        endDate: selectedContract.endDate,
                    }}
                    onConfirm={(data) => activateMutation.mutate({ id: selectedContract._id, data })}
                    isSubmitting={activateMutation.isPending}
                />
            )}

            {/* View Contract Modal */}
            <ContractViewModal
                open={isViewOpen}
                onOpenChange={setIsViewOpen}
                contract={selectedContract}
            />
        </div>
    );
}

import apiClient from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/useDebounce';
import { useBuildingStore } from '@/stores/buildingStore';
import { useQuery } from '@tanstack/react-query';
import { FileText, Loader2, Search } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ContractSelectModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSelect: (contract: any) => void;
}

const contractsApi = {
    getAll: async (params: any): Promise<any> => {
        const response = await apiClient.get('/contracts', { params });
        return response.data;
    },
};

export default function ContractSelectModal({ open, onOpenChange, onSelect }: ContractSelectModalProps) {
    const { t } = useTranslation();
    const { selectedBuildingId } = useBuildingStore();
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 300);

    const { data: contractsData, isLoading } = useQuery({
        queryKey: ['contracts-for-invoice', { buildingId: selectedBuildingId, search: debouncedSearch }],
        queryFn: () => contractsApi.getAll({
            page: 1,
            limit: 50,
            search: debouncedSearch || undefined,
            buildingId: selectedBuildingId || undefined,
            status: 'ACTIVE',
        }),
        enabled: open,
    });

    const contracts: any[] = Array.isArray(contractsData?.data) ? contractsData.data : [];

    const formatCurrency = (amount: number) => {
        if (!amount) return '-';
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    const getTypeLabel = (contract: any) => {
        const type = contract.roomType || contract.contractType;
        return type === 'LONG_TERM' ? t('contracts.roomTypeLongTerm') : t('contracts.roomTypeShortTerm');
    };

    const getTypeBadgeColor = (contract: any) => {
        const type = contract.roomType || contract.contractType;
        return type === 'LONG_TERM'
            ? 'bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400'
            : 'bg-orange-100 text-orange-700 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400';
    };

    const getContractPrice = (contract: any): { price: number | null; unit: string; isPriceTable?: boolean } => {
        const type = contract.roomType || contract.contractType;
        if (type === 'LONG_TERM') {
            return { price: contract.rentPrice, unit: t('common.month') };
        }
        // Short-term
        const pricingType = contract.shortTermPricingType;
        if (pricingType === 'FIXED') {
            return { price: contract.fixedPrice, unit: t('contracts.fixed') || 'lần' };
        }
        if (pricingType === 'HOURLY') {
            if (contract.hourlyPricingMode === 'PER_HOUR') {
                return { price: contract.pricePerHour, unit: t('contracts.hour') || 'giờ' };
            }
            // Price table mode
            return { price: null, unit: '', isPriceTable: true };
        }
        if (pricingType === 'DAILY') {
            return { price: null, unit: '', isPriceTable: true };
        }
        return { price: null, unit: '' };
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-emerald-600" />
                        {t('invoices.selectContract')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('invoices.selectContractDesc')}
                    </DialogDescription>
                </DialogHeader>

                <DialogBody className="pt-2 space-y-4">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder={t('invoices.searchContractPlaceholder')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    {/* Contract List */}
                    <div className="overflow-y-auto space-y-2 min-h-[200px] max-h-[400px]">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                            </div>
                        ) : contracts.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">{t('invoices.noActiveContracts')}</p>
                            </div>
                        ) : (
                            contracts.map((contract) => (
                                <button
                                    key={contract._id}
                                    className="w-full text-left p-3 rounded-lg border dark:border-slate-600 hover:border-emerald-300 dark:hover:border-emerald-600 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 transition-all group cursor-pointer"
                                    onClick={() => {
                                        onSelect(contract);
                                        onOpenChange(false);
                                    }}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                                                    {contract.contractCode}
                                                </span>
                                                <Badge variant="outline" className={getTypeBadgeColor(contract)}>
                                                    {getTypeLabel(contract)}
                                                </Badge>
                                            </div>
                                            <div className="text-xs text-muted-foreground space-y-0.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-slate-600 dark:text-slate-300">
                                                        {contract.tenantId?.fullName || '-'}
                                                    </span>
                                                    <span className="text-slate-300 dark:text-slate-500">•</span>
                                                    <span>{contract.roomId?.roomCode || contract.roomId?.roomName || '-'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            {(() => {
                                                const { price, unit, isPriceTable } = getContractPrice(contract);
                                                if (isPriceTable && contract.shortTermPrices?.length > 0) {
                                                    const prices = contract.shortTermPrices.map((t: any) => t.price);
                                                    const minP = Math.min(...prices);
                                                    const maxP = Math.max(...prices);
                                                    const pUnit = contract.shortTermPricingType === 'HOURLY' ? t('contracts.hour') : t('contracts.day');
                                                    return (
                                                        <>
                                                            <div className="font-semibold text-sm text-emerald-700 dark:text-emerald-400">
                                                                {minP === maxP ? formatCurrency(minP) : `${formatCurrency(minP)} - ${formatCurrency(maxP)}`}
                                                            </div>
                                                            <div className="text-[10px] text-muted-foreground mt-0.5">
                                                                /{pUnit}
                                                            </div>
                                                        </>
                                                    );
                                                }
                                                return (
                                                    <>
                                                        <div className="font-semibold text-sm text-emerald-700 dark:text-emerald-400">
                                                            {price ? formatCurrency(price) : '-'}
                                                        </div>
                                                        {unit && (
                                                            <div className="text-[10px] text-muted-foreground mt-0.5">
                                                                /{unit}
                                                            </div>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </DialogBody>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        {t('common.cancel')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

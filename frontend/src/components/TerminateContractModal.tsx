import apiClient from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AlertTriangle, FileText, Loader2, UserMinus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface TerminateContractModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    contract: any;
    onSuccess?: () => void;
}

export default function TerminateContractModal({
    open,
    onOpenChange,
    contract,
    onSuccess,
}: TerminateContractModalProps) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();

    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [createFinalInvoice, setCreateFinalInvoice] = useState(true);
    const [closeTenant, setCloseTenant] = useState(false);

    const terminateMutation = useMutation({
        mutationFn: async (data: any) => {
            const response = await apiClient.patch(
                `/contracts/${contract._id}/terminate?closeTenant=${closeTenant}`,
                data
            );
            return response.data;
        },
        onSuccess: () => {
            toast({
                title: t('common.success'),
                description: t('contracts.terminateSuccess'),
            });
            queryClient.invalidateQueries({ queryKey: ['contracts'] });
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
            queryClient.invalidateQueries({ queryKey: ['tenants'] });
            onSuccess?.();
            onOpenChange(false);
        },
        onError: (error: any) => {
            toast({
                title: t('common.error'),
                description: error.response?.data?.message || t('contracts.terminateError'),
                variant: 'destructive',
            });
        },
    });

    const handleSubmit = () => {
        if (!contract) return;

        const payload = {
            endDate: new Date(endDate),
            createFinalInvoice,
        };

        terminateMutation.mutate(payload);
    };

    if (!contract) return null;

    const room = contract.roomId;
    const tenant = contract.tenantId;
    const contractType = contract.contractType;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-600">
                        <AlertTriangle className="h-5 w-5" />
                        {t('contracts.terminate')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('contracts.terminateDescription')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Contract Info */}
                    <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                                {t('contracts.contractCode')}
                            </span>
                            <span className="font-medium">{contract.contractCode}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                                {t('contracts.tenant')}
                            </span>
                            <span className="font-medium">
                                {tenant?.name || tenant?.fullName || 'N/A'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                                {t('contracts.room')}
                            </span>
                            <span className="font-medium">
                                {room?.name || room?.roomCode || 'N/A'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                                {t('contracts.type')}
                            </span>
                            <Badge variant="outline">
                                {contractType === 'LONG_TERM' ? 'Long Term' : 'Short Term'}
                            </Badge>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                                {t('contracts.deposit')}
                            </span>
                            <span className="font-medium text-emerald-600">
                                {formatCurrency(contract.deposit || 0)}
                            </span>
                        </div>
                    </div>

                    {/* End Date */}
                    <div className="space-y-2">
                        <Label htmlFor="endDate">{t('contracts.terminationDate')} *</Label>
                        <Input
                            id="endDate"
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>

                    {/* Options */}
                    <div className="space-y-4">
                        <div className="flex items-center space-x-3 p-3 border rounded-lg">
                            <Checkbox
                                id="createFinalInvoice"
                                checked={createFinalInvoice}
                                onCheckedChange={(checked) => setCreateFinalInvoice(!!checked)}
                            />
                            <div className="flex-1">
                                <Label htmlFor="createFinalInvoice" className="flex items-center gap-2 cursor-pointer">
                                    <FileText className="h-4 w-4 text-blue-500" />
                                    {t('contracts.createFinalInvoice')}
                                </Label>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {t('contracts.createFinalInvoiceDescription')}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center space-x-3 p-3 border rounded-lg">
                            <Checkbox
                                id="closeTenant"
                                checked={closeTenant}
                                onCheckedChange={(checked) => setCloseTenant(!!checked)}
                            />
                            <div className="flex-1">
                                <Label htmlFor="closeTenant" className="flex items-center gap-2 cursor-pointer">
                                    <UserMinus className="h-4 w-4 text-orange-500" />
                                    {t('contracts.closeTenant')}
                                </Label>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {t('contracts.closeTenantDescription')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Warning */}
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                        <div className="text-sm text-red-700">
                            <p className="font-medium">{t('contracts.terminateWarning')}</p>
                            <ul className="list-disc list-inside mt-1 text-xs text-red-600">
                                <li>{t('contracts.terminateWarning1')}</li>
                                <li>{t('contracts.terminateWarning2')}</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        {t('common.cancel')}
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleSubmit}
                        disabled={terminateMutation.isPending}
                    >
                        {terminateMutation.isPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {t('common.loading')}
                            </>
                        ) : (
                            <>
                                <AlertTriangle className="mr-2 h-4 w-4" />
                                {t('contracts.terminate')}
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

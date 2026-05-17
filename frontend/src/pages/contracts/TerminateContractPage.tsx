import apiClient from '@/api/client';
import CreateInvoiceModal from '@/components/CreateInvoiceModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
    AlertTriangle,
    ArrowLeft,
    Building2,
    CalendarX2,
    DoorOpen,
    FileText,
    Loader2,
    User,
    UserMinus,
    Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

export default function TerminateContractPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const queryClient = useQueryClient();

    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [createFinalInvoice, setCreateFinalInvoice] = useState(true);
    const [closeTenant, setCloseTenant] = useState(false);
    const [showFinalInvoiceModal, setShowFinalInvoiceModal] = useState(false);

    const { data: contract, isLoading, isError } = useQuery({
        queryKey: ['contract', id],
        queryFn: async () => {
            const response = await apiClient.get(`/contracts/${id}`);
            return response.data;
        },
        enabled: !!id,
    });

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
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            queryClient.invalidateQueries({ queryKey: ['payments'] });
            navigate('/contracts');
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

        if (createFinalInvoice && contract.contractType === 'LONG_TERM') {
            setShowFinalInvoiceModal(true);
        } else {
            terminateMutation.mutate({
                endDate: new Date(endDate),
                createFinalInvoice: false,
            });
        }
    };

    const handleFinalInvoiceSuccess = () => {
        setShowFinalInvoiceModal(false);
        terminateMutation.mutate({
            endDate: new Date(endDate),
            createFinalInvoice: false,
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (isError || !contract) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/contracts')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <h1 className="text-3xl font-bold tracking-tight">{t('common.notFound')}</h1>
                </div>
            </div>
        );
    }

    const room = contract.roomId;
    const tenant = contract.tenantId;
    const contractType = contract.contractType;
    const isLongTerm = contractType === 'LONG_TERM';

    return (
        <div className="space-y-6">
            {/* Header with actions */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-red-600 flex items-center gap-2">
                            <CalendarX2 className="h-6 w-6" />
                            {t('contracts.terminate')}
                        </h1>
                        <p className="text-muted-foreground text-sm">{t('contracts.terminateDescription')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        onClick={() => navigate(-1)}
                        disabled={terminateMutation.isPending}
                    >
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
                        ) : createFinalInvoice && isLongTerm ? (
                            <>
                                <FileText className="mr-2 h-4 w-4" />
                                {t('contracts.terminateWithInvoice')}
                            </>
                        ) : (
                            <>
                                <AlertTriangle className="mr-2 h-4 w-4" />
                                {t('contracts.terminate')}
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Contract Info */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                {t('contracts.contractInfo')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                                    <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('contracts.contractCode')}</p>
                                        <p className="font-mono font-semibold text-sm">{contract.contractCode}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                                    <User className="h-4 w-4 text-violet-500 shrink-0" />
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('contracts.tenant')}</p>
                                        <p className="font-semibold text-sm">{tenant?.fullName || tenant?.name || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                                    <DoorOpen className="h-4 w-4 text-emerald-500 shrink-0" />
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('contracts.room')}</p>
                                        <p className="font-semibold text-sm">{room?.roomName || room?.roomCode || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                                    <Building2 className="h-4 w-4 text-amber-500 shrink-0" />
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('contracts.type')}</p>
                                        <Badge variant="outline" className="mt-0.5">
                                            {isLongTerm ? t('contracts.roomTypeLongTerm') : t('contracts.roomTypeShortTerm')}
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                                <div className="flex items-center gap-2">
                                    <Wallet className="h-4 w-4 text-emerald-600" />
                                    <span className="text-sm font-medium">{t('contracts.deposit')}</span>
                                </div>
                                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                                    {formatCurrency(contract.depositAmount || contract.deposit || 0)}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Warning */}
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                        <div className="text-sm">
                            <p className="font-semibold text-red-700 dark:text-red-400">{t('contracts.terminateWarning')}</p>
                            <ul className="list-disc list-inside mt-2 text-xs text-red-600 dark:text-red-400 space-y-1">
                                <li>{t('contracts.terminateWarning1')}</li>
                                <li>{t('contracts.terminateWarning2')}</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Right Column - Termination Settings */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">{t('contracts.terminationSettings')}</CardTitle>
                        <CardDescription>{t('contracts.terminationSettingsDesc')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* End Date */}
                        <div className="space-y-2">
                            <Label htmlFor="endDate" className="text-sm font-medium">
                                {t('contracts.terminationDate')} *
                            </Label>
                            <Input
                                id="endDate"
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>

                        <Separator />

                        {/* Options */}
                        <div className="space-y-3">
                            {isLongTerm && (
                                <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <Checkbox
                                        id="createFinalInvoice"
                                        checked={createFinalInvoice}
                                        onCheckedChange={(checked) => setCreateFinalInvoice(!!checked)}
                                        className="mt-0.5"
                                    />
                                    <div className="flex-1">
                                        <Label htmlFor="createFinalInvoice" className="flex items-center gap-2 cursor-pointer font-medium">
                                            <FileText className="h-4 w-4 text-blue-500" />
                                            {t('contracts.createFinalInvoice')}
                                        </Label>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {t('contracts.createFinalInvoiceDescription')}
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <Checkbox
                                    id="closeTenant"
                                    checked={closeTenant}
                                    onCheckedChange={(checked) => setCloseTenant(!!checked)}
                                    className="mt-0.5"
                                />
                                <div className="flex-1">
                                    <Label htmlFor="closeTenant" className="flex items-center gap-2 cursor-pointer font-medium">
                                        <UserMinus className="h-4 w-4 text-orange-500" />
                                        {t('contracts.closeTenant')}
                                    </Label>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {t('contracts.closeTenantDescription')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Final Invoice Modal */}
            {showFinalInvoiceModal && (
                <CreateInvoiceModal
                    open={showFinalInvoiceModal}
                    onOpenChange={(open) => setShowFinalInvoiceModal(open)}
                    contract={contract}
                    room={room}
                    isFinal
                    onSuccess={handleFinalInvoiceSuccess}
                />
            )}
        </div>
    );
}

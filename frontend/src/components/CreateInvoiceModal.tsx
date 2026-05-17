import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    AlertTriangle,
    Calendar,
    Droplets,
    Edit2,
    Loader2,
    Package, Plus,
    Receipt,
    Trash2,
    Wallet,
    Zap
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import apiClient from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { MonthYearPicker } from '@/components/ui/month-year-picker';
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn, formatCurrency } from '@/lib/utils';

// Invoice creation schema
const createInvoiceSchema = z.object({
    billingPeriod: z.date(),
    billingMonths: z.number().min(1).max(12),
    previousElectricIndex: z.number().min(0),
    initialElectricIndex: z.number().min(0),
    previousWaterIndex: z.number().min(0),
    initialWaterIndex: z.number().min(0),
    dueDate: z.date(),
    notes: z.string().optional(),
    adjustments: z.array(z.object({
        description: z.string().min(1),
        amount: z.number().min(0),
        isDiscount: z.boolean()
    })).optional()
}).refine(data => data.initialElectricIndex >= data.previousElectricIndex, {
    message: "Current electric index must be >= previous",
    path: ["initialElectricIndex"]
}).refine(data => data.initialWaterIndex >= data.previousWaterIndex, {
    message: "Current water index must be >= previous",
    path: ["initialWaterIndex"]
});

type CreateInvoiceFormData = z.infer<typeof createInvoiceSchema>;

interface Adjustment {
    description: string;
    amount: number;
    isDiscount: boolean;
}

interface ServiceCharge {
    name: string;
    amount: number;
    quantity: number;
}

interface CreateInvoiceModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    contract: any;
    room?: any;
    onSuccess?: () => void;
    renderAsPage?: boolean;
    isFinal?: boolean;
}

const invoicesApi = {
    create: (data: any) => apiClient.post('/invoices', data).then(res => res.data),
    getByContract: (contractId: string) => apiClient.get(`/invoices/contract/${contractId}`).then(res => res.data),
};

export default function CreateInvoiceModal({ 
    open, 
    onOpenChange, 
    contract, 
    room,
    onSuccess,
    renderAsPage = false,
    isFinal = false 
}: CreateInvoiceModalProps) {
    const { t } = useTranslation();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
    const [newAdjustment, setNewAdjustment] = useState({ description: '', amount: 0, isDiscount: false });
    const [serviceCharges, setServiceCharges] = useState<ServiceCharge[]>([]);
    const [editingServiceIndex, setEditingServiceIndex] = useState<number | null>(null);
    const [proRate, setProRate] = useState(false);
    const [applyDeposit, setApplyDeposit] = useState(false);

    // Fetch existing invoices for this contract to determine min billing period
    const { data: contractInvoices } = useQuery({
        queryKey: ['invoices', 'contract', contract?._id],
        queryFn: () => invoicesApi.getByContract(contract._id),
        enabled: !!contract?._id && open,
    });

    // Compute min/max dates for billing period picker
    const billingPeriodBounds = useMemo(() => {
        const now = new Date();
        const maxDate = new Date(now.getFullYear(), now.getMonth(), 1);
        
        let minDate: Date | null = null;
        if (contractInvoices?.length) {
            // Find the latest billing period among existing invoices
            let latestMonth = 0;
            let latestYear = 0;
            for (const inv of contractInvoices) {
                const m = inv.billingPeriod?.month || 0;
                const y = inv.billingPeriod?.year || 0;
                if (y > latestYear || (y === latestYear && m > latestMonth)) {
                    latestYear = y;
                    latestMonth = m;
                }
            }
            if (latestYear > 0) {
                // Min = month AFTER the last invoiced month (exclusive)
                minDate = new Date(latestYear, latestMonth, 1); // month is 0-indexed, inv.month is 1-indexed, so this is already +1
            }
        }
        return { minDate, maxDate };
    }, [contractInvoices]);

    // Derive billing period from contract.nextPaymentDate or fallback to current month
    const getSuggestedBillingPeriod = () => {
        if (contract?.nextPaymentDate) {
            const npd = new Date(contract.nextPaymentDate);
            return new Date(npd.getFullYear(), npd.getMonth(), 1);
        }
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    };

    const getDefaultDueDate = (billingPeriod: Date) => {
        const dueDay = contract?.paymentDueDay || 15;
        const dueDate = new Date(billingPeriod.getFullYear(), billingPeriod.getMonth() + 1, 1);
        const daysInMonth = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0).getDate();
        dueDate.setDate(Math.min(dueDay, daysInMonth));
        return dueDate;
    };

    const suggestedPeriod = getSuggestedBillingPeriod();

    const form = useForm<CreateInvoiceFormData>({
        resolver: zodResolver(createInvoiceSchema),
        defaultValues: {
            billingPeriod: isFinal ? new Date(new Date().getFullYear(), new Date().getMonth(), 1) : suggestedPeriod,
            billingMonths: isFinal ? 1 : (contract?.paymentCycleMonths || 1),
            previousElectricIndex: room?.currentElectricIndex || contract?.initialElectricIndex || 0,
            initialElectricIndex: 0,
            previousWaterIndex: room?.currentWaterIndex || contract?.initialWaterIndex || 0,
            initialWaterIndex: 0,
            dueDate: getDefaultDueDate(isFinal ? new Date(new Date().getFullYear(), new Date().getMonth(), 1) : suggestedPeriod),
            notes: '',
        }
    });

    // Reset form when contract changes
    useEffect(() => {
        if (contract && open) {
            const roomData = room || contract.roomId;
            const period = isFinal ? new Date(new Date().getFullYear(), new Date().getMonth(), 1) : getSuggestedBillingPeriod();
            form.reset({
                billingPeriod: period,
                billingMonths: isFinal ? 1 : (contract?.paymentCycleMonths || 1),
                previousElectricIndex: roomData?.currentElectricIndex || contract?.initialElectricIndex || 0,
                initialElectricIndex: 0,
                previousWaterIndex: roomData?.currentWaterIndex || contract?.initialWaterIndex || 0,
                initialWaterIndex: 0,
                dueDate: getDefaultDueDate(period),
                notes: '',
            });
            setAdjustments([]);
            setApplyDeposit(false);
            // Initialize service charges from contract
            const contractServices = (contract.serviceCharges || []).map((s: any) => ({
                name: s.name,
                amount: s.amount || 0,
                quantity: s.quantity || 1,
            }));
            setServiceCharges(contractServices);
            setEditingServiceIndex(null);
            setProRate(false);
        }
    }, [contract, room, open]);

    const watchValues = form.watch();

    // Calculate amounts
    const calculations = useMemo(() => {
        const electricUsed = Math.max(0, (watchValues.initialElectricIndex || 0) - (watchValues.previousElectricIndex || 0));
        const waterUsed = Math.max(0, (watchValues.initialWaterIndex || 0) - (watchValues.previousWaterIndex || 0));
        
        const electricAmount = electricUsed * (contract?.electricityPrice || 0);
        const waterAmount = waterUsed * (contract?.waterPrice || 0);
        const billingMonths = watchValues.billingMonths || contract?.paymentCycleMonths || 1;
        const cycleMonths = contract?.paymentCycleMonths || 1;
        const isOffCycle = billingMonths !== cycleMonths;
        const rentAmount = (isOffCycle && proRate)
            ? (contract?.rentPrice || 0) / cycleMonths * billingMonths
            : (contract?.rentPrice || 0);
        
        // Service charges from editable list
        const serviceTotal = serviceCharges.reduce((sum, s) => 
            sum + (s.amount * (s.quantity || 1)), 0);
        
        // Adjustments
        const adjustmentTotal = adjustments.reduce((sum, adj) => 
            adj.isDiscount ? sum - adj.amount : sum + adj.amount, 0);
        
        const totalAmount = rentAmount + electricAmount + waterAmount + serviceTotal + adjustmentTotal;

        return {
            electricUsed,
            waterUsed,
            electricAmount,
            waterAmount,
            rentAmount,
            serviceTotal,
            adjustmentTotal,
            totalAmount
        };
    }, [watchValues, contract, adjustments, serviceCharges]);

    const createMutation = useMutation({
        mutationFn: invoicesApi.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            queryClient.invalidateQueries({ queryKey: ['contracts'] });
            toast({
                title: t('common.success'),
                description: t('invoices.createSuccess'),
            });
            onOpenChange(false);
            onSuccess?.();
        },
        onError: (error: any) => {
            toast({
                title: t('common.error'),
                description: error.response?.data?.message || t('invoices.createError'),
                variant: 'destructive',
            });
        }
    });

    const onSubmit = (data: CreateInvoiceFormData) => {
        const roomData = room || contract.roomId;
        const billingDate = data.billingPeriod;
        const month = billingDate.getMonth() + 1;
        const year = billingDate.getFullYear();
        
        createMutation.mutate({
            contractId: contract._id,
            roomId: roomData?._id || contract.roomId,
            tenantId: contract.tenantId?._id || contract.tenantId,
            month,
            year,
            invoiceType: isFinal ? 'FINAL' : 'REGULAR',
            previousElectricIndex: data.previousElectricIndex,
            initialElectricIndex: data.initialElectricIndex,
            electricityPrice: contract.electricityPrice,
            previousWaterIndex: data.previousWaterIndex,
            initialWaterIndex: data.initialWaterIndex,
            waterPrice: contract.waterPrice,
            billingMonths: data.billingMonths,
            rentAmount: ((data.billingMonths || 1) !== (contract.paymentCycleMonths || 1) && proRate)
                ? (contract.rentPrice || 0) / (contract.paymentCycleMonths || 1) * (data.billingMonths || 1)
                : (contract.rentPrice || 0),
            serviceCharges: serviceCharges,
            adjustments: adjustments,
            dueDate: data.dueDate,
            notes: data.notes,
            ...(isFinal && { applyDeposit }),
        });
    };

    const handleAddAdjustment = () => {
        if (newAdjustment.description && newAdjustment.amount > 0) {
            setAdjustments([...adjustments, { ...newAdjustment }]);
            setNewAdjustment({ description: '', amount: 0, isDiscount: false });
        }
    };

    const handleRemoveAdjustment = (index: number) => {
        setAdjustments(adjustments.filter((_, i) => i !== index));
    };

    // Service management
    const handleAddService = () => {
        setServiceCharges([...serviceCharges, { name: '', amount: 0, quantity: 1 }]);
        setEditingServiceIndex(serviceCharges.length);
    };

    const handleRemoveService = (index: number) => {
        setServiceCharges(serviceCharges.filter((_, i) => i !== index));
        if (editingServiceIndex === index) setEditingServiceIndex(null);
    };

    const handleUpdateService = (index: number, field: keyof ServiceCharge, value: string | number) => {
        const updated = [...serviceCharges];
        updated[index] = { ...updated[index], [field]: value };
        setServiceCharges(updated);
    };

    if (!contract) return null;

    const roomData = room || contract.roomId;
    const tenantData = contract.tenantId;

    const formContent = (
        <Form {...form}>
            <form id="create-invoice-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                
                {/* Contract Info Bar */}
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-sm font-medium">{contract.contractCode}</span>
                            <span className="text-sm text-muted-foreground ml-2">
                                {contract.tenantId?.name || contract.tenantId?.fullName || t('invoices.guest')} {'\u2022'} {room?.name || room?.roomName || contract.roomId?.name || contract.roomId?.roomName || t('invoices.room')}
                            </span>
                        </div>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700">
                            {t('contracts.roomTypeLongTerm')}
                        </Badge>
                    </div>
                </div>

                {/* Two-column grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* LEFT COLUMN: Billing Period, Utilities, Due Date & Notes */}
                    <div className="space-y-4">
                        {/* Billing Period & Due Date */}
                        <div className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-emerald-500" />
                                <h3 className="font-medium text-sm">{isFinal ? t('invoices.finalInvoice') : t('invoices.billingPeriod')}</h3>
                                {!isFinal && contract?.nextPaymentDate && (
                                    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700">
                                        {t('invoices.suggestedPeriod')}
                                    </Badge>
                                )}
                                {isFinal && (
                                    <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700">
                                        {t('invoices.finalBadge')}
                                    </Badge>
                                )}
                            </div>
                            {!isFinal && (
                            <div className="grid grid-cols-3 gap-3">
                                <FormField
                                    control={form.control}
                                    name="billingPeriod"
                                    render={({ field }) => {
                                        const isOverridden = field.value && suggestedPeriod &&
                                            (field.value.getMonth() !== suggestedPeriod.getMonth() ||
                                             field.value.getFullYear() !== suggestedPeriod.getFullYear());
                                        return (
                                            <FormItem>
                                                <FormLabel className="text-xs">{t('invoices.billingPeriod')}</FormLabel>
                                                <FormControl>
                                                    <MonthYearPicker
                                                        value={field.value}
                                                        onChange={(date) => field.onChange(date)}
                                                        minDate={billingPeriodBounds.minDate}
                                                        maxDate={billingPeriodBounds.maxDate}
                                                    />
                                                </FormControl>
                                                {isOverridden && (
                                                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1">
                                                        <AlertTriangle className="h-3 w-3" />
                                                        {t('invoices.billingPeriodOverrideWarning')}
                                                    </p>
                                                )}
                                                <FormMessage />
                                            </FormItem>
                                        );
                                    }}
                                />
                                <FormField
                                    control={form.control}
                                    name="billingMonths"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">{t('invoices.billingMonths')}</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    max={12}
                                                    {...field}
                                                    onChange={e => field.onChange(Math.max(1, Math.min(12, parseInt(e.target.value) || 1)))}
                                                />
                                            </FormControl>
                                            <p className="text-[10px] text-muted-foreground">
                                                {t('invoices.billingMonthsHint', { months: contract?.paymentCycleMonths || 1 })}
                                            </p>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            )}
                            {/* Pro-rate checkbox - only when off-cycle (not for FINAL) */}
                            {!isFinal && (watchValues.billingMonths || contract?.paymentCycleMonths || 1) !== (contract?.paymentCycleMonths || 1) && (
                                <div className="flex items-center gap-2 mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-md border border-amber-200 dark:border-amber-800">
                                    <Checkbox
                                        id="proRate"
                                        checked={proRate}
                                        onCheckedChange={(checked) => setProRate(checked === true)}
                                    />
                                    <label htmlFor="proRate" className="text-xs text-amber-700 dark:text-amber-400 cursor-pointer">
                                        {t('invoices.proRateLabel')}
                                    </label>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-3 mt-3">
                                <FormField
                                    control={form.control}
                                    name="dueDate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs">{t('invoices.dueDate')}</FormLabel>
                                            <FormControl>
                                                <DatePicker
                                                    value={field.value}
                                                    onChange={(date) => field.onChange(date)}
                                                    placeholder={t('invoices.dueDate')}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        {/* Utilities */}
                        <div className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <Zap className="h-4 w-4 text-amber-500" />
                                <h3 className="font-medium text-sm">{t('invoices.utilities')}</h3>
                            </div>
                            
                            {/* Electricity */}
                            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Zap className="h-3 w-3 text-yellow-500" />
                                    <span className="text-xs font-medium">{t('contracts.electricity')}</span>
                                    <span className="text-xs text-muted-foreground ml-auto">{formatCurrency(contract.electricityPrice)}/kWh</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <FormField
                                        control={form.control}
                                        name="previousElectricIndex"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">{t('invoices.previousIndex')}</FormLabel>
                                                <FormControl>
                                                    <Input 
                                                        type="number" 
                                                        min={0}
                                                        className="bg-muted"
                                                        {...field}
                                                        disabled
                                                        readOnly
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="initialElectricIndex"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">{t('invoices.currentIndex')}</FormLabel>
                                                <FormControl>
                                                    <Input 
                                                        type="number" 
                                                        min={0}
                                                        {...field}
                                                        onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <div className="flex flex-col justify-end">
                                        <span className="text-xs text-muted-foreground">{t('invoices.usage')}: {calculations.electricUsed} kWh</span>
                                        <span className="text-sm font-semibold text-amber-600">{formatCurrency(calculations.electricAmount)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Water */}
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 space-y-2">
                                <div className="flex items-center gap-2">
                                    <Droplets className="h-3 w-3 text-blue-500" />
                                    <span className="text-xs font-medium">{t('contracts.water')}</span>
                                    <span className="text-xs text-muted-foreground ml-auto">{formatCurrency(contract.waterPrice)}/m³</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <FormField
                                        control={form.control}
                                        name="previousWaterIndex"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">{t('invoices.previousIndex')}</FormLabel>
                                                <FormControl>
                                                    <Input 
                                                        type="number" 
                                                        min={0}
                                                        className="bg-muted"
                                                        {...field}
                                                        disabled
                                                        readOnly
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="initialWaterIndex"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">{t('invoices.currentIndex')}</FormLabel>
                                                <FormControl>
                                                    <Input 
                                                        type="number" 
                                                        min={0}
                                                        {...field}
                                                        onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <div className="flex flex-col justify-end">
                                        <span className="text-xs text-muted-foreground">{t('invoices.usage')}: {calculations.waterUsed} m³</span>
                                        <span className="text-sm font-semibold text-blue-600">{formatCurrency(calculations.waterAmount)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="border rounded-lg p-4 space-y-3">
                            <FormField
                                control={form.control}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs">{t('common.notes')}</FormLabel>
                                        <FormControl>
                                            <Textarea 
                                                placeholder={t('invoices.notesPlaceholder')}
                                                rows={2}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Services, Adjustments, Summary */}
                    <div className="space-y-4">
                        {/* Services (Editable) */}
                        <div className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Package className="h-4 w-4 text-purple-500" />
                                    <h3 className="font-medium text-sm">{t('invoices.services')}</h3>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={handleAddService}
                                >
                                    <Plus className="h-3 w-3 mr-1" />
                                    {t('common.add')}
                                </Button>
                            </div>

                            {serviceCharges.length === 0 && (
                                <p className="text-xs text-muted-foreground text-center py-2">{t('contracts.noServices')}</p>
                            )}

                            {serviceCharges.map((service, index) => (
                                <div key={index} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2.5 space-y-2">
                                    {editingServiceIndex === index ? (
                                        /* Edit mode */
                                        <div className="space-y-2">
                                            <div className="flex gap-2">
                                                <div className="flex-1">
                                                    <Label className="text-xs">{t('contracts.serviceName')}</Label>
                                                    <Input
                                                        value={service.name}
                                                        onChange={e => handleUpdateService(index, 'name', e.target.value)}
                                                        placeholder={t('contracts.serviceName')}
                                                        className="mt-1"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <div className="w-24">
                                                    <Label className="text-xs">{t('common.quantity')}</Label>
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        value={service.quantity}
                                                        onChange={e => handleUpdateService(index, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                                                        className="mt-1"
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <Label className="text-xs">{t('contracts.serviceAmount')}</Label>
                                                    <Input
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={service.amount ? formatCurrency(service.amount) : ''}
                                                        onChange={e => {
                                                            const raw = e.target.value.replace(/[^0-9]/g, '');
                                                            handleUpdateService(index, 'amount', Number(raw));
                                                        }}
                                                        className="mt-1"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex justify-end">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 text-xs"
                                                    onClick={() => setEditingServiceIndex(null)}
                                                >
                                                    {t('common.done')}
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        /* Display mode */
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <span className="text-sm">{service.name || t('contracts.serviceName')}</span>
                                                {service.quantity > 1 && (
                                                    <span className="text-xs text-muted-foreground">
                                                        {formatCurrency(service.amount)} x {service.quantity}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="font-medium text-sm">{formatCurrency(service.amount * service.quantity)}</span>
                                                <Button 
                                                    type="button" 
                                                    variant="ghost" 
                                                    size="sm"
                                                    className="h-7 w-7 p-0"
                                                    onClick={() => setEditingServiceIndex(index)}
                                                >
                                                    <Edit2 className="h-3 w-3 text-muted-foreground" />
                                                </Button>
                                                <Button 
                                                    type="button" 
                                                    variant="ghost" 
                                                    size="sm"
                                                    className="h-7 w-7 p-0"
                                                    onClick={() => handleRemoveService(index)}
                                                >
                                                    <Trash2 className="h-3 w-3 text-red-500" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {serviceCharges.length > 0 && (
                                <div className="border-t pt-2 flex justify-between font-medium text-sm">
                                    <span>{t('invoices.subtotal')}</span>
                                    <span>{formatCurrency(calculations.serviceTotal)}</span>
                                </div>
                            )}
                        </div>

                        {/* Adjustments */}
                        <div className="border rounded-lg p-4 space-y-2">
                            <h3 className="font-medium text-sm">{t('invoices.adjustments')}</h3>
                            
                            {adjustments.map((adj, index) => (
                                <div key={index} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded p-2">
                                    <div className="flex items-center gap-2">
                                        <Badge variant={adj.isDiscount ? "secondary" : "outline"} className={cn(
                                            "text-[10px] px-1.5 py-0",
                                            adj.isDiscount ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                        )}>
                                            {adj.isDiscount ? t('invoices.discount') : t('invoices.charge')}
                                        </Badge>
                                        <span className="text-xs">{adj.description}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className={cn("font-medium text-xs", adj.isDiscount ? "text-green-600" : "text-red-600")}>
                                            {adj.isDiscount ? "-" : "+"}{formatCurrency(adj.amount)}
                                        </span>
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            size="sm"
                                            className="h-6 w-6 p-0"
                                            onClick={() => handleRemoveAdjustment(index)}
                                        >
                                            <Trash2 className="h-3 w-3 text-red-500" />
                                        </Button>
                                    </div>
                                </div>
                            ))}

                            <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <Label className="text-xs">{t('invoices.description')}</Label>
                                    <Input 
                                        placeholder={t('invoices.adjustmentPlaceholder')}
                                        value={newAdjustment.description}
                                        onChange={e => setNewAdjustment({...newAdjustment, description: e.target.value})}
                                    />
                                </div>
                                <div className="w-28">
                                    <Label className="text-xs">{t('invoices.amount')}</Label>
                                    <Input 
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="0"
                                        value={newAdjustment.amount ? formatCurrency(newAdjustment.amount) : ''}
                                        onChange={e => {
                                            const raw = e.target.value.replace(/[^0-9]/g, '');
                                            setNewAdjustment({...newAdjustment, amount: Number(raw)});
                                        }}
                                    />
                                </div>
                                <div className="flex gap-1">
                                    <Button 
                                        type="button" 
                                        variant={newAdjustment.isDiscount ? "default" : "outline"} 
                                        size="sm"
                                        className={cn("h-10 w-10 p-0", newAdjustment.isDiscount && "bg-green-600 hover:bg-green-700")}
                                        onClick={() => setNewAdjustment({...newAdjustment, isDiscount: true})}
                                    >
                                        -
                                    </Button>
                                    <Button 
                                        type="button" 
                                        variant={!newAdjustment.isDiscount ? "default" : "outline"} 
                                        size="sm"
                                        className={cn("h-10 w-10 p-0", !newAdjustment.isDiscount && "bg-red-600 hover:bg-red-700")}
                                        onClick={() => setNewAdjustment({...newAdjustment, isDiscount: false})}
                                    >
                                        +
                                    </Button>
                                </div>
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    size="sm"
                                    className="h-10 w-10 p-0"
                                    onClick={handleAddAdjustment}
                                    disabled={!newAdjustment.description || newAdjustment.amount <= 0}
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 space-y-1">
                            <h3 className="font-semibold text-emerald-800 dark:text-emerald-300 text-sm">{t('invoices.invoiceSummary')}</h3>
                            <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                    <span>
                                        {t('contracts.rentPrice')}
                                        {(watchValues.billingMonths || 1) !== (contract?.paymentCycleMonths || 1) && proRate && (
                                            <span className="text-muted-foreground text-xs ml-1">
                                                ({formatCurrency((contract?.rentPrice || 0) / (contract?.paymentCycleMonths || 1))}/{t('common.month')} × {watchValues.billingMonths})
                                            </span>
                                        )}
                                    </span>
                                    <span>{formatCurrency(calculations.rentAmount)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>{t('contracts.electricity')}</span>
                                    <span>{formatCurrency(calculations.electricAmount)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>{t('contracts.water')}</span>
                                    <span>{formatCurrency(calculations.waterAmount)}</span>
                                </div>
                                {calculations.serviceTotal > 0 && (
                                    <div className="flex justify-between">
                                        <span>{t('invoices.services')}</span>
                                        <span>{formatCurrency(calculations.serviceTotal)}</span>
                                    </div>
                                )}
                                {calculations.adjustmentTotal !== 0 && (
                                    <div className="flex justify-between">
                                        <span>{t('invoices.adjustments')}</span>
                                        <span className={calculations.adjustmentTotal < 0 ? "text-green-600" : "text-red-600"}>
                                            {calculations.adjustmentTotal < 0 ? '' : '+'}{formatCurrency(calculations.adjustmentTotal)}
                                        </span>
                                    </div>
                                )}
                                <div className="border-t border-emerald-200 dark:border-emerald-800 pt-2 flex justify-between font-bold text-lg text-emerald-800 dark:text-emerald-300">
                                    <span>{t('invoices.total')}</span>
                                    <span>{formatCurrency(calculations.totalAmount)}</span>
                                </div>
                                {/* Deposit deduction - FINAL mode only */}
                                {isFinal && contract?.depositAmount > 0 && (
                                    <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                id="applyDeposit"
                                                checked={applyDeposit}
                                                onCheckedChange={(checked) => setApplyDeposit(checked === true)}
                                            />
                                            <label htmlFor="applyDeposit" className="text-sm font-medium text-blue-700 dark:text-blue-400 cursor-pointer flex items-center gap-1.5">
                                                <Wallet className="h-3.5 w-3.5" />
                                                {t('invoices.applyDeposit')}
                                            </label>
                                        </div>
                                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 ml-6">
                                            {t('invoices.depositAmount')}: {formatCurrency(contract.depositAmount)}
                                        </p>
                                        {applyDeposit && contract.depositAmount >= calculations.totalAmount && (
                                            <p className="text-xs text-green-600 dark:text-green-400 mt-1 ml-6 font-medium">
                                                {t('invoices.depositCoversAll', { refund: formatCurrency(contract.depositAmount - calculations.totalAmount) })}
                                            </p>
                                        )}
                                        {applyDeposit && contract.depositAmount < calculations.totalAmount && (
                                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 ml-6">
                                                {t('invoices.depositPartial', { remaining: formatCurrency(calculations.totalAmount - contract.depositAmount) })}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

            </form>
        </Form>
    );

    if (renderAsPage) {
        return (
            <div className="space-y-6">
                <div className="bg-card border rounded-lg p-6 space-y-6">
                    {formContent}
                </div>
            </div>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Receipt className="h-5 w-5 text-emerald-600" />
                        {isFinal ? t('invoices.createFinalTitle') : t('invoices.createTitle')}
                    </DialogTitle>
                    <DialogDescription>
                        {roomData?.roomName || roomData?.roomCode} - {tenantData?.fullName}
                    </DialogDescription>
                </DialogHeader>

                <DialogBody className="space-y-6">
                    {formContent}
                </DialogBody>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={createMutation.isPending}
                    >
                        {t('common.cancel')}
                    </Button>
                    <Button
                        type="submit"
                        form="create-invoice-form"
                        disabled={createMutation.isPending}
                    >
                        {createMutation.isPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {t('common.loading')}
                            </>
                        ) : (
                            <>
                                <Receipt className="mr-2 h-4 w-4" />
                                {t('invoices.create')}
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

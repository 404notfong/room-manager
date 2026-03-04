import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addHours, differenceInDays, differenceInHours, isSameDay, startOfDay } from 'date-fns';
import {
    Clock,
    Loader2,
    Package,
    Plus,
    Receipt,
    Trash2
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import apiClient from '@/api/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import {
    Dialog,
    DialogBody,
    DialogContent,
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

// Short-term invoice creation schema
function createShortTermInvoiceSchema(t: (key: string) => string) {
    return z.object({
        checkInTime: z.date({ required_error: t('invoices.checkInRequired') }),
        checkOutTime: z.date({ required_error: t('invoices.checkOutRequired') }),
        dueDate: z.date(),
        notes: z.string().optional(),
        adjustments: z.array(z.object({
            description: z.string().min(1),
            amount: z.number().min(0),
            isDiscount: z.boolean()
        })).optional()
    }).refine(data => {
        return data.checkOutTime > data.checkInTime;
    }, {
        message: t('invoices.checkOutAfterCheckIn'),
        path: ["checkOutTime"]
    });
}

type CreateShortTermInvoiceFormData = z.infer<ReturnType<typeof createShortTermInvoiceSchema>>;

interface Adjustment {
    description: string;
    amount: number;
    isDiscount: boolean;
}

interface ShortTermPriceTier {
    fromValue: number;
    toValue: number;
    price: number;
}

interface CreateShortTermInvoiceModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    contract: any;
    room?: any;
    onSuccess?: () => void;
}

const invoicesApi = {
    create: (data: any) => apiClient.post('/invoices', data).then(res => res.data),
};

/**
 * Calculate short-term rental amount based on pricing type
 */
function calculateShortTermAmount(
    contract: any,
    totalHours: number,
    totalDays: number,
    t: (key: string) => string
): { amount: number; calculation: string } {
    const pricingType = contract?.shortTermPricingType;
    
    if (pricingType === 'FIXED') {
        return {
            amount: contract.fixedPrice || 0,
            calculation: t('invoices.fixedPrice')
        };
    }

    if (pricingType === 'HOURLY') {
        if (contract.hourlyPricingMode === 'PER_HOUR') {
            const amount = totalHours * (contract.pricePerHour || 0);
            return {
                amount,
                calculation: `${totalHours} ${t('invoices.hoursUnit')} × ${formatCurrency(contract.pricePerHour)}`
            };
        }
        
        // Price table mode
        return calculateFromPriceTable(
            contract.shortTermPrices || [],
            totalHours,
            contract.priceTableType || 'PROGRESSIVE',
            t('invoices.hoursUnit'),
            t
        );
    }

    if (pricingType === 'DAILY') {
        return calculateFromPriceTable(
            contract.shortTermPrices || [],
            totalDays,
            contract.priceTableType || 'PROGRESSIVE',
            t('invoices.daysUnit'),
            t
        );
    }

    return { amount: 0, calculation: t('invoices.unknownPricing') };
}

function calculateFromPriceTable(
    priceTiers: ShortTermPriceTier[],
    quantity: number,
    tableType: string,
    unit: string,
    t: (key: string) => string
): { amount: number; calculation: string } {
    if (!priceTiers || priceTiers.length === 0) {
        return { amount: 0, calculation: t('invoices.noPriceTiers') };
    }

    const sortedTiers = [...priceTiers].sort((a, b) => a.fromValue - b.fromValue);

    if (tableType === 'FLAT') {
        // toValue === -1 means unlimited (matches any quantity >= fromValue)
        const matchingTier = sortedTiers.find(tier => 
            quantity >= tier.fromValue && (tier.toValue === -1 || quantity <= tier.toValue)
        );
        if (matchingTier) {
            const amount = quantity * matchingTier.price;
            const tierLabel = matchingTier.toValue === -1 
                ? `${matchingTier.fromValue}+`
                : `${matchingTier.fromValue}-${matchingTier.toValue}`;
            return {
                amount,
                calculation: `${quantity} ${unit} × ${formatCurrency(matchingTier.price)} (${t('invoices.tier')} ${tierLabel})`
            };
        }
        const lastTier = sortedTiers[sortedTiers.length - 1];
        const amount = quantity * lastTier.price;
        return {
            amount,
            calculation: `${quantity} ${unit} × ${formatCurrency(lastTier.price)} (${t('invoices.lastTier')})`
        };
    }

    // Progressive
    let remainingQty = quantity;
    let totalAmount = 0;
    const calculations: string[] = [];

    for (const tier of sortedTiers) {
        if (remainingQty <= 0) break;
        
        // toValue === -1 means unlimited — this tier absorbs all remaining quantity
        const tierRange = tier.toValue === -1 ? remainingQty : (tier.toValue - tier.fromValue + 1);
        const qtyInTier = Math.min(remainingQty, tierRange);
        const tierAmount = qtyInTier * tier.price;
        
        totalAmount += tierAmount;
        calculations.push(`${qtyInTier} × ${formatCurrency(tier.price)}`);
        remainingQty -= qtyInTier;
    }

    if (remainingQty > 0 && sortedTiers.length > 0) {
        const lastTier = sortedTiers[sortedTiers.length - 1];
        const extraAmount = remainingQty * lastTier.price;
        totalAmount += extraAmount;
        calculations.push(`${remainingQty} × ${formatCurrency(lastTier.price)}`);
    }

    return {
        amount: totalAmount,
        calculation: `${t('invoices.progressive')}: ${calculations.join(' + ')}`
    };
}

export default function CreateShortTermInvoiceModal({ 
    open, 
    onOpenChange, 
    contract, 
    room,
    onSuccess 
}: CreateShortTermInvoiceModalProps) {
    const { t } = useTranslation();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
    const [newAdjustment, setNewAdjustment] = useState({ description: '', amount: 0, isDiscount: false });
    const [autoCalculate, setAutoCalculate] = useState(true);
    const [manualHours, setManualHours] = useState<number>(0);
    const [manualDays, setManualDays] = useState<number>(0);

    // Round minutes down to nearest 5-minute step for DateTimePicker compatibility
    const roundToStep5 = (date: Date): Date => {
        const d = new Date(date);
        d.setMinutes(Math.floor(d.getMinutes() / 5) * 5, 0, 0);
        return d;
    };

    const now = roundToStep5(new Date());
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    // Default check-in time from contract startDate
    const defaultCheckIn = contract?.startDate 
        ? roundToStep5(new Date(contract.startDate))
        : now;

    const schema = useMemo(() => createShortTermInvoiceSchema(t), [t]);
    const form = useForm<CreateShortTermInvoiceFormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            checkInTime: defaultCheckIn,
            checkOutTime: now,
            dueDate: now,
            notes: '',
            adjustments: []
        },
    });

    const watchValues = form.watch();

    // Auto-reset form when modal opens with new contract
    useEffect(() => {
        if (open && contract) {
            const contractStart = contract.startDate 
                ? roundToStep5(new Date(contract.startDate))
                : roundToStep5(new Date());
            
            form.reset({
                checkInTime: contractStart,
                checkOutTime: roundToStep5(new Date()),
                dueDate: new Date(),
                notes: '',
                adjustments: []
            });
            setAdjustments([]);
            setAutoCalculate(true);
            setManualHours(0);
            setManualDays(0);
        }
    }, [open, contract?._id]);

    // Auto-correct: if checkOut <= checkIn, bump checkOut to checkIn + 1 hour
    const checkInValue = form.watch('checkInTime');
    const checkOutValue = form.watch('checkOutTime');
    useEffect(() => {
        if (checkInValue && checkOutValue && checkOutValue <= checkInValue) {
            form.setValue('checkOutTime', roundToStep5(addHours(checkInValue, 1)));
        }
    }, [checkInValue, checkOutValue]);

    // Auto-calculated duration from check-in/check-out
    const autoDuration = useMemo(() => {
        const checkIn = watchValues.checkInTime || null;
        const checkOut = watchValues.checkOutTime || null;
        let totalHours = 0;
        let totalDays = 0;
        if (checkIn && checkOut && checkOut > checkIn) {
            totalHours = Math.ceil(differenceInHours(checkOut, checkIn));
            totalDays = Math.ceil(differenceInDays(checkOut, checkIn)) || 1;
        }
        return { totalHours, totalDays };
    }, [watchValues.checkInTime, watchValues.checkOutTime]);

    // Sync manual values when switching to manual mode or when auto values change
    useEffect(() => {
        if (autoCalculate) {
            setManualHours(autoDuration.totalHours);
            setManualDays(autoDuration.totalDays);
        }
    }, [autoCalculate, autoDuration.totalHours, autoDuration.totalDays]);

    // Calculate duration and amount
    const calculations = useMemo(() => {
        if (!contract) return { totalHours: 0, totalDays: 0, rentAmount: 0, calculation: '', serviceTotal: 0, adjustmentTotal: 0, total: 0 };

        const totalHours = autoCalculate ? autoDuration.totalHours : manualHours;
        const totalDays = autoCalculate ? autoDuration.totalDays : manualDays;

        const result = calculateShortTermAmount(contract, totalHours, totalDays, t);
        
        // Service charges
        const serviceTotal = (contract.serviceCharges || [])
            .filter((s: any) => s.isRecurring !== false)
            .reduce((sum: number, s: any) => sum + (s.amount * (s.quantity || 1)), 0);

        // Adjustments
        const adjustmentTotal = adjustments.reduce((sum, adj) => {
            return adj.isDiscount ? sum - adj.amount : sum + adj.amount;
        }, 0);

        return {
            totalHours,
            totalDays,
            rentAmount: result.amount,
            calculation: result.calculation,
            serviceTotal,
            adjustmentTotal,
            total: result.amount + serviceTotal + adjustmentTotal
        };
    }, [contract, autoDuration, autoCalculate, manualHours, manualDays, adjustments]);

    // Create mutation
    const createMutation = useMutation({
        mutationFn: invoicesApi.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            queryClient.invalidateQueries({ queryKey: ['contracts'] });
            toast({
                title: t('invoices.createSuccess'),
                description: t('invoices.createdForDuration', { hours: calculations.totalHours, days: calculations.totalDays }),
            });
            onOpenChange(false);
            onSuccess?.();
        },
        onError: (error: any) => {
            toast({
                title: t('invoices.createError'),
                description: error.response?.data?.message || error.message,
                variant: 'destructive',
            });
        },
    });

    const onSubmit = (data: CreateShortTermInvoiceFormData) => {
        if (!contract) return;

        const payload = {
            contractId: contract._id,
            roomId: room?._id || contract.roomId?._id || contract.roomId,
            tenantId: contract.tenantId?._id || contract.tenantId,
            month: currentMonth,
            year: currentYear,
            checkInTime: data.checkInTime,
            checkOutTime: data.checkOutTime,
            totalHours: calculations.totalHours,
            totalDays: calculations.totalDays,
            rentAmount: calculations.rentAmount,
            serviceCharges: contract.serviceCharges?.filter((s: any) => s.isRecurring !== false) || [],
            adjustments: adjustments,
            dueDate: data.dueDate,
            notes: data.notes || '',
        };

        createMutation.mutate(payload);
    };

    // Add adjustment handler
    const handleAddAdjustment = () => {
        if (newAdjustment.description && newAdjustment.amount > 0) {
            setAdjustments([...adjustments, { ...newAdjustment }]);
            setNewAdjustment({ description: '', amount: 0, isDiscount: false });
        }
    };

    const handleRemoveAdjustment = (index: number) => {
        setAdjustments(adjustments.filter((_, i) => i !== index));
    };

    const getPricingTypeLabel = () => {
        switch (contract?.shortTermPricingType) {
            case 'HOURLY': return t('invoices.pricingHourly');
            case 'DAILY': return t('invoices.pricingDaily');
            case 'FIXED': return t('invoices.pricingFixed');
            default: return contract?.shortTermPricingType;
        }
    };

    if (!contract) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Receipt className="h-5 w-5 text-emerald-600" />
                        {t('invoices.shortTermTitle')}
                    </DialogTitle>
                </DialogHeader>

                <DialogBody>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        {/* Contract Info - full width */}
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 mb-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="text-sm font-medium">{contract.contractCode}</span>
                                    <span className="text-sm text-muted-foreground ml-2">
                                        {contract.tenantId?.name || contract.tenantId?.fullName || t('invoices.guest')} • {room?.name || room?.roomName || contract.roomId?.name || contract.roomId?.roomName || t('invoices.room')}
                                    </span>
                                </div>
                                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700">
                                    {getPricingTypeLabel()}
                                </Badge>
                            </div>
                        </div>

                        {/* Two-column grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* LEFT COLUMN: Time & Duration */}
                            <div className="space-y-4">
                                {/* Check-in / Check-out */}
                                <div className="border rounded-lg p-4 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-blue-500" />
                                        <h3 className="font-medium text-sm">{t('invoices.stayDuration')}</h3>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <FormField
                                            control={form.control}
                                            name="checkInTime"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs">{t('invoices.checkIn')}</FormLabel>
                                                    <FormControl>
                                                        <DateTimePicker
                                                            value={field.value}
                                                            onChange={(date) => field.onChange(date)}
                                                            placeholder={t('invoices.checkIn')}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="checkOutTime"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs">{t('invoices.checkOut')}</FormLabel>
                                                    <FormControl>
                                                        <DateTimePicker
                                                            value={field.value}
                                                            onChange={(date) => {
                                                                if (date && checkInValue && date <= checkInValue) return;
                                                                field.onChange(date);
                                                            }}
                                                            placeholder={t('invoices.checkOut')}
                                                            disabledDate={(date) => {
                                                                if (!checkInValue) return false;
                                                                if (date < startOfDay(checkInValue)) return true;
                                                                if (isSameDay(date, checkInValue)) {
                                                                    const outH = checkOutValue?.getHours() ?? 0;
                                                                    const outM = checkOutValue?.getMinutes() ?? 0;
                                                                    const inH = checkInValue.getHours();
                                                                    const inM = checkInValue.getMinutes();
                                                                    if (outH < inH || (outH === inH && outM <= inM)) return true;
                                                                }
                                                                return false;
                                                            }}
                                                            minDateTime={checkInValue}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    {/* Duration Display */}
                                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Checkbox
                                                    id="autoCalculate"
                                                    checked={autoCalculate}
                                                    onCheckedChange={(checked) => setAutoCalculate(!!checked)}
                                                />
                                                <Label htmlFor="autoCalculate" className="text-xs cursor-pointer">
                                                    {t('invoices.autoCalculate')}
                                                </Label>
                                            </div>
                                            {autoCalculate && (
                                                <span className="font-medium text-sm">
                                                    {contract?.shortTermPricingType === 'DAILY' 
                                                        ? `${calculations.totalDays} ${t('invoices.days')}`
                                                        : contract?.shortTermPricingType === 'HOURLY'
                                                            ? `${calculations.totalHours} ${t('invoices.hours')}`
                                                            : `${calculations.totalHours} ${t('invoices.hours')} / ${calculations.totalDays} ${t('invoices.days')}`
                                                    }
                                                </span>
                                            )}
                                        </div>

                                        {!autoCalculate && (
                                            <div className="flex gap-3">
                                                {(contract?.shortTermPricingType === 'HOURLY' || contract?.shortTermPricingType === 'FIXED') && (
                                                    <div className="flex-1">
                                                        <Label className="text-xs">{t('invoices.hours')}</Label>
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            value={manualHours}
                                                            onChange={(e) => setManualHours(Math.max(0, Number(e.target.value)))}
                                                            className="mt-1 h-8"
                                                        />
                                                    </div>
                                                )}
                                                {(contract?.shortTermPricingType === 'DAILY' || contract?.shortTermPricingType === 'FIXED') && (
                                                    <div className="flex-1">
                                                        <Label className="text-xs">{t('invoices.days')}</Label>
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            value={manualDays}
                                                            onChange={(e) => setManualDays(Math.max(0, Number(e.target.value)))}
                                                            className="mt-1 h-8"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>{t('invoices.calculation')}:</span>
                                            <span>{calculations.calculation}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Due Date & Notes */}
                                <div className="border rounded-lg p-4 space-y-3">
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
                                    <FormField
                                        control={form.control}
                                        name="notes"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">{t('invoices.notes')}</FormLabel>
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
                                {/* Services */}
                                {contract.serviceCharges?.length > 0 && (
                                    <div className="border rounded-lg p-4 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Package className="h-4 w-4 text-purple-500" />
                                            <h3 className="font-medium text-sm">{t('invoices.services')}</h3>
                                        </div>
                                        {contract.serviceCharges
                                            .filter((s: any) => s.isRecurring !== false)
                                            .map((service: any, index: number) => (
                                            <div key={index} className="flex justify-between text-sm">
                                                <div className="flex flex-col">
                                                    <span className="text-xs">{service.name} {service.quantity > 1 && `x${service.quantity}`}</span>
                                                    {service.quantity > 1 && (
                                                        <span className="text-xs text-muted-foreground">
                                                            {formatCurrency(service.amount)}/{t('invoices.eachPrice')}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="font-medium text-sm">{formatCurrency(service.amount * (service.quantity || 1))}</span>
                                            </div>
                                        ))}
                                        <div className="border-t pt-2 flex justify-between font-medium text-sm">
                                            <span>{t('invoices.subtotal')}</span>
                                            <span>{formatCurrency(calculations.serviceTotal)}</span>
                                        </div>
                                    </div>
                                )}

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
                                                onChange={(e) => setNewAdjustment({ ...newAdjustment, description: e.target.value })}
                                                className="h-8 text-xs"
                                            />
                                        </div>
                                        <div className="w-24">
                                            <Label className="text-xs">{t('invoices.amount')}</Label>
                                            <Input
                                                type="number"
                                                placeholder="0"
                                                value={newAdjustment.amount || ''}
                                                onChange={(e) => setNewAdjustment({ ...newAdjustment, amount: Number(e.target.value) })}
                                                className="h-8 text-xs"
                                            />
                                        </div>
                                        <div className="flex gap-1">
                                            <Button
                                                type="button"
                                                variant={newAdjustment.isDiscount ? "default" : "outline"}
                                                size="sm"
                                                className={cn("h-8 w-8 p-0", newAdjustment.isDiscount && "bg-green-600 hover:bg-green-700")}
                                                onClick={() => setNewAdjustment({ ...newAdjustment, isDiscount: true })}
                                            >
                                                -
                                            </Button>
                                            <Button
                                                type="button"
                                                variant={!newAdjustment.isDiscount ? "default" : "outline"}
                                                size="sm"
                                                className={cn("h-8 w-8 p-0", !newAdjustment.isDiscount && "bg-red-600 hover:bg-red-700")}
                                                onClick={() => setNewAdjustment({ ...newAdjustment, isDiscount: false })}
                                            >
                                                +
                                            </Button>
                                        </div>
                                        <Button 
                                            type="button" 
                                            variant="outline" 
                                            size="sm"
                                            className="h-8 w-8 p-0"
                                            onClick={handleAddAdjustment}
                                            disabled={!newAdjustment.description || newAdjustment.amount <= 0}
                                        >
                                            <Plus className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Summary */}
                                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 space-y-1">
                                    <h3 className="font-semibold text-emerald-800 dark:text-emerald-300 text-sm">{t('invoices.invoiceSummary')}</h3>
                                    <div className="space-y-1 text-sm">
                                        <div className="flex justify-between">
                                            <span>{t('invoices.rental')} ({contract?.shortTermPricingType === 'DAILY'
                                                ? `${calculations.totalDays} ${t('invoices.days')}`
                                                : contract?.shortTermPricingType === 'HOURLY'
                                                    ? `${calculations.totalHours} ${t('invoices.hours')}`
                                                    : `${calculations.totalHours}${t('invoices.hours').charAt(0)} / ${calculations.totalDays}${t('invoices.days').charAt(0)}`
                                            })</span>
                                            <span>{formatCurrency(calculations.rentAmount)}</span>
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
                                                    {calculations.adjustmentTotal < 0 ? "" : "+"}{formatCurrency(calculations.adjustmentTotal)}
                                                </span>
                                            </div>
                                        )}
                                        <div className="border-t border-emerald-200 dark:border-emerald-800 pt-2 flex justify-between font-bold text-lg text-emerald-800 dark:text-emerald-300">
                                            <span>{t('invoices.total')}</span>
                                            <span>{formatCurrency(calculations.total)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="mt-4">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                {t('common.cancel')}
                            </Button>
                            <Button 
                                type="submit"
                                disabled={createMutation.isPending || calculations.total <= 0}
                                className="bg-emerald-600 hover:bg-emerald-700"
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
                    </form>
                </Form>
                </DialogBody>
            </DialogContent>
        </Dialog>
    );
}

                        <div className="border rounded-lg p-4 space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Clock className="h-4 w-4 text-blue-500" />
                                <h3 className="font-medium">{t('invoices.stayDuration')}</h3>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="checkInTime"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('invoices.checkIn')}</FormLabel>
                                            <FormControl>
                                                <DateTimePicker
                                                    value={field.value}
                                                    onChange={(date) => field.onChange(date)}
                                                    placeholder={t('invoices.checkIn')}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="checkOutTime"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t('invoices.checkOut')}</FormLabel>
                                            <FormControl>
                                                <DateTimePicker
                                                    value={field.value}
                                                    onChange={(date) => {
                                                        // Only accept if after check-in
                                                        if (date && checkInValue && date <= checkInValue) return;
                                                        field.onChange(date);
                                                    }}
                                                    placeholder={t('invoices.checkOut')}
                                                    disabledDate={(date) => {
                                                        if (!checkInValue) return false;
                                                        if (date < startOfDay(checkInValue)) return true;
                                                        // Disable check-in date if checkout time would be <= check-in time
                                                        if (isSameDay(date, checkInValue)) {
                                                            const outH = checkOutValue?.getHours() ?? 0;
                                                            const outM = checkOutValue?.getMinutes() ?? 0;
                                                            const inH = checkInValue.getHours();
                                                            const inM = checkInValue.getMinutes();
                                                            if (outH < inH || (outH === inH && outM <= inM)) return true;
                                                        }
                                                        return false;
                                                    }}
                                                    minDateTime={checkInValue}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* Duration Display */}
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 mt-3 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id="autoCalculate"
                                            checked={autoCalculate}
                                            onCheckedChange={(checked) => setAutoCalculate(!!checked)}
                                        />
                                        <Label htmlFor="autoCalculate" className="text-sm cursor-pointer">
                                            {t('invoices.autoCalculate') || 'Tự động tính thời gian'}
                                        </Label>
                                    </div>
                                    {autoCalculate && (
                                        <span className="font-medium text-sm">
                                            {contract?.shortTermPricingType === 'DAILY' 
                                                ? `${calculations.totalDays} ${t('invoices.days')}`
                                                : contract?.shortTermPricingType === 'HOURLY'
                                                    ? `${calculations.totalHours} ${t('invoices.hours')}`
                                                    : `${calculations.totalHours} ${t('invoices.hours')} / ${calculations.totalDays} ${t('invoices.days')}`
                                            }
                                        </span>
                                    )}
                                </div>

                                {!autoCalculate && (
                                    <div className="flex gap-4">
                                        {(contract?.shortTermPricingType === 'HOURLY' || contract?.shortTermPricingType === 'FIXED') && (
                                            <div className="flex-1">
                                                <Label className="text-xs">{t('invoices.hours') || 'Giờ'}</Label>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    value={manualHours}
                                                    onChange={(e) => setManualHours(Math.max(0, Number(e.target.value)))}
                                                    className="mt-1"
                                                />
                                            </div>
                                        )}
                                        {(contract?.shortTermPricingType === 'DAILY' || contract?.shortTermPricingType === 'FIXED') && (
                                            <div className="flex-1">
                                                <Label className="text-xs">{t('invoices.days') || 'Ngày'}</Label>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    value={manualDays}
                                                    onChange={(e) => setManualDays(Math.max(0, Number(e.target.value)))}
                                                    className="mt-1"
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex justify-between text-sm">
                                    <span>{t('invoices.calculation')}:</span>
                                    <span className="text-muted-foreground text-xs">
                                        {calculations.calculation}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Services (if any) */}
                        {contract.serviceCharges?.length > 0 && (
                            <div className="border rounded-lg p-4 space-y-3">
                                <div className="flex items-center gap-2">
                                    <Package className="h-4 w-4 text-purple-500" />
                                    <h3 className="font-medium">{t('invoices.services')}</h3>
                                </div>
                                {contract.serviceCharges
                                    .filter((s: any) => s.isRecurring !== false)
                                    .map((service: any, index: number) => (
                                    <div key={index} className="flex justify-between text-sm">
                                        <div className="flex flex-col">
                                            <span>{service.name} {service.quantity > 1 && `x${service.quantity}`}</span>
                                            {service.quantity > 1 && (
                                                <span className="text-xs text-muted-foreground">
                                                    {formatCurrency(service.amount)}/{t('invoices.eachPrice')}
                                                </span>
                                            )}
                                        </div>
                                        <span className="font-medium">{formatCurrency(service.amount * (service.quantity || 1))}</span>
                                    </div>
                                ))}
                                <div className="border-t pt-2 flex justify-between font-medium">
                                    <span>{t('invoices.subtotal')}</span>
                                    <span>{formatCurrency(calculations.serviceTotal)}</span>
                                </div>
                            </div>
                        )}

                        {/* Adjustments */}
                        <div className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="font-medium">{t('invoices.adjustments')}</h3>
                            </div>
                            
                            {/* Existing adjustments */}
                            {adjustments.map((adj, index) => (
                                <div key={index} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded p-2">
                                    <div className="flex items-center gap-2">
                                        <Badge variant={adj.isDiscount ? "secondary" : "outline"} className={cn(
                                            adj.isDiscount ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                        )}>
                                            {adj.isDiscount ? t('invoices.discount') : t('invoices.charge')}
                                        </Badge>
                                        <span className="text-sm">{adj.description}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={cn("font-medium", adj.isDiscount ? "text-green-600" : "text-red-600")}>
                                            {adj.isDiscount ? "-" : "+"}{formatCurrency(adj.amount)}
                                        </span>
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            size="sm"
                                            onClick={() => handleRemoveAdjustment(index)}
                                        >
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </div>
                                </div>
                            ))}

                            {/* Add new adjustment */}
                            <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <Label className="text-xs">{t('invoices.description')}</Label>
                                    <Input
                                        placeholder={t('invoices.adjustmentPlaceholder')}
                                        value={newAdjustment.description}
                                        onChange={(e) => setNewAdjustment({ ...newAdjustment, description: e.target.value })}
                                    />
                                </div>
                                <div className="w-32">
                                    <Label className="text-xs">{t('invoices.amount')}</Label>
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        value={newAdjustment.amount || ''}
                                        onChange={(e) => setNewAdjustment({ ...newAdjustment, amount: Number(e.target.value) })}
                                    />
                                </div>
                                <div className="flex gap-1">
                                    <Button
                                        type="button"
                                        variant={newAdjustment.isDiscount ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setNewAdjustment({ ...newAdjustment, isDiscount: true })}
                                        className={cn(newAdjustment.isDiscount && "bg-green-600 hover:bg-green-700")}
                                    >
                                        -
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={!newAdjustment.isDiscount ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setNewAdjustment({ ...newAdjustment, isDiscount: false })}
                                        className={cn(!newAdjustment.isDiscount && "bg-red-600 hover:bg-red-700")}
                                    >
                                        +
                                    </Button>
                                </div>
                                <Button 
                                    type="button" 
                                    variant="outline" 
                                    size="sm"
                                    onClick={handleAddAdjustment}
                                    disabled={!newAdjustment.description || newAdjustment.amount <= 0}
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Due Date */}
                        <FormField
                            control={form.control}
                            name="dueDate"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('invoices.dueDate')}</FormLabel>
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

                        {/* Notes */}
                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('invoices.notes')}</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder={t('invoices.notesPlaceholder')}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Summary */}
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 space-y-2">
                            <h3 className="font-semibold text-emerald-800 dark:text-emerald-300">{t('invoices.invoiceSummary')}</h3>
                            <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                    <span>{t('invoices.rental')} ({contract?.shortTermPricingType === 'DAILY'
                                        ? `${calculations.totalDays} ${t('invoices.days')}`
                                        : contract?.shortTermPricingType === 'HOURLY'
                                            ? `${calculations.totalHours} ${t('invoices.hours')}`
                                            : `${calculations.totalHours}${t('invoices.hours').charAt(0)} / ${calculations.totalDays}${t('invoices.days').charAt(0)}`
                                    })</span>
                                    <span>{formatCurrency(calculations.rentAmount)}</span>
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
                                            {calculations.adjustmentTotal < 0 ? "" : "+"}{formatCurrency(calculations.adjustmentTotal)}
                                        </span>
                                    </div>
                                )}
                                <div className="border-t border-emerald-200 dark:border-emerald-800 pt-2 flex justify-between font-bold text-lg text-emerald-800 dark:text-emerald-300">
                                    <span>{t('invoices.total')}</span>
                                    <span>{formatCurrency(calculations.total)}</span>
                                </div>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                {t('common.cancel')}
                            </Button>
                            <Button 
                                type="submit"
                                disabled={createMutation.isPending || calculations.total <= 0}
                                className="bg-emerald-600 hover:bg-emerald-700"
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
                    </form>
                </Form>
                </DialogBody>
            </DialogContent>
        </Dialog>
    );
}

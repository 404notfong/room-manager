import { useEffect, useMemo } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DialogBody, DialogFooter } from '@/components/ui/dialog';
import { NumberInput } from '@/components/ui/number-input';
import apiClient from '@/api/client';

export type ServiceFormData = {
    name: string;
    unit: string;
    priceType: 'FIXED' | 'TABLE';
    fixedPrice?: number;
    priceTiers?: { fromValue: number; toValue: number; price: number }[];
    buildingScope: 'ALL' | 'SPECIFIC';
    buildingIds?: string[];
    isActive?: boolean;
};

interface ServiceFormProps {
    defaultValues?: Partial<ServiceFormData>;
    onSubmit: (data: ServiceFormData) => void;
    onCancel: () => void;
    isSubmitting?: boolean;
}

interface Building {
    _id: string;
    name: string;
    code: string;
}

const COMMON_UNITS = ['người', 'cái', 'phòng', 'xe', 'tháng', 'lần'];

export default function ServiceForm({
    defaultValues,
    onSubmit,
    onCancel,
    isSubmitting = false,
}: ServiceFormProps) {
    const { t } = useTranslation();

    const serviceSchema = useMemo(() => {
        const priceTierSchema = z.object({
            fromValue: z.number().min(0),
            toValue: z.number(),
            price: z.number().min(0, t('validation.min', { field: t('services.price'), min: 0 })),
        });

        return z.object({
            name: z.string().min(1, t('validation.required', { field: t('services.name') })),
            unit: z.string().min(1, t('validation.required', { field: t('services.unit') })),
            priceType: z.enum(['FIXED', 'TABLE']),
            fixedPrice: z.number().min(0, t('validation.min', { field: t('services.price'), min: 0 })).optional(),
            priceTiers: z.array(priceTierSchema).optional(),
            buildingScope: z.enum(['ALL', 'SPECIFIC']),
            buildingIds: z.array(z.string()).optional(),
            isActive: z.boolean().optional(),
        }).superRefine((data, ctx) => {
            // If FIXED, require fixedPrice >= 0
            if (data.priceType === 'FIXED') {
                if (data.fixedPrice === undefined || data.fixedPrice < 0) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: t('validation.required', { field: t('services.price') }),
                        path: ['fixedPrice'],
                    });
                }
            }
            // If TABLE, require prices >= 0
            if (data.priceType === 'TABLE') {
                if (!data.priceTiers || data.priceTiers.length === 0) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: t('validation.required', { field: t('services.priceTable') }),
                        path: ['priceTiers'],
                    });
                } else {
                    // Check each tier price >= 0
                    data.priceTiers.forEach((tier, index) => {
                        if (tier.price < 0) {
                            ctx.addIssue({
                                code: z.ZodIssueCode.custom,
                                message: t('validation.min', { field: t('services.price'), min: 0 }),
                                path: ['priceTiers', index, 'price'],
                            });
                        }
                    });
                }
            }
        });
    }, [t]);

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        control,
        reset,
        formState: { errors },
    } = useForm<ServiceFormData>({
        resolver: zodResolver(serviceSchema),
        defaultValues: {
            name: '',
            unit: '',
            priceType: 'FIXED',
            fixedPrice: 0,
            priceTiers: [
                { fromValue: 0, toValue: 0, price: 0 },
                { fromValue: 0, toValue: -1, price: 0 }
            ],
            buildingScope: 'ALL',
            buildingIds: [],
            isActive: true,
            ...defaultValues, // Keep this for initial render, useEffect handles updates
        },
    });

    // Reset form when defaultValues change (crucial for edit mode)
    useEffect(() => {
        if (defaultValues) {
            // merge defaultValues with initial defaults to ensure all fields exist
            const mergedValues = {
                name: '',
                unit: '',
                priceType: 'FIXED',
                fixedPrice: 0,
                priceTiers: [
                    { fromValue: 0, toValue: 0, price: 0 },
                    { fromValue: 0, toValue: -1, price: 0 }
                ],
                buildingScope: 'ALL',
                buildingIds: [],
                isActive: true,
                ...defaultValues,
            };
            // Force reset to ensure specific fields like buildingIds are populated
            reset(mergedValues as ServiceFormData);
        }
    }, [defaultValues, reset]);

    const { fields, append, remove, update } = useFieldArray({
        control,
        name: 'priceTiers',
    });

    const priceType = watch('priceType');
    const buildingScope = watch('buildingScope');
    const selectedBuildingIds = watch('buildingIds') || [];
    const priceTiers = watch('priceTiers');

    // Initialize default price tiers when switching to TABLE mode
    useEffect(() => {
        if (priceType === 'TABLE' && (!priceTiers || priceTiers.length === 0)) {
            setValue('priceTiers', [
                { fromValue: 0, toValue: 0, price: 0 },
                { fromValue: 0, toValue: -1, price: 0 }
            ]);
        }
    }, [priceType, priceTiers, setValue]);

    const { data: buildings = [] } = useQuery<Building[]>({
        queryKey: ['buildings'],
        queryFn: async () => {
            const response = await apiClient.get('/buildings');
            return Array.isArray(response.data?.data) ? response.data.data :
                Array.isArray(response.data) ? response.data : [];
        },
    });

    const handleBuildingToggle = (buildingId: string) => {
        const current = selectedBuildingIds;
        if (current.includes(buildingId)) {
            setValue('buildingIds', current.filter(id => id !== buildingId));
        } else {
            setValue('buildingIds', [...current, buildingId]);
        }
    };

    // Add new price tier with auto-linking (same as RoomForm)
    const handleAddPriceTier = () => {
        if (fields.length === 0) {
            // First tier: 0 - input
            append({ fromValue: 0, toValue: 0, price: 0 });
            // Last tier: input - remaining
            append({ fromValue: 0, toValue: -1, price: 0 });
        } else {
            // Insert before the last "remaining" tier
            const lastIndex = fields.length - 1;
            const lastTier = fields[lastIndex];
            const secondLastIndex = fields.length - 2;
            const prevEndValue = secondLastIndex >= 0 ? (fields[secondLastIndex].toValue as number) : 0;

            // Remove the last tier temporarily
            const lastTierData = { ...lastTier, fromValue: 0 };
            remove(lastIndex);

            // Add new tier
            append({ fromValue: prevEndValue, toValue: prevEndValue, price: 0 });

            // Re-add the last tier with updated fromValue
            append({ fromValue: prevEndValue, toValue: -1, price: lastTierData.price });
        }
    };

    // Handle toValue change to update next tier's fromValue
    const handleToValueChange = (index: number, value: number) => {
        const nextIndex = index + 1;
        if (nextIndex < fields.length) {
            update(nextIndex, { ...fields[nextIndex], fromValue: value });
        }
    };

    // Auto-scroll to first error when form is submitted with errors
    useEffect(() => {
        if (errors && Object.keys(errors).length > 0) {
            // Find first error input element
            const firstErrorElement = document.querySelector('[class*="border-destructive"]') as HTMLElement;
            if (firstErrorElement) {
                firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                firstErrorElement.focus();
            }
        }
    }, [errors, isSubmitting]);

    return (
        <form onSubmit={handleSubmit((data) => {
            onSubmit(data);
        }, () => {
            // Form validation errors handled by UI
        })} className="flex flex-col flex-1 overflow-hidden">
            <DialogBody>
                <div className="space-y-4">
                    {/* Name */}
                    <div className="space-y-2">
                        <Label htmlFor="name">{t('services.name')} <span className="text-destructive">*</span></Label>
                        <Input
                            id="name"
                            {...register('name')}
                            placeholder={t('services.namePlaceholder', 'VD: Giữ xe, Internet, Vệ sinh...')}
                            className={errors.name ? 'border-destructive' : ''}
                        />
                        {errors.name && (
                            <p className="text-sm text-destructive">{errors.name.message}</p>
                        )}
                    </div>

                    {/* Unit */}
                    <div className="space-y-2">
                        <Label htmlFor="unit">{t('services.unit')} <span className="text-destructive">*</span></Label>
                        <div className="flex gap-2">
                            <Input
                                id="unit"
                                {...register('unit')}
                                placeholder={t('services.unitPlaceholder', 'VD: người, xe, phòng...')}
                                className={errors.unit ? 'border-destructive' : ''}
                            />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {COMMON_UNITS.map((unit) => (
                                <Button
                                    key={unit}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setValue('unit', unit)}
                                >
                                    {unit}
                                </Button>
                            ))}
                        </div>
                        {errors.unit && (
                            <p className="text-sm text-destructive">{errors.unit.message}</p>
                        )}
                    </div>

                    {/* Price Type */}
                    <div className="space-y-2">
                        <Label>{t('services.priceType')}</Label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    value="FIXED"
                                    {...register('priceType')}
                                    className="accent-primary"
                                />
                                {t('services.fixedPrice')}
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    value="TABLE"
                                    {...register('priceType')}
                                    className="accent-primary"
                                />
                                {t('services.priceTable')}
                            </label>
                        </div>
                    </div>

                    {/* Fixed Price */}
                    {priceType === 'FIXED' && (
                        <div className="space-y-2">
                            <Label htmlFor="fixedPrice">{t('services.price')} <span className="text-destructive">*</span></Label>
                            <Controller
                                name="fixedPrice"
                                control={control}
                                render={({ field, fieldState }) => (
                                    <NumberInput
                                        value={field.value}
                                        onChange={field.onChange}
                                        error={!!fieldState.error}
                                    />
                                )}
                            />
                            {errors.fixedPrice && (
                                <p className="text-sm text-destructive">{errors.fixedPrice.message}</p>
                            )}
                        </div>
                    )}

                    {/* Price Table - Same as RoomForm */}
                    {priceType === 'TABLE' && (
                        <div className={`space-y-2 p-4 border rounded-lg bg-muted/30 ${errors.priceTiers?.root || errors.priceTiers?.message ? 'border-destructive' : ''}`}>
                            <Label>{t('services.priceTable')}</Label>
                            {/* Show error for priceTiers array */}
                            {(errors.priceTiers?.root || errors.priceTiers?.message) && (
                                <p className="text-sm text-destructive">
                                    {errors.priceTiers.message || errors.priceTiers.root?.message}
                                </p>
                            )}
                            <div className="space-y-2">
                                {fields.map((field, index) => {
                                    const isLast = index === fields.length - 1;
                                    const isFirst = index === 0;
                                    const priceError = errors.priceTiers?.[index]?.price;
                                    const toValueError = errors.priceTiers?.[index]?.toValue;
                                    return (
                                        <div key={field.id} className="space-y-1">
                                            <div className="flex gap-2 items-center">
                                                <NumberInput
                                                    value={field.fromValue}
                                                    disabled={true}
                                                    placeholder={t('services.from')}
                                                    onChange={() => { }}
                                                    className="w-20"
                                                    decimalScale={0}
                                                />
                                                <span className="text-muted-foreground">-</span>
                                                {isLast ? (
                                                    <span className="w-20 text-center text-muted-foreground italic">
                                                        {t('rooms.remaining', 'còn lại')}
                                                    </span>
                                                ) : (
                                                    <Controller
                                                        control={control}
                                                        name={`priceTiers.${index}.toValue`}
                                                        render={({ field: toField }) => (
                                                            <NumberInput
                                                                value={toField.value}
                                                                placeholder={t('services.to')}
                                                                onChange={(v) => {
                                                                    if (v !== undefined) {
                                                                        toField.onChange(v);
                                                                        handleToValueChange(index, v);
                                                                    }
                                                                }}
                                                                className="w-20"
                                                                decimalScale={0}
                                                                error={!!toValueError || (typeof toField.value === 'number' && toField.value >= 0 && toField.value < field.fromValue)}
                                                            />
                                                        )}
                                                    />
                                                )}
                                                <Controller
                                                    control={control}
                                                    name={`priceTiers.${index}.price`}
                                                    render={({ field: priceField, fieldState }) => (
                                                        <NumberInput
                                                            value={priceField.value}
                                                            placeholder={t('services.price')}
                                                            onChange={priceField.onChange}
                                                            className="flex-1"
                                                            error={!!fieldState.error}
                                                        />
                                                    )}
                                                />
                                                {!isFirst && !isLast && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => {
                                                            const prevField = fields[index - 1];
                                                            const nextField = fields[index + 1];
                                                            if (nextField) {
                                                                update(index + 1, { ...nextField, fromValue: prevField.toValue as number });
                                                            }
                                                            remove(index);
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                )}
                                                {(isFirst || isLast) && <div className="w-10" />}
                                            </div>
                                            {(priceError || toValueError) && (
                                                <p className="text-sm text-destructive pl-1">
                                                    {priceError?.message || toValueError?.message}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleAddPriceTier}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    {t('services.addTier')}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Building Scope */}
                    <div className="space-y-2">
                        <Label>{t('services.scope')}</Label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    value="ALL"
                                    {...register('buildingScope')}
                                    className="accent-primary"
                                />
                                {t('services.allBuildings')}
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    value="SPECIFIC"
                                    {...register('buildingScope')}
                                    className="accent-primary"
                                />
                                {t('services.specificBuildings')}
                            </label>
                        </div>
                    </div>

                    {/* Building Selection */}
                    {buildingScope === 'SPECIFIC' && (
                        <div className="space-y-2">
                            <Label>{t('services.selectBuildings')}</Label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-60">
                                {/* Available Buildings */}
                                <div className="border rounded-md flex flex-col">
                                    <div className="p-2 border-b bg-muted/50 font-medium text-xs">
                                        {t('services.availableBuildings')}
                                    </div>
                                    <div className="p-2 overflow-y-auto flex-1 space-y-1">
                                        {buildings
                                            .filter(b => !selectedBuildingIds.includes(b._id))
                                            .map((building) => (
                                                <div
                                                    key={building._id}
                                                    onClick={() => handleBuildingToggle(building._id)}
                                                    className="flex items-center justify-between p-2 rounded hover:bg-muted cursor-pointer text-sm"
                                                >
                                                    <span>{building.name}</span>
                                                    <Plus className="h-3 w-3 text-muted-foreground" />
                                                </div>
                                            ))}
                                        {buildings.filter(b => !selectedBuildingIds.includes(b._id)).length === 0 && (
                                            <p className="text-xs text-muted-foreground text-center py-4">
                                                {buildings.length === 0 ? t('services.noBuildings') : t('services.allSelected')}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Selected Buildings */}
                                <div className="border rounded-md flex flex-col">
                                    <div className="p-2 border-b bg-muted/50 font-medium text-xs flex justify-between">
                                        <span>{t('services.selectedBuildings')} ({selectedBuildingIds.length})</span>
                                        {selectedBuildingIds.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setValue('buildingIds', [])}
                                                className="text-xs text-destructive hover:underline"
                                            >
                                                {t('common.clearAll')}
                                            </button>
                                        )}
                                    </div>
                                    <div className="p-2 overflow-y-auto flex-1 space-y-1">
                                        {selectedBuildingIds.map((id) => {
                                            const building = buildings.find(b => b._id === id);
                                            if (!building) return null;
                                            return (
                                                <div
                                                    key={id}
                                                    onClick={() => handleBuildingToggle(id)}
                                                    className="flex items-center justify-between p-2 rounded bg-primary/5 hover:bg-destructive/10 cursor-pointer text-sm group"
                                                >
                                                    <span className="font-medium text-primary group-hover:text-destructive">{building.name}</span>
                                                    <Trash2 className="h-3 w-3 text-primary group-hover:text-destructive" />
                                                </div>
                                            );
                                        })}
                                        {selectedBuildingIds.length === 0 && (
                                            <p className="text-xs text-muted-foreground text-center py-4">
                                                {t('services.noBuildingsSelected')}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Active */}
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="isActive"
                            checked={watch('isActive')}
                            onChange={(e) => setValue('isActive', e.target.checked)}
                            className="accent-primary h-4 w-4"
                        />
                        <Label htmlFor="isActive">{t('services.isActive')}</Label>
                    </div>
                </div>
            </DialogBody>

            <DialogFooter>
                <Button type="button" variant="outline" onClick={onCancel}>
                    {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                    {t('common.save')}
                </Button>
            </DialogFooter>
        </form>
    );
}

import { useEffect } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { DialogBody, DialogFooter } from '@/components/ui/dialog';
import { useRoomSchema } from '@/lib/validations';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/api/client';
import { Plus, Trash2 } from 'lucide-react';
import { NumberInput } from '@/components/ui/number-input';

export type RoomFormData = z.infer<ReturnType<typeof useRoomSchema>>;

interface RoomFormProps {
    defaultValues?: Partial<RoomFormData>;
    onSubmit: (data: RoomFormData) => void;
    onCancel: () => void;
    isSubmitting?: boolean;
    isEditing?: boolean;
    roomCode?: string;
    preselectedBuildingId?: string | null;
    currentStatus?: string; // For handling OCCUPIED status display
}

export default function RoomForm({
    defaultValues,
    onSubmit,
    onCancel,
    isSubmitting = false,
    isEditing = false,
    roomCode,
    preselectedBuildingId,
    currentStatus,
}: RoomFormProps) {
    const { t } = useTranslation();
    const schema = useRoomSchema();

    const { data: buildings = [] } = useQuery({
        queryKey: ['buildings'],
        queryFn: async () => {
            const res = await apiClient.get('/buildings');
            return Array.isArray(res.data?.data) ? res.data.data : [];
        },
    });

    const { data: roomGroups = [] } = useQuery({
        queryKey: ['roomGroups'],
        queryFn: async () => {
            const res = await apiClient.get('/room-groups');
            // Handle both response structures: direct array or wrapped in data property
            const groups = Array.isArray(res.data)
                ? res.data
                : (Array.isArray(res.data?.data) ? res.data.data : []);
            // Filter only active room groups
            return groups.filter((g: any) => g.isActive !== false);
        },
    });

    const {
        register,
        control,
        handleSubmit,
        watch,
        setValue,
        formState: { errors, isSubmitted },
    } = useForm<RoomFormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            buildingId: '',
            roomName: '',
            floor: 1,
            area: undefined,
            maxOccupancy: undefined,
            status: 'AVAILABLE',
            roomGroupId: '',
            description: '',
            roomType: 'LONG_TERM',
            defaultElectricPrice: 0,
            defaultWaterPrice: 0,
            defaultRoomPrice: 0,
            defaultTermMonths: 1,
            shortTermPricingType: 'HOURLY',
            hourlyPricingMode: 'PER_HOUR',
            pricePerHour: 0,
            shortTermPrices: [
                { fromValue: 0, toValue: 0, price: 0 },
                { fromValue: 0, toValue: -1, price: 0 }
            ],
            fixedPrice: 0,
            ...defaultValues,
        },
    });

    const { fields, append, remove, update } = useFieldArray({
        control,
        name: 'shortTermPrices',
    });

    const roomType = watch('roomType');
    const shortTermPricingType = watch('shortTermPricingType');
    const hourlyPricingMode = watch('hourlyPricingMode');

    // Auto-select building if creating new room and building is pre-selected
    useEffect(() => {
        if (!isEditing && preselectedBuildingId) {
            setValue('buildingId', preselectedBuildingId);
        }
    }, [isEditing, preselectedBuildingId, setValue]);

    const termMonthOptions = [1, 2, 3, 6, 12];

    // Auto-scroll to first error when form is submitted with errors
    useEffect(() => {
        if (isSubmitted && Object.keys(errors).length > 0) {
            // Find first error input element
            const firstErrorElement = document.querySelector('[class*="border-destructive"]') as HTMLElement;
            if (firstErrorElement) {
                firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                firstErrorElement.focus();
            }
        }
    }, [errors, isSubmitted]);

    // Add new price tier with auto-linking
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

            // Update the last tier's fromValue when we add new tier
            // Insert a new tier before the last one
            const newFromValue = prevEndValue;

            // Remove the last tier temporarily
            const lastTierData = { ...lastTier, fromValue: 0 };
            remove(lastIndex);

            // Add new tier
            append({ fromValue: newFromValue, toValue: newFromValue, price: 0 });

            // Re-add the last tier with updated fromValue
            append({ fromValue: newFromValue, toValue: -1, price: lastTierData.price });
        }
    };

    // Handle toValue change to update next tier's fromValue
    const handleToValueChange = (index: number, value: number) => {
        const nextIndex = index + 1;
        if (nextIndex < fields.length) {
            update(nextIndex, { ...fields[nextIndex], fromValue: value });
        }
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <DialogBody>
                <div className="space-y-4">
                    {/* Basic Info Section */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 col-span-2">
                            <Label htmlFor="buildingId">{t('rooms.building')} <span className="text-destructive">*</span></Label>
                            <Controller
                                name="buildingId"
                                control={control}
                                render={({ field }) => (
                                    <Select
                                        onValueChange={field.onChange}
                                        value={field.value}
                                        disabled={isEditing || (!!preselectedBuildingId && !isEditing)}
                                    >
                                        <SelectTrigger className={errors.buildingId ? 'border-destructive' : ''}>
                                            <SelectValue placeholder={t('rooms.selectBuilding')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {buildings.map((b: any) => (
                                                <SelectItem key={b._id} value={b._id}>
                                                    {b.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                            {errors.buildingId && (
                                <p className="text-sm text-destructive">{errors.buildingId.message}</p>
                            )}
                        </div>

                        {/* Room Code - Display only in edit mode */}
                        {isEditing && roomCode && (
                            <div className="space-y-2">
                                <Label>{t('rooms.roomCodeAuto')}</Label>
                                <Input value={roomCode} disabled className="bg-muted" />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="roomName">{t('rooms.roomName')} <span className="text-destructive">*</span></Label>
                            <Input
                                id="roomName"
                                {...register('roomName')}
                                className={errors.roomName ? 'border-destructive' : ''}
                            />
                            {errors.roomName && (
                                <p className="text-sm text-destructive">{errors.roomName.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="floor">{t('rooms.floor')} <span className="text-destructive">*</span></Label>
                            <Input
                                id="floor"
                                type="number"
                                {...register('floor', { valueAsNumber: true })}
                                className={errors.floor ? 'border-destructive' : ''}
                            />
                            {errors.floor && (
                                <p className="text-sm text-destructive">{errors.floor.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="area">{t('rooms.area')}</Label>
                            <Controller
                                name="area"
                                control={control}
                                render={({ field }) => (
                                    <NumberInput
                                        id="area"
                                        value={field.value ?? undefined}
                                        onChange={field.onChange}
                                    />
                                )}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="maxOccupancy">{t('rooms.maxOccupancy')}</Label>
                            <Controller
                                name="maxOccupancy"
                                control={control}
                                render={({ field }) => (
                                    <NumberInput
                                        id="maxOccupancy"
                                        value={field.value ?? undefined}
                                        onChange={field.onChange}
                                    />
                                )}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="status">{t('rooms.status')}</Label>
                            <Controller
                                name="status"
                                control={control}
                                render={({ field }) => {
                                    const isLocked = currentStatus === 'OCCUPIED' || currentStatus === 'DEPOSITED';
                                    return (
                                        <Select
                                            onValueChange={field.onChange}
                                            value={field.value}
                                            disabled={isLocked}
                                        >
                                            <SelectTrigger className={isLocked ? 'bg-muted' : ''}>
                                                <SelectValue placeholder={t('rooms.selectStatus')} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="AVAILABLE">{t('rooms.statusAvailable')}</SelectItem>
                                                {currentStatus === 'OCCUPIED' && (
                                                    <SelectItem value="OCCUPIED">{t('rooms.statusOccupied')}</SelectItem>
                                                )}
                                                {currentStatus === 'DEPOSITED' && (
                                                    <SelectItem value="DEPOSITED">{t('rooms.statusDeposited')}</SelectItem>
                                                )}
                                                <SelectItem value="MAINTENANCE">{t('rooms.statusMaintenance')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    );
                                }}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="roomGroupId">{t('rooms.roomGroup')}</Label>
                            <Controller
                                name="roomGroupId"
                                control={control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                                        <SelectTrigger>
                                            <SelectValue placeholder={t('rooms.selectGroup')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {roomGroups.map((g: any) => (
                                                <SelectItem key={g._id} value={g._id}>
                                                    {g.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </div>
                    </div>

                    {/* Room Type Section */}
                    <div className="border-t pt-4 mt-4">
                        <div className="space-y-2">
                            <Label>{t('rooms.roomType')} <span className="text-destructive">*</span></Label>
                            <Controller
                                name="roomType"
                                control={control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger className={errors.roomType ? 'border-destructive' : ''}>
                                            <SelectValue placeholder={t('rooms.selectRoomType')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="LONG_TERM">{t('rooms.roomTypeLongTerm')}</SelectItem>
                                            <SelectItem value="SHORT_TERM">{t('rooms.roomTypeShortTerm')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                            <p className="text-xs text-muted-foreground">
                                <span className="font-medium">{t('rooms.roomTypeLongTerm')}:</span> {t('rooms.roomTypeLongTermHint')} • {' '}
                                <span className="font-medium">{t('rooms.roomTypeShortTerm')}:</span> {t('rooms.roomTypeShortTermHint')}
                            </p>
                        </div>
                    </div>

                    {/* Long-term Room Fields */}
                    {roomType === 'LONG_TERM' && (
                        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>{t('rooms.defaultElectricPrice')} <span className="text-destructive">*</span></Label>
                                    <Controller
                                        name="defaultElectricPrice"
                                        control={control}
                                        render={({ field, fieldState }) => (
                                            <NumberInput
                                                value={field.value}
                                                onChange={field.onChange}
                                                error={!!fieldState.error}
                                            />
                                        )}
                                    />
                                    {errors.defaultElectricPrice && (
                                        <p className="text-sm text-destructive">{errors.defaultElectricPrice.message}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('rooms.defaultWaterPrice')} <span className="text-destructive">*</span></Label>
                                    <Controller
                                        name="defaultWaterPrice"
                                        control={control}
                                        render={({ field, fieldState }) => (
                                            <NumberInput
                                                value={field.value}
                                                onChange={field.onChange}
                                                error={!!fieldState.error}
                                            />
                                        )}
                                    />
                                    {errors.defaultWaterPrice && (
                                        <p className="text-sm text-destructive">{errors.defaultWaterPrice.message}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('rooms.defaultRoomPrice')} <span className="text-destructive">*</span></Label>
                                    <Controller
                                        name="defaultRoomPrice"
                                        control={control}
                                        render={({ field, fieldState }) => (
                                            <NumberInput
                                                value={field.value}
                                                onChange={field.onChange}
                                                error={!!fieldState.error}
                                            />
                                        )}
                                    />
                                    {errors.defaultRoomPrice && (
                                        <p className="text-sm text-destructive">{errors.defaultRoomPrice.message}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('rooms.defaultTermMonths')} <span className="text-destructive">*</span></Label>
                                    <Controller
                                        name="defaultTermMonths"
                                        control={control}
                                        render={({ field }) => (
                                            <Select
                                                onValueChange={(v) => field.onChange(parseInt(v))}
                                                value={field.value?.toString()}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder={t('rooms.selectTermMonths')} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {termMonthOptions.map((m) => (
                                                        <SelectItem key={m} value={m.toString()}>
                                                            {m} {t('rooms.months')}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Short-term Room Fields */}
                    {roomType === 'SHORT_TERM' && (
                        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                            <div className="space-y-2">
                                <Label>{t('rooms.shortTermPricingType')} <span className="text-destructive">*</span></Label>
                                <Controller
                                    name="shortTermPricingType"
                                    control={control}
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger>
                                                <SelectValue placeholder={t('rooms.selectPricingType')} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="HOURLY">{t('rooms.pricingHourly')}</SelectItem>
                                                <SelectItem value="DAILY">{t('rooms.pricingDaily')}</SelectItem>
                                                <SelectItem value="FIXED">{t('rooms.pricingFixed')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                            </div>

                            {/* Fixed Price */}
                            {shortTermPricingType === 'FIXED' && (
                                <div className="space-y-2">
                                    <Label>{t('rooms.fixedPrice')} <span className="text-destructive">*</span></Label>
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

                            {/* Hourly Pricing - Choose mode */}
                            {shortTermPricingType === 'HOURLY' && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>{t('rooms.hourlyPricingMode')}</Label>
                                        <Controller
                                            name="hourlyPricingMode"
                                            control={control}
                                            render={({ field }) => (
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder={t('rooms.selectHourlyMode')} />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="PER_HOUR">{t('rooms.perHourMode')}</SelectItem>
                                                        <SelectItem value="TABLE">{t('rooms.tableMode')}</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                    </div>

                                    {/* Per Hour Mode - Simple input */}
                                    {hourlyPricingMode === 'PER_HOUR' && (
                                        <div className="space-y-2">
                                            <Label>{t('rooms.pricePerHour')} <span className="text-destructive">*</span></Label>
                                            <Controller
                                                name="pricePerHour"
                                                control={control}
                                                render={({ field, fieldState }) => (
                                                    <NumberInput
                                                        value={field.value}
                                                        onChange={field.onChange}
                                                        error={!!fieldState.error}
                                                    />
                                                )}
                                            />
                                            {errors.pricePerHour && (
                                                <p className="text-sm text-destructive">{errors.pricePerHour.message}</p>
                                            )}
                                        </div>
                                    )}

                                    {/* Table Mode - Price tiers */}
                                    {hourlyPricingMode === 'TABLE' && (
                                        <div className="space-y-2">
                                            <Label>{t('rooms.priceTable')}</Label>
                                            <div className="space-y-2">
                                                {fields.map((field, index) => {
                                                    const isLast = index === fields.length - 1;
                                                    const isFirst = index === 0;
                                                    const priceError = errors.shortTermPrices?.[index]?.price;
                                                    const toValueError = errors.shortTermPrices?.[index]?.toValue;
                                                    return (
                                                        <div key={field.id} className="space-y-1">
                                                            <div className="flex gap-2 items-center">
                                                                <NumberInput
                                                                    value={field.fromValue}
                                                                    disabled={true}
                                                                    placeholder={t('rooms.fromHour')}
                                                                    onChange={() => { }}
                                                                    className="w-20"
                                                                    decimalScale={0}
                                                                />
                                                                <span className="text-muted-foreground">-</span>
                                                                {isLast ? (
                                                                    <span className="w-20 text-center text-muted-foreground italic">
                                                                        {t('rooms.remaining')}
                                                                    </span>
                                                                ) : (
                                                                    <Controller
                                                                        control={control}
                                                                        name={`shortTermPrices.${index}.toValue`}
                                                                        render={({ field: toField }) => (
                                                                            <NumberInput
                                                                                value={toField.value}
                                                                                placeholder={t('rooms.toHour')}
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
                                                                    name={`shortTermPrices.${index}.price`}
                                                                    render={({ field: priceField, fieldState }) => (
                                                                        <NumberInput
                                                                            value={priceField.value}
                                                                            placeholder={t('rooms.priceAmount')}
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
                                                    {t('rooms.addPriceTier')}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Daily Pricing - Price tiers table */}
                            {shortTermPricingType === 'DAILY' && (
                                <div className="space-y-2">
                                    <Label>{t('rooms.priceTable')}</Label>
                                    <div className="space-y-2">
                                        {fields.map((field, index) => {
                                            const isLast = index === fields.length - 1;
                                            const isFirst = index === 0;
                                            const priceError = errors.shortTermPrices?.[index]?.price;
                                            const toValueError = errors.shortTermPrices?.[index]?.toValue;
                                            return (
                                                <div key={field.id} className="space-y-1">
                                                    <div className="flex gap-2 items-center">
                                                        <NumberInput
                                                            value={field.fromValue}
                                                            disabled={true}
                                                            placeholder={t('rooms.fromDay')}
                                                            onChange={() => { }}
                                                            className="w-20"
                                                            decimalScale={0}
                                                        />
                                                        <span className="text-muted-foreground">-</span>
                                                        {isLast ? (
                                                            <span className="w-20 text-center text-muted-foreground italic">
                                                                {t('rooms.remaining')}
                                                            </span>
                                                        ) : (
                                                            <Controller
                                                                control={control}
                                                                name={`shortTermPrices.${index}.toValue`}
                                                                render={({ field: toField }) => (
                                                                    <NumberInput
                                                                        value={toField.value}
                                                                        placeholder={t('rooms.toDay')}
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
                                                            name={`shortTermPrices.${index}.price`}
                                                            render={({ field: priceField, fieldState }) => (
                                                                <NumberInput
                                                                    value={priceField.value}
                                                                    placeholder={t('rooms.priceAmount')}
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
                                            {t('rooms.addPriceTier')}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Note */}
                    <p className="text-sm text-muted-foreground italic">
                        {t('rooms.pricingNote')}
                    </p>

                    {/* Description - Textarea */}
                    <div className="space-y-2">
                        <Label htmlFor="description">{t('rooms.description')}</Label>
                        <Textarea
                            id="description"
                            {...register('description')}
                            rows={3}
                            placeholder={t('rooms.description')}
                        />
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

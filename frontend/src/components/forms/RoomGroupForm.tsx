import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DialogBody, DialogFooter } from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useRoomGroupSchema } from '@/lib/validations';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/api/client';

export type RoomGroupFormData = z.infer<ReturnType<typeof useRoomGroupSchema>>;

interface RoomGroupFormProps {
    defaultValues?: Partial<RoomGroupFormData>;
    onSubmit: (data: RoomGroupFormData) => void;
    onCancel: () => void;
    isSubmitting?: boolean;
    isEditing?: boolean;
    preselectedBuildingId?: string | null;
}

const COLORS = [
    { name: 'Đỏ', value: 'red' },
    { name: 'Xanh dương', value: 'blue' },
    { name: 'Xanh lá', value: 'green' },
    { name: 'Vàng', value: 'yellow' },
    { name: 'Tím', value: 'purple' },
    { name: 'Hồng', value: 'pink' },
    { name: 'Cam', value: 'orange' },
    { name: 'Xám', value: 'gray' },
];

export default function RoomGroupForm({
    defaultValues,
    onSubmit,
    onCancel,
    isSubmitting = false,
    isEditing = false,
    preselectedBuildingId,
}: RoomGroupFormProps) {
    const { t } = useTranslation();
    const schema = useRoomGroupSchema();

    const { data: buildings = [] } = useQuery({
        queryKey: ['buildings'],
        queryFn: async () => {
            const res = await apiClient.get('/buildings');
            return Array.isArray(res.data?.data) ? res.data.data : [];
        },
    });

    // Determine initial buildingId: use defaultValues for edit, or preselectedBuildingId for create
    const initialBuildingId = defaultValues?.buildingId || preselectedBuildingId || '';

    const {
        register,
        control,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = useForm<RoomGroupFormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            buildingId: initialBuildingId,
            name: '',
            description: '',
            color: 'blue',
            sortOrder: 0,
            isActive: true,
            ...defaultValues,
        },
    });

    const selectedColor = watch('color');
    const hasBuildingPreselected = !!preselectedBuildingId || isEditing;

    const getColorBadge = (color: string) => {
        const colorClasses: Record<string, string> = {
            red: 'bg-red-500',
            blue: 'bg-blue-500',
            green: 'bg-green-500',
            yellow: 'bg-yellow-500',
            purple: 'bg-purple-500',
            pink: 'bg-pink-500',
            orange: 'bg-orange-500',
            gray: 'bg-gray-500',
        };
        return colorClasses[color] || 'bg-gray-500';
    };

    // Get building name for display when disabled
    const selectedBuildingName = buildings.find((b: any) => b._id === initialBuildingId)?.name;

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <DialogBody>
                <div className="space-y-4">
                    {defaultValues?.code && (
                        <div className="space-y-2">
                            <Label>{t('roomGroups.code')}</Label>
                            <Input value={defaultValues.code} disabled className="bg-muted" />
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="buildingId">{t('rooms.building')} <span className="text-destructive">*</span></Label>
                        {hasBuildingPreselected ? (
                            <>
                                <Input
                                    value={selectedBuildingName || t('common.loading')}
                                    disabled
                                    className="bg-muted"
                                />
                                <input type="hidden" {...register('buildingId')} />
                            </>
                        ) : (
                            <Controller
                                name="buildingId"
                                control={control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                        )}
                        {errors.buildingId && (
                            <p className="text-sm text-destructive">{errors.buildingId.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="name">{t('roomGroups.name')} <span className="text-destructive">*</span></Label>
                        <Input
                            id="name"
                            {...register('name')}
                            className={errors.name ? 'border-destructive' : ''}
                        />
                        {errors.name && (
                            <p className="text-sm text-destructive">{errors.name.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">{t('roomGroups.description')}</Label>
                        <Input id="description" {...register('description')} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>{t('roomGroups.color')}</Label>
                            <div className="flex flex-wrap gap-2">
                                {COLORS.map((color) => (
                                    <button
                                        key={color.value}
                                        type="button"
                                        onClick={() => setValue('color', color.value)}
                                        className={`w-8 h-8 rounded-full ${getColorBadge(color.value)} ${selectedColor === color.value ? 'ring-2 ring-offset-2 ring-primary' : ''
                                            }`}
                                        title={color.name}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="sortOrder">{t('roomGroups.sortOrder')}</Label>
                            <Input
                                id="sortOrder"
                                type="number"
                                {...register('sortOrder', { valueAsNumber: true })}
                            />
                        </div>
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

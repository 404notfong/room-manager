import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    DialogBody,
    DialogFooter,
} from '@/components/ui/dialog';

interface BuildingFormProps {
    defaultValues?: {
        name: string;
        code?: string;
        address: {
            street: string;
            ward: string;
            district: string;
            city: string;
        };
        description: string;
    };
    onSubmit: (data: BuildingFormData) => void;
    onCancel: () => void;
    isSubmitting?: boolean;
    isEditing?: boolean;
}

// Schema hook for i18n validation
const useBuildingSchema = () => {
    const { t } = useTranslation();

    return z.object({
        name: z.string().min(1, t('validation.required', { field: t('buildings.name') })),
        address: z.object({
            street: z.string().min(1, t('validation.required', { field: t('buildings.street') })),
            ward: z.string().min(1, t('validation.required', { field: t('buildings.ward') })),
            district: z.string().min(1, t('validation.required', { field: t('buildings.district') })),
            city: z.string().min(1, t('validation.required', { field: t('buildings.city') })),
        }),
        code: z.string().optional(),
        description: z.string().optional(),
    });
};

export type BuildingFormData = z.infer<ReturnType<typeof useBuildingSchema>>;

export default function BuildingForm({
    defaultValues = {
        name: '',
        code: '',
        address: { street: '', ward: '', district: '', city: '' },
        description: '',
    },
    onSubmit,
    onCancel,
    isSubmitting = false,
    isEditing = false,
}: BuildingFormProps) {
    const { t } = useTranslation();
    const schema = useBuildingSchema();

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<BuildingFormData>({
        resolver: zodResolver(schema),
        defaultValues,
    });

    const handleFormSubmit = (data: BuildingFormData) => {
        // Remove code field - backend auto-generates it and doesn't accept it in DTO
        const payload = { ...data };
        delete payload.code;
        // Remove empty description
        if (!payload.description) {
            delete payload.description;
        }
        onSubmit(payload);
    };

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <DialogBody>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">{t('buildings.name')} <span className="text-destructive">*</span></Label>
                        <Input
                            id="name"
                            {...register('name')}
                            placeholder={t('buildings.namePlaceholder')}
                            className={errors.name ? 'border-destructive' : ''}
                        />
                        {errors.name && (
                            <p className="text-sm text-destructive">{errors.name.message}</p>
                        )}
                    </div>

                    {isEditing && (
                        <div className="space-y-2">
                            <Label htmlFor="code">{t('buildings.code')}</Label>
                            <Input
                                id="code"
                                {...register('code')}
                                disabled
                                className="bg-muted"
                            />
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="street">{t('buildings.street')} <span className="text-destructive">*</span></Label>
                        <Input
                            id="street"
                            {...register('address.street')}
                            placeholder={t('buildings.streetPlaceholder')}
                            className={errors.address?.street ? 'border-destructive' : ''}
                        />
                        {errors.address?.street && (
                            <p className="text-sm text-destructive">{errors.address.street.message}</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label htmlFor="ward">{t('buildings.ward')} <span className="text-destructive">*</span></Label>
                            <Input
                                id="ward"
                                {...register('address.ward')}
                                placeholder={t('buildings.wardPlaceholder')}
                                className={errors.address?.ward ? 'border-destructive' : ''}
                            />
                            {errors.address?.ward && (
                                <p className="text-sm text-destructive">{errors.address.ward.message}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="district">{t('buildings.district')} <span className="text-destructive">*</span></Label>
                            <Input
                                id="district"
                                {...register('address.district')}
                                placeholder={t('buildings.districtPlaceholder')}
                                className={errors.address?.district ? 'border-destructive' : ''}
                            />
                            {errors.address?.district && (
                                <p className="text-sm text-destructive">{errors.address.district.message}</p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="city">{t('buildings.city')} <span className="text-destructive">*</span></Label>
                        <Input
                            id="city"
                            {...register('address.city')}
                            placeholder={t('buildings.cityPlaceholder')}
                            className={errors.address?.city ? 'border-destructive' : ''}
                        />
                        {errors.address?.city && (
                            <p className="text-sm text-destructive">{errors.address.city.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">{t('buildings.description')}</Label>
                        <Input
                            id="description"
                            {...register('description')}
                            placeholder={t('buildings.descriptionPlaceholder')}
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
        </form >
    );
}

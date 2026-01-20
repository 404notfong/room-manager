import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DialogBody, DialogFooter } from '@/components/ui/dialog';
import { useTenantSchema } from '@/lib/validations';

export type TenantFormData = z.infer<ReturnType<typeof useTenantSchema>>;

interface TenantFormProps {
    defaultValues?: Partial<TenantFormData>;
    onSubmit: (data: TenantFormData) => void;
    onCancel: () => void;
    isSubmitting?: boolean;
}

export default function TenantForm({
    defaultValues,
    onSubmit,
    onCancel,
    isSubmitting = false,
}: TenantFormProps) {
    const { t } = useTranslation();
    const schema = useTenantSchema();

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<TenantFormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            fullName: '',
            email: '',
            phone: '',
            idNumber: '',
            dateOfBirth: '',
            gender: undefined,
            address: '',
            occupation: '',
            status: 'ACTIVE',
            ...defaultValues,
        },
    });

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <DialogBody>
                <div className="space-y-4">
                    {defaultValues?.code && (
                        <div className="space-y-2">
                            <Label>{t('tenants.code')}</Label>
                            <Input value={defaultValues.code} disabled className="bg-muted" />
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="fullName">{t('tenants.fullName')} <span className="text-destructive">*</span></Label>
                        <Input
                            id="fullName"
                            {...register('fullName')}
                            className={errors.fullName ? 'border-destructive' : ''}
                        />
                        {errors.fullName && (
                            <p className="text-sm text-destructive">{errors.fullName.message}</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">{t('tenants.email')}</Label>
                            <Input
                                id="email"
                                type="email"
                                {...register('email')}
                                className={errors.email ? 'border-destructive' : ''}
                            />
                            {errors.email && (
                                <p className="text-sm text-destructive">{errors.email.message}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">{t('tenants.phone')} <span className="text-destructive">*</span></Label>
                            <Input
                                id="phone"
                                {...register('phone')}
                                className={errors.phone ? 'border-destructive' : ''}
                            />
                            {errors.phone && (
                                <p className="text-sm text-destructive">{errors.phone.message}</p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="idNumber">{t('tenants.idNumber')} <span className="text-destructive">*</span></Label>
                        <Input
                            id="idNumber"
                            {...register('idNumber')}
                            className={errors.idNumber ? 'border-destructive' : ''}
                        />
                        {errors.idNumber && (
                            <p className="text-sm text-destructive">{errors.idNumber.message}</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="dateOfBirth">{t('tenants.dateOfBirth')}</Label>
                            <Input
                                id="dateOfBirth"
                                type="date"
                                {...register('dateOfBirth')}
                                defaultValue={defaultValues?.dateOfBirth || ''}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="gender">{t('tenants.gender')}</Label>
                            <select
                                id="gender"
                                {...register('gender')}
                                defaultValue={defaultValues?.gender || ''}
                                className="flex h-10 w-full rounded-md border border-input bg-white dark:bg-slate-900 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            >
                                <option value="">{t('tenants.selectGender')}</option>
                                <option value="MALE">{t('tenants.genderMale')}</option>
                                <option value="FEMALE">{t('tenants.genderFemale')}</option>
                                <option value="OTHER">{t('tenants.genderOther')}</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="address">{t('tenants.address')}</Label>
                        <Input id="address" {...register('address')} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="occupation">{t('tenants.occupation')}</Label>
                        <Input id="occupation" {...register('occupation')} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="status">{t('common.status')}</Label>
                        <select
                            id="status"
                            {...register('status')}
                            defaultValue={defaultValues?.status || 'ACTIVE'}
                            className="flex h-10 w-full rounded-md border border-input bg-white dark:bg-slate-900 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:bg-muted disabled:opacity-50"
                            disabled={defaultValues?.status === 'RENTING' || defaultValues?.status === 'DEPOSITED'}
                        >
                            <option value="ACTIVE">{t('tenants.statusActive')}</option>
                            <option value="CLOSED">{t('tenants.statusClosed')}</option>
                            {defaultValues?.status === 'RENTING' && (
                                <option value="RENTING">{t('tenants.statusRenting')}</option>
                            )}
                            {defaultValues?.status === 'DEPOSITED' && (
                                <option value="DEPOSITED">{t('tenants.statusDeposited')}</option>
                            )}
                        </select>
                        {(defaultValues?.status === 'RENTING' || defaultValues?.status === 'DEPOSITED') && (
                            <div className="flex flex-col gap-1 mt-1">
                                <Badge
                                    variant={defaultValues.status === 'RENTING' ? 'default' : 'secondary'}
                                    className={`w-fit ${defaultValues.status === 'DEPOSITED' ? 'bg-orange-500 hover:bg-orange-600' : ''}`}
                                >
                                    {defaultValues.status === 'RENTING' ? t('tenants.statusRenting') : t('tenants.statusDeposited')}
                                </Badge>
                                <p className="text-xs text-muted-foreground italic">
                                    * {t('tenants.statusRentAutoHint')}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="border-t pt-4 mt-4">
                        <h3 className="font-medium mb-4">{t('tenants.emergencyContact')}</h3>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="ecName">{t('tenants.ecName')}</Label>
                                <Input id="ecName" {...register('emergencyContact.name')} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="ecPhone">{t('tenants.ecPhone')}</Label>
                                    <Input id="ecPhone" {...register('emergencyContact.phone')} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="ecRelationship">{t('tenants.ecRelationship')}</Label>
                                    <Input id="ecRelationship" {...register('emergencyContact.relationship')} />
                                </div>
                            </div>
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
        </form >
    );
}

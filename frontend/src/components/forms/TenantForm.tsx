import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DialogBody, DialogFooter } from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { DatePicker } from '@/components/ui/date-picker';
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
        control,
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

    const handleFormSubmit = (data: TenantFormData) => {
        // If status is RENTING or DEPOSITED (system managed), do not send it in update
        if (data.status === 'RENTING' || data.status === 'DEPOSITED') {
            const { status, ...rest } = data;
            onSubmit(rest as TenantFormData);
        } else {
            onSubmit(data);
        }
    };

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col flex-1 overflow-hidden">
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
                            <Controller
                                control={control}
                                name="dateOfBirth"
                                render={({ field }) => (
                                    <DatePicker
                                        value={field.value}
                                        onChange={(date) => field.onChange(date ? format(date, 'yyyy-MM-dd') : '')}
                                        className={errors.dateOfBirth ? "border-destructive" : ""}
                                    />
                                )}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="gender">{t('tenants.gender')}</Label>
                            <Controller
                                control={control}
                                name="gender"
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger>
                                            <SelectValue placeholder={t('tenants.selectGender')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="MALE">{t('tenants.genderMale')}</SelectItem>
                                            <SelectItem value="FEMALE">{t('tenants.genderFemale')}</SelectItem>
                                            <SelectItem value="OTHER">{t('tenants.genderOther')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            />
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
                        <Controller
                            control={control}
                            name="status"
                            render={({ field }) => (
                                <Select
                                    onValueChange={field.onChange}
                                    value={field.value}
                                    disabled={defaultValues?.status === 'RENTING' || defaultValues?.status === 'DEPOSITED'}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder={t('tenants.selectStatus')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ACTIVE">{t('tenants.statusActive')}</SelectItem>
                                        <SelectItem value="CLOSED">{t('tenants.statusClosed')}</SelectItem>
                                        {defaultValues?.status === 'RENTING' && (
                                            <SelectItem value="RENTING">{t('tenants.statusRenting')}</SelectItem>
                                        )}
                                        {defaultValues?.status === 'DEPOSITED' && (
                                            <SelectItem value="DEPOSITED">{t('tenants.statusDeposited')}</SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            )}
                        />
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

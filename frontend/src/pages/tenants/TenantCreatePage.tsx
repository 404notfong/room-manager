import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import apiClient from '@/api/client';
import TenantForm, { TenantFormData } from '@/components/forms/TenantForm';

export default function TenantCreatePage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const createMutation = useMutation({
        mutationFn: async (data: TenantFormData) => {
            const backendData = {
                fullName: data.fullName,
                idCard: data.idNumber,
                phone: data.phone,
                email: data.email || undefined,
                dateOfBirth: data.dateOfBirth || undefined,
                gender: data.gender || undefined,
                permanentAddress: data.address || undefined,
                occupation: data.occupation || undefined,
                status: data.status || undefined,
                emergencyContact: data.emergencyContact || undefined,
            };
            const response = await apiClient.post('/tenants', backendData);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tenants'] });
            toast({ title: t('tenants.createSuccess') });
            navigate('/tenants');
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message;
            if (message === 'PHONE_EXISTS') {
                toast({ variant: 'destructive', title: t('tenants.phoneExistsError') });
            } else if (message === 'ID_CARD_EXISTS') {
                toast({ variant: 'destructive', title: t('tenants.idCardExistsError') });
            } else {
                toast({ variant: 'destructive', title: t('tenants.createError') });
            }
        },
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/tenants')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                            <Users className="h-7 w-7" />
                            {t('tenants.addTitle')}
                        </h1>
                        <p className="text-muted-foreground">{t('tenants.addDescription')}</p>
                    </div>
                </div>
                <Button type="submit" form="tenant-form" disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('common.save')}
                </Button>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <TenantForm
                        onSubmit={(data) => createMutation.mutate(data)}
                        isSubmitting={createMutation.isPending}
                        formId="tenant-form"
                    />
                </CardContent>
            </Card>
        </div>
    );
}

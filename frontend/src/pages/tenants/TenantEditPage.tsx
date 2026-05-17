import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import apiClient from '@/api/client';
import TenantForm, { TenantFormData } from '@/components/forms/TenantForm';

export default function TenantEditPage() {
    const { t } = useTranslation();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data: rawTenant, isLoading } = useQuery({
        queryKey: ['tenant', id],
        queryFn: async () => {
            const response = await apiClient.get(`/tenants/${id}`);
            return response.data;
        },
        enabled: !!id,
    });

    // Map backend fields to frontend
    const tenant = rawTenant ? {
        ...rawTenant,
        idNumber: rawTenant.idCard,
        address: rawTenant.permanentAddress,
    } : null;

    const updateMutation = useMutation({
        mutationFn: async (data: Partial<TenantFormData>) => {
            const backendData: any = {};
            if (data.fullName) backendData.fullName = data.fullName;
            if (data.phone) backendData.phone = data.phone;
            if (data.email) backendData.email = data.email;
            if (data.idNumber) backendData.idCard = data.idNumber;
            if (data.dateOfBirth) backendData.dateOfBirth = data.dateOfBirth;
            if (data.gender) backendData.gender = data.gender;
            if (data.occupation) backendData.occupation = data.occupation;
            if (data.status) backendData.status = data.status;
            if (data.emergencyContact) backendData.emergencyContact = data.emergencyContact;
            if (data.address) backendData.permanentAddress = data.address;
            const response = await apiClient.put(`/tenants/${id}`, backendData);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tenants'] });
            queryClient.invalidateQueries({ queryKey: ['tenant', id] });
            toast({ title: t('tenants.updateSuccess') });
            navigate('/tenants');
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message;
            if (message === 'PHONE_EXISTS') {
                toast({ variant: 'destructive', title: t('tenants.phoneExistsError') });
            } else if (message === 'ID_CARD_EXISTS') {
                toast({ variant: 'destructive', title: t('tenants.idCardExistsError') });
            } else {
                toast({ variant: 'destructive', title: t('tenants.updateError') });
            }
        },
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-muted-foreground">{t('common.loading')}</div>
            </div>
        );
    }

    if (!tenant) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <p className="text-muted-foreground">{t('common.notFound')}</p>
                <Button variant="outline" onClick={() => navigate('/tenants')}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {t('common.back')}
                </Button>
            </div>
        );
    }

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
                            {t('tenants.editTitle')}
                        </h1>
                        <p className="text-muted-foreground">{t('tenants.editDescription')}</p>
                    </div>
                </div>
                <Button type="submit" form="tenant-form" disabled={updateMutation.isPending}>
                    {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('common.save')}
                </Button>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <TenantForm
                        defaultValues={{
                            code: tenant.code,
                            fullName: tenant.fullName,
                            email: tenant.email,
                            phone: tenant.phone,
                            idNumber: tenant.idNumber,
                            dateOfBirth: tenant.dateOfBirth ? tenant.dateOfBirth.split('T')[0] : '',
                            gender: tenant.gender,
                            address: tenant.address,
                            occupation: tenant.occupation,
                            status: tenant.status,
                            emergencyContact: tenant.emergencyContact,
                        }}
                        onSubmit={(data) => updateMutation.mutate(data)}
                        isSubmitting={updateMutation.isPending}
                        formId="tenant-form"
                    />
                </CardContent>
            </Card>
        </div>
    );
}

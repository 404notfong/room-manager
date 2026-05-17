import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import apiClient from '@/api/client';
import ServiceForm, { ServiceFormData } from '@/components/forms/ServiceForm';

export default function ServiceEditPage() {
    const { t } = useTranslation();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data: service, isLoading } = useQuery({
        queryKey: ['service', id],
        queryFn: async () => {
            const response = await apiClient.get(`/services/${id}`);
            return response.data;
        },
        enabled: !!id,
    });

    const updateMutation = useMutation({
        mutationFn: async (data: Partial<ServiceFormData>) => {
            const response = await apiClient.put(`/services/${id}`, data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['services'] });
            queryClient.invalidateQueries({ queryKey: ['service', id] });
            toast({ title: t('services.updateSuccess') });
            navigate('/services');
        },
        onError: () => {
            toast({ variant: 'destructive', title: t('services.updateError') });
        },
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-muted-foreground">{t('common.loading')}</div>
            </div>
        );
    }

    if (!service) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <p className="text-muted-foreground">{t('common.notFound')}</p>
                <Button variant="outline" onClick={() => navigate('/services')}>
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
                    <Button variant="ghost" size="icon" onClick={() => navigate('/services')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                            <Wrench className="h-7 w-7" />
                            {t('services.editTitle')}
                        </h1>
                        <p className="text-muted-foreground">{t('services.editDescription')}</p>
                    </div>
                </div>
                <Button type="submit" form="service-form" disabled={updateMutation.isPending}>
                    {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('common.save')}
                </Button>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <ServiceForm
                        defaultValues={{
                            name: service.name,
                            unit: service.unit,
                            priceType: service.priceType || service.pricingType || 'FIXED',
                            fixedPrice: service.fixedPrice || service.unitPrice,
                            priceTiers: service.priceTiers || [],
                            buildingScope: service.buildingScope || 'ALL',
                            buildingIds: service.buildingIds?.map((b: any) =>
                                typeof b === 'string' ? b : b._id
                            ) || [],
                            isActive: service.isActive,
                        }}
                        onSubmit={(data) => updateMutation.mutate(data)}
                        isSubmitting={updateMutation.isPending}
                        formId="service-form"
                    />
                </CardContent>
            </Card>
        </div>
    );
}

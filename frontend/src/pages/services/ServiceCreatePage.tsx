import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import apiClient from '@/api/client';
import ServiceForm, { ServiceFormData } from '@/components/forms/ServiceForm';

export default function ServiceCreatePage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const createMutation = useMutation({
        mutationFn: async (data: ServiceFormData) => {
            const response = await apiClient.post('/services', data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['services'] });
            toast({ title: t('services.createSuccess') });
            navigate('/services');
        },
        onError: () => {
            toast({ variant: 'destructive', title: t('services.createError') });
        },
    });

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
                            {t('services.addTitle')}
                        </h1>
                        <p className="text-muted-foreground">{t('services.addDescription')}</p>
                    </div>
                </div>
                <Button type="submit" form="service-form" disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('common.save')}
                </Button>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <ServiceForm
                        onSubmit={(data) => createMutation.mutate(data)}
                        isSubmitting={createMutation.isPending}
                        formId="service-form"
                    />
                </CardContent>
            </Card>
        </div>
    );
}

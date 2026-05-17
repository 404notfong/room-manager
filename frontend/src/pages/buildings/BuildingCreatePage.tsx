import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import apiClient from '@/api/client';
import BuildingForm, { BuildingFormData } from '@/components/forms/BuildingForm';

export default function BuildingCreatePage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const createMutation = useMutation({
        mutationFn: async (data: BuildingFormData) => {
            const response = await apiClient.post('/buildings', data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['buildings'] });
            toast({ title: t('buildings.createSuccess') });
            navigate('/buildings');
        },
        onError: (error: any) => {
            toast({
                variant: 'destructive',
                title: t('buildings.createError'),
                description: error.response?.data?.message?.join(', ') || error.message,
            });
        },
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/buildings')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                            <Building2 className="h-7 w-7" />
                            {t('buildings.addTitle')}
                        </h1>
                        <p className="text-muted-foreground">{t('buildings.addDescription')}</p>
                    </div>
                </div>
                <Button type="submit" form="building-form" disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('common.save')}
                </Button>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <BuildingForm
                        onSubmit={(data) => createMutation.mutate(data)}
                        isSubmitting={createMutation.isPending}
                        formId="building-form"
                    />
                </CardContent>
            </Card>
        </div>
    );
}

import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import apiClient from '@/api/client';
import BuildingForm, { BuildingFormData } from '@/components/forms/BuildingForm';

export default function BuildingEditPage() {
    const { t } = useTranslation();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data: building, isLoading } = useQuery({
        queryKey: ['building', id],
        queryFn: async () => {
            const response = await apiClient.get(`/buildings/${id}`);
            return response.data;
        },
        enabled: !!id,
    });

    const updateMutation = useMutation({
        mutationFn: async (data: Partial<BuildingFormData>) => {
            const response = await apiClient.put(`/buildings/${id}`, data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['buildings'] });
            queryClient.invalidateQueries({ queryKey: ['building', id] });
            toast({ title: t('buildings.updateSuccess') });
            navigate('/buildings');
        },
        onError: (error: any) => {
            toast({
                variant: 'destructive',
                title: t('buildings.updateError'),
                description: error.response?.data?.message?.join(', ') || error.message,
            });
        },
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-muted-foreground">{t('common.loading')}</div>
            </div>
        );
    }

    if (!building) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <p className="text-muted-foreground">{t('common.notFound')}</p>
                <Button variant="outline" onClick={() => navigate('/buildings')}>
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
                    <Button variant="ghost" size="icon" onClick={() => navigate('/buildings')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                            <Building2 className="h-7 w-7" />
                            {t('buildings.editTitle')}
                        </h1>
                        <p className="text-muted-foreground">{t('buildings.editDescription')}</p>
                    </div>
                </div>
                <Button type="submit" form="building-form" disabled={updateMutation.isPending}>
                    {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('common.save')}
                </Button>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <BuildingForm
                        defaultValues={{
                            name: building.name,
                            code: building.code,
                            address: building.address,
                            description: building.description || '',
                        }}
                        onSubmit={(data) => updateMutation.mutate(data)}
                        isSubmitting={updateMutation.isPending}
                        isEditing
                        formId="building-form"
                    />
                </CardContent>
            </Card>
        </div>
    );
}

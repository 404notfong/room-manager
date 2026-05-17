import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Layers, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import apiClient from '@/api/client';
import RoomGroupForm, { RoomGroupFormData } from '@/components/forms/RoomGroupForm';
import { useBuildingStore } from '@/stores/buildingStore';

export default function RoomGroupCreatePage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { selectedBuildingId } = useBuildingStore();

    const createMutation = useMutation({
        mutationFn: async (data: RoomGroupFormData) => {
            const cleanData = {
                ...data,
                description: data.description || undefined,
                color: data.color || undefined,
            };
            const response = await apiClient.post('/room-groups', cleanData);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['room-groups'] });
            toast({ title: t('roomGroups.createSuccess') });
            navigate('/room-groups');
        },
        onError: () => {
            toast({ variant: 'destructive', title: t('roomGroups.createError') });
        },
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/room-groups')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                            <Layers className="h-7 w-7" />
                            {t('roomGroups.addTitle')}
                        </h1>
                        <p className="text-muted-foreground">{t('roomGroups.addDescription')}</p>
                    </div>
                </div>
                <Button type="submit" form="room-group-form" disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('common.save')}
                </Button>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <RoomGroupForm
                        onSubmit={(data) => createMutation.mutate(data)}
                        isSubmitting={createMutation.isPending}
                        preselectedBuildingId={selectedBuildingId}
                        formId="room-group-form"
                    />
                </CardContent>
            </Card>
        </div>
    );
}

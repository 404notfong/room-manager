import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Layers, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import apiClient from '@/api/client';
import RoomGroupForm, { RoomGroupFormData } from '@/components/forms/RoomGroupForm';

export default function RoomGroupEditPage() {
    const { t } = useTranslation();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data: roomGroup, isLoading } = useQuery({
        queryKey: ['room-group', id],
        queryFn: async () => {
            const response = await apiClient.get(`/room-groups/${id}`);
            return response.data;
        },
        enabled: !!id,
    });

    const updateMutation = useMutation({
        mutationFn: async (data: Partial<RoomGroupFormData>) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { buildingId, ...rest } = data;
            const cleanData = {
                ...rest,
                description: rest.description || undefined,
                color: rest.color || undefined,
            };
            const response = await apiClient.put(`/room-groups/${id}`, cleanData);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['room-groups'] });
            queryClient.invalidateQueries({ queryKey: ['room-group', id] });
            toast({ title: t('roomGroups.updateSuccess') });
            navigate('/room-groups');
        },
        onError: () => {
            toast({ variant: 'destructive', title: t('roomGroups.updateError') });
        },
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-muted-foreground">{t('common.loading')}</div>
            </div>
        );
    }

    if (!roomGroup) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <p className="text-muted-foreground">{t('common.notFound')}</p>
                <Button variant="outline" onClick={() => navigate('/room-groups')}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {t('common.back')}
                </Button>
            </div>
        );
    }

    const buildingId = typeof roomGroup.buildingId === 'object' ? roomGroup.buildingId._id : roomGroup.buildingId;

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
                            {t('roomGroups.editTitle')}
                        </h1>
                        <p className="text-muted-foreground">{t('roomGroups.editDescription')}</p>
                    </div>
                </div>
                <Button type="submit" form="room-group-form" disabled={updateMutation.isPending}>
                    {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('common.save')}
                </Button>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <RoomGroupForm
                        defaultValues={{
                            buildingId,
                            name: roomGroup.name,
                            description: roomGroup.description,
                            color: roomGroup.color,
                            sortOrder: roomGroup.sortOrder,
                            isActive: roomGroup.isActive,
                            code: roomGroup.code,
                        }}
                        onSubmit={(data) => updateMutation.mutate(data)}
                        isSubmitting={updateMutation.isPending}
                        isEditing
                        formId="room-group-form"
                    />
                </CardContent>
            </Card>
        </div>
    );
}

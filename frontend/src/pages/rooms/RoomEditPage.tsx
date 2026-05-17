import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, DoorOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import apiClient from '@/api/client';
import RoomForm, { RoomFormData } from '@/components/forms/RoomForm';

// Helper to clean payload before sending to API
const cleanRoomData = (data: RoomFormData): any => {
    const payload: any = { ...data };
    if (payload.roomType === 'LONG_TERM') {
        delete payload.shortTermPricingType;
        delete payload.hourlyPricingMode;
        delete payload.pricePerHour;
        delete payload.shortTermPrices;
        delete payload.fixedPrice;
    } else {
        delete payload.defaultElectricPrice;
        delete payload.defaultWaterPrice;
        delete payload.defaultRoomPrice;
        delete payload.defaultTermMonths;
        if (payload.shortTermPricingType !== 'HOURLY') {
            delete payload.hourlyPricingMode;
            delete payload.pricePerHour;
        }
        if (payload.shortTermPricingType === 'HOURLY' && payload.hourlyPricingMode === 'PER_HOUR') {
            delete payload.shortTermPrices;
        }
        if (payload.shortTermPricingType === 'HOURLY' && payload.hourlyPricingMode === 'TABLE') {
            delete payload.pricePerHour;
        }
        if (payload.shortTermPricingType !== 'FIXED') {
            delete payload.fixedPrice;
        }
    }
    return payload;
};

export default function RoomEditPage() {
    const { t } = useTranslation();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data: room, isLoading } = useQuery({
        queryKey: ['room', id],
        queryFn: async () => {
            const response = await apiClient.get(`/rooms/${id}`);
            return response.data;
        },
        enabled: !!id,
    });

    const updateMutation = useMutation({
        mutationFn: async (data: Partial<RoomFormData>) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { buildingId: _, ...updateData } = data as RoomFormData;
            const cleanData = {
                ...cleanRoomData(updateData as RoomFormData),
                roomGroupId: updateData.roomGroupId === '' ? null : (updateData.roomGroupId || undefined),
                description: updateData.description || undefined,
                area: updateData.area || undefined,
                maxOccupancy: updateData.maxOccupancy || undefined,
            };
            const response = await apiClient.put(`/rooms/${id}`, cleanData);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
            queryClient.invalidateQueries({ queryKey: ['room', id] });
            toast({ title: t('rooms.updateSuccess') });
            navigate('/rooms');
        },
        onError: () => {
            toast({ variant: 'destructive', title: t('rooms.updateError') });
        },
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-muted-foreground">{t('common.loading')}</div>
            </div>
        );
    }

    if (!room) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <p className="text-muted-foreground">{t('common.notFound')}</p>
                <Button variant="outline" onClick={() => navigate('/rooms')}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {t('common.back')}
                </Button>
            </div>
        );
    }

    const getEditDefaultValues = (): Partial<RoomFormData> => ({
        buildingId: typeof room.buildingId === 'object' ? room.buildingId._id : room.buildingId,
        roomName: room.roomName,
        floor: room.floor,
        area: room.area,
        maxOccupancy: room.maxOccupancy,
        status: room.status,
        description: room.description,
        roomGroupId: room.roomGroupId ? (typeof room.roomGroupId === 'object' ? room.roomGroupId._id : room.roomGroupId) : undefined,
        roomType: room.roomType || 'LONG_TERM',
        defaultElectricPrice: room.defaultElectricPrice,
        defaultWaterPrice: room.defaultWaterPrice,
        defaultRoomPrice: room.defaultRoomPrice,
        defaultTermMonths: room.defaultTermMonths,
        shortTermPricingType: room.shortTermPricingType,
        hourlyPricingMode: room.hourlyPricingMode,
        pricePerHour: room.pricePerHour,
        shortTermPrices: (!room.shortTermPrices || room.shortTermPrices.length === 0)
            ? [{ fromValue: 1, toValue: 1, price: 0 }, { fromValue: 2, toValue: -1, price: 0 }]
            : room.shortTermPrices,
        priceTableType: room.priceTableType || 'PROGRESSIVE',
        fixedPrice: room.fixedPrice,
        currentElectricIndex: room.currentElectricIndex || 0,
        currentWaterIndex: room.currentWaterIndex || 0,
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/rooms')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                            <DoorOpen className="h-7 w-7" />
                            {t('rooms.editTitle')}
                        </h1>
                        <p className="text-muted-foreground">{t('rooms.editDescription')}</p>
                    </div>
                </div>
                <Button type="submit" form="room-form" disabled={updateMutation.isPending}>
                    {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('common.save')}
                </Button>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <RoomForm
                        defaultValues={getEditDefaultValues()}
                        onSubmit={(data) => updateMutation.mutate(data)}
                        isSubmitting={updateMutation.isPending}
                        isEditing={true}
                        roomCode={room.roomCode}
                        currentStatus={room.status}
                        formId="room-form"
                    />
                </CardContent>
            </Card>
        </div>
    );
}

import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, DoorOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import apiClient from '@/api/client';
import RoomForm, { RoomFormData } from '@/components/forms/RoomForm';
import { useBuildingStore } from '@/stores/buildingStore';

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

export default function RoomCreatePage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { selectedBuildingId } = useBuildingStore();
    const [searchParams] = useSearchParams();

    // Support duplicate: pass source room id via ?duplicate=roomId
    const duplicateId = searchParams.get('duplicate');

    const { data: duplicateRoom } = useQuery({
        queryKey: ['room', duplicateId],
        queryFn: async () => {
            const response = await apiClient.get(`/rooms/${duplicateId}`);
            return response.data;
        },
        enabled: !!duplicateId,
    });

    const getDuplicateDefaults = (): Partial<RoomFormData> | undefined => {
        if (!duplicateRoom) return undefined;
        const room = duplicateRoom;
        return {
            buildingId: typeof room.buildingId === 'object' ? room.buildingId._id : room.buildingId,
            roomName: `${room.roomName} - copy`,
            floor: room.floor,
            area: room.area,
            maxOccupancy: room.maxOccupancy,
            status: 'AVAILABLE',
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
        };
    };

    const createMutation = useMutation({
        mutationFn: async (data: RoomFormData) => {
            const cleanData = {
                ...cleanRoomData(data),
                roomGroupId: data.roomGroupId || undefined,
                description: data.description || undefined,
                area: data.area || undefined,
                maxOccupancy: data.maxOccupancy || undefined,
            };
            const response = await apiClient.post('/rooms', cleanData);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
            toast({ title: t('rooms.createSuccess') });
            navigate('/rooms');
        },
        onError: () => {
            toast({ variant: 'destructive', title: t('rooms.createError') });
        },
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
                            {t('rooms.addTitle')}
                        </h1>
                        <p className="text-muted-foreground">{t('rooms.addDescription')}</p>
                    </div>
                </div>
                <Button type="submit" form="room-form" disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('common.save')}
                </Button>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <RoomForm
                        defaultValues={getDuplicateDefaults()}
                        onSubmit={(data) => createMutation.mutate(data)}
                        isSubmitting={createMutation.isPending}
                        preselectedBuildingId={selectedBuildingId}
                        formId="room-form"
                    />
                </CardContent>
            </Card>
        </div>
    );
}

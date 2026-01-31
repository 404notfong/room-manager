import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi, GetNotificationsParams } from '@/api/notifications.api';

export const useNotifications = (params: GetNotificationsParams = { page: 1, limit: 10 }) => {
    return useQuery({
        queryKey: ['notifications', params],
        queryFn: () => notificationsApi.getAll(params),
        refetchInterval: 30000, // Poll every 30s
    });
};

export const useUnreadCount = () => {
    return useQuery({
        queryKey: ['notifications', 'unread-count'],
        queryFn: notificationsApi.getUnreadCount,
        refetchInterval: 30000, // Poll every 30s
    });
};

export const useMarkNotificationRead = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: notificationsApi.markAsRead,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });
};

export const useMarkAllNotificationsRead = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: notificationsApi.markAllAsRead,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });
};

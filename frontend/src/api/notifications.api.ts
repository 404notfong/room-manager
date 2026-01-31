import apiClient from '@/api/client';

export enum NotificationType {
    SYSTEM = 'SYSTEM',
    INVOICE = 'INVOICE',
    CONTRACT = 'CONTRACT',
    PAYMENT = 'PAYMENT',
    SERVICE = 'SERVICE'
}

export interface Notification {
    _id: string;
    userId: string;
    title: string;
    message: string;
    type: NotificationType;
    isRead: boolean;
    metadata?: Record<string, any>;
    createdAt: string;
    updatedAt: string;
}

export interface GetNotificationsParams {
    page?: number;
    limit?: number;
}

export interface GetNotificationsResponse {
    notifications: Notification[];
    total: number;
    page: number;
    totalPages: number;
}

export const notificationsApi = {
    getAll: async (params?: GetNotificationsParams) => {
        const response = await apiClient.get<GetNotificationsResponse>('/notifications', { params });
        return response.data;
    },

    getUnreadCount: async () => {
        const response = await apiClient.get<number>('/notifications/unread-count');
        return response.data;
    },

    markAsRead: async (id: string) => {
        const response = await apiClient.patch<Notification>(`/notifications/${id}/read`);
        return response.data;
    },

    markAllAsRead: async () => {
        const response = await apiClient.patch<void>('/notifications/read-all');
        return response.data;
    },
};

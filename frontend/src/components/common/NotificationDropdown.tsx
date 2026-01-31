import { useState } from 'react';
import { Bell, Check, Info, FileText, Receipt, ShieldAlert } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useNotifications, useUnreadCount, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/hooks/useNotifications';
import { NotificationType } from '@/api/notifications.api';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export function NotificationDropdown() {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);

    const { data: notificationsData, isLoading } = useNotifications({ page: 1, limit: 10 });
    const { data: unreadCount } = useUnreadCount();
    const { mutate: markAsRead } = useMarkNotificationRead();
    const { mutate: markAllAsRead } = useMarkAllNotificationsRead();

    // Icon mapping based on type
    const getIcon = (type: NotificationType) => {
        switch (type) {
            case NotificationType.INVOICE: return <Receipt className="h-4 w-4 text-orange-500" />;
            case NotificationType.CONTRACT: return <FileText className="h-4 w-4 text-blue-500" />;
            case NotificationType.SYSTEM: return <ShieldAlert className="h-4 w-4 text-red-500" />;
            case NotificationType.SERVICE: return <Info className="h-4 w-4 text-purple-500" />;
            default: return <Info className="h-4 w-4 text-gray-500" />;
        }
    };

    const handleItemClick = (notification: any) => {
        if (!notification.isRead) {
            markAsRead(notification._id);
        }
        // Navigate based on type/metadata if needed
        // For now just close
        setIsOpen(false);
    };

    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full text-muted-foreground hover:text-foreground">
                    <Bell className="h-5 w-5" />
                    {unreadCount && unreadCount > 0 ? (
                        <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-red-600 border-2 border-background animate-pulse" />
                    ) : null}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b">
                    <h4 className="font-semibold text-sm">{t('notifications.title', 'Thông báo')}</h4>
                    {unreadCount && unreadCount > 0 ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-1 text-xs text-primary hover:text-primary/80 h-6"
                            onClick={(e) => {
                                e.preventDefault();
                                markAllAsRead();
                            }}
                        >
                            {t('notifications.markAllRead', 'Đọc tất cả')}
                        </Button>
                    ) : null}
                </div>

                <div className="max-h-[350px] overflow-y-auto">
                    {isLoading ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
                    ) : notificationsData?.notifications?.length === 0 ? (
                        <div className="p-8 text-center bg-muted/10">
                            <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                            <p className="text-sm text-muted-foreground">{t('notifications.empty', 'Không có thông báo mới')}</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {notificationsData?.notifications.map((notification) => (
                                <div
                                    key={notification._id}
                                    className={cn(
                                        "flex gap-3 p-3 hover:bg-muted/50 transition-colors cursor-pointer relative group",
                                        !notification.isRead && "bg-blue-50/50 dark:bg-blue-900/10"
                                    )}
                                    onClick={() => handleItemClick(notification)}
                                >
                                    <div className={cn(
                                        "mt-1 h-8 w-8 shrink-0 rounded-full flex items-center justify-center bg-background border shadow-sm",
                                        !notification.isRead && "border-blue-200 dark:border-blue-800"
                                    )}>
                                        {getIcon(notification.type)}
                                    </div>
                                    <div className="flex-1 space-y-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className={cn("text-sm font-medium leading-none truncate", !notification.isRead && "text-foreground")}>
                                                {notification.title}
                                            </p>
                                            <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                                                {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: vi })}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground line-clamp-2">
                                            {notification.message}
                                        </p>
                                    </div>
                                    {!notification.isRead && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 rounded-full hover:bg-background shadow-sm border"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    markAsRead(notification._id);
                                                }}
                                            >
                                                <Check className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <DropdownMenuSeparator className="m-0" />
                <div className="p-1 bg-muted/30">
                    <Button variant="ghost" size="sm" className="w-full text-xs h-8 text-muted-foreground">
                        {t('notifications.viewAll', 'Xem tất cả')}
                    </Button>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

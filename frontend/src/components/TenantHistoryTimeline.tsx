import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { FileText, Receipt, Banknote, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import apiClient from '@/api/client';

interface HistoryEvent {
    type: 'contract' | 'invoice' | 'payment';
    date: string;
    title: string;
    data: any;
}

interface HistoryResponse {
    data: HistoryEvent[];
    meta: { total: number; page: number; limit: number; totalPages: number };
}

interface TenantHistoryTimelineProps {
    tenantId: string;
}

const EVENT_CONFIG = {
    contract: {
        icon: FileText,
        color: 'bg-blue-500',
        borderColor: 'border-blue-500',
        lightBg: 'bg-blue-50 dark:bg-blue-950/30',
    },
    invoice: {
        icon: Receipt,
        color: 'bg-orange-500',
        borderColor: 'border-orange-500',
        lightBg: 'bg-orange-50 dark:bg-orange-950/30',
    },
    payment: {
        icon: Banknote,
        color: 'bg-green-500',
        borderColor: 'border-green-500',
        lightBg: 'bg-green-50 dark:bg-green-950/30',
    },
};

function formatCurrency(amount: number): string {
    return amount.toLocaleString('vi-VN') + ' đ';
}

export default function TenantHistoryTimeline({ tenantId }: TenantHistoryTimelineProps) {
    const { t } = useTranslation();

    const { data: historyData, isLoading } = useQuery<HistoryResponse>({
        queryKey: ['tenant-history', tenantId],
        queryFn: () => apiClient.get(`/tenants/${tenantId}/history`, { params: { limit: 50 } }).then(res => res.data),
        enabled: !!tenantId,
    });

    const events = historyData?.data || [];

    if (isLoading) {
        return (
            <div className="space-y-4 p-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-3 animate-pulse">
                        <div className="w-8 h-8 rounded-full bg-muted" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-muted rounded w-1/3" />
                            <div className="h-3 bg-muted rounded w-1/2" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (events.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mb-3 opacity-40" />
                <p className="text-sm">{t('tenants.history.noHistory')}</p>
            </div>
        );
    }

    return (
        <div className="relative pl-6 space-y-0">
            {/* Timeline vertical line */}
            <div className="absolute left-[15px] top-2 bottom-2 w-[2px] bg-border" />

            {events.map((event, index) => {
                const config = EVENT_CONFIG[event.type];
                const Icon = config.icon;
                const date = new Date(event.date);

                return (
                    <div key={`${event.type}-${index}`} className="relative flex gap-3 pb-6 last:pb-0">
                        {/* Dot */}
                        <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full ${config.color} text-white shrink-0 -ml-6`}>
                            <Icon className="h-4 w-4" />
                        </div>

                        {/* Content */}
                        <div className={`flex-1 rounded-lg border p-3 ${config.lightBg}`}>
                            <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-sm">{event.title}</span>
                                <span className="text-xs text-muted-foreground">
                                    {date.toLocaleDateString()}
                                </span>
                            </div>

                            {/* Event-specific details */}
                            {event.type === 'contract' && (
                                <div className="text-xs text-muted-foreground space-y-0.5">
                                    <div>{t('tenants.history.room')}: <span className="font-medium text-foreground">{event.data.roomName}</span></div>
                                    <div>{t('tenants.history.rent')}: <span className="font-medium text-foreground">{formatCurrency(event.data.rentPrice)}</span></div>
                                    <Badge variant="outline" className="mt-1 text-[10px] h-5">{event.data.status}</Badge>
                                </div>
                            )}

                            {event.type === 'invoice' && (
                                <div className="text-xs text-muted-foreground space-y-0.5">
                                    <div>{t('tenants.history.amount')}: <span className="font-medium text-foreground">{formatCurrency(event.data.totalAmount)}</span></div>
                                    {event.data.billingPeriod && (
                                        <div>{t('tenants.history.period')}: {event.data.billingPeriod.month}/{event.data.billingPeriod.year}</div>
                                    )}
                                    <Badge variant="outline" className="mt-1 text-[10px] h-5">{event.data.status}</Badge>
                                </div>
                            )}

                            {event.type === 'payment' && (
                                <div className="text-xs text-muted-foreground space-y-0.5">
                                    <div>{t('tenants.history.amount')}: <span className="font-medium text-foreground">{formatCurrency(event.data.amount)}</span></div>
                                    <div>{t('tenants.history.method')}: <span className="font-medium text-foreground">{event.data.paymentMethod}</span></div>
                                    {event.data.invoiceNumber && (
                                        <div>Invoice: #{event.data.invoiceNumber}</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

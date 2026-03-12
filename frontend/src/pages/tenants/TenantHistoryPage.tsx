import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileText, Receipt, Banknote, Clock, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import apiClient from '@/api/client';
import Pagination from '@/components/Pagination';

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

const EVENT_CONFIG = {
    contract: {
        icon: FileText,
        color: 'bg-blue-500',
        lightBg: 'bg-blue-50 dark:bg-blue-950/30',
        borderColor: 'border-blue-200 dark:border-blue-800',
        label: 'Contract',
    },
    invoice: {
        icon: Receipt,
        color: 'bg-orange-500',
        lightBg: 'bg-orange-50 dark:bg-orange-950/30',
        borderColor: 'border-orange-200 dark:border-orange-800',
        label: 'Invoice',
    },
    payment: {
        icon: Banknote,
        color: 'bg-green-500',
        lightBg: 'bg-green-50 dark:bg-green-950/30',
        borderColor: 'border-green-200 dark:border-green-800',
        label: 'Payment',
    },
};

function formatCurrency(amount: number): string {
    return amount.toLocaleString('vi-VN') + ' đ';
}

export default function TenantHistoryPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [startDate, setStartDate] = useState<Date | undefined>(undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(undefined);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

    // Fetch tenant info
    const { data: tenant } = useQuery({
        queryKey: ['tenant', id],
        queryFn: () => apiClient.get(`/tenants/${id}`).then(res => res.data),
        enabled: !!id,
    });

    // Fetch history
    const queryParams: any = { page: currentPage, limit: pageSize };
    if (typeFilter !== 'all') queryParams.type = typeFilter;
    if (startDate) queryParams.startDate = startDate.toISOString().split('T')[0];
    if (endDate) queryParams.endDate = endDate.toISOString().split('T')[0];

    const { data: historyData, isLoading } = useQuery<HistoryResponse>({
        queryKey: ['tenant-history-page', id, typeFilter, startDate, endDate, currentPage, pageSize],
        queryFn: () => apiClient.get(`/tenants/${id}/history`, { params: queryParams }).then(res => res.data),
        enabled: !!id,
    });

    const events = historyData?.data || [];
    const meta = historyData?.meta || { total: 0, page: 1, limit: 10, totalPages: 0 };

    const toggleExpand = (index: number) => {
        setExpandedIndex(expandedIndex === index ? null : index);
    };

    const handleTypeChange = (value: string) => {
        setTypeFilter(value);
        setCurrentPage(1);
    };

    const handleDateChange = (field: 'start' | 'end', value: Date | undefined) => {
        if (field === 'start') setStartDate(value);
        else setEndDate(value);
        setCurrentPage(1);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/tenants')}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        {tenant?.fullName || '...'} — {t('tenants.history.title')}
                    </h1>
                    <p className="text-muted-foreground">
                        {t('tenants.history.eventsCount', { count: meta.total })}
                    </p>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            <Select value={typeFilter} onValueChange={handleTypeChange}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder={t('tenants.history.filterByType')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{t('tenants.history.allTypes')}</SelectItem>
                                    <SelectItem value="contract">
                                        <span className="flex items-center gap-2">
                                            <FileText className="h-3 w-3 text-blue-500" /> Contract
                                        </span>
                                    </SelectItem>
                                    <SelectItem value="invoice">
                                        <span className="flex items-center gap-2">
                                            <Receipt className="h-3 w-3 text-orange-500" /> Invoice
                                        </span>
                                    </SelectItem>
                                    <SelectItem value="payment">
                                        <span className="flex items-center gap-2">
                                            <Banknote className="h-3 w-3 text-green-500" /> Payment
                                        </span>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2">
                            <DatePicker
                                value={startDate}
                                onChange={(date) => handleDateChange('start', date)}
                                className="w-[180px]"
                                placeholder={t('tenants.history.startDate')}
                            />
                            <span className="text-muted-foreground">→</span>
                            <DatePicker
                                value={endDate}
                                onChange={(date) => handleDateChange('end', date)}
                                className="w-[180px]"
                                placeholder={t('tenants.history.endDate')}
                            />
                        </div>
                        {(typeFilter !== 'all' || startDate || endDate) && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setTypeFilter('all');
                                    setStartDate(undefined);
                                    setEndDate(undefined);
                                    setCurrentPage(1);
                                }}
                            >
                                {t('common.clearAll')}
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        {t('tenants.history.title')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex gap-3 animate-pulse">
                                    <div className="w-10 h-10 rounded-full bg-muted shrink-0" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 bg-muted rounded w-1/3" />
                                        <div className="h-3 bg-muted rounded w-1/2" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : events.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                            <Clock className="h-16 w-16 mb-4 opacity-30" />
                            <p className="text-lg">{t('tenants.history.noHistory')}</p>
                        </div>
                    ) : (
                        <div className="relative pl-8 space-y-0">
                            {/* Timeline line */}
                            <div className="absolute left-[19px] top-2 bottom-2 w-[2px] bg-border" />

                            {events.map((event, index) => {
                                const config = EVENT_CONFIG[event.type];
                                const Icon = config.icon;
                                const date = new Date(event.date);
                                const isExpanded = expandedIndex === index;

                                return (
                                    <div key={`${event.type}-${index}`} className="relative pb-6 last:pb-0">
                                        {/* Dot */}
                                        <div className={`absolute left-0 z-10 flex items-center justify-center w-10 h-10 rounded-full ${config.color} text-white -ml-8`}>
                                            <Icon className="h-5 w-5" />
                                        </div>

                                        {/* Card */}
                                        <div
                                            className={`ml-6 border rounded-lg cursor-pointer transition-all hover:shadow-md ${config.lightBg} ${config.borderColor}`}
                                            onClick={() => toggleExpand(index)}
                                        >
                                            {/* Collapsed header */}
                                            <div className="flex items-center justify-between p-4">
                                                <div className="flex items-center gap-3">
                                                    <div>
                                                        <span className="font-medium">{event.title}</span>
                                                        <Badge variant="outline" className="ml-2 text-[10px]">
                                                            {event.type}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <span>{date.toLocaleDateString()}</span>
                                                    {isExpanded ? (
                                                        <ChevronUp className="h-4 w-4" />
                                                    ) : (
                                                        <ChevronDown className="h-4 w-4" />
                                                    )}
                                                </div>
                                            </div>

                                            {/* Expanded details */}
                                            {isExpanded && (
                                                <div className="px-4 pb-4 border-t border-border/50 pt-3">
                                                    {event.type === 'contract' && (
                                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                                            <div>
                                                                <p className="text-muted-foreground">{t('tenants.history.room')}</p>
                                                                <p className="font-medium">{event.data.roomName}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-muted-foreground">{t('tenants.history.rent')}</p>
                                                                <p className="font-medium">{formatCurrency(event.data.rentPrice)}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-muted-foreground">{t('tenants.history.status')}</p>
                                                                <Badge variant="outline">{event.data.status}</Badge>
                                                            </div>
                                                            {event.data.startDate && (
                                                                <div>
                                                                    <p className="text-muted-foreground">{t('tenants.history.period')}</p>
                                                                    <p className="font-medium">
                                                                        {new Date(event.data.startDate).toLocaleDateString()} → {event.data.endDate ? new Date(event.data.endDate).toLocaleDateString() : '-'}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {event.type === 'invoice' && (
                                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                                            <div>
                                                                <p className="text-muted-foreground">{t('tenants.history.amount')}</p>
                                                                <p className="font-medium">{formatCurrency(event.data.totalAmount)}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-muted-foreground">{t('tenants.history.status')}</p>
                                                                <Badge variant="outline">{event.data.status}</Badge>
                                                            </div>
                                                            {event.data.billingPeriod && (
                                                                <div>
                                                                    <p className="text-muted-foreground">{t('tenants.history.period')}</p>
                                                                    <p className="font-medium">{event.data.billingPeriod.month}/{event.data.billingPeriod.year}</p>
                                                                </div>
                                                            )}
                                                            {event.data.dueDate && (
                                                                <div>
                                                                    <p className="text-muted-foreground">{t('tenants.history.dueDate')}</p>
                                                                    <p className="font-medium">{new Date(event.data.dueDate).toLocaleDateString()}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {event.type === 'payment' && (
                                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                                            <div>
                                                                <p className="text-muted-foreground">{t('tenants.history.amount')}</p>
                                                                <p className="font-medium">{formatCurrency(event.data.amount)}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-muted-foreground">{t('tenants.history.method')}</p>
                                                                <p className="font-medium">{event.data.paymentMethod}</p>
                                                            </div>
                                                            {event.data.invoiceNumber && (
                                                                <div className="col-span-2">
                                                                    <p className="text-muted-foreground">Invoice #</p>
                                                                    <p className="font-medium">{event.data.invoiceNumber}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Pagination */}
                    {meta.total > 0 && (
                        <Pagination
                            currentPage={currentPage}
                            totalPages={meta.totalPages}
                            pageSize={pageSize}
                            totalItems={meta.total}
                            onPageChange={setCurrentPage}
                            onPageSizeChange={(size) => {
                                setPageSize(size);
                                setCurrentPage(1);
                            }}
                        />
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

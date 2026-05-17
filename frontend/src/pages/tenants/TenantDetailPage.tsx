import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Phone, Shield, AlertTriangle, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import apiClient from '@/api/client';
import TenantHistoryTimeline from '@/components/TenantHistoryTimeline';
import { formatPhoneNumber } from '@/lib/utils';

export default function TenantDetailPage() {
    const { t } = useTranslation();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const { data: rawTenant, isLoading } = useQuery({
        queryKey: ['tenant', id],
        queryFn: async () => {
            const response = await apiClient.get(`/tenants/${id}`);
            return response.data;
        },
        enabled: !!id,
    });

    const tenant = rawTenant ? {
        ...rawTenant,
        idNumber: rawTenant.idCard,
        address: rawTenant.permanentAddress,
    } : null;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-muted-foreground">{t('common.loading')}</div>
            </div>
        );
    }

    if (!tenant) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <p className="text-muted-foreground">{t('common.notFound')}</p>
                <Button variant="outline" onClick={() => navigate('/tenants')}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    {t('common.back')}
                </Button>
            </div>
        );
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'RENTING': return 'bg-blue-500 hover:bg-blue-600';
            case 'ACTIVE': return 'bg-green-500 hover:bg-green-600';
            case 'DEPOSITED': return 'bg-orange-500 hover:bg-orange-600';
            default: return 'bg-gray-500 hover:bg-gray-600';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'RENTING': return t('tenants.statusRenting');
            case 'ACTIVE': return t('tenants.statusActive');
            case 'DEPOSITED': return t('tenants.statusDeposited');
            default: return t('tenants.statusClosed');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/tenants')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                {tenant.fullName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">{tenant.fullName}</h1>
                            <p className="text-muted-foreground font-mono text-sm">{tenant.code}</p>
                        </div>
                    </div>
                </div>
                <Button onClick={() => navigate(`/tenants/${id}/edit`)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    {t('common.edit')}
                </Button>
            </div>

            <Card>
                <CardContent className="pt-6">
                    <Tabs defaultValue="info">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="info">{t('tenants.info')}</TabsTrigger>
                            <TabsTrigger value="history">{t('tenants.history.title')}</TabsTrigger>
                        </TabsList>
                        <TabsContent value="info" className="mt-4">
                            <div className="space-y-5">
                                {/* Contact */}
                                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                                    <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                        <Phone className="h-3.5 w-3.5" />
                                        {t('tenants.contact') || 'Contact'}
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-muted-foreground">{t('tenants.phone')}</p>
                                            <p className="text-sm font-medium">{formatPhoneNumber(tenant.phone)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">{t('tenants.email')}</p>
                                            <p className="text-sm font-medium">{tenant.email || '-'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Personal Info */}
                                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                                    <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                        <Shield className="h-3.5 w-3.5" />
                                        {t('tenants.personalInfo') || 'Personal Info'}
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-muted-foreground">{t('tenants.idNumber')}</p>
                                            <p className="text-sm font-medium">{tenant.idNumber || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">{t('tenants.dateOfBirth')}</p>
                                            <p className="text-sm font-medium">
                                                {tenant.dateOfBirth ? new Date(tenant.dateOfBirth).toLocaleDateString() : '-'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">{t('tenants.gender')}</p>
                                            <p className="text-sm font-medium">
                                                {tenant.gender === 'MALE' ? t('tenants.genderMale')
                                                    : tenant.gender === 'FEMALE' ? t('tenants.genderFemale')
                                                        : tenant.gender === 'OTHER' ? t('tenants.genderOther') : '-'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">{t('tenants.occupation')}</p>
                                            <p className="text-sm font-medium">{tenant.occupation || '-'}</p>
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-xs text-muted-foreground">{t('tenants.address')}</p>
                                            <p className="text-sm font-medium">{tenant.address || '-'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Status */}
                                <div className="rounded-lg border bg-muted/30 p-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-muted-foreground">{t('common.status')}</p>
                                            <Badge className={`mt-1 ${getStatusColor(tenant.status)}`}>
                                                {getStatusLabel(tenant.status)}
                                            </Badge>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">{t('tenants.createdAt')}</p>
                                            <p className="text-sm font-medium mt-1">{new Date(tenant.createdAt).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Emergency Contact */}
                                {tenant.emergencyContact && (
                                    <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-4 space-y-3">
                                        <h4 className="text-sm font-medium text-orange-400 flex items-center gap-2">
                                            <AlertTriangle className="h-3.5 w-3.5" />
                                            {t('tenants.emergencyContact')}
                                        </h4>
                                        <div className="grid grid-cols-3 gap-3">
                                            <div>
                                                <p className="text-xs text-muted-foreground">{t('tenants.ecName')}</p>
                                                <p className="text-sm font-medium">{tenant.emergencyContact.name || '-'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">{t('tenants.ecPhone')}</p>
                                                <p className="text-sm font-medium">{tenant.emergencyContact.phone || '-'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">{t('tenants.ecRelationship')}</p>
                                                <p className="text-sm font-medium">{tenant.emergencyContact.relationship || '-'}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                        <TabsContent value="history" className="mt-4">
                            <div className="space-y-4">
                                <TenantHistoryTimeline tenantId={tenant._id} />
                                <div className="text-center">
                                    <Button
                                        variant="link"
                                        onClick={() => navigate(`/tenants/${tenant._id}/history`)}
                                    >
                                        {t('tenants.history.viewAll')}
                                    </Button>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}

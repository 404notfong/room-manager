import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Calendar, FileText, Zap, Droplets, Package, Home, Download, Loader2, Wallet } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

import {
    Dialog,
    DialogContent,
    DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPhoneNumber } from '@/lib/utils';

interface ContractViewModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    contract: any;
}

export default function ContractViewModal({ open, onOpenChange, contract }: ContractViewModalProps) {
    const { t } = useTranslation();
    const contentRef = useRef<HTMLDivElement>(null);
    const [isExporting, setIsExporting] = useState(false);

    if (!contract) return null;

    const formatCurrency = (amount: number | undefined) => {
        if (amount === undefined || amount === null) return '-';
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    const formatDate = (date: string | undefined) => {
        if (!date) return '-';
        return new Date(date).toLocaleDateString('vi-VN');
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ACTIVE':
                return <Badge className="bg-emerald-500 text-white border-0">{t('contracts.statusActive')}</Badge>;
            case 'EXPIRED':
                return <Badge className="bg-gray-500 text-white border-0">{t('contracts.statusExpired')}</Badge>;
            case 'TERMINATED':
                return <Badge className="bg-red-500 text-white border-0">{t('contracts.statusTerminated')}</Badge>;
            case 'DRAFT':
                return <Badge className="bg-amber-500 text-white border-0">{t('contracts.statusDraft')}</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const getContractTypeBadge = () => {
        const roomType = contract.roomType || contract.contractType;
        if (roomType === 'LONG_TERM') {
            return <Badge variant="outline" className="border-blue-500 text-blue-600 bg-blue-50">{t('contracts.roomTypeLongTerm')}</Badge>;
        }
        return <Badge variant="outline" className="border-orange-500 text-orange-600 bg-orange-50">{t('contracts.roomTypeShortTerm')}</Badge>;
    };

    const getPaymentCycleLabel = () => {
        const type = contract.roomType || contract.contractType;
        if (type === 'SHORT_TERM') {
            switch (contract.shortTermPricingType) {
                case 'HOURLY': return t('rooms.pricingHourly');
                case 'DAILY': return t('rooms.pricingDaily');
                case 'FIXED': return t('rooms.pricingFixed');
                default: return '-';
            }
        }

        switch (contract.paymentCycle) {
            case 'MONTHLY': return t('contracts.cycleMonthly');
            case 'MONTHLY_2': return t('contracts.cycleMonthly2');
            case 'QUARTERLY': return t('contracts.cycleQuarterly');
            case 'MONTHLY_6': return t('contracts.cycleHalfYearly');
            case 'MONTHLY_12': return t('contracts.cycleYearly');
            case 'CUSTOM': return `${contract.paymentCycleMonths} ${t('rooms.month')}`;
            default: return contract.paymentCycle;
        }
    };

    const getTotalServices = () => {
        if (!contract.serviceCharges || !Array.isArray(contract.serviceCharges)) return 0;
        return contract.serviceCharges.reduce((sum: number, service: any) => sum + (service.amount * (service.quantity || 1)), 0);
    };

    const handleExportPDF = async () => {
        if (!contentRef.current) return;

        setIsExporting(true);
        try {
            const canvas = await html2canvas(contentRef.current, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4',
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
            const imgX = (pdfWidth - imgWidth * ratio) / 2;
            const imgY = 10;

            pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
            pdf.save(`${contract.contractCode || 'contract'}.pdf`);
        } catch (error) {
            console.error('Error exporting PDF:', error);
        } finally {
            setIsExporting(false);
        }
    };

    const isLongTerm = (contract.roomType || contract.contractType) === 'LONG_TERM';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0"
                hideCloseButton
            >
                {/* Scrollable content area */}
                <div className="flex-1 overflow-y-auto">
                    <div ref={contentRef}>
                        {/* Header with gradient */}
                        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="h-14 w-14 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                                        <FileText className="h-7 w-7" />
                                    </div>
                                    <div>
                                        <p className="text-blue-100 text-sm">{t('contracts.code')}</p>
                                        <h2 className="text-2xl font-bold tracking-wide">{contract.contractCode}</h2>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    {getStatusBadge(contract.status)}
                                    {getContractTypeBadge()}
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-5 bg-white">
                            {/* Room & Period Info - Card style */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 rounded-xl p-4 border">
                                    <div className="flex items-center gap-2 text-blue-600 mb-3">
                                        <Home className="h-4 w-4" />
                                        <span className="font-semibold text-sm">{t('contracts.roomInfo')}</span>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">{t('buildings.label')}</span>
                                            <span className="font-semibold">{contract.roomId?.buildingId?.name || '-'}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">{t('rooms.label')}</span>
                                            <span className="font-semibold text-blue-600">{contract.roomId?.roomName || contract.roomId?.roomCode || '-'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-slate-50 rounded-xl p-4 border">
                                    <div className="flex items-center gap-2 text-blue-600 mb-3">
                                        <Calendar className="h-4 w-4" />
                                        <span className="font-semibold text-sm">{t('contracts.period')}</span>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">{t('contracts.startDate')}</span>
                                            <span className="font-semibold">{formatDate(contract.startDate)}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">{t('contracts.endDate')}</span>
                                            <span className="font-semibold">{contract.endDate ? formatDate(contract.endDate) : t('contracts.noEndDate')}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">{t('contracts.paymentCycle')}</span>
                                            <span className="font-semibold text-emerald-600">{getPaymentCycleLabel()}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Deposit - Separate section */}
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                                        <Wallet className="h-5 w-5 text-amber-600" />
                                    </div>
                                    <span className="font-semibold text-amber-800">{t('contracts.deposit')}</span>
                                </div>
                                <span className="text-xl font-bold text-amber-700">{formatCurrency(contract.depositAmount)}</span>
                            </div>

                            {/* Tenant Info - Consistent text labels */}
                            <div className="border rounded-xl overflow-hidden">
                                <div className="bg-blue-50 px-4 py-2.5 border-b flex items-center gap-2">
                                    <User className="h-4 w-4 text-blue-600" />
                                    <span className="font-semibold text-sm text-blue-700">{t('contracts.tenantInfo')}</span>
                                </div>
                                <div className="p-4 bg-white">
                                    <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                                        <div className="flex gap-2">
                                            <span className="text-muted-foreground min-w-[100px]">{t('tenants.fullName')}:</span>
                                            <span className="font-semibold">{contract.tenantId?.fullName || '-'}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <span className="text-muted-foreground min-w-[100px]">{t('tenants.phone')}:</span>
                                            <span className="font-semibold text-blue-600">{formatPhoneNumber(contract.tenantId?.phone)}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <span className="text-muted-foreground min-w-[100px]">{t('tenants.idNumber')}:</span>
                                            <span className="font-medium">{contract.tenantId?.idCard || '-'}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <span className="text-muted-foreground min-w-[100px]">{t('tenants.email')}:</span>
                                            <span className="font-medium">{contract.tenantId?.email || '-'}</span>
                                        </div>
                                        {contract.tenantId?.permanentAddress && (
                                            <div className="flex gap-2 col-span-2">
                                                <span className="text-muted-foreground min-w-[100px]">{t('tenants.address')}:</span>
                                                <span className="font-medium">{contract.tenantId.permanentAddress}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Utilities Table - Long term only */}
                            {isLongTerm && (
                                <div className="border rounded-xl overflow-hidden">
                                    <div className="bg-amber-50 px-4 py-2.5 border-b flex items-center gap-2">
                                        <Zap className="h-4 w-4 text-amber-600" />
                                        <span className="font-semibold text-sm text-amber-700">{t('contracts.utilitiesInfo')}</span>
                                    </div>
                                    <table className="w-full text-sm bg-white">
                                        <thead>
                                            <tr className="border-b bg-slate-50">
                                                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t('common.item')}</th>
                                                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">{t('contracts.initialIndex')}</th>
                                                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">{t('contracts.unitPrice')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="border-b">
                                                <td className="px-4 py-3 flex items-center gap-2">
                                                    <Zap className="h-4 w-4 text-yellow-500" />
                                                    <span>{t('contracts.electricity')}</span>
                                                </td>
                                                <td className="text-right px-4 py-3 font-medium">{contract.initialElectricIndex ?? 0}</td>
                                                <td className="text-right px-4 py-3 font-semibold text-amber-600">{formatCurrency(contract.electricityPrice)}/{t('contracts.unitIndex')}</td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-3 flex items-center gap-2">
                                                    <Droplets className="h-4 w-4 text-blue-500" />
                                                    <span>{t('contracts.water')}</span>
                                                </td>
                                                <td className="text-right px-4 py-3 font-medium">{contract.initialWaterIndex ?? 0}</td>
                                                <td className="text-right px-4 py-3 font-semibold text-blue-600">{formatCurrency(contract.waterPrice)}/{t('contracts.unitIndex')}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Services Table */}
                            {contract.serviceCharges && contract.serviceCharges.length > 0 && (
                                <div className="border rounded-xl overflow-hidden">
                                    <div className="bg-purple-50 px-4 py-2.5 border-b flex items-center gap-2">
                                        <Package className="h-4 w-4 text-purple-600" />
                                        <span className="font-semibold text-sm text-purple-700">{t('contracts.services')}</span>
                                    </div>
                                    <table className="w-full text-sm bg-white">
                                        <thead>
                                            <tr className="border-b bg-slate-50">
                                                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-10">{t('common.stt')}</th>
                                                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">{t('contracts.serviceName')}</th>
                                                <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">{t('contracts.quantity')}</th>
                                                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">{t('contracts.unitPrice')}</th>
                                                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">{t('common.total')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {contract.serviceCharges.map((service: any, index: number) => (
                                                <tr key={index} className="border-b last:border-b-0">
                                                    <td className="px-4 py-2.5 text-muted-foreground">{index + 1}</td>
                                                    <td className="px-4 py-2.5 font-medium">{service.name}</td>
                                                    <td className="text-center px-4 py-2.5">{service.quantity || 1}</td>
                                                    <td className="text-right px-4 py-2.5">{formatCurrency(service.amount)}</td>
                                                    <td className="text-right px-4 py-2.5 font-semibold text-purple-600">
                                                        {formatCurrency(service.amount * (service.quantity || 1))}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-purple-50">
                                                <td colSpan={4} className="text-right px-4 py-2.5 font-semibold">{t('contracts.totalServiceAmount')}</td>
                                                <td className="text-right px-4 py-2.5 font-bold text-purple-600">{formatCurrency(getTotalServices())}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}

                            {/* Rent Price - Only show rent, no total since invoice will calculate */}
                            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-5 border">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-lg">{t('contracts.rentPrice')}</span>
                                    {isLongTerm ? (
                                        <div className="text-right">
                                            <span className="text-2xl font-bold text-blue-600">
                                                {formatCurrency(contract.rentPrice)}
                                            </span>
                                            <span className="text-sm text-muted-foreground ml-1">
                                                / {getPaymentCycleLabel()}
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="text-right">
                                            {contract.shortTermPricingType === 'HOURLY' && contract.hourlyPricingMode === 'PER_HOUR' && (
                                                <span className="text-2xl font-bold text-orange-600">
                                                    {formatCurrency(contract.pricePerHour)}/h
                                                </span>
                                            )}
                                            {contract.shortTermPricingType === 'FIXED' && (
                                                <span className="text-2xl font-bold text-orange-600">
                                                    {formatCurrency(contract.fixedPrice)}
                                                </span>
                                            )}
                                            {((contract.shortTermPricingType === 'HOURLY' && contract.hourlyPricingMode === 'TABLE') ||
                                                contract.shortTermPricingType === 'DAILY') &&
                                                contract.shortTermPrices?.length > 0 && (
                                                    <div className="space-y-2">
                                                        <div className="text-sm font-medium text-orange-600 text-right">
                                                            {t('contracts.priceTable')}
                                                        </div>
                                                        <table className="text-sm w-full">
                                                            <thead>
                                                                <tr className="text-muted-foreground text-xs">
                                                                    <th className="text-left font-medium px-2 py-1">
                                                                        {contract.shortTermPricingType === 'HOURLY' ? t('rooms.fromHour') : t('rooms.fromDay')}
                                                                    </th>
                                                                    <th className="text-left font-medium px-2 py-1">
                                                                        {contract.shortTermPricingType === 'HOURLY' ? t('rooms.toHour') : t('rooms.toDay')}
                                                                    </th>
                                                                    <th className="text-right font-medium px-2 py-1">{t('contracts.unitPrice')}</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {contract.shortTermPrices.map((tier: any, idx: number) => (
                                                                    <tr key={idx} className="border-t">
                                                                        <td className="px-2 py-1">{tier.fromValue}</td>
                                                                        <td className="px-2 py-1">{tier.toValue === -1 ? '∞' : tier.toValue}</td>
                                                                        <td className="text-right px-2 py-1 font-medium text-orange-600">
                                                                            {formatCurrency(tier.price)}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Notes */}
                            {contract.notes && (
                                <div className="border rounded-xl p-4 bg-white">
                                    <h3 className="font-semibold text-sm text-muted-foreground mb-2">{t('common.notes')}</h3>
                                    <p className="text-sm">{contract.notes}</p>
                                </div>
                            )}

                            {/* Terms */}
                            {contract.terms && (
                                <div className="border rounded-xl p-4 bg-white">
                                    <h3 className="font-semibold text-sm text-muted-foreground mb-2">{t('contracts.terms')}</h3>
                                    <p className="text-sm whitespace-pre-wrap">{contract.terms}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sticky Footer */}
                <DialogFooter className="border-t p-4 bg-slate-50 flex-row gap-2 sm:justify-end shrink-0">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        {t('common.close')}
                    </Button>
                    <Button
                        onClick={handleExportPDF}
                        disabled={isExporting}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        {isExporting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {t('common.loading')}
                            </>
                        ) : (
                            <>
                                <Download className="mr-2 h-4 w-4" />
                                {t('contracts.exportPDF')}
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

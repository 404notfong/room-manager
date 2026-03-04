import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
    Download,
    Loader2,
    Printer,
    X,
} from 'lucide-react';
import { useRef, useState } from 'react';

import CreateInvoiceModal from './CreateInvoiceModal';
import CreateShortTermInvoiceModal from './CreateShortTermInvoiceModal';
import TerminateContractModal from './TerminateContractModal';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
} from '@/components/ui/dialog';
import { formatDate, formatPhoneNumber } from '@/lib/utils';

interface ContractViewModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    contract: any;
}

export default function ContractViewModal({ open, onOpenChange, contract }: ContractViewModalProps) {
    const receiptRef = useRef<HTMLDivElement>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false);
    const [isCreateShortTermInvoiceOpen, setIsCreateShortTermInvoiceOpen] = useState(false);
    const [isTerminateOpen, setIsTerminateOpen] = useState(false);

    if (!contract) return null;

    const formatCurrency = (amount: number | undefined) => {
        if (amount === undefined || amount === null) return '-';
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'ACTIVE': return '● ĐANG HIỆU LỰC';
            case 'EXPIRED': return '○ HẾT HẠN';
            case 'TERMINATED': return '✗ ĐÃ THANH LÝ';
            case 'DRAFT': return '◌ BẢN NHÁP';
            default: return status;
        }
    };

    const getPaymentCycleLabel = () => {
        const type = contract.roomType || contract.contractType;
        if (type === 'SHORT_TERM') {
            switch (contract.shortTermPricingType) {
                case 'HOURLY': return 'Theo giờ';
                case 'DAILY': return 'Theo ngày';
                case 'FIXED': return 'Trọn gói';
                default: return '-';
            }
        }

        switch (contract.paymentCycle) {
            case 'MONTHLY': return 'Hàng tháng';
            case 'MONTHLY_2': return '2 tháng/lần';
            case 'QUARTERLY': return 'Hàng quý';
            case 'MONTHLY_6': return '6 tháng/lần';
            case 'MONTHLY_12': return 'Hàng năm';
            case 'CUSTOM': return `${contract.paymentCycleMonths} tháng`;
            default: return contract.paymentCycle;
        }
    };

    const getTotalServices = () => {
        if (!contract.serviceCharges || !Array.isArray(contract.serviceCharges)) return 0;
        return contract.serviceCharges.reduce((sum: number, service: any) => sum + (service.amount * (service.quantity || 1)), 0);
    };

    const handleExportPDF = async () => {
        if (!receiptRef.current) return;
        setIsExporting(true);
        try {
            // Clone the element outside the dialog portal so html2canvas can capture it properly
            const clone = receiptRef.current.cloneNode(true) as HTMLElement;
            clone.style.position = 'absolute';
            clone.style.left = '-9999px';
            clone.style.top = '0';
            clone.style.width = `${receiptRef.current.offsetWidth}px`;
            document.body.appendChild(clone);

            const canvas = await html2canvas(clone, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
            });

            document.body.removeChild(clone);

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4',
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = pdfWidth / imgWidth;
            const pdfHeight = imgHeight * ratio;

            // Handle multi-page if content is taller than A4
            const pageHeight = pdf.internal.pageSize.getHeight();
            if (pdfHeight + 10 > pageHeight) {
                let remainingHeight = pdfHeight;
                let position = 10;
                while (remainingHeight > 0) {
                    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
                    remainingHeight -= (pageHeight - 10);
                    if (remainingHeight > 0) {
                        pdf.addPage();
                        position = -(pdfHeight - remainingHeight);
                    }
                }
            } else {
                pdf.addImage(imgData, 'PNG', 0, 10, pdfWidth, pdfHeight);
            }

            pdf.save(`${contract.contractCode || 'contract'}.pdf`);
        } catch (error) {
            console.error('Error exporting PDF:', error);
        } finally {
            setIsExporting(false);
        }
    };

    const handlePrint = () => {
        const printContent = receiptRef.current;
        if (!printContent) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        // Collect all stylesheets from the page so Tailwind classes work
        const styleSheets = Array.from(document.styleSheets);
        let cssText = '';
        styleSheets.forEach((sheet) => {
            try {
                const rules = Array.from(sheet.cssRules || []);
                rules.forEach((rule) => {
                    cssText += rule.cssText + '\n';
                });
            } catch {
                // Cross-origin stylesheets can't be read, use link tag instead
                if (sheet.href) {
                    cssText += `@import url("${sheet.href}");\n`;
                }
            }
        });

        printWindow.document.write(`
            <html>
                <head>
                    <title>In hợp đồng - ${contract.contractCode}</title>
                    <style>
                        ${cssText}
                        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap');
                        body { 
                            font-family: 'JetBrains Mono', 'Courier New', monospace;
                            margin: 0; 
                            padding: 20px;
                            background: white;
                        }
                        @media print {
                            body { padding: 0; }
                        }
                    </style>
                </head>
                <body>
                    ${printContent.innerHTML}
                </body>
            </html>
        `);
        printWindow.document.close();
        // Wait for styles to load before printing
        printWindow.onload = () => {
            printWindow.focus();
            printWindow.print();
        };
        // Fallback: print after a short delay if onload doesn't fire
        setTimeout(() => {
            printWindow.focus();
            printWindow.print();
        }, 1000);
    };

    const isLongTerm = (contract.roomType || contract.contractType) === 'LONG_TERM';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent hideCloseButton className="max-w-[420px] max-h-[90vh] p-0 gap-0 overflow-hidden bg-slate-100 dark:bg-slate-800">
                {/* Toolbar */}
                <div className="flex items-center justify-between px-3 py-2 border-b bg-slate-200 dark:bg-slate-700">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Chi tiết hợp đồng</span>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={handlePrint}
                        >
                            <Printer className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={handleExportPDF}
                            disabled={isExporting}
                        >
                            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onOpenChange(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Contract Paper */}
                <div className="flex-1 overflow-y-auto p-4">
                    <div 
                        ref={receiptRef}
                        className="shadow-lg mx-auto"
                        style={{
                            maxWidth: '380px',
                            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                            fontSize: '11px',
                            lineHeight: '1.5',
                            padding: '24px 20px',
                            backgroundColor: '#ffffff',
                            color: '#0f172a',
                        }}
                    >
                        {/* Header */}
                        <div className="text-center mb-4">
                            <div className="text-lg font-bold tracking-wider">NHÀ TRỌ SỐ</div>
                            <div className="text-[10px] mt-1" style={{ color: '#64748b' }}>Quản lý lưu trú thời đại số</div>
                            <div className="border-b-2 border-double mt-3" style={{ borderColor: '#94a3b8' }} />
                        </div>

                        {/* Contract Title */}
                        <div className="text-center mb-4">
                            <div className="text-base font-bold uppercase tracking-wide">
                                HỢP ĐỒNG THUÊ PHÒNG
                            </div>
                            <div className="text-[10px] mt-1" style={{ color: '#64748b' }}>
                                {isLongTerm ? 'Dài hạn' : 'Ngắn hạn'}
                            </div>
                        </div>

                        {/* Contract Info */}
                        <div className="p-3 mb-3" style={{ border: '1px solid #cbd5e1' }}>
                            <div className="flex justify-between mb-2">
                                <span style={{ color: '#64748b' }}>Số hợp đồng:</span>
                                <span className="font-bold">{contract.contractCode}</span>
                            </div>
                            <div className="flex justify-between mb-2">
                                <span style={{ color: '#64748b' }}>Ngày bắt đầu:</span>
                                <span className="font-medium">{formatDate(contract.startDate)}</span>
                            </div>
                            <div className="flex justify-between mb-2">
                                <span style={{ color: '#64748b' }}>Ngày kết thúc:</span>
                                <span className="font-medium">{contract.endDate ? formatDate(contract.endDate) : 'Chưa xác định'}</span>
                            </div>
                            {isLongTerm && (
                                <>
                                    <div className="flex justify-between">
                                        <span style={{ color: '#64748b' }}>Chu kỳ thanh toán:</span>
                                        <span className="font-medium">{getPaymentCycleLabel()}</span>
                                    </div>
                                    {contract.paymentDueDay && (
                                        <div className="flex justify-between mt-2">
                                            <span style={{ color: '#64748b' }}>Ngày thanh toán:</span>
                                            <span className="font-medium">Ngày {contract.paymentDueDay} hàng tháng</span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Status */}
                        <div className="text-center py-2 px-4 border-2 border-dashed rounded mb-4"
                            style={{
                                borderColor: contract.status === 'ACTIVE' ? '#10b981' : 
                                             contract.status === 'TERMINATED' ? '#ef4444' : '#6b7280'
                            }}
                        >
                            <span className="font-bold text-xs"
                                style={{
                                    color: contract.status === 'ACTIVE' ? '#10b981' : 
                                           contract.status === 'TERMINATED' ? '#ef4444' : '#6b7280'
                                }}
                            >
                                {getStatusText(contract.status)}
                            </span>
                        </div>

                        <div className="border-b border-dashed my-3" style={{ borderColor: '#cbd5e1' }} />

                        {/* Room Info */}
                        <div className="mb-4">
                            <div className="font-bold text-[10px] uppercase tracking-wider mb-2 border-b pb-1" style={{ color: '#475569' }}>
                                Thông tin phòng
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between">
                                    <span style={{ color: '#64748b' }}>Tòa nhà:</span>
                                    <span className="font-medium">{contract.roomId?.buildingId?.name || '-'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span style={{ color: '#64748b' }}>Phòng:</span>
                                    <span className="font-bold" style={{ color: '#2563eb' }}>{contract.roomId?.roomName || contract.roomId?.roomCode || '-'}</span>
                                </div>
                                {isLongTerm && (
                                    <>
                                        <div className="flex justify-between">
                                            <span style={{ color: '#64748b' }}>Chỉ số điện đầu:</span>
                                            <span className="font-medium">{contract.initialElectricIndex ?? 0}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span style={{ color: '#64748b' }}>Chỉ số nước đầu:</span>
                                            <span className="font-medium">{contract.initialWaterIndex ?? 0}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Tenant Info */}
                        <div className="mb-4">
                            <div className="font-bold text-[10px] uppercase tracking-wider mb-2 border-b pb-1" style={{ color: '#475569' }}>
                                Thông tin khách thuê
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between">
                                    <span style={{ color: '#64748b' }}>Họ tên:</span>
                                    <span className="font-bold">{contract.tenantId?.fullName || '-'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span style={{ color: '#64748b' }}>SĐT:</span>
                                    <span className="font-medium" style={{ color: '#2563eb' }}>{formatPhoneNumber(contract.tenantId?.phone)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span style={{ color: '#64748b' }}>CCCD:</span>
                                    <span className="font-medium">{contract.tenantId?.idCard || '-'}</span>
                                </div>
                                {contract.tenantId?.email && (
                                    <div className="flex justify-between">
                                    <span style={{ color: '#64748b' }}>Email:</span>
                                        <span className="font-medium text-[10px]">{contract.tenantId.email}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="border-b border-dashed my-3" style={{ borderColor: '#cbd5e1' }} />

                        {/* Pricing Table */}
                        <div className="mb-4">
                            <div className="font-bold text-[10px] uppercase tracking-wider mb-2 border-b pb-1" style={{ color: '#475569' }}>
                                Bảng giá
                            </div>
                            
                            {/* Rent */}
                            <div className="flex justify-between py-1 font-bold">
                                <span>Tiền thuê phòng</span>
                                <span style={{ color: '#2563eb' }}>{formatCurrency(contract.rentPrice)}</span>
                            </div>
                            
                            {/* Deposit */}
                            <div className="flex justify-between py-1">
                                <span>Tiền cọc</span>
                                <span className="font-medium" style={{ color: '#d97706' }}>{formatCurrency(contract.depositAmount)}</span>
                            </div>

                            {/* Utilities - Long term only */}
                            {isLongTerm && (
                                <>
                                    <div className="border-b border-dotted my-1" style={{ borderColor: '#e2e8f0' }} />
                                    <div className="text-[10px] uppercase tracking-wider mt-2 mb-1" style={{ color: '#64748b' }}>
                                        Điện nước
                                    </div>
                                    <div className="flex justify-between py-1">
                                        <span>Điện</span>
                                        <span className="font-medium">{formatCurrency(contract.electricityPrice)}/kWh</span>
                                    </div>
                                    <div className="flex justify-between py-1">
                                        <span>Nước</span>
                                        <span className="font-medium">{formatCurrency(contract.waterPrice)}/m³</span>
                                    </div>
                                </>
                            )}

                            {/* Short-term pricing */}
                            {!isLongTerm && (
                                <>
                                    {contract.shortTermPricingType === 'HOURLY' && contract.hourlyPricingMode === 'PER_HOUR' && (
                                        <div className="flex justify-between py-1">
                                            <span>Giá theo giờ</span>
                                            <span className="font-medium" style={{ color: '#ea580c' }}>{formatCurrency(contract.pricePerHour)}/giờ</span>
                                        </div>
                                    )}
                                    {contract.shortTermPricingType === 'FIXED' && (
                                        <div className="flex justify-between py-1">
                                            <span>Giá trọn gói</span>
                                            <span className="font-medium" style={{ color: '#ea580c' }}>{formatCurrency(contract.fixedPrice)}</span>
                                        </div>
                                    )}
                                    {((contract.shortTermPricingType === 'HOURLY' && contract.hourlyPricingMode === 'TABLE') ||
                                        contract.shortTermPricingType === 'DAILY') &&
                                        contract.shortTermPrices?.length > 0 && (
                                            <>
                                                <div className="text-[10px] uppercase tracking-wider mt-2 mb-1" style={{ color: '#64748b' }}>
                                                    Bảng giá theo {contract.shortTermPricingType === 'HOURLY' ? 'giờ' : 'ngày'}
                                                </div>
                                                <table className="w-full text-[10px]" style={{ border: '1px solid #e2e8f0' }}>
                                                    <thead>
                                                        <tr style={{ backgroundColor: '#f8fafc' }}>
                                                            <th className="text-left px-2 py-1 border-r">Từ</th>
                                                            <th className="text-left px-2 py-1 border-r">Đến</th>
                                                            <th className="text-right px-2 py-1">Đơn giá</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {contract.shortTermPrices.map((tier: any, idx: number) => (
                                                            <tr key={idx} className="border-t">
                                                                <td className="px-2 py-1 border-r">{tier.fromValue}</td>
                                                                <td className="px-2 py-1 border-r">{tier.toValue === -1 ? '∞' : tier.toValue}</td>
                                                                <td className="text-right px-2 py-1 font-medium" style={{ color: '#ea580c' }}>
                                                                    {formatCurrency(tier.price)}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </>
                                        )}
                                </>
                            )}
                            {/* Services - merged into price table */}
                            {contract.serviceCharges && contract.serviceCharges.length > 0 && (
                                <>
                                    <div className="border-b border-dotted my-1" style={{ borderColor: '#e2e8f0' }} />
                                    <div className="text-[10px] uppercase tracking-wider mt-2 mb-1" style={{ color: '#64748b' }}>
                                        Dịch vụ
                                    </div>
                                    {contract.serviceCharges.map((service: any, index: number) => (
                                        <div key={index} className="flex justify-between py-1">
                                            <span>{service.name} {(service.quantity || 1) > 1 ? `x${service.quantity}` : ''}</span>
                                            <span className="font-medium">
                                                {formatCurrency(service.amount * (service.quantity || 1))}
                                            </span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between py-1 font-bold border-t border-dotted mt-1 pt-1">
                                        <span>Tổng dịch vụ</span>
                                        <span style={{ color: '#9333ea' }}>{formatCurrency(getTotalServices())}</span>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Notes */}
                        {contract.notes && (
                            <div className="mb-3 p-2" style={{ backgroundColor: '#f8fafc', border: '1px dotted #cbd5e1' }}>
                                <div className="text-[10px] font-bold mb-1" style={{ color: '#64748b' }}>Ghi chú:</div>
                                <div className="text-[10px]">{contract.notes}</div>
                            </div>
                        )}

                        {/* Terms */}
                        {contract.terms && (
                            <div className="mb-3 p-2" style={{ backgroundColor: '#f8fafc', border: '1px dotted #cbd5e1' }}>
                                <div className="text-[10px] font-bold mb-1" style={{ color: '#64748b' }}>Điều khoản:</div>
                                <div className="text-[10px] whitespace-pre-wrap">{contract.terms}</div>
                            </div>
                        )}



                        {/* Tear-off edge effect */}
                        <div 
                            className="mt-6 -mx-5 -mb-6 h-4"
                            style={{
                                background: 'repeating-linear-gradient(90deg, transparent, transparent 8px, #f1f5f9 8px, #f1f5f9 16px)',
                            }}
                        />
                    </div>
                </div>

                {/* Action Footer */}
                <div className="p-3 border-t bg-white dark:bg-slate-800 flex gap-2 flex-wrap justify-end">
                    {contract.status === 'ACTIVE' && isLongTerm && (
                        <Button
                            onClick={() => setIsCreateInvoiceOpen(true)}
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700"
                        >
                            Tạo hóa đơn
                        </Button>
                    )}
                    {contract.status === 'ACTIVE' && !isLongTerm && (
                        <Button
                            onClick={() => setIsCreateShortTermInvoiceOpen(true)}
                            size="sm"
                            className="bg-orange-600 hover:bg-orange-700"
                        >
                            Tạo hóa đơn
                        </Button>
                    )}
                    {contract.status === 'ACTIVE' && (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setIsTerminateOpen(true)}
                        >
                            Thanh lý
                        </Button>
                    )}
                </div>
            </DialogContent>

            {/* Create Invoice Modal - Long Term */}
            <CreateInvoiceModal
                open={isCreateInvoiceOpen}
                onOpenChange={setIsCreateInvoiceOpen}
                contract={contract}
                room={contract.roomId}
                onSuccess={() => {
                    setIsCreateInvoiceOpen(false);
                }}
            />

            {/* Create Invoice Modal - Short Term */}
            <CreateShortTermInvoiceModal
                open={isCreateShortTermInvoiceOpen}
                onOpenChange={setIsCreateShortTermInvoiceOpen}
                contract={contract}
                room={contract.roomId}
                onSuccess={() => {
                    setIsCreateShortTermInvoiceOpen(false);
                }}
            />

            {/* Terminate Contract Modal */}
            <TerminateContractModal
                open={isTerminateOpen}
                onOpenChange={setIsTerminateOpen}
                contract={contract}
                onSuccess={() => {
                    setIsTerminateOpen(false);
                    onOpenChange(false);
                }}
            />
        </Dialog>
    );
}

import { format } from 'date-fns';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
    Download,
    Loader2,
    Printer,
    X,
} from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
} from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/utils';

interface InvoiceViewModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    invoice: any;
    onRecordPayment?: () => void;
}

export default function InvoiceViewModal({ 
    open, 
    onOpenChange, 
    invoice,
    onRecordPayment 
}: InvoiceViewModalProps) {
    const receiptRef = useRef<HTMLDivElement>(null);
    const [isExporting, setIsExporting] = useState(false);

    if (!invoice) return null;

    const formatDate = (dateString: string | Date | undefined) => {
        if (!dateString) return '-';
        try {
            return format(new Date(dateString), 'dd/MM/yyyy');
        } catch {
            return '-';
        }
    };

    const formatDateTime = (dateString: string | Date | undefined) => {
        if (!dateString) return '-';
        try {
            return format(new Date(dateString), 'dd/MM/yyyy HH:mm');
        } catch {
            return '-';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'PAID': return '✓ ĐÃ THANH TOÁN';
            case 'PENDING': return '○ CHỜ THANH TOÁN';
            case 'PARTIAL': return '◐ THANH TOÁN MỘT PHẦN';
            case 'OVERDUE': return '✗ QUÁ HẠN';
            case 'CANCELLED': return '✗ ĐÃ HỦY';
            default: return status;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PAID': return '#10b981';
            case 'OVERDUE': return '#ef4444';
            case 'CANCELLED': return '#6b7280';
            case 'PARTIAL': return '#3b82f6';
            default: return '#f59e0b';
        }
    };

    const isShortTerm = invoice.totalHours > 0 || invoice.totalDays > 0;
    const room = invoice.roomId;
    const tenant = invoice.tenantId;
    const remainingAmount = invoice.remainingAmount || (invoice.totalAmount - (invoice.paidAmount || 0));

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

            pdf.save(`${invoice.invoiceNumber || 'invoice'}.pdf`);
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
                if (sheet.href) {
                    cssText += `@import url("${sheet.href}");\n`;
                }
            }
        });

        printWindow.document.write(`
            <html>
                <head>
                    <title>In hóa đơn - ${invoice.invoiceNumber}</title>
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
        printWindow.onload = () => {
            printWindow.focus();
            printWindow.print();
        };
        setTimeout(() => {
            printWindow.focus();
            printWindow.print();
        }, 1000);
    };

    const statusColor = getStatusColor(invoice.status);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent hideCloseButton className="max-w-[420px] max-h-[90vh] p-0 gap-0 overflow-hidden bg-slate-100 dark:bg-slate-800">
                {/* Toolbar */}
                <div className="flex items-center justify-between px-3 py-2 border-b bg-slate-200 dark:bg-slate-700">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Chi tiết hóa đơn</span>
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

                {/* Invoice Paper */}
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

                        {/* Invoice Title */}
                        <div className="text-center mb-4">
                            <div className="text-base font-bold uppercase tracking-wide">HÓA ĐƠN THANH TOÁN</div>
                            <div className="text-[10px] mt-1" style={{ color: '#64748b' }}>
                                {isShortTerm ? 'Thuê ngắn hạn' : 'Thuê dài hạn'}
                            </div>
                        </div>

                        {/* Invoice Info - Bordered box like Contract */}
                        <div className="p-3 mb-3" style={{ border: '1px solid #cbd5e1' }}>
                            <div className="flex justify-between mb-2">
                                <span style={{ color: '#64748b' }}>Số HĐ:</span>
                                <span className="font-bold">{invoice.invoiceNumber}</span>
                            </div>
                            <div className="flex justify-between mb-2">
                                <span style={{ color: '#64748b' }}>Ngày lập:</span>
                                <span className="font-medium">{formatDate(invoice.createdAt)}</span>
                            </div>
                            <div className="flex justify-between mb-2">
                                <span style={{ color: '#64748b' }}>Kỳ thanh toán:</span>
                                <span className="font-medium">{invoice.billingPeriod?.month}/{invoice.billingPeriod?.year}</span>
                            </div>
                            <div className="flex justify-between">
                                <span style={{ color: '#64748b' }}>Hạn thanh toán:</span>
                                <span className="font-medium">{formatDate(invoice.dueDate)}</span>
                            </div>
                        </div>

                        {/* Status Badge - Prominent position like Contract */}
                        <div className="text-center py-2 px-4 border-2 border-dashed rounded mb-4"
                            style={{ borderColor: statusColor }}
                        >
                            <span className="font-bold text-xs"
                                style={{ color: statusColor }}
                            >
                                {getStatusText(invoice.status)}
                            </span>
                        </div>

                        <div className="border-b border-dashed my-3" style={{ borderColor: '#cbd5e1' }} />

                        {/* Customer Info */}
                        <div className="mb-4">
                            <div className="font-bold text-[10px] uppercase tracking-wider mb-2 border-b pb-1" style={{ color: '#475569' }}>
                                Thông tin khách hàng
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between">
                                    <span style={{ color: '#64748b' }}>Tên:</span>
                                    <span className="font-bold">{tenant?.name || tenant?.fullName || '-'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span style={{ color: '#64748b' }}>Phòng:</span>
                                    <span className="font-bold" style={{ color: '#2563eb' }}>{room?.name || room?.roomCode || '-'}</span>
                                </div>
                                {room?.buildingId?.name && (
                                    <div className="flex justify-between">
                                        <span style={{ color: '#64748b' }}>Tòa nhà:</span>
                                        <span className="font-medium">{room.buildingId.name}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Short-term Duration */}
                        {isShortTerm && (
                            <>
                                <div className="mb-4">
                                    <div className="font-bold text-[10px] uppercase tracking-wider mb-2 border-b pb-1" style={{ color: '#475569' }}>
                                        Thời gian lưu trú
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between">
                                            <span style={{ color: '#64748b' }}>Check-in:</span>
                                            <span className="font-medium">{formatDateTime(invoice.checkInTime)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span style={{ color: '#64748b' }}>Check-out:</span>
                                            <span className="font-medium">{formatDateTime(invoice.checkOutTime)}</span>
                                        </div>
                                        <div className="flex justify-between font-medium">
                                            <span>Thời gian:</span>
                                            <span>
                                                {invoice.totalHours > 0 && `${invoice.totalHours} giờ`}
                                                {invoice.totalHours > 0 && invoice.totalDays > 0 && ' / '}
                                                {invoice.totalDays > 0 && `${invoice.totalDays} ngày`}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="border-b border-dashed my-3" style={{ borderColor: '#cbd5e1' }} />
                            </>
                        )}

                        {/* Items List */}
                        <div className="mb-4">
                            <div className="font-bold text-[10px] uppercase tracking-wider mb-2 border-b pb-1" style={{ color: '#475569' }}>
                                Chi tiết
                            </div>
                            
                            {/* Rent */}
                            <div className="flex justify-between py-1 font-bold">
                                <span>Tiền thuê phòng</span>
                                <span style={{ color: '#2563eb' }}>{formatCurrency(invoice.rentAmount)}</span>
                            </div>

                            {/* Utilities */}
                            {!isShortTerm && invoice.electricityUsed > 0 && (
                                <>
                                    <div className="border-b border-dotted my-1" style={{ borderColor: '#e2e8f0' }} />
                                    <div className="text-[10px] uppercase tracking-wider mt-2 mb-1" style={{ color: '#64748b' }}>
                                        Điện nước
                                    </div>
                                    <div className="py-1">
                                        <div className="flex justify-between">
                                            <span>Tiền điện</span>
                                            <span className="font-medium">{formatCurrency(invoice.electricityAmount)}</span>
                                        </div>
                                        <div className="text-[10px] pl-2" style={{ color: '#64748b' }}>
                                            {invoice.previousElectricIndex} → {invoice.initialElectricIndex} = {invoice.electricityUsed} kWh
                                        </div>
                                    </div>
                                </>
                            )}

                            {!isShortTerm && invoice.waterUsed > 0 && (
                                <div className="py-1">
                                    <div className="flex justify-between">
                                        <span>Tiền nước</span>
                                        <span className="font-medium">{formatCurrency(invoice.waterAmount)}</span>
                                    </div>
                                    <div className="text-[10px] pl-2" style={{ color: '#64748b' }}>
                                        {invoice.previousWaterIndex} → {invoice.initialWaterIndex} = {invoice.waterUsed} m³
                                    </div>
                                </div>
                            )}

                            {/* Services */}
                            {invoice.serviceCharges?.length > 0 && (
                                <>
                                    <div className="border-b border-dotted my-1" style={{ borderColor: '#e2e8f0' }} />
                                    <div className="text-[10px] uppercase tracking-wider mt-2 mb-1" style={{ color: '#64748b' }}>
                                        Dịch vụ
                                    </div>
                                    {invoice.serviceCharges.map((service: any, index: number) => (
                                        <div key={index} className="flex justify-between py-1">
                                            <span>{service.name}</span>
                                            <span className="font-medium">{formatCurrency(service.amount)}</span>
                                        </div>
                                    ))}
                                </>
                            )}

                            {/* Adjustments */}
                            {invoice.adjustments?.length > 0 && (
                                <>
                                    <div className="border-b border-dotted my-1" style={{ borderColor: '#e2e8f0' }} />
                                    <div className="text-[10px] uppercase tracking-wider mt-2 mb-1" style={{ color: '#64748b' }}>
                                        Điều chỉnh
                                    </div>
                                    {invoice.adjustments.map((adj: any, index: number) => (
                                        <div key={index} className="flex justify-between py-1">
                                            <span style={{ color: adj.isDiscount ? '#16a34a' : '#dc2626' }}>
                                                {adj.isDiscount ? '(-) ' : '(+) '}{adj.description}
                                            </span>
                                            <span className="font-medium" style={{ color: adj.isDiscount ? '#16a34a' : '#dc2626' }}>
                                                {adj.isDiscount ? '-' : '+'}{formatCurrency(adj.amount)}
                                            </span>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>

                        {/* Total Section */}
                        <div className="border-t-2 border-b-2 border-dashed py-2 my-3" style={{ borderColor: '#94a3b8' }}>
                            <div className="flex justify-between text-base font-bold">
                                <span>TỔNG CỘNG</span>
                                <span style={{ color: '#2563eb' }}>{formatCurrency(invoice.totalAmount)}</span>
                            </div>
                        </div>

                        {/* Payment Status */}
                        <div className="mb-4">
                            <div className="font-bold text-[10px] uppercase tracking-wider mb-2 border-b pb-1" style={{ color: '#475569' }}>
                                Thanh toán
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between">
                                    <span style={{ color: '#64748b' }}>Đã thanh toán:</span>
                                    <span className="font-medium" style={{ color: '#10b981' }}>{formatCurrency(invoice.paidAmount || 0)}</span>
                                </div>
                                {remainingAmount > 0 && (
                                    <div className="flex justify-between">
                                        <span style={{ color: '#64748b' }}>Còn lại:</span>
                                        <span className="font-bold" style={{ color: '#ef4444' }}>{formatCurrency(remainingAmount)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Notes */}
                        {invoice.notes && (
                            <div className="mb-3 p-2" style={{ backgroundColor: '#f8fafc', border: '1px dotted #cbd5e1' }}>
                                <div className="text-[10px] font-bold mb-1" style={{ color: '#64748b' }}>Ghi chú:</div>
                                <div className="text-[10px]">{invoice.notes}</div>
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
                    {invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && onRecordPayment && (
                        <Button 
                            onClick={onRecordPayment}
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700"
                        >
                            Ghi nhận thanh toán
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

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

    const isShortTerm = invoice.totalHours > 0 || invoice.totalDays > 0;
    const room = invoice.roomId;
    const tenant = invoice.tenantId;
    const remainingAmount = invoice.remainingAmount || (invoice.totalAmount - (invoice.paidAmount || 0));

    const handleExportPDF = async () => {
        if (!receiptRef.current) return;
        setIsExporting(true);
        try {
            const canvas = await html2canvas(receiptRef.current, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: [80, canvas.height * 80 / canvas.width + 10],
            });

            pdf.addImage(imgData, 'PNG', 0, 5, 80, canvas.height * 80 / canvas.width);
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

        printWindow.document.write(`
            <html>
                <head>
                    <title>In hóa đơn - ${invoice.invoiceNumber}</title>
                    <style>
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
        printWindow.print();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[380px] max-h-[90vh] p-0 gap-0 overflow-hidden bg-slate-100">
                {/* Toolbar */}
                <div className="flex items-center justify-between px-3 py-2 bg-slate-200 border-b">
                    <span className="text-sm font-medium text-slate-700">Chi tiết hóa đơn</span>
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

                {/* Receipt Paper */}
                <div className="flex-1 overflow-y-auto p-4">
                    <div 
                        ref={receiptRef}
                        className="bg-white shadow-lg mx-auto"
                        style={{
                            maxWidth: '320px',
                            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                            fontSize: '12px',
                            lineHeight: '1.4',
                            padding: '20px 16px',
                            backgroundImage: `
                                linear-gradient(to bottom, white 0%, white 100%),
                                repeating-linear-gradient(transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)
                            `,
                        }}
                    >
                        {/* Header */}
                        <div className="text-center mb-4">
                            <div className="text-lg font-bold tracking-wider">NHÀ TRỌ SỐ</div>
                            <div className="text-[10px] text-slate-500 mt-1">Quản lý lưu trú thời đại số</div>
                            <div className="border-b-2 border-dashed border-slate-300 mt-3" />
                        </div>

                        {/* Invoice Title */}
                        <div className="text-center mb-3">
                            <div className="text-base font-bold">HÓA ĐƠN THANH TOÁN</div>
                            <div className="text-[10px] text-slate-500">
                                {isShortTerm ? 'Thuê ngắn hạn' : 'Thuê dài hạn'}
                            </div>
                        </div>

                        {/* Invoice Info */}
                        <div className="mb-3 space-y-1">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Số HĐ:</span>
                                <span className="font-bold">{invoice.invoiceNumber}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Ngày lập:</span>
                                <span>{formatDate(invoice.createdAt)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Kỳ thanh toán:</span>
                                <span>{invoice.billingPeriod?.month}/{invoice.billingPeriod?.year}</span>
                            </div>
                        </div>

                        <div className="border-b border-dashed border-slate-300 my-2" />

                        {/* Customer Info */}
                        <div className="mb-3 space-y-1">
                            <div className="font-bold text-slate-600 text-[10px] uppercase tracking-wider">
                                Thông tin khách hàng
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Tên:</span>
                                <span className="font-medium">{tenant?.name || tenant?.fullName || '-'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Phòng:</span>
                                <span>{room?.name || room?.roomCode || '-'}</span>
                            </div>
                            {room?.buildingId?.name && (
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Tòa nhà:</span>
                                    <span>{room.buildingId.name}</span>
                                </div>
                            )}
                        </div>

                        <div className="border-b border-dashed border-slate-300 my-2" />

                        {/* Short-term Duration */}
                        {isShortTerm && (
                            <>
                                <div className="mb-3 space-y-1">
                                    <div className="font-bold text-slate-600 text-[10px] uppercase tracking-wider">
                                        Thời gian lưu trú
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Check-in:</span>
                                        <span>{formatDateTime(invoice.checkInTime)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Check-out:</span>
                                        <span>{formatDateTime(invoice.checkOutTime)}</span>
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
                                <div className="border-b border-dashed border-slate-300 my-2" />
                            </>
                        )}

                        {/* Items List */}
                        <div className="mb-3">
                            <div className="font-bold text-slate-600 text-[10px] uppercase tracking-wider mb-2">
                                Chi tiết
                            </div>
                            
                            {/* Rent */}
                            <div className="flex justify-between py-1">
                                <span>Tiền thuê phòng</span>
                                <span className="font-medium">{formatCurrency(invoice.rentAmount)}</span>
                            </div>

                            {/* Utilities */}
                            {!isShortTerm && invoice.electricityUsed > 0 && (
                                <div className="py-1">
                                    <div className="flex justify-between">
                                        <span>Tiền điện</span>
                                        <span className="font-medium">{formatCurrency(invoice.electricityAmount)}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 pl-2">
                                        {invoice.previousElectricIndex} → {invoice.initialElectricIndex} = {invoice.electricityUsed} kWh
                                    </div>
                                </div>
                            )}

                            {!isShortTerm && invoice.waterUsed > 0 && (
                                <div className="py-1">
                                    <div className="flex justify-between">
                                        <span>Tiền nước</span>
                                        <span className="font-medium">{formatCurrency(invoice.waterAmount)}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 pl-2">
                                        {invoice.previousWaterIndex} → {invoice.initialWaterIndex} = {invoice.waterUsed} m³
                                    </div>
                                </div>
                            )}

                            {/* Services */}
                            {invoice.serviceCharges?.length > 0 && (
                                <>
                                    <div className="border-b border-dotted border-slate-200 my-1" />
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
                                    <div className="border-b border-dotted border-slate-200 my-1" />
                                    {invoice.adjustments.map((adj: any, index: number) => (
                                        <div key={index} className="flex justify-between py-1">
                                            <span className={adj.isDiscount ? 'text-green-600' : 'text-red-600'}>
                                                {adj.isDiscount ? '(-) ' : '(+) '}{adj.description}
                                            </span>
                                            <span className={`font-medium ${adj.isDiscount ? 'text-green-600' : 'text-red-600'}`}>
                                                {adj.isDiscount ? '-' : '+'}{formatCurrency(adj.amount)}
                                            </span>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>

                        {/* Total Section */}
                        <div className="border-t-2 border-b-2 border-dashed border-slate-400 py-2 my-2">
                            <div className="flex justify-between text-base font-bold">
                                <span>TỔNG CỘNG</span>
                                <span>{formatCurrency(invoice.totalAmount)}</span>
                            </div>
                        </div>

                        {/* Payment Status */}
                        <div className="mb-3 space-y-1">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Đã thanh toán:</span>
                                <span className="text-green-600 font-medium">{formatCurrency(invoice.paidAmount || 0)}</span>
                            </div>
                            {remainingAmount > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Còn lại:</span>
                                    <span className="text-red-600 font-bold">{formatCurrency(remainingAmount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-slate-500">Hạn thanh toán:</span>
                                <span>{formatDate(invoice.dueDate)}</span>
                            </div>
                        </div>

                        {/* Status Badge */}
                        <div className="text-center py-2 px-4 border-2 border-dashed rounded mb-3"
                            style={{
                                borderColor: invoice.status === 'PAID' ? '#10b981' : 
                                             invoice.status === 'OVERDUE' ? '#ef4444' : '#f59e0b'
                            }}
                        >
                            <span className="font-bold text-sm"
                                style={{
                                    color: invoice.status === 'PAID' ? '#10b981' : 
                                           invoice.status === 'OVERDUE' ? '#ef4444' : '#f59e0b'
                                }}
                            >
                                {getStatusText(invoice.status)}
                            </span>
                        </div>

                        {/* Notes */}
                        {invoice.notes && (
                            <div className="mb-3 text-[10px] text-slate-500 italic">
                                Ghi chú: {invoice.notes}
                            </div>
                        )}

                        {/* Footer */}
                        <div className="border-t border-dashed border-slate-300 pt-3 mt-3 text-center">
                            <div className="text-[10px] text-slate-500">
                                Cảm ơn quý khách!
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1">
                                Liên hệ: 0123.456.789
                            </div>
                            <div className="text-[9px] text-slate-400 mt-2">
                                In lúc: {format(new Date(), 'HH:mm dd/MM/yyyy')}
                            </div>
                        </div>

                        {/* Tear-off edge effect */}
                        <div 
                            className="mt-4 -mx-4 -mb-5 h-4"
                            style={{
                                background: 'repeating-linear-gradient(90deg, transparent, transparent 8px, #f1f5f9 8px, #f1f5f9 16px)',
                            }}
                        />
                    </div>
                </div>

                {/* Action Footer */}
                {invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && onRecordPayment && (
                    <div className="p-3 border-t bg-white">
                        <Button 
                            onClick={onRecordPayment}
                            className="w-full bg-emerald-600 hover:bg-emerald-700"
                        >
                            Ghi nhận thanh toán
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

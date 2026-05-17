import { useQuery } from '@tanstack/react-query';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
    ArrowLeft,
    Download,
    Loader2,
    Pencil,
    Printer,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import apiClient from '@/api/client';
import CreateInvoiceModal from '@/components/CreateInvoiceModal';
import CreateShortTermInvoiceModal from '@/components/CreateShortTermInvoiceModal';
import { Button } from '@/components/ui/button';
import { formatDate, formatPhoneNumber } from '@/lib/utils';

export default function ContractDetailPage() {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const receiptRef = useRef<HTMLDivElement>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false);
    const [isCreateShortTermInvoiceOpen, setIsCreateShortTermInvoiceOpen] = useState(false);

    const { data: contract, isLoading, isError } = useQuery({
        queryKey: ['contract', id],
        queryFn: async () => {
            const response = await apiClient.get(`/contracts/${id}`);
            return response.data;
        },
        enabled: !!id,
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (isError || !contract) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/contracts')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <h1 className="text-3xl font-bold tracking-tight">Không tìm thấy</h1>
                </div>
                <p className="text-muted-foreground">Hợp đồng không tồn tại hoặc đã bị xóa.</p>
            </div>
        );
    }

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
        printWindow.onload = () => {
            printWindow.focus();
            printWindow.print();
        };
        setTimeout(() => {
            printWindow.focus();
            printWindow.print();
        }, 1000);
    };

    const isLongTerm = (contract.roomType || contract.contractType) === 'LONG_TERM';

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/contracts')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Chi tiết hợp đồng</h1>
                        <p className="text-muted-foreground">{contract.contractCode}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handlePrint}>
                        <Printer className="h-4 w-4 mr-2" /> In
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={isExporting}>
                        {isExporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                        PDF
                    </Button>
                    {(contract.status === 'DRAFT' || contract.status === 'ACTIVE') && (
                        <Button variant="outline" size="sm" onClick={() => navigate(`/contracts/${contract._id}/edit`)}>
                            <Pencil className="h-4 w-4 mr-2" /> Sửa
                        </Button>
                    )}
                </div>
            </div>

            {/* Contract Paper */}
            <div className="flex justify-center">
                <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-6 max-w-[460px] w-full">
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
                            {/* Services */}
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
            </div>

            {/* Action Footer */}
            <div className="flex gap-2 justify-center">
                {contract.status === 'ACTIVE' && isLongTerm && (
                    <Button
                        onClick={() => setIsCreateInvoiceOpen(true)}
                        className="bg-emerald-600 hover:bg-emerald-700"
                    >
                        Tạo hóa đơn
                    </Button>
                )}
                {contract.status === 'ACTIVE' && !isLongTerm && (
                    <Button
                        onClick={() => setIsCreateShortTermInvoiceOpen(true)}
                        className="bg-orange-600 hover:bg-orange-700"
                    >
                        Tạo hóa đơn
                    </Button>
                )}
                {contract.status === 'ACTIVE' && (
                    <Button
                        variant="destructive"
                        onClick={() => navigate(`/contracts/${contract._id}/terminate`)}
                    >
                        Thanh lý
                    </Button>
                )}
            </div>

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
        </div>
    );
}

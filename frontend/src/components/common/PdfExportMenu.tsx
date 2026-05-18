import { ChevronDown, Download, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, type ButtonProps } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import type { PdfExportPreset } from '@/lib/pdf-export';
import { cn } from '@/lib/utils';

interface PdfExportMenuProps {
    onExport: (preset: PdfExportPreset) => Promise<void> | void;
    isExporting: boolean;
    iconOnly?: boolean;
    align?: 'start' | 'center' | 'end';
    variant?: ButtonProps['variant'];
    size?: ButtonProps['size'];
    className?: string;
}

const exportOptions: Array<{
    preset: PdfExportPreset;
    titleKey: string;
    titleFallback: string;
    descriptionKey: string;
    descriptionFallback: string;
}> = [
    {
        preset: 'standard',
        titleKey: 'common.pdfStandard',
        titleFallback: 'PDF thường',
        descriptionKey: 'common.pdfStandardHint',
        descriptionFallback: 'Nhẹ hơn, tải nhanh hơn',
    },
    {
        preset: 'high',
        titleKey: 'common.pdfHighQuality',
        titleFallback: 'PDF chất lượng cao',
        descriptionKey: 'common.pdfHighQualityHint',
        descriptionFallback: 'Nét hơn, file lớn hơn',
    },
];

const PDF_EXPORT_PRESET_STORAGE_KEY = 'pdf-export-preset:v1';

function getStoredPdfPreset(): PdfExportPreset {
    if (typeof window === 'undefined') {
        return 'standard';
    }

    const storedPreset = window.localStorage.getItem(PDF_EXPORT_PRESET_STORAGE_KEY);
    return storedPreset === 'high' ? 'high' : 'standard';
}

export default function PdfExportMenu({
    onExport,
    isExporting,
    iconOnly = false,
    align = 'end',
    variant = 'outline',
    size = 'sm',
    className,
}: PdfExportMenuProps) {
    const { t } = useTranslation();
    const exportLabel = t('common.exportPdf', 'Xuất PDF');
    const [preferredPreset, setPreferredPreset] = useState<PdfExportPreset>(() => getStoredPdfPreset());
    const currentOption = exportOptions.find((option) => option.preset === preferredPreset) ?? exportOptions[0];
    const currentPresetLabel = t(currentOption.titleKey, currentOption.titleFallback);

    const handleExport = async (preset: PdfExportPreset) => {
        setPreferredPreset(preset);
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(PDF_EXPORT_PRESET_STORAGE_KEY, preset);
        }

        try {
            await onExport(preset);
            const option = exportOptions.find((item) => item.preset === preset) ?? currentOption;
            toast({
                title: t('common.success', 'Thành công'),
                description: t(
                    'common.pdfExportSuccess',
                    `Đã xuất ${t(option.titleKey, option.titleFallback)} thành công.`,
                ),
                variant: 'success',
            });
        } catch (error: any) {
            toast({
                title: t('common.error', 'Lỗi'),
                description:
                    error?.message ||
                    t('common.pdfExportError', 'Không thể xuất PDF. Vui lòng thử lại.'),
                variant: 'destructive',
            });
            throw error;
        }
    };

    const menuContent = (
        <DropdownMenuContent align={align} className="w-56">
            <DropdownMenuLabel>{t('common.exportPdf', 'Xuất PDF')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={preferredPreset}>
                {exportOptions.map((option) => (
                    <DropdownMenuRadioItem
                        key={option.preset}
                        value={option.preset}
                        onSelect={() => void handleExport(option.preset)}
                        className="items-start"
                    >
                        <div className="flex flex-col gap-0.5">
                            <span className="font-medium">
                                {t(option.titleKey, option.titleFallback)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {t(option.descriptionKey, option.descriptionFallback)}
                            </span>
                        </div>
                    </DropdownMenuRadioItem>
                ))}
            </DropdownMenuRadioGroup>
        </DropdownMenuContent>
    );

    if (iconOnly) {
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild disabled={isExporting}>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn('h-8 w-8', className)}
                        aria-label={`${exportLabel}: ${currentPresetLabel}`}
                        title={`${exportLabel}: ${currentPresetLabel}`}
                    >
                        {isExporting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="h-4 w-4" />
                        )}
                    </Button>
                </DropdownMenuTrigger>
                {menuContent}
            </DropdownMenu>
        );
    }

    return (
        <div className={cn('inline-flex', className)}>
            <Button
                variant={variant}
                size={size}
                onClick={() => void handleExport(preferredPreset)}
                disabled={isExporting}
                className="rounded-r-none border-r-0"
                aria-label={`${t('common.pdf', 'PDF')}: ${currentPresetLabel}`}
            >
                {isExporting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Download className="mr-2 h-4 w-4" />
                )}
                <span>{t('common.pdf', 'PDF')}</span>
            </Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild disabled={isExporting}>
                    <Button
                        variant={variant}
                        size={size}
                        className="rounded-l-none px-2"
                        aria-label={`${exportLabel}: ${currentPresetLabel}`}
                        title={`${exportLabel}: ${currentPresetLabel}`}
                    >
                        <ChevronDown className="h-4 w-4 opacity-70" />
                    </Button>
                </DropdownMenuTrigger>
                {menuContent}
            </DropdownMenu>
        </div>
    );
}

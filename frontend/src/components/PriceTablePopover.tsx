import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';

interface PriceTier {
    fromValue: number;
    toValue: number;
    price: number;
}

interface PriceTablePopoverProps {
    shortTermPrices: PriceTier[];
    pricingType?: 'HOURLY' | 'DAILY';
    unitLabel?: string;
    maxVisibleRows?: number;
    highlightPrice?: boolean; // New prop to control text color
}

export function PriceTablePopover({ shortTermPrices, pricingType, unitLabel, maxVisibleRows = 3, highlightPrice = false }: PriceTablePopoverProps) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    const unit = unitLabel || (pricingType === 'HOURLY' ? 'h' : t('rooms.days', 'ngày'));
    const hasMore = shortTermPrices.length > maxVisibleRows;
    const visiblePrices = shortTermPrices.slice(0, maxVisibleRows);

    const renderTier = (tier: PriceTier, index: number) => (
        <div
            key={index}
            className="flex justify-between items-center gap-4 text-sm py-0.5"
        >
            <span className="text-muted-foreground text-xs">
                {tier.toValue === -1
                    ? `${tier.fromValue}${unit}+`
                    : `${tier.fromValue}-${tier.toValue} ${unit}`
                }
            </span>
            <span className={`font-medium text-xs ${highlightPrice ? 'text-primary font-bold' : ''}`}>
                {formatCurrency(tier.price)}
            </span>
        </div>
    );

    return (
        <div className="flex flex-col items-end">
            {/* Show first maxVisibleRows directly */}
            {visiblePrices.map((tier, index) => renderTier(tier, index))}

            {/* If there are more, show a "..." button with popover */}
            {hasMore && (
                <Popover open={isOpen} onOpenChange={setIsOpen}>
                    <PopoverTrigger asChild>
                        <button
                            className="text-xs text-primary hover:underline cursor-pointer mt-0.5"
                            onClick={() => setIsOpen(true)}
                        >
                            ...{t('common.viewMore', 'xem thêm')}
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                        <div className="p-3 space-y-2">
                            <h4 className="font-medium text-sm">
                                {pricingType
                                    ? (pricingType === 'HOURLY' ? t('rooms.pricingHourly') : t('rooms.pricingDaily'))
                                    : t('services.priceTable', 'Bảng giá')
                                }
                            </h4>
                            <div className="space-y-1">
                                {shortTermPrices.map((tier, index) => (
                                    <div
                                        key={index}
                                        className="flex justify-between items-center gap-4 text-sm py-1 border-b last:border-b-0"
                                    >
                                        <span className="text-muted-foreground">
                                            {tier.toValue === -1
                                                ? `${tier.fromValue}${unit}+ (${t('rooms.remaining', 'còn lại')})`
                                                : `${tier.fromValue} - ${tier.toValue} ${unit}`
                                            }
                                        </span>
                                        <span className={`text-right ${highlightPrice ? 'text-primary font-bold' : 'font-medium'}`}>
                                            {formatCurrency(tier.price)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            )}
        </div>
    );
}

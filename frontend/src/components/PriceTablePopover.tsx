import { Badge } from '@/components/ui/badge';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar, ChevronDown, Clock } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface PriceTier {
    fromValue: number;
    toValue: number;
    price: number;
}

interface PriceTablePopoverProps {
    shortTermPrices: PriceTier[];
    pricingType?: 'HOURLY' | 'DAILY';
    priceTableType?: 'PROGRESSIVE' | 'FLAT';
    unitLabel?: string;
    highlightPrice?: boolean;
}

export function PriceTablePopover({ shortTermPrices, pricingType, priceTableType, unitLabel, highlightPrice = false }: PriceTablePopoverProps) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
    };

    const unit = unitLabel || (pricingType === 'HOURLY' ? 'h' : t('rooms.days', 'ngày'));
    const Icon = pricingType === 'HOURLY' ? Clock : Calendar;
    
    // Find min and max prices
    const prices = shortTermPrices.map(t => t.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <div 
                    className="inline-flex items-center gap-1.5 cursor-pointer hover:text-primary transition-colors group" 
                    role="button" 
                    tabIndex={0}
                >
                    <span className={`text-sm whitespace-nowrap ${highlightPrice ? 'text-primary font-bold' : 'font-medium'}`}>
                        {minPrice === maxPrice 
                            ? formatCurrency(minPrice)
                            : `${formatCurrency(minPrice)} - ${formatCurrency(maxPrice)}`
                        }
                    </span>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        /{pricingType === 'HOURLY' ? t('rooms.hour', 'giờ') : t('rooms.day', 'ngày')}
                    </span>
                    <span className="text-[9px] text-primary/70 group-hover:text-primary flex items-center gap-0.5 whitespace-nowrap">
                        <Icon className="h-2.5 w-2.5" />
                        {shortTermPrices.length}
                        <ChevronDown className="h-2.5 w-2.5" />
                    </span>
                </div>
            </PopoverTrigger>
            <PopoverContent className="w-auto min-w-[200px] p-0" align="end">
                <div className="p-3">
                    {/* Header */}
                    <div className="flex items-center gap-2 pb-2 mb-2 border-b">
                        <div className="p-1.5 bg-primary/10 rounded">
                            <Icon className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-sm">
                                {pricingType === 'HOURLY' ? t('rooms.pricingHourly') : t('rooms.pricingDaily')}
                            </h4>
                            <p className="text-[10px] text-muted-foreground">
                                {shortTermPrices.length} {t('rooms.priceTiers', 'mức giá')}
                            </p>
                        </div>
                        {priceTableType && (
                            <Badge 
                                variant="outline" 
                                className={`text-[9px] h-5 px-1.5 py-0 font-medium ${
                                    priceTableType === 'PROGRESSIVE' 
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30'
                                        : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30'
                                }`}
                            >
                                {priceTableType === 'PROGRESSIVE' ? t('rooms.priceTableProgressive') : t('rooms.priceTableFlat')}
                            </Badge>
                        )}
                    </div>
                    
                    {/* Price Tiers */}
                    <div className="space-y-1">
                        {shortTermPrices.map((tier, index) => (
                            <div
                                key={index}
                                className="flex justify-between items-center gap-6 py-1.5 px-2 rounded hover:bg-muted/50 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                                    <span className="text-xs text-muted-foreground">
                                        {tier.toValue === -1
                                            ? `${tier.fromValue} ${unit}+`
                                            : `${tier.fromValue} - ${tier.toValue} ${unit}`
                                        }
                                    </span>
                                </div>
                                <span className="text-sm font-bold text-primary">
                                    {formatCurrency(tier.price)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import * as React from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface MonthYearPickerProps {
    value?: Date | null;
    onChange: (date: Date) => void;
    className?: string;
    placeholder?: string;
    disabled?: boolean;
    minDate?: Date | null;
    maxDate?: Date | null;
}

const MONTHS_SHORT = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export function MonthYearPicker({ value, onChange, className, placeholder, disabled, minDate, maxDate }: MonthYearPickerProps) {
    const { t } = useTranslation();
    const defaultPlaceholder = placeholder || t('invoices.billingPeriod');
    
    const now = new Date();
    const [viewYear, setViewYear] = React.useState(value ? value.getFullYear() : now.getFullYear());
    const [open, setOpen] = React.useState(false);

    // Sync viewYear when value changes
    React.useEffect(() => {
        if (value) {
            setViewYear(value.getFullYear());
        }
    }, [value]);

    const isMonthDisabled = (month: number, year: number) => {
        if (minDate) {
            const minY = minDate.getFullYear();
            const minM = minDate.getMonth();
            if (year < minY || (year === minY && month < minM)) return true;
        }
        if (maxDate) {
            const maxY = maxDate.getFullYear();
            const maxM = maxDate.getMonth();
            if (year > maxY || (year === maxY && month > maxM)) return true;
        }
        return false;
    };

    const handleSelect = (month: number) => {
        if (isMonthDisabled(month, viewYear)) return;
        onChange(new Date(viewYear, month, 1));
        setOpen(false);
    };

    const displayValue = value
        ? `${String(value.getMonth() + 1).padStart(2, '0')}/${value.getFullYear()}`
        : '';

    const selectedMonth = value?.getMonth();
    const selectedYear = value?.getFullYear();

    // Check if entire year has any selectable month
    const canGoPrev = !minDate || viewYear - 1 >= minDate.getFullYear();
    const canGoNext = !maxDate || viewYear + 1 <= maxDate.getFullYear();

    return (
        <div className={cn("relative w-full", className)}>
            <Input
                type="text"
                value={displayValue}
                readOnly
                placeholder={defaultPlaceholder}
                disabled={disabled}
                className="w-full bg-card border-border rounded-lg pr-10 cursor-pointer"
                onClick={() => !disabled && setOpen(true)}
            />
            <Popover open={open} onOpenChange={setOpen} modal={true}>
                <PopoverTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        disabled={disabled}
                        className="absolute right-0 top-0 h-10 w-10 text-muted-foreground hover:bg-transparent hover:text-foreground"
                    >
                        <CalendarIcon className="h-4 w-4" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[260px] p-3" align="end">
                    {/* Year navigation */}
                    <div className="flex items-center justify-between mb-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={!canGoPrev}
                            onClick={() => setViewYear(y => y - 1)}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-semibold">{viewYear}</span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={!canGoNext}
                            onClick={() => setViewYear(y => y + 1)}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Month grid */}
                    <div className="grid grid-cols-3 gap-1.5">
                        {MONTHS_SHORT.map((monthLabel, index) => {
                            const isSelected = selectedMonth === index && selectedYear === viewYear;
                            const isCurrent = now.getMonth() === index && now.getFullYear() === viewYear;
                            const isDisabled = isMonthDisabled(index, viewYear);
                            return (
                                <Button
                                    key={monthLabel}
                                    variant={isSelected ? "default" : "ghost"}
                                    size="sm"
                                    disabled={isDisabled}
                                    className={cn(
                                        "h-9 text-xs font-medium",
                                        isSelected && "bg-primary text-primary-foreground",
                                        !isSelected && isCurrent && !isDisabled && "border border-primary text-primary",
                                        !isSelected && !isCurrent && !isDisabled && "text-foreground hover:bg-accent",
                                        isDisabled && "opacity-40 cursor-not-allowed"
                                    )}
                                    onClick={() => handleSelect(index)}
                                >
                                    {monthLabel}
                                </Button>
                            );
                        })}
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}


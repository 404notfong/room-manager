import { format, isSameDay, isValid, parse, set } from "date-fns"
import { Calendar as CalendarIcon, Clock } from "lucide-react"
import * as React from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface DateTimePickerProps {
    value?: Date | string | null;
    onChange: (date: Date | undefined) => void;
    className?: string;
    placeholder?: string;
    disabled?: boolean;
    disabledDate?: (date: Date) => boolean;
    showTime?: boolean;
    minDateTime?: Date | null;
}

export function DateTimePicker({ 
    value, 
    onChange, 
    className, 
    placeholder, 
    disabled,
    disabledDate,
    showTime = true,
    minDateTime
}: DateTimePickerProps) {
    const { t } = useTranslation();
    const defaultPlaceholder = showTime ? t('common.pickDateTime', 'Chọn ngày giờ') : t('common.pickDate');
    const [inputValue, setInputValue] = React.useState<string>("");
    const [isOpen, setIsOpen] = React.useState(false);

    // Get current date object
    const currentDate = React.useMemo(() => {
        if (value) {
            const date = typeof value === 'string' ? new Date(value) : value;
            if (!isNaN(date.getTime())) {
                return date;
            }
        }
        return undefined;
    }, [value]);

    // Initialize input value from props
    React.useEffect(() => {
        if (currentDate) {
            const formatStr = showTime ? "dd-MM-yyyy HH:mm" : "dd-MM-yyyy";
            setInputValue(format(currentDate, formatStr));
        } else {
            setInputValue("");
        }
    }, [currentDate, showTime]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let newValue = e.target.value;
        const maxLength = showTime ? 16 : 10; // dd-MM-yyyy HH:mm = 16 chars

        // Allow only numbers, dashes, colons and spaces
        newValue = newValue.replace(/[^0-9-:\s]/g, '');

        // Auto-format: Add separators automatically
        if (newValue.length === 2 && inputValue.length === 1) {
            newValue += '-';
        } else if (newValue.length === 5 && inputValue.length === 4) {
            newValue += '-';
        } else if (showTime && newValue.length === 10 && inputValue.length === 9) {
            newValue += ' ';
        } else if (showTime && newValue.length === 13 && inputValue.length === 12) {
            newValue += ':';
        }

        if (newValue.length > maxLength) return;

        setInputValue(newValue);

        // Attempt to parse date when full length
        if (newValue.length === maxLength) {
            const formatStr = showTime ? "dd-MM-yyyy HH:mm" : "dd-MM-yyyy";
            const parsedDate = parse(newValue, formatStr, new Date());
            if (isValid(parsedDate)) {
                onChange(parsedDate);
            } else {
                onChange(undefined);
            }
        } else {
            if (value) onChange(undefined);
        }
    };

    const handleCalendarSelect = (date: Date | undefined) => {
        // Ignore deselection (clicking already-selected date returns undefined)
        if (!date) return;
        
        if (showTime) {
            // Preserve current time when selecting new date
            const hours = currentDate?.getHours() || 0;
            const minutes = currentDate?.getMinutes() || 0;
            const newDate = set(date, { hours, minutes });
            onChange(newDate);
        } else {
            onChange(date);
            setIsOpen(false);
        }
    };

    const handleHourChange = (hour: string) => {
        const date = currentDate || new Date();
        const newDate = set(date, { hours: parseInt(hour) });
        onChange(newDate);
    };

    const handleMinuteChange = (minute: string) => {
        const date = currentDate || new Date();
        const newDate = set(date, { minutes: parseInt(minute) });
        onChange(newDate);
    };

    const handleBlur = () => {
        if (currentDate) {
            const formatStr = showTime ? "dd-MM-yyyy HH:mm" : "dd-MM-yyyy";
            setInputValue(format(currentDate, formatStr));
        } else {
            setInputValue("");
        }
    }

    // Generate hour options (0-23)
    const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
    // Generate minute options (0-59, step 5)
    const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));

    // Determine which hours/minutes should be disabled based on minDateTime
    const isSameDayAsMin = currentDate && minDateTime ? isSameDay(currentDate, minDateTime) : false;
    const minHour = minDateTime ? minDateTime.getHours() : -1;
    const minMinute = minDateTime ? Math.floor(minDateTime.getMinutes() / 5) * 5 : -1;
    const currentHour = currentDate?.getHours() ?? 0;

    const isHourDisabled = (hour: number) => {
        if (!isSameDayAsMin) return false;
        return hour < minHour;
    };

    const isMinuteDisabled = (minute: number) => {
        if (!isSameDayAsMin) return false;
        if (currentHour < minHour) return true;
        if (currentHour === minHour) return minute <= minMinute;
        return false;
    };

    return (
        <div className={cn("relative w-full", className)}>
            <Input
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onBlur={handleBlur}
                placeholder={placeholder || defaultPlaceholder}
                disabled={disabled}
                className="w-full bg-card border-border rounded-lg pr-10"
            />
            <Popover modal={true} open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        disabled={disabled}
                        className="absolute right-0 top-0 h-10 w-10 text-muted-foreground hover:bg-transparent hover:text-foreground"
                    >
                        {showTime ? <Clock className="h-4 w-4" /> : <CalendarIcon className="h-4 w-4" />}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                        mode="single"
                        selected={currentDate}
                        onSelect={handleCalendarSelect}
                        disabled={disabledDate}
                        initialFocus
                    />
                    {showTime && (
                        <div className="border-t p-3 flex items-center justify-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <Select
                                value={currentDate?.getHours().toString().padStart(2, '0') || "00"}
                                onValueChange={handleHourChange}
                            >
                                <SelectTrigger className="w-[70px]">
                                    <SelectValue placeholder="HH" />
                                </SelectTrigger>
                                <SelectContent>
                                    {hours.map((hour) => (
                                        <SelectItem 
                                            key={hour} 
                                            value={hour}
                                            disabled={isHourDisabled(parseInt(hour))}
                                        >
                                            {hour}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <span className="text-muted-foreground">:</span>
                            <Select
                                value={(Math.floor((currentDate?.getMinutes() ?? 0) / 5) * 5).toString().padStart(2, '0')}
                                onValueChange={handleMinuteChange}
                            >
                                <SelectTrigger className="w-[70px]">
                                    <SelectValue placeholder="MM" />
                                </SelectTrigger>
                                <SelectContent>
                                    {minutes.map((minute) => (
                                        <SelectItem 
                                            key={minute} 
                                            value={minute}
                                            disabled={isMinuteDisabled(parseInt(minute))}
                                        >
                                            {minute}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsOpen(false)}
                                className="ml-2"
                            >
                                OK
                            </Button>
                        </div>
                    )}
                </PopoverContent>
            </Popover>
        </div>
    )
}

import * as React from "react"
import { format, parse, isValid } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
    value?: Date | string | null;
    onChange: (date: Date | undefined) => void;
    className?: string;
    placeholder?: string;
    disabled?: boolean;
}

export function DatePicker({ value, onChange, className, placeholder, disabled }: DatePickerProps) {
    const { t } = useTranslation();
    const defaultPlaceholder = t('common.pickDate');
    const [inputValue, setInputValue] = React.useState<string>("");

    // Initialize input value from props
    React.useEffect(() => {
        if (value) {
            const date = typeof value === 'string' ? new Date(value) : value;
            if (!isNaN(date.getTime())) {
                setInputValue(format(date, "dd-MM-yyyy"));
            }
        } else {
            setInputValue("");
        }
    }, [value]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let newValue = e.target.value;

        // Allow only numbers and dashes
        newValue = newValue.replace(/[^0-9-]/g, '');

        // Auto-format: Add dashes automatically
        if (newValue.length === 2 && inputValue.length === 1) {
            newValue += '-';
        } else if (newValue.length === 5 && inputValue.length === 4) {
            newValue += '-';
        }

        // Prevent typing more than 10 characters
        if (newValue.length > 10) return;

        setInputValue(newValue);

        // Attempt to parse date when full length
        if (newValue.length === 10) {
            const parsedDate = parse(newValue, "dd-MM-yyyy", new Date());
            if (isValid(parsedDate)) {
                onChange(parsedDate);
            } else {
                onChange(undefined);
            }
        } else {
            // Clear value if incomplete to avoid invalid states
            if (value) onChange(undefined);
        }
    };

    const handleCalendarSelect = (date: Date | undefined) => {
        onChange(date);
        if (date) {
            setInputValue(format(date, "dd-MM-yyyy"));
        } else {
            setInputValue("");
        }
    };

    const handleBlur = () => {
        if (value) {
            const date = typeof value === 'string' ? new Date(value) : value;
            if (!isNaN(date.getTime())) {
                setInputValue(format(date, "dd-MM-yyyy"));
            }
        } else {
            setInputValue("");
        }
    }

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
            <Popover modal={true}>
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
                <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                        mode="single"
                        selected={value ? (typeof value === 'string' ? new Date(value) : value) : undefined}
                        onSelect={handleCalendarSelect}
                        initialFocus
                    />
                </PopoverContent>
            </Popover>
        </div>
    )
}

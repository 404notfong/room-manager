import { NumericFormat, NumericFormatProps } from 'react-number-format';
import { cn } from '@/lib/utils';
import React from 'react';

export interface NumberInputProps extends Omit<NumericFormatProps, 'onChange'> {
    onChange?: (value: number | undefined) => void;
    className?: string;
    error?: boolean;
}

export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
    ({ className, onChange, error, ...props }, ref) => {
        return (
            <NumericFormat
                className={cn(
                    "flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-card file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-muted/50 disabled:opacity-60",
                    error && "border-destructive focus-visible:ring-destructive",
                    className
                )}
                getInputRef={ref}
                thousandSeparator=","
                decimalSeparator="."
                onValueChange={(values) => {
                    onChange?.(values.floatValue);
                }}
                {...props}
            />
        );
    }
);
NumberInput.displayName = "NumberInput";

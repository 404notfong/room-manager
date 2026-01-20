import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function formatPhoneNumber(phone: string | undefined): string {
    if (!phone) return '-';

    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');

    // Handle +84 or 84 at the beginning
    if (cleaned.startsWith('84')) {
        cleaned = '0' + cleaned.substring(2);
    }

    // Format for 10 digits: 0xxx xxx xxx (3-3-4) or (4-3-3)
    // Vietnamese standard for 10 digits is often 4-3-3: 0903 123 456
    if (cleaned.length === 10) {
        const match = cleaned.match(/^(\d{4})(\d{3})(\d{3})$/);
        if (match) {
            return `${match[1]} ${match[2]} ${match[3]}`;
        }
    }

    // Fallback for other lengths or failed match
    return phone;
}

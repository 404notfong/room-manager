/**
 * Price Table Validation Utilities
 * Pure functions (no React hooks) for easy testing
 */

export interface PriceTier {
    fromValue: number;
    toValue: number; // -1 means "infinite/remaining"
    price: number;
}

export interface PriceTableValidationResult {
    isValid: boolean;
    errors: PriceTableValidationError[];
}

export interface PriceTableValidationError {
    index: number;
    field: 'fromValue' | 'toValue' | 'price' | 'sequence';
    message: string;
}

/**
 * Validates a price table (array of price tiers)
 * Rules:
 * 1. Price must be > 0
 * 2. toValue must be >= fromValue (unless toValue is -1)
 * 3. Each tier's fromValue must equal previous tier's toValue + 1
 * 4. First tier must start from 0 or 1
 * 5. Last tier must have toValue = -1 (infinite)
 */
export function validatePriceTable(tiers: PriceTier[]): PriceTableValidationResult {
    const errors: PriceTableValidationError[] = [];

    if (!tiers || tiers.length === 0) {
        return {
            isValid: false,
            errors: [{ index: -1, field: 'sequence', message: 'Price table must have at least one tier' }]
        };
    }

    tiers.forEach((tier, index) => {
        // Rule 1: Price must be > 0
        if (tier.price === undefined || tier.price <= 0) {
            errors.push({
                index,
                field: 'price',
                message: `Tier ${index + 1}: Price must be greater than 0`
            });
        }

        // Rule 2: toValue must be >= fromValue (unless -1)
        if (tier.toValue !== -1 && tier.toValue < tier.fromValue) {
            errors.push({
                index,
                field: 'toValue',
                message: `Tier ${index + 1}: End value must be >= start value`
            });
        }

        // Rule 3: Sequence check - fromValue = previous toValue + 1
        if (index > 0) {
            const prevTier = tiers[index - 1];
            const expectedFromValue = prevTier.toValue + 1;
            if (tier.fromValue !== expectedFromValue) {
                errors.push({
                    index,
                    field: 'fromValue',
                    message: `Tier ${index + 1}: Start value must be ${expectedFromValue} (previous end + 1)`
                });
            }
        }

        // Rule 4: First tier must start from 0 or 1
        if (index === 0 && tier.fromValue !== 0 && tier.fromValue !== 1) {
            errors.push({
                index,
                field: 'fromValue',
                message: 'First tier must start from 0 or 1'
            });
        }

        // Rule 5: Last tier must have toValue = -1
        if (index === tiers.length - 1 && tier.toValue !== -1) {
            errors.push({
                index,
                field: 'toValue',
                message: 'Last tier must have unlimited end value (-1)'
            });
        }
    });

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Auto-fix tier connections when adding a new tier
 * Returns the new tier with correct fromValue
 */
export function getNextTierFromValue(tiers: PriceTier[]): number {
    if (!tiers || tiers.length === 0) {
        return 1; // Default start
    }
    const lastTier = tiers[tiers.length - 1];
    return lastTier.toValue === -1 ? lastTier.fromValue + 1 : lastTier.toValue + 1;
}

/**
 * Auto-adjust next tier's fromValue when current tier's toValue changes
 */
export function adjustNextTierFromValue(
    tiers: PriceTier[],
    changedIndex: number,
    newToValue: number
): PriceTier[] {
    const newTiers = [...tiers];
    
    // Update current tier's toValue
    newTiers[changedIndex] = {
        ...newTiers[changedIndex],
        toValue: newToValue
    };

    // Adjust next tier's fromValue if exists
    if (changedIndex < newTiers.length - 1) {
        newTiers[changedIndex + 1] = {
            ...newTiers[changedIndex + 1],
            fromValue: newToValue + 1
        };
    }

    return newTiers;
}

/**
 * Recalculate all tier sequences after deletion
 */
export function recalculateTierSequence(tiers: PriceTier[]): PriceTier[] {
    if (!tiers || tiers.length === 0) return [];
    
    return tiers.map((tier, index) => {
        if (index === 0) {
            return tier; // Keep first tier unchanged
        }
        
        const prevTier = tiers[index - 1];
        return {
            ...tier,
            fromValue: prevTier.toValue + 1
        };
    });
}

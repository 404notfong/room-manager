import { describe, expect, it } from 'vitest';
import {
    adjustNextTierFromValue,
    getNextTierFromValue,
    PriceTier,
    recalculateTierSequence,
    validatePriceTable
} from './priceTableValidation';

describe('Price Table Validation', () => {
    describe('validatePriceTable', () => {
        it('should return invalid for empty array', () => {
            const result = validatePriceTable([]);
            expect(result.isValid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].message).toContain('at least one tier');
        });

        it('should return invalid for null/undefined', () => {
            const result = validatePriceTable(null as any);
            expect(result.isValid).toBe(false);
        });

        it('should validate correct single tier (start from 1)', () => {
            const tiers: PriceTier[] = [
                { fromValue: 1, toValue: -1, price: 10000 }
            ];
            const result = validatePriceTable(tiers);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should validate correct single tier (start from 0)', () => {
            const tiers: PriceTier[] = [
                { fromValue: 0, toValue: -1, price: 10000 }
            ];
            const result = validatePriceTable(tiers);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should validate correct multi-tier table', () => {
            const tiers: PriceTier[] = [
                { fromValue: 1, toValue: 2, price: 50000 },
                { fromValue: 3, toValue: 5, price: 40000 },
                { fromValue: 6, toValue: -1, price: 30000 }
            ];
            const result = validatePriceTable(tiers);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        // Rule 1: Price must be > 0
        describe('Rule 1: Price validation', () => {
            it('should fail when price is 0', () => {
                const tiers: PriceTier[] = [
                    { fromValue: 1, toValue: -1, price: 0 }
                ];
                const result = validatePriceTable(tiers);
                expect(result.isValid).toBe(false);
                expect(result.errors.some(e => e.field === 'price')).toBe(true);
            });

            it('should fail when price is negative', () => {
                const tiers: PriceTier[] = [
                    { fromValue: 1, toValue: -1, price: -100 }
                ];
                const result = validatePriceTable(tiers);
                expect(result.isValid).toBe(false);
                expect(result.errors.some(e => e.field === 'price')).toBe(true);
            });
        });

        // Rule 2: toValue >= fromValue (unless -1)
        describe('Rule 2: Range validation', () => {
            it('should fail when toValue < fromValue', () => {
                const tiers: PriceTier[] = [
                    { fromValue: 5, toValue: 3, price: 10000 }
                ];
                const result = validatePriceTable(tiers);
                expect(result.isValid).toBe(false);
                expect(result.errors.some(e => e.field === 'toValue' && e.message.includes('>='))).toBe(true);
            });

            it('should allow toValue = -1 (infinite)', () => {
                const tiers: PriceTier[] = [
                    { fromValue: 1, toValue: -1, price: 10000 }
                ];
                const result = validatePriceTable(tiers);
                expect(result.isValid).toBe(true);
                // toValue = -1 is valid and doesn't trigger "toValue < fromValue" error
            });

            it('should allow toValue = fromValue (single value tier)', () => {
                const tiers: PriceTier[] = [
                    { fromValue: 1, toValue: 1, price: 50000 },
                    { fromValue: 2, toValue: -1, price: 30000 }
                ];
                const result = validatePriceTable(tiers);
                expect(result.isValid).toBe(true);
            });
        });

        // Rule 3: Sequence check
        describe('Rule 3: Sequence validation (fromValue = prevToValue + 1)', () => {
            it('should fail when tier gap exists', () => {
                const tiers: PriceTier[] = [
                    { fromValue: 1, toValue: 2, price: 50000 },
                    { fromValue: 5, toValue: -1, price: 30000 } // Gap: 3,4 missing
                ];
                const result = validatePriceTable(tiers);
                expect(result.isValid).toBe(false);
                expect(result.errors.some(e => 
                    e.field === 'fromValue' && 
                    e.index === 1 &&
                    e.message.includes('3') // Expected fromValue
                )).toBe(true);
            });

            it('should fail when tier overlap exists', () => {
                const tiers: PriceTier[] = [
                    { fromValue: 1, toValue: 5, price: 50000 },
                    { fromValue: 3, toValue: -1, price: 30000 } // Overlap: starts at 3, but should be 6
                ];
                const result = validatePriceTable(tiers);
                expect(result.isValid).toBe(false);
                expect(result.errors.some(e => 
                    e.field === 'fromValue' && 
                    e.index === 1
                )).toBe(true);
            });

            it('should pass when sequence is correct (previous end + 1)', () => {
                const tiers: PriceTier[] = [
                    { fromValue: 1, toValue: 3, price: 50000 },
                    { fromValue: 4, toValue: 6, price: 40000 }, // 3 + 1 = 4 ✓
                    { fromValue: 7, toValue: -1, price: 30000 } // 6 + 1 = 7 ✓
                ];
                const result = validatePriceTable(tiers);
                expect(result.isValid).toBe(true);
            });
        });

        // Rule 4: First tier start
        describe('Rule 4: First tier must start from 0 or 1', () => {
            it('should fail when first tier starts from other values', () => {
                const tiers: PriceTier[] = [
                    { fromValue: 5, toValue: -1, price: 10000 }
                ];
                const result = validatePriceTable(tiers);
                expect(result.isValid).toBe(false);
                expect(result.errors.some(e => 
                    e.field === 'fromValue' && 
                    e.index === 0 &&
                    e.message.includes('0 or 1')
                )).toBe(true);
            });
        });

        // Rule 5: Last tier infinite
        describe('Rule 5: Last tier must have toValue = -1', () => {
            it('should fail when last tier has finite toValue', () => {
                const tiers: PriceTier[] = [
                    { fromValue: 1, toValue: 5, price: 10000 }
                ];
                const result = validatePriceTable(tiers);
                expect(result.isValid).toBe(false);
                expect(result.errors.some(e => 
                    e.field === 'toValue' && 
                    e.message.includes('unlimited') || e.message.includes('-1')
                )).toBe(true);
            });

            it('should fail when multi-tier table last tier is finite', () => {
                const tiers: PriceTier[] = [
                    { fromValue: 1, toValue: 2, price: 50000 },
                    { fromValue: 3, toValue: 10, price: 30000 } // Should be -1
                ];
                const result = validatePriceTable(tiers);
                expect(result.isValid).toBe(false);
                expect(result.errors.some(e => 
                    e.field === 'toValue' && 
                    e.index === 1
                )).toBe(true);
            });
        });

        // Combined errors
        describe('Multiple errors', () => {
            it('should report all errors at once', () => {
                const tiers: PriceTier[] = [
                    { fromValue: 5, toValue: 3, price: 0 }, // 3 errors: wrong start, toValue < fromValue, price 0
                ];
                const result = validatePriceTable(tiers);
                expect(result.isValid).toBe(false);
                expect(result.errors.length).toBeGreaterThanOrEqual(3);
            });
        });
    });

    describe('getNextTierFromValue', () => {
        it('should return 1 for empty array', () => {
            expect(getNextTierFromValue([])).toBe(1);
        });

        it('should return 1 for null', () => {
            expect(getNextTierFromValue(null as any)).toBe(1);
        });

        it('should return previous toValue + 1', () => {
            const tiers: PriceTier[] = [
                { fromValue: 1, toValue: 5, price: 10000 }
            ];
            expect(getNextTierFromValue(tiers)).toBe(6);
        });

        it('should handle last tier with toValue = -1', () => {
            const tiers: PriceTier[] = [
                { fromValue: 1, toValue: -1, price: 10000 }
            ];
            // When last tier is -1 (infinite), next tier starts from fromValue + 1
            expect(getNextTierFromValue(tiers)).toBe(2);
        });
    });

    describe('adjustNextTierFromValue', () => {
        it('should update current tier and adjust next tier', () => {
            const tiers: PriceTier[] = [
                { fromValue: 1, toValue: 3, price: 50000 },
                { fromValue: 4, toValue: -1, price: 30000 }
            ];
            
            // Change first tier toValue from 3 to 5
            const result = adjustNextTierFromValue(tiers, 0, 5);
            
            expect(result[0].toValue).toBe(5);
            expect(result[1].fromValue).toBe(6); // 5 + 1
        });

        it('should not crash when changing last tier', () => {
            const tiers: PriceTier[] = [
                { fromValue: 1, toValue: -1, price: 10000 }
            ];
            
            const result = adjustNextTierFromValue(tiers, 0, 5);
            expect(result[0].toValue).toBe(5);
            expect(result.length).toBe(1);
        });
    });

    describe('recalculateTierSequence', () => {
        it('should return empty for empty array', () => {
            expect(recalculateTierSequence([])).toEqual([]);
        });

        it('should keep first tier unchanged', () => {
            const tiers: PriceTier[] = [
                { fromValue: 1, toValue: 5, price: 10000 }
            ];
            const result = recalculateTierSequence(tiers);
            expect(result[0]).toEqual(tiers[0]);
        });

        it('should fix broken sequences', () => {
            // Simulating after-delete state with broken sequence
            const tiers: PriceTier[] = [
                { fromValue: 1, toValue: 3, price: 50000 },
                { fromValue: 10, toValue: -1, price: 30000 } // Wrong: should be 4
            ];
            
            const result = recalculateTierSequence(tiers);
            
            expect(result[0].fromValue).toBe(1);
            expect(result[0].toValue).toBe(3);
            expect(result[1].fromValue).toBe(4); // Fixed: 3 + 1
            expect(result[1].toValue).toBe(-1);
        });

        it('should handle multi-tier recalculation', () => {
            const tiers: PriceTier[] = [
                { fromValue: 1, toValue: 2, price: 50000 },
                { fromValue: 100, toValue: 5, price: 40000 }, // Wrong
                { fromValue: 200, toValue: -1, price: 30000 } // Wrong
            ];
            
            const result = recalculateTierSequence(tiers);
            
            expect(result[0].fromValue).toBe(1);
            expect(result[1].fromValue).toBe(3);  // 2 + 1
            expect(result[2].fromValue).toBe(6);  // 5 + 1
        });
    });
});

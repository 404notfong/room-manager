import { z } from 'zod';
import { useTranslation } from 'react-i18next';

// Vietnamese phone number regex
// Supports: 03x, 05x, 07x, 08x, 09x (10 digits) or +84 format (11-12 digits)
const vietnamesePhoneRegex = /^(0|\+84)(3[2-9]|5[2689]|7[06-9]|8[1-9]|9[0-46-9])[0-9]{7}$/;

export const isValidVietnamesePhone = (phone: string): boolean => {
    return vietnamesePhoneRegex.test(phone.replace(/\s/g, ''));
};

export const useBuildingSchema = () => {
    const { t } = useTranslation();

    return z.object({
        name: z.string().min(1, t('validation.required', { field: t('buildings.name') })),
        address: z.object({
            street: z.string().min(1, t('validation.required', { field: t('buildings.street') })),
            ward: z.string().min(1, t('validation.required', { field: t('buildings.ward') })),
            district: z.string().min(1, t('validation.required', { field: t('buildings.district') })),
            city: z.string().min(1, t('validation.required', { field: t('buildings.city') })),
        }),
        description: z.string().optional(),
    });
};

// Short-term price tier schema
const shortTermPriceTierSchema = z.object({
    fromValue: z.number().min(0),
    toValue: z.union([z.number().min(0), z.literal(-1)]), // -1 means "remaining"
    price: z.number().min(0),
});

export const useRoomSchema = () => {
    const { t } = useTranslation();

    return z.object({
        code: z.string().optional(),
        buildingId: z.string().min(1, t('validation.required', { field: t('rooms.building') })),
        // roomCode is auto-generated, not in form
        roomName: z.string().min(1, t('validation.required', { field: t('rooms.roomName') })),
        floor: z.number().min(0, t('validation.min', { field: t('rooms.floor'), min: 0 })),
        area: z.number().min(0).optional().nullable(),
        maxOccupancy: z.number().min(0).optional().nullable(),
        status: z.enum(['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'DEPOSITED']).optional(),
        roomGroupId: z.string().optional(),
        description: z.string().optional(),

        // Room type (required)
        roomType: z.enum(['LONG_TERM', 'SHORT_TERM']),

        // Long-term room fields
        defaultElectricPrice: z.number().min(0).optional(),
        defaultWaterPrice: z.number().min(0).optional(),
        defaultRoomPrice: z.number().min(0).optional(),
        defaultTermMonths: z.number().min(1).optional(),

        // Short-term room fields
        shortTermPricingType: z.enum(['HOURLY', 'DAILY', 'FIXED']).optional(),
        hourlyPricingMode: z.enum(['PER_HOUR', 'TABLE']).optional(), // New: per hour or table
        pricePerHour: z.number().min(0).optional(), // New: price per hour
        shortTermPrices: z.array(shortTermPriceTierSchema).optional(),
        fixedPrice: z.number().min(0).optional(),
    }).superRefine((data, ctx) => {
        // Long-term room validation
        if (data.roomType === 'LONG_TERM') {
            if (data.defaultRoomPrice === undefined || data.defaultRoomPrice <= 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: t('validation.min', { field: t('rooms.defaultRoomPrice'), min: 1 }),
                    path: ['defaultRoomPrice'],
                });
            }
            if (data.defaultElectricPrice === undefined || data.defaultElectricPrice <= 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: t('validation.min', { field: t('rooms.defaultElectricPrice'), min: 1 }),
                    path: ['defaultElectricPrice'],
                });
            }
            if (data.defaultWaterPrice === undefined || data.defaultWaterPrice <= 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: t('validation.min', { field: t('rooms.defaultWaterPrice'), min: 1 }),
                    path: ['defaultWaterPrice'],
                });
            }
        }

        // Short-term room validation
        if (data.roomType === 'SHORT_TERM') {
            if (!data.shortTermPricingType) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: t('validation.required', { field: t('rooms.shortTermPricingType') }),
                    path: ['shortTermPricingType'],
                });
            }

            if (data.shortTermPricingType === 'FIXED') {
                if (data.fixedPrice === undefined || data.fixedPrice <= 0) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: t('validation.min', { field: t('rooms.fixedPrice'), min: 1 }),
                        path: ['fixedPrice'],
                    });
                }
            }

            if (data.shortTermPricingType === 'HOURLY') {
                if (!data.hourlyPricingMode) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: t('validation.required', { field: t('rooms.hourlyPricingMode') }),
                        path: ['hourlyPricingMode'],
                    });
                } else if (data.hourlyPricingMode === 'PER_HOUR') {
                    if (data.pricePerHour === undefined || data.pricePerHour <= 0) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: t('validation.min', { field: t('rooms.pricePerHour'), min: 1 }),
                            path: ['pricePerHour'],
                        });
                    }
                } else if (data.hourlyPricingMode === 'TABLE') {
                    if (!data.shortTermPrices || data.shortTermPrices.length === 0) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: t('validation.required', { field: t('rooms.priceTable') }),
                            path: ['shortTermPrices'],
                        });
                    } else {
                        // Validate each tier
                        data.shortTermPrices.forEach((tier, index) => {
                            if (tier.price <= 0) {
                                ctx.addIssue({
                                    code: z.ZodIssueCode.custom,
                                    message: t('validation.min', { field: t('rooms.priceAmount'), min: 1 }),
                                    path: ['shortTermPrices', index, 'price'],
                                });
                            }
                            // toValue must be > fromValue (unless -1 for "remaining")
                            if (tier.toValue !== -1 && tier.toValue < tier.fromValue) {
                                ctx.addIssue({
                                    code: z.ZodIssueCode.custom,
                                    message: t('validation.rangeInvalid'),
                                    path: ['shortTermPrices', index, 'toValue'],
                                });
                            }
                        });
                    }
                }
            }
            if (data.shortTermPricingType === 'DAILY') {
                if (!data.shortTermPrices || data.shortTermPrices.length === 0) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: t('validation.required', { field: t('rooms.priceTable') }),
                        path: ['shortTermPrices'],
                    });
                } else {
                    // Validate each tier
                    data.shortTermPrices.forEach((tier, index) => {
                        if (tier.price <= 0) {
                            ctx.addIssue({
                                code: z.ZodIssueCode.custom,
                                message: t('validation.min', { field: t('rooms.priceAmount'), min: 1 }),
                                path: ['shortTermPrices', index, 'price'],
                            });
                        }
                        // toValue must be > fromValue (unless -1 for "remaining")
                        if (tier.toValue !== -1 && tier.toValue < tier.fromValue) {
                            ctx.addIssue({
                                code: z.ZodIssueCode.custom,
                                message: t('validation.rangeInvalid'),
                                path: ['shortTermPrices', index, 'toValue'],
                            });
                        }
                    });
                }
            }
        }
    });
};

export const useTenantSchema = () => {
    const { t } = useTranslation();

    return z.object({
        code: z.string().optional(),
        fullName: z.string().min(1, t('validation.required', { field: t('tenants.fullName') })),
        email: z.string().email(t('validation.email', { field: t('tenants.email') })).optional().or(z.literal('')),
        phone: z.string()
            .min(1, t('validation.required', { field: t('tenants.phone') }))
            .refine((val) => isValidVietnamesePhone(val), {
                message: t('validation.phone'),
            }),
        idNumber: z.string().min(1, t('validation.required', { field: t('tenants.idNumber') })),
        dateOfBirth: z.string().optional().or(z.literal('')),
        gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional().or(z.literal('')),
        address: z.string().optional(),
        occupation: z.string().optional(),
        status: z.enum(['RENTING', 'ACTIVE', 'CLOSED', 'DEPOSITED']).optional(),
        emergencyContact: z.object({
            name: z.string().optional(),
            phone: z.string().optional(),
            relationship: z.string().optional(),
        }).optional(),
    });
};

export const useRoomGroupSchema = () => {
    const { t } = useTranslation();

    return z.object({
        code: z.string().optional(),
        buildingId: z.string().min(1, t('validation.required', { field: t('rooms.building') })),
        name: z.string().min(1, t('validation.required', { field: t('roomGroups.name') })),
        description: z.string().optional(),
        color: z.string().optional(),
        sortOrder: z.number().optional(),
        isActive: z.boolean().optional(),
    });
};

export const useLoginSchema = () => {
    const { t } = useTranslation();

    return z.object({
        email: z.string()
            .min(1, t('validation.required', { field: t('auth.email') }))
            .email(t('validation.email', { field: t('auth.email') })),
        password: z.string()
            .min(1, t('validation.required', { field: t('auth.password') })),
    });
};

export const useRegisterSchema = () => {
    const { t } = useTranslation();

    return z.object({
        email: z.string()
            .min(1, t('validation.required', { field: t('auth.email') }))
            .email(t('validation.email', { field: t('auth.email') })),
        password: z.string()
            .min(1, t('validation.required', { field: t('auth.password') }))
            .min(6, t('validation.minLength', { field: t('auth.password'), min: 6 })),
        confirmPassword: z.string()
            .min(1, t('validation.required', { field: t('auth.confirmPassword') })),
        fullName: z.string()
            .min(1, t('validation.required', { field: t('auth.fullName') })),
        phone: z.string()
            .min(1, t('validation.required', { field: t('auth.phone') }))
            .refine((val) => isValidVietnamesePhone(val), {
                message: t('validation.phone'),
            }),
    }).refine((data) => data.password === data.confirmPassword, {
        message: t('validation.passwordsNotMatch'),
        path: ['confirmPassword'],
    });
};

export const useContractSchema = () => {
    const { t } = useTranslation();

    return z.object({
        buildingId: z.string({ required_error: t('validation.required', { field: t('buildings.label') }), invalid_type_error: t('validation.required', { field: t('buildings.label') }) }).min(1, t('validation.required', { field: t('buildings.label') })),
        roomId: z.string({ required_error: t('validation.required', { field: t('contracts.room') }), invalid_type_error: t('validation.required', { field: t('contracts.room') }) }).min(1, t('validation.required', { field: t('contracts.room') })),
        tenantId: z.string().optional(),
        startDate: z.string().min(1, t('validation.required', { field: t('contracts.startDate') })),
        endDate: z.string().optional(),
        status: z.enum(['DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED']).optional(),

        // Pricing Configuration
        roomType: z.enum(['LONG_TERM', 'SHORT_TERM']),
        shortTermPricingType: z.enum(['HOURLY', 'DAILY', 'FIXED']).optional(),
        hourlyPricingMode: z.enum(['PER_HOUR', 'TABLE']).optional(),

        rentPrice: z.number({
            required_error: t('validation.required', { field: t('contracts.rentPrice') }),
            invalid_type_error: t('validation.required', { field: t('contracts.rentPrice') })
        }).min(0),
        electricityPrice: z.number({
            required_error: t('validation.required', { field: t('contracts.electricPrice') }),
            invalid_type_error: t('validation.required', { field: t('contracts.electricPrice') })
        }).min(0),
        waterPrice: z.number({
            required_error: t('validation.required', { field: t('contracts.waterPrice') }),
            invalid_type_error: t('validation.required', { field: t('contracts.waterPrice') })
        }).min(0),

        pricePerHour: z.number({ invalid_type_error: t('validation.required', { field: t('contracts.pricePerHour') }) }).min(0).optional(),
        fixedPrice: z.number({ invalid_type_error: t('validation.required', { field: t('contracts.fixedPrice') }) }).min(0).optional(),
        shortTermPrices: z.array(z.object({
            fromValue: z.number().min(0),
            toValue: z.union([z.number().min(0), z.literal(-1)]),
            price: z.number().min(0)
        })).optional(),

        depositAmount: z.number({ required_error: t('validation.required', { field: t('contracts.deposit') }), invalid_type_error: t('validation.required', { field: t('contracts.deposit') }) })
            .min(0, t('validation.min', { field: t('contracts.deposit'), min: 0 })),
        paymentCycle: z.enum(['MONTHLY', 'MONTHLY_2', 'QUARTERLY', 'MONTHLY_6', 'MONTHLY_12', 'CUSTOM']).optional(),
        paymentCycleMonths: z.number().min(1, t('validation.min', { field: t('contracts.paymentCycleMonths'), min: 1 })).optional(),
        paymentDueDay: z.number({ invalid_type_error: t('validation.required', { field: t('contracts.paymentDueDay') }) })
            .min(1, t('validation.min', { field: t('contracts.paymentDueDay'), min: 1 }))
            .max(31, t('validation.max', { field: t('contracts.paymentDueDay'), max: 31 })),

        initialElectricIndex: z.number({
            required_error: t('validation.required', { field: t('contracts.initialElectricIndex') }),
            invalid_type_error: t('validation.required', { field: t('contracts.initialElectricIndex') })
        }).min(0),
        initialWaterIndex: z.number({
            required_error: t('validation.required', { field: t('contracts.initialWaterIndex') }),
            invalid_type_error: t('validation.required', { field: t('contracts.initialWaterIndex') })
        }).min(0),

        newTenant: z.object({
            fullName: z.string({ required_error: t('validation.required', { field: t('tenants.fullName') }) })
                .min(1, t('validation.required', { field: t('tenants.fullName') })),
            idCard: z.string({ required_error: t('validation.required', { field: t('tenants.idNumber') }) })
                .min(1, t('validation.required', { field: t('tenants.idNumber') })),
            phone: z.string({ required_error: t('validation.required', { field: t('tenants.phone') }) })
                .min(1, t('validation.required', { field: t('tenants.phone') }))
                .refine((val) => isValidVietnamesePhone(val), {
                    message: t('validation.phone'),
                }),
            email: z.string().email(t('validation.email', { field: t('tenants.email') })).optional().or(z.literal('')),
            permanentAddress: z.string().optional(),
        }).optional(),
        serviceCharges: z.array(z.object({
            name: z.string().min(1, t('validation.required', { field: t('contracts.serviceName') })),
            amount: z.number().min(0),
            quantity: z.number().min(1).default(1),
            isRecurring: z.boolean().default(true),
            isPredefined: z.boolean().optional(),
            serviceId: z.string().optional(),
            priceType: z.string().optional(),
            priceTiers: z.array(shortTermPriceTierSchema).optional(),
        })).optional(),
        notes: z.string().optional(),
        terms: z.string().optional(),
    }).refine((data) => data.tenantId || (data.newTenant && data.newTenant.fullName && data.newTenant.phone && data.newTenant.idCard), {
        message: t('validation.required', { field: t('contracts.tenant') }),
        path: ["tenantId"],
    }).superRefine((data, ctx) => {
        // 1. Tenant Validation
        if (!data.tenantId) {
            if (!data.newTenant) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: t('validation.required', { field: t('contracts.tenant') }),
                    path: ['tenantId'],
                });
            } else {
                if (!data.newTenant.fullName) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: t('validation.required', { field: t('tenants.fullName') }),
                        path: ['newTenant', 'fullName'],
                    });
                }
                if (!data.newTenant.phone) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: t('validation.required', { field: t('tenants.phone') }),
                        path: ['newTenant', 'phone'],
                    });
                }
                if (!data.newTenant.idCard) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: t('validation.required', { field: t('tenants.idNumber') }),
                        path: ['newTenant', 'idCard'],
                    });
                }
            }
        }

        // 2. Pricing Validation
        if (data.roomType === 'LONG_TERM') {
            if (data.rentPrice === undefined || data.rentPrice < 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: t('validation.required', { field: t('contracts.rentPrice') }),
                    path: ['rentPrice'],
                });
            }
            if (data.electricityPrice === undefined || data.electricityPrice < 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: t('validation.required', { field: t('contracts.electricPrice') }),
                    path: ['electricityPrice'],
                });
            }
            if (data.waterPrice === undefined || data.waterPrice < 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: t('validation.required', { field: t('contracts.waterPrice') }),
                    path: ['waterPrice'],
                });
            }
            if (data.initialElectricIndex === undefined || data.initialElectricIndex < 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: t('validation.required', { field: t('contracts.initialElectricIndex') }),
                    path: ['initialElectricIndex'],
                });
            }
            if (data.initialWaterIndex === undefined || data.initialWaterIndex < 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: t('validation.required', { field: t('contracts.initialWaterIndex') }),
                    path: ['initialWaterIndex'],
                });
            }

            if (data.paymentCycle === 'CUSTOM' && (!data.paymentCycleMonths || data.paymentCycleMonths < 1)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: t('validation.required', { field: t('contracts.paymentCycleMonths') }),
                    path: ['paymentCycleMonths'],
                });
            }
        } else if (data.roomType === 'SHORT_TERM') {
            if (!data.shortTermPricingType) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: t('validation.required', { field: t('contracts.pricingModel') }),
                    path: ['shortTermPricingType'],
                });
                return;
            }

            if (data.shortTermPricingType === 'HOURLY') {
                if (!data.hourlyPricingMode) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: t('validation.required', { field: t('contracts.hourlyMode') }),
                        path: ['hourlyPricingMode'],
                    });
                }
            }

            if (data.shortTermPricingType === 'FIXED') {
                if (data.fixedPrice === undefined || data.fixedPrice <= 0) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: t('validation.required', { field: t('contracts.fixedPrice') }),
                        path: ['fixedPrice'],
                    });
                }
            } else if (data.shortTermPricingType === 'HOURLY' && data.hourlyPricingMode === 'PER_HOUR') {
                if (data.pricePerHour === undefined || data.pricePerHour <= 0) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: t('validation.required', { field: t('contracts.pricePerHour') }),
                        path: ['pricePerHour'],
                    });
                }
            } else {
                // DAILY or HOURLY-TABLE
                if (!data.shortTermPrices || data.shortTermPrices.length === 0) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: t('validation.required', { field: t('contracts.pricingTiers') }),
                        path: ['shortTermPrices'],
                    });
                } else {
                    data.shortTermPrices.forEach((tier, index) => {
                        // Price required
                        if (tier.price === undefined || tier.price <= 0) {
                            ctx.addIssue({
                                code: z.ZodIssueCode.custom,
                                message: t('validation.required', { field: t('contracts.tierPrice') }),
                                path: ['shortTermPrices', index, 'price'],
                            });
                        }

                        // toValue >= fromValue (unless -1)
                        if (tier.toValue !== -1 && tier.toValue < tier.fromValue) {
                            ctx.addIssue({
                                code: z.ZodIssueCode.custom,
                                message: t('validation.rangeInvalid'),
                                path: ['shortTermPrices', index, 'toValue'],
                            });
                        }

                        // Check sequence
                        if (index > 0) {
                            const prevTier = data.shortTermPrices![index - 1];
                            if (tier.fromValue !== prevTier.toValue) {
                                ctx.addIssue({
                                    code: z.ZodIssueCode.custom,
                                    message: t('validation.sequenceInvalid'),
                                    path: ['shortTermPrices', index, 'fromValue'],
                                });
                            }
                        }

                        // Last entry toValue must be -1
                        if (index === data.shortTermPrices!.length - 1 && tier.toValue !== -1) {
                            ctx.addIssue({
                                code: z.ZodIssueCode.custom,
                                message: t('validation.lastEntryInfinite'),
                                path: ['shortTermPrices', index, 'toValue'],
                            });
                        }
                    });
                }
            }
        }
    });
};

export type BuildingFormData = z.infer<ReturnType<typeof useBuildingSchema>>;
export type RoomFormData = z.infer<ReturnType<typeof useRoomSchema>>;
export type TenantFormData = z.infer<ReturnType<typeof useTenantSchema>>;
export type RoomGroupFormData = z.infer<ReturnType<typeof useRoomGroupSchema>>;
export type LoginFormData = z.infer<ReturnType<typeof useLoginSchema>>;
export type RegisterFormData = z.infer<ReturnType<typeof useRegisterSchema>>;


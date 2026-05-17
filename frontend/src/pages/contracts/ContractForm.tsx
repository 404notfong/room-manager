import { zodResolver } from '@hookform/resolvers/zod';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import * as z from 'zod';

import apiClient from '@/api/client';
import BuildingSelector from '@/components/BuildingSelector';
import ServiceForm, { ServiceFormData } from '@/components/forms/ServiceForm';
import RoomSelector from '@/components/RoomSelector';
import TenantSelector from '@/components/TenantSelector';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { DatePicker } from '@/components/ui/date-picker';
import { DateTimePicker } from '@/components/ui/datetime-picker';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberInput } from '@/components/ui/number-input';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/useDebounce';
import { cn, formatPhoneNumber } from '@/lib/utils';
import { useContractSchema } from '@/lib/validations';
import { useBuildingStore } from '@/stores/buildingStore';
import { format } from 'date-fns';

type ContractFormValues = z.infer<ReturnType<typeof useContractSchema>>;

interface ContractFormProps {
    contract?: any; // If editing
    preSelectedRoomId?: string; // For creating contract from dashboard with pre-selected room
    onSuccess?: () => void;
    formId?: string;
    renderHeaderButtons?: (buttons: React.ReactNode) => void;
}

export default function ContractForm({ contract, preSelectedRoomId, onSuccess, formId, renderHeaderButtons }: ContractFormProps) {
    const { t } = useTranslation();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { selectedBuildingId } = useBuildingStore();

    const [activeTab, setActiveTab] = useState<'existing' | 'new'>('existing');
    const [isDraft, setIsDraft] = useState(false);
    const isDraftRef = useRef(false);

    // Active contract restrictions
    const isActiveContract = contract?.status === 'ACTIVE';

    // Check if the contract has any invoices (for meter index editability)
    const { data: contractInvoices } = useQuery({
        queryKey: ['contract-invoices', contract?._id],
        queryFn: async () => {
            const response = await apiClient.get(`/invoices?contractId=${contract._id}&limit=1`);
            return response.data;
        },
        enabled: !!contract?._id && isActiveContract,
    });
    const hasInvoices = isActiveContract && (contractInvoices?.data?.length > 0 || contractInvoices?.total > 0);

    const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false);
    const [openServiceCombobox, setOpenServiceCombobox] = useState(false);

    const [serviceSearch, setServiceSearch] = useState('');
    const debouncedServiceSearch = useDebounce(serviceSearch, 500);

    const schema = useContractSchema();
    const form = useForm<ContractFormValues>({
        resolver: zodResolver(schema),
        mode: 'onChange',
        defaultValues: {
            roomType: 'LONG_TERM',
            paymentCycle: 'MONTHLY',
            paymentDueDay: 1,
            rentPrice: 0,
            electricityPrice: 0,
            waterPrice: 0,
            depositAmount: 0,
            startDate: new Date().toISOString().split('T')[0],
            endDate: undefined,
            serviceCharges: [],
            shortTermPrices: [],
            priceTableType: 'PROGRESSIVE',
            pricePerHour: 0,
            fixedPrice: 0,
            initialElectricIndex: 0,
            initialWaterIndex: 0,
            buildingId: selectedBuildingId || ''
        }
    });

    const [selectedBuilding, setSelectedBuilding] = useState<string>(selectedBuildingId || '');

    // Sync with global building state if changed
    useEffect(() => {
        if (selectedBuildingId && !form.getValues('roomId') && !contract && !preSelectedRoomId) {
            setSelectedBuilding(selectedBuildingId);
            form.setValue('buildingId', selectedBuildingId, { shouldValidate: true });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedBuildingId, contract, preSelectedRoomId]);

    // Fetch pre-selected room data
    const { data: preSelectedRoom } = useQuery({
        queryKey: ['room', preSelectedRoomId],
        queryFn: async () => {
            const response = await apiClient.get(`/rooms/${preSelectedRoomId}`);
            return response.data;
        },
        enabled: !!preSelectedRoomId && !contract,
    });

    // Watch start date to update disabled state of end date picker
    const startDate = form.watch('startDate');

    // Auto-select building and room when preSelectedRoomId is provided
    useEffect(() => {
        if (preSelectedRoom && !contract) {
            // IMPORTANT: Reset form completely first to clear any leftover data from previous edit
            form.reset({
                roomType: 'LONG_TERM',
                paymentCycle: 'MONTHLY',
                paymentDueDay: 1,
                rentPrice: 0,
                electricityPrice: 0,
                waterPrice: 0,
                depositAmount: 0,
                startDate: new Date().toISOString().split('T')[0],
                endDate: undefined,
                serviceCharges: [],
                shortTermPrices: [],
                pricePerHour: 0,
                fixedPrice: 0,
                initialElectricIndex: 0,
                initialWaterIndex: 0,
                buildingId: '',
                roomId: '',
                tenantId: '',
                notes: '',
                terms: '',
            });

            const room = preSelectedRoom;
            const buildingId = room.buildingId?._id || room.buildingId;
            if (buildingId) {
                setSelectedBuilding(buildingId);
                form.setValue('buildingId', buildingId, { shouldValidate: true });
            }
            // Use handleRoomChange logic inline to set all room values
            form.setValue('roomType', room.roomType);
            form.setValue('rentPrice', room.defaultRoomPrice || 0);
            form.setValue('electricityPrice', room.defaultElectricPrice || 0);
            form.setValue('waterPrice', room.defaultWaterPrice || 0);
            if (room.roomType === 'LONG_TERM' && room.defaultTermMonths) {
                const termMonths = room.defaultTermMonths;
                form.setValue('paymentCycleMonths', termMonths);
                if (termMonths === 1) form.setValue('paymentCycle', 'MONTHLY');
                else if (termMonths === 2) form.setValue('paymentCycle', 'MONTHLY_2');
                else if (termMonths === 3) form.setValue('paymentCycle', 'QUARTERLY');
                else if (termMonths === 6) form.setValue('paymentCycle', 'MONTHLY_6');
                else if (termMonths === 12) form.setValue('paymentCycle', 'MONTHLY_12');
                else form.setValue('paymentCycle', 'CUSTOM');
            }
            if (room.roomType === 'SHORT_TERM') {
                form.setValue('shortTermPricingType', room.shortTermPricingType);
                form.setValue('hourlyPricingMode', room.hourlyPricingMode);
                form.setValue('pricePerHour', room.pricePerHour || 0);
                form.setValue('fixedPrice', room.fixedPrice || 0);
                if (room.shortTermPrices && room.shortTermPrices.length > 0) {
                    replacePrices(room.shortTermPrices);
                } else {
                    replacePrices([]);
                }
            }
            form.setValue('roomId', room._id, { shouldValidate: true });
            
            // Auto-fill meter indexes from room's current indexes
            form.setValue('initialElectricIndex', room.currentElectricIndex || 0);
            form.setValue('initialWaterIndex', room.currentWaterIndex || 0);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [preSelectedRoom, contract]);

    // Handle contract editing
    useEffect(() => {
        if (contract) {
            const isShortTerm = contract.contractType === 'SHORT_TERM' || contract.roomType === 'SHORT_TERM';
            form.reset({
                buildingId: contract.roomId?.buildingId?._id || (typeof contract.roomId?.buildingId === 'string' ? contract.roomId.buildingId : '') || contract.buildingId || '',
                roomId: contract.roomId?._id || contract.roomId || '',
                tenantId: contract.tenantId?._id || contract.tenantId || '',
                // For SHORT_TERM, keep full ISO string with time; for LONG_TERM, use date only
                startDate: contract.startDate 
                    ? (isShortTerm ? new Date(contract.startDate).toISOString() : new Date(contract.startDate).toISOString().split('T')[0])
                    : '',
                endDate: contract.endDate 
                    ? (isShortTerm ? new Date(contract.endDate).toISOString() : new Date(contract.endDate).toISOString().split('T')[0])
                    : undefined,
                roomType: contract.contractType || contract.roomType || 'LONG_TERM',
                rentPrice: contract.rentPrice || 0,
                depositAmount: contract.depositAmount || 0,
                electricityPrice: contract.electricityPrice || 0,
                waterPrice: contract.waterPrice || 0,
                paymentCycle: contract.paymentCycle || 'MONTHLY',
                paymentCycleMonths: contract.paymentCycleMonths || 1,
                paymentDueDay: contract.paymentDueDay || 1,
                initialElectricIndex: contract.initialElectricIndex || 0,
                initialWaterIndex: contract.initialWaterIndex || 0,
                serviceCharges: contract.serviceCharges || [],
                status: contract.status || 'ACTIVE',
                notes: contract.notes || '',
                terms: contract.terms || '',
                shortTermPricingType: contract.shortTermPricingType,
                hourlyPricingMode: contract.hourlyPricingMode,
                pricePerHour: contract.pricePerHour || 0,
                fixedPrice: contract.fixedPrice || 0,
                priceTableType: contract.priceTableType || 'PROGRESSIVE',
                shortTermPrices: contract.shortTermPrices || []
            });
            setSelectedBuilding(contract.roomId?.buildingId?._id || (typeof contract.roomId?.buildingId === 'string' ? contract.roomId.buildingId : '') || contract.buildingId || '');
            setActiveTab('existing');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [contract]);

    const { fields: serviceFields, append: appendService, remove: removeService } = useFieldArray({
        control: form.control,
        name: "serviceCharges"
    });

    const { fields: priceFields, append: appendPrice, remove: removePrice, replace: replacePrices, update: updatePrice } = useFieldArray({
        control: form.control,
        name: "shortTermPrices"
    });

    const roomType = form.watch('roomType');
    const currentShortTermType = form.watch('shortTermPricingType');
    const currentHourlyMode = form.watch('hourlyPricingMode');

    // Validations & Logic from RoomForm - Updated to use +1 logic
    const handleAddPriceTier = () => {
        if (priceFields.length === 0) {
            // First tier starts from 1
            appendPrice({ fromValue: 1, toValue: 1, price: 0 });
            appendPrice({ fromValue: 2, toValue: -1, price: 0 });
        } else {
            const lastIndex = priceFields.length - 1;
            const lastTier = priceFields[lastIndex];
            const secondLastIndex = priceFields.length - 2;
            const prevEndValue = secondLastIndex >= 0 ? (priceFields[secondLastIndex].toValue as number) : 0;
            // New tier starts at prevEndValue + 1
            const newFromValue = prevEndValue + 1;

            const lastTierData = { ...lastTier, fromValue: 0 };
            removePrice(lastIndex);

            // Add new tier (default toValue = fromValue for user to fill in)
            appendPrice({ fromValue: newFromValue, toValue: newFromValue, price: 0 });
            // Re-add the last tier with updated fromValue (new tier's toValue + 1)
            appendPrice({ fromValue: newFromValue + 1, toValue: -1, price: lastTierData.price });
        }
    };

    // Handle toValue change to update next tier's fromValue (next tier starts at toValue + 1)
    const handleToValueChange = (index: number, value: number) => {
        const nextIndex = index + 1;
        if (nextIndex < priceFields.length) {
            updatePrice(nextIndex, { ...priceFields[nextIndex], fromValue: value + 1 });
        }
    };

    // Auto-initialize price table when mode changes
    // Skip when preSelectedRoomId or contract exists - those paths handle price population
    useEffect(() => {
        if (preSelectedRoomId || contract) return;
        if (roomType === 'SHORT_TERM') {
            const isTableMode = (currentShortTermType === 'HOURLY' && currentHourlyMode === 'TABLE') || currentShortTermType === 'DAILY';
            if (isTableMode && priceFields.length === 0) {
                handleAddPriceTier();
            }
        }
    }, [roomType, currentShortTermType, currentHourlyMode, priceFields.length, preSelectedRoomId, contract]);

    // Queries
    // Queries for buildings and services ... (tenants query removed)

    // Services Infinite Query
    const {
        data: servicesData,
        fetchNextPage: fetchNextServicePage,
        hasNextPage: hasNextServicePage,
        isFetchingNextPage: isFetchingNextServicePage,
        isLoading: isServicesLoading
    } = useInfiniteQuery({
        queryKey: ['services', debouncedServiceSearch],
        queryFn: async ({ pageParam = 1 }) => {
            const res = await apiClient.get(`/services?search=${debouncedServiceSearch}&page=${pageParam}&limit=10&isActive=true`);
            return res.data;
        },
        getNextPageParam: (lastPage: any) => {
            if (lastPage?.meta) {
                return lastPage.meta.page < lastPage.meta.totalPages ? lastPage.meta.page + 1 : undefined;
            }
            return undefined;
        },
        initialPageParam: 1,
    });

    const allAvailableServices = servicesData?.pages.flatMap((page: any) =>
        Array.isArray(page) ? page : (page?.data || [])
    ) || [];

    // Filter out services that are already added
    const addedServiceIds = serviceFields.map(f => f.serviceId).filter(Boolean);
    const availableServices = allAvailableServices.filter((s: any) =>
        s.isActive && !addedServiceIds.includes(s._id)
    );

    // Infinite Scroll Observer using callback ref
    const serviceObserver = useRef<IntersectionObserver>();
    const lastServiceRef = (node: HTMLDivElement) => {
        if (isServicesLoading || isFetchingNextServicePage) return;
        if (serviceObserver.current) serviceObserver.current.disconnect();

        serviceObserver.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasNextServicePage) {
                fetchNextServicePage();
            }
        }, { threshold: 0, rootMargin: '100px' });

        if (node) serviceObserver.current.observe(node);
    };

    // Calculate amount for services with price table
    const watchedServiceCharges = form.watch('serviceCharges') || [];

    useEffect(() => {
        watchedServiceCharges.forEach((charge: any, index: number) => {
            if (charge.isPredefined && charge.serviceId) {
                // Try to get metadata from charge itself, otherwise lookup from available services
                let metadata = charge.priceType && charge.priceTiers ? charge : null;
                if (!metadata) {
                    metadata = allAvailableServices.find(s => s._id === charge.serviceId);
                }

                if (metadata && metadata.priceType === 'TABLE' && metadata.priceTiers && Array.isArray(metadata.priceTiers)) {
                    const quantity = Number(charge.quantity) || 0;
                    let price = 0;

                    // Match tiers: quantity > from && (quantity <= to || to === -1)
                    // We sort tiers to ensure specific ones match first before the "remaining" one
                    const sortedTiers = [...metadata.priceTiers].sort((a, b) => {
                        if (a.toValue === -1) return 1;
                        if (b.toValue === -1) return -1;
                        return a.toValue - b.toValue;
                    });

                    const matchingTier = sortedTiers.find((tier: any) => {
                        const from = Number(tier.fromValue) || 0;
                        const to = Number(tier.toValue);
                        if (to === -1) return quantity > from;
                        return quantity > from && quantity <= to;
                    });

                    if (matchingTier) {
                        price = matchingTier.price;
                    } else if (quantity > 0 && sortedTiers.length > 0) {
                        price = sortedTiers[sortedTiers.length - 1].price;
                    }

                    if (price !== Number(charge.amount)) {
                        form.setValue(`serviceCharges.${index}.amount`, price, { shouldDirty: true });
                    }
                }
            }
        });
    }, [watchedServiceCharges, allAvailableServices, form]);


    // Mutations
    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string, data: ContractFormValues }) => {
            const payload: any = { ...data };
            // Sync contractType with roomType
            payload.contractType = data.roomType;
            // Note: tenant details usually not updated here, primarily pricing/dates
            delete payload.newTenant;
            delete payload.tenantId;
            delete payload.roomId;
            delete payload.buildingId;
            // Clean up service charges metadata
            if (payload.serviceCharges) {
                payload.serviceCharges = payload.serviceCharges.map((s: any) => {
                    const { priceType, priceTiers, ...rest } = s;
                    return rest;
                });
            }
            return (await apiClient.put(`/contracts/${id}`, payload)).data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contracts'] });
            queryClient.invalidateQueries({ queryKey: ['rooms-dashboard'] }); // Refresh dashboard
            toast({ title: t('common.success') });
            onSuccess?.();
            form.reset();
        },
        onError: (err: any) => {
            console.error(err);
            const message = err.response?.data?.message;
            if (message === 'PHONE_EXIST' || message === 'PHONE_EXISTS') {
                toast({ variant: 'destructive', title: t('tenants.phoneExists') });
            } else {
                toast({ variant: 'destructive', title: message || 'Error occurred' });
            }
        }
    });

    const createMutation = useMutation({
        mutationFn: async (data: ContractFormValues) => {
            // Prepare payload
            const payload: any = { ...data };
            // Sync contractType with roomType
            payload.contractType = data.roomType;

            if (activeTab === 'existing') {
                delete payload.newTenant;
            } else {
                delete payload.tenantId;
                // Clean up newTenant optional fields if empty
                if (!payload.newTenant.email) delete payload.newTenant.email;
                if (!payload.newTenant.permanentAddress) delete payload.newTenant.permanentAddress;
            }
            // Clean up service charges metadata
            if (payload.serviceCharges) {
                payload.serviceCharges = payload.serviceCharges.map((s: any) => {
                    const { priceType, priceTiers, ...rest } = s;
                    return rest;
                });
            }
            return (await apiClient.post('/contracts', payload)).data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contracts'] });
            queryClient.invalidateQueries({ queryKey: ['rooms'] }); // Update room status
            queryClient.invalidateQueries({ queryKey: ['rooms-dashboard'] }); // Refresh dashboard
            queryClient.invalidateQueries({ queryKey: ['tenants'] }); // New tenant
            toast({ title: t('common.success') });
            onSuccess?.();
            form.reset();
        },
        onError: (err: any) => {
            console.error(err);
            const message = err.response?.data?.message;
            if (message === 'PHONE_EXIST' || message === 'PHONE_EXISTS') {
                toast({ variant: 'destructive', title: t('validation.PHONE_EXISTS') });
            } else if (message === 'ID_CARD_EXISTS') {
                toast({ variant: 'destructive', title: t('validation.ID_CARD_EXISTS') });
            } else {
                toast({ variant: 'destructive', title: message || t('common.error') });
            }
        }
    });

    const createServiceMutation = useMutation({
        mutationFn: async (data: ServiceFormData) => {
            return (await apiClient.post('/services', data)).data;
        },
        onSuccess: (newService) => {
            queryClient.invalidateQueries({ queryKey: ['services'] });
            toast({ title: t('common.success') });
            setIsServiceDialogOpen(false);
            // Auto add the new service to the list
            appendService({
                name: newService.name,
                amount: newService.priceType === 'FIXED' ? newService.fixedPrice : 0,
                quantity: 1,
                isRecurring: true,
                isPredefined: true,
                serviceId: newService._id
            });
        },
        onError: (err: any) => {
            console.error(err);
            toast({ variant: 'destructive', title: err.response?.data?.message || 'Error occurred' });
        }
    });

    const onSubmit = (data: ContractFormValues) => {
        // When using formId, read draft mode from form DOM data attribute
        // (set by external header buttons via onClick before submit)
        const savingAsDraft = isDraftRef.current;
        if (contract) {
            updateMutation.mutate({
                id: contract._id,
                data: {
                    ...data,
                    status: savingAsDraft ? 'DRAFT' as any : 'ACTIVE' as any
                }
            });
        } else {
            createMutation.mutate({
                ...data,
                status: savingAsDraft ? 'DRAFT' as any : 'ACTIVE' as any
            });
        }
    };



    // Auto-fill price configuration when room selected
    const handleRoomChange = (room: any) => {
        if (room) {
            form.setValue('roomType', room.roomType);

            // Long Term logic
            form.setValue('rentPrice', room.defaultRoomPrice || 0);
            form.setValue('electricityPrice', room.defaultElectricPrice || 0);
            form.setValue('waterPrice', room.defaultWaterPrice || 0);
            
            // Auto-fill initial meter indexes from room's current indexes
            form.setValue('initialElectricIndex', room.currentElectricIndex || 0);
            form.setValue('initialWaterIndex', room.currentWaterIndex || 0);

            // Auto-fill payment cycle from room's default term
            if (room.roomType === 'LONG_TERM' && room.defaultTermMonths) {
                const termMonths = room.defaultTermMonths;
                form.setValue('paymentCycleMonths', termMonths);
                // Set appropriate paymentCycle based on term months
                if (termMonths === 1) {
                    form.setValue('paymentCycle', 'MONTHLY');
                } else if (termMonths === 2) {
                    form.setValue('paymentCycle', 'MONTHLY_2');
                } else if (termMonths === 3) {
                    form.setValue('paymentCycle', 'QUARTERLY');
                } else if (termMonths === 6) {
                    form.setValue('paymentCycle', 'MONTHLY_6');
                } else if (termMonths === 12) {
                    form.setValue('paymentCycle', 'MONTHLY_12');
                } else {
                    form.setValue('paymentCycle', 'CUSTOM');
                }
            }

            // Short Term logic
            if (room.roomType === 'SHORT_TERM') {
                form.setValue('shortTermPricingType', room.shortTermPricingType);
                form.setValue('hourlyPricingMode', room.hourlyPricingMode);
                form.setValue('pricePerHour', room.pricePerHour || 0);
                form.setValue('fixedPrice', room.fixedPrice || 0);
                form.setValue('priceTableType', room.priceTableType || 'PROGRESSIVE');
                if (room.shortTermPrices && room.shortTermPrices.length > 0) {
                    replacePrices(room.shortTermPrices);
                } else {
                    replacePrices([]);
                }
            }
            form.setValue('roomId', room._id, { shouldValidate: true });
        }
    };


    const handleAddService = (serviceId: string) => {
        if (serviceId === 'custom') {
            appendService({ name: '', amount: 0, quantity: 1, isRecurring: true, isPredefined: false });
        } else if (serviceId === 'create_new') {
            setIsServiceDialogOpen(true);
        } else {
            const service = allAvailableServices.find((s: any) => s._id === serviceId);
            if (service) {
                // Check for duplicates just in case
                if (addedServiceIds.includes(service._id)) {
                    toast({ variant: 'destructive', title: t('contracts.serviceAlreadyAdded') });
                    return;
                }

                appendService({
                    name: service.name,
                    amount: service.priceType === 'FIXED' ? (service.fixedPrice || 0) : 0,
                    quantity: 1,
                    isRecurring: true,
                    isPredefined: true,
                    serviceId: service._id,
                    // Store price meta for recalculation
                    priceType: service.priceType,
                    priceTiers: service.priceTiers
                });

                // If it's a table price, we might need to trigger calculation immediately
                // but useEffect will handle it since quantity=1 is added
            }
        }
    };

    // Pass header buttons to parent via callback
    useEffect(() => {
        if (!formId || !renderHeaderButtons) return;
        renderHeaderButtons(
            <>
                {(!contract || contract.status === 'DRAFT') && (
                    <Button
                        type="submit"
                        form={formId}
                        variant="secondary"
                        disabled={createMutation.isPending || updateMutation.isPending}
                        onClick={() => {
                            isDraftRef.current = true;
                            setIsDraft(true);
                        }}
                    >
                        {((createMutation.isPending || updateMutation.isPending) && isDraft) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {!contract ? t('contracts.depositShort') : t('common.save')}
                    </Button>
                )}
                <Button
                    type="submit"
                    form={formId}
                    disabled={createMutation.isPending || updateMutation.isPending}
                    onClick={() => {
                        isDraftRef.current = false;
                        setIsDraft(false);
                    }}
                >
                    {((createMutation.isPending || updateMutation.isPending) && !isDraft) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {contract ? (contract.status === 'ACTIVE' ? t('common.save') : t('contracts.activate')) : t('common.create')}
                </Button>
            </>
        );
    }, [formId, renderHeaderButtons, contract, createMutation.isPending, updateMutation.isPending, isDraft, t]);

    return (
        <>
                {formId && !renderHeaderButtons && (
                    <div className="flex justify-end gap-3 mb-4">
                        {(!contract || contract.status === 'DRAFT') && (
                            <Button
                                type="submit"
                                form={formId}
                                variant="secondary"
                                disabled={createMutation.isPending || updateMutation.isPending}
                                onClick={() => {
                                    isDraftRef.current = true;
                                    setIsDraft(true);
                                }}
                            >
                                {((createMutation.isPending || updateMutation.isPending) && isDraft) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {!contract ? t('contracts.depositShort') : t('common.save')}
                            </Button>
                        )}
                        <Button
                            type="submit"
                            form={formId}
                            disabled={createMutation.isPending || updateMutation.isPending}
                            onClick={() => {
                                isDraftRef.current = false;
                                setIsDraft(false);
                            }}
                        >
                            {((createMutation.isPending || updateMutation.isPending) && !isDraft) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {contract ? (contract.status === 'ACTIVE' ? t('common.save') : t('contracts.activate')) : t('common.create')}
                        </Button>
                    </div>
                )}
                <Form {...form}>
                    <form id={formId} onSubmit={form.handleSubmit(onSubmit, (errors) => {
                        console.error('Form validation errors:', errors);
                        toast({
                            variant: "destructive",
                            title: t('common.error'),
                            description: t('validation.pleaseCheckInput', 'Vui lòng kiểm tra lại thông tin nhập liệu')
                        });
                    })} className="space-y-6">
                        <div>

                            <div className="flex gap-6 flex-col md:flex-row">
                                {/* Left Column: Contract Configuration */}
                                <div className="flex-1 space-y-4">
                                    {/* Basic Selection Card */}
                                    <Card>
                                        <CardContent className="pt-6">
                                            <div className="grid grid-cols-2 gap-4">
                                                <FormField
                                                    control={form.control}
                                                    name="buildingId"
                                                    render={({ field, fieldState }) => (
                                                        <FormItem className="space-y-2">
                                                            <FormLabel>{t('buildings.label')} <span className="text-destructive">*</span></FormLabel>
                                                            <FormControl>
                                                                <BuildingSelector
                                                                    value={field.value}
                                                                    onSelect={(id: string | null) => {
                                                                        field.onChange(id || '');
                                                                        setSelectedBuilding(id || '');
                                                                        form.setValue('roomId', '', { shouldValidate: true });
                                                                    }}
                                                                    showAllOption={false}
                                                                    disabled={!!selectedBuildingId || !!contract || !!preSelectedRoomId}
                                                                    error={!!fieldState.error}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />


                                                <FormField
                                                    control={form.control}
                                                    name="roomId"
                                                    render={({ field, fieldState }) => (
                                                        <FormItem className="space-y-2">
                                                            <FormLabel>{t('rooms.label')} <span className="text-destructive">*</span></FormLabel>
                                                            <FormControl>
                                                                <RoomSelector
                                                                    buildingId={selectedBuilding}
                                                                    value={field.value}
                                                                    status="AVAILABLE"
                                                                    onSelect={(room) => {
                                                                        handleRoomChange(room);
                                                                    }}
                                                                    error={!!fieldState.error}
                                                                    disabled={!!contract || !!preSelectedRoomId}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />

                                            </div>
                                        </CardContent>
                                    </Card>

                                    {form.watch('roomId') && (
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-lg">{t('contracts.pricingConfig')}</CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                <FormField
                                                    control={form.control}
                                                    name="roomType"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>{t('contracts.type')}</FormLabel>
                                                            <Select onValueChange={field.onChange} value={field.value} disabled={isActiveContract}>
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="LONG_TERM">{t('contracts.roomTypeLongTerm')}</SelectItem>
                                                                    <SelectItem value="SHORT_TERM">{t('contracts.roomTypeShortTerm')}</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                            {isActiveContract ? (
                                                                <p className="text-xs text-amber-500">{t('contracts.cannotChangeActiveField')}</p>
                                                            ) : (
                                                                <p className="text-xs text-muted-foreground">
                                                                    <span className="font-medium">{t('rooms.roomTypeLongTerm')}:</span> {t('rooms.roomTypeLongTermHint')} • {' '}
                                                                    <span className="font-medium">{t('rooms.roomTypeShortTerm')}:</span> {t('rooms.roomTypeShortTermHint')}
                                                                </p>
                                                            )}
                                                        </FormItem>
                                                    )}
                                                />

                                                {roomType === 'LONG_TERM' && (
                                                    <div className="space-y-4">
                                                        <FormField
                                                            control={form.control}
                                                            name="rentPrice"
                                                            render={({ field, fieldState }) => (
                                                                <FormItem>
                                                                    <FormLabel>{t('contracts.rentPrice')} {roomType === 'LONG_TERM' && <span className="text-destructive">*</span>}</FormLabel>
                                                                    <FormControl>
                                                                        <NumberInput
                                                                            value={field.value}
                                                                            onChange={field.onChange}
                                                                            error={!!fieldState.error}
                                                                        />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <FormField
                                                                control={form.control}
                                                                name="electricityPrice"
                                                                render={({ field, fieldState }) => (
                                                                    <FormItem>
                                                                        <FormLabel>{t('contracts.electricPrice')} {roomType === 'LONG_TERM' && <span className="text-destructive">*</span>}</FormLabel>
                                                                        <div className="relative">
                                                                            <FormControl>
                                                                                <NumberInput
                                                                                    value={field.value}
                                                                                    onChange={field.onChange}
                                                                                    className="pr-16"
                                                                                    error={!!fieldState.error}
                                                                                />
                                                                            </FormControl>
                                                                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-muted-foreground text-sm">
                                                                                / {t('contracts.unitIndex')}
                                                                            </div>
                                                                        </div>
                                                                        <FormMessage />
                                                                    </FormItem>
                                                                )}
                                                            />
                                                            <FormField
                                                                control={form.control}
                                                                name="waterPrice"
                                                                render={({ field, fieldState }) => (
                                                                    <FormItem>
                                                                        <FormLabel>{t('contracts.waterPrice')} {roomType === 'LONG_TERM' && <span className="text-destructive">*</span>}</FormLabel>
                                                                        <div className="relative">
                                                                            <FormControl>
                                                                                <NumberInput
                                                                                    value={field.value}
                                                                                    onChange={field.onChange}
                                                                                    className="pr-16"
                                                                                    error={!!fieldState.error}
                                                                                />
                                                                            </FormControl>
                                                                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-muted-foreground text-sm">
                                                                                / {t('contracts.unitIndex')}
                                                                            </div>
                                                                        </div>
                                                                        <FormMessage />
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <FormField
                                                                control={form.control}
                                                                name="initialElectricIndex"
                                                                render={({ field, fieldState }) => (
                                                                    <FormItem>
                                                                        <FormLabel>{t('contracts.initialElectricIndex')} {roomType === 'LONG_TERM' && <span className="text-destructive">*</span>}</FormLabel>
                                                                        <FormControl>
                                                                            <NumberInput
                                                                                value={field.value}
                                                                                onChange={field.onChange}
                                                                                error={!!fieldState.error}
                                                                                disabled={hasInvoices}
                                                                            />
                                                                        </FormControl>
                                                                        {hasInvoices && <p className="text-xs text-amber-500">{t('contracts.cannotChangeMeterWithInvoice')}</p>}
                                                                        <FormMessage />
                                                                    </FormItem>
                                                                )}
                                                            />
                                                            <FormField
                                                                control={form.control}
                                                                name="initialWaterIndex"
                                                                render={({ field, fieldState }) => (
                                                                    <FormItem>
                                                                        <FormLabel>{t('contracts.initialWaterIndex')} {roomType === 'LONG_TERM' && <span className="text-destructive">*</span>}</FormLabel>
                                                                        <FormControl>
                                                                            <NumberInput
                                                                                value={field.value}
                                                                                onChange={field.onChange}
                                                                                error={!!fieldState.error}
                                                                                disabled={hasInvoices}
                                                                            />
                                                                        </FormControl>
                                                                        {hasInvoices && <p className="text-xs text-amber-500">{t('contracts.cannotChangeMeterWithInvoice')}</p>}
                                                                        <FormMessage />
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {roomType === 'SHORT_TERM' && (
                                                    <div className="space-y-4 border p-3 rounded-md bg-muted/20">
                                                        <FormField
                                                            control={form.control}
                                                            name="shortTermPricingType"
                                                            render={({ field, fieldState }) => (
                                                                <FormItem>
                                                                    <FormLabel>{t('contracts.pricingModel')} <span className="text-destructive">*</span></FormLabel>
                                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                                        <FormControl>
                                                                            <SelectTrigger error={!!fieldState.error}>
                                                                                <SelectValue />
                                                                            </SelectTrigger>
                                                                        </FormControl>
                                                                        <SelectContent>
                                                                            <SelectItem value="HOURLY">{t('contracts.modelHourly')}</SelectItem>
                                                                            <SelectItem value="DAILY">{t('contracts.modelDaily')}</SelectItem>
                                                                            <SelectItem value="FIXED">{t('contracts.modelFixed')}</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />

                                                        {currentShortTermType === 'FIXED' && (
                                                            <FormField
                                                                control={form.control}
                                                                name="fixedPrice"
                                                                render={({ field, fieldState }) => (
                                                                    <FormItem>
                                                                        <FormLabel>{t('contracts.fixedPrice')} <span className="text-destructive">*</span></FormLabel>
                                                                        <FormControl>
                                                                            <NumberInput
                                                                                value={field.value}
                                                                                onChange={field.onChange}
                                                                                error={!!fieldState.error}
                                                                            />
                                                                        </FormControl>
                                                                        <FormMessage />
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        )}

                                                        {currentShortTermType === 'HOURLY' && (
                                                            <div className="space-y-4">
                                                                <FormField
                                                                    control={form.control}
                                                                    name="hourlyPricingMode"
                                                                    render={({ field, fieldState }) => (
                                                                        <FormItem>
                                                                            <FormLabel>{t('contracts.hourlyMode')} <span className="text-destructive">*</span></FormLabel>
                                                                            <Select onValueChange={field.onChange} value={field.value}>
                                                                                <FormControl>
                                                                                    <SelectTrigger error={!!fieldState.error}>
                                                                                        <SelectValue />
                                                                                    </SelectTrigger>
                                                                                </FormControl>
                                                                                <SelectContent>
                                                                                    <SelectItem value="PER_HOUR">{t('contracts.modePerHour')}</SelectItem>
                                                                                    <SelectItem value="TABLE">{t('contracts.modeTable')}</SelectItem>
                                                                                </SelectContent>
                                                                            </Select>
                                                                            <FormMessage />
                                                                        </FormItem>
                                                                    )}
                                                                />

                                                                {currentHourlyMode === 'PER_HOUR' && (
                                                                    <FormField
                                                                        control={form.control}
                                                                        name="pricePerHour"
                                                                        render={({ field, fieldState }) => (
                                                                            <FormItem>
                                                                                <FormLabel>{t('contracts.pricePerHour')} <span className="text-destructive">*</span></FormLabel>
                                                                                <FormControl>
                                                                                    <NumberInput
                                                                                        value={field.value}
                                                                                        onChange={field.onChange}
                                                                                        error={!!fieldState.error}
                                                                                    />
                                                                                </FormControl>
                                                                                <FormMessage />
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                )}

                                                                {currentHourlyMode === 'TABLE' && (
                                                                    <div className="space-y-4">
                                                                        {/* Price Table Type Selection */}
                                                                        <div className="space-y-2">
                                                                            <Label>{t('rooms.priceTableType')}</Label>
                                                                            <FormField
                                                                                control={form.control}
                                                                                name="priceTableType"
                                                                                render={({ field }) => (
                                                                                    <RadioGroup
                                                                                        value={field.value || 'PROGRESSIVE'}
                                                                                        onValueChange={field.onChange}
                                                                                        className="flex flex-col gap-3"
                                                                                    >
                                                                                        <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                                                                            <RadioGroupItem value="PROGRESSIVE" id="contract-progressive" className="mt-0.5" />
                                                                                            <div className="space-y-1">
                                                                                                <Label htmlFor="contract-progressive" className="font-medium cursor-pointer">
                                                                                                    {t('rooms.priceTableProgressive')}
                                                                                                </Label>
                                                                                                <p className="text-xs text-muted-foreground">
                                                                                                    {t('rooms.priceTableProgressiveHint')}
                                                                                                </p>
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                                                                            <RadioGroupItem value="FLAT" id="contract-flat" className="mt-0.5" />
                                                                                            <div className="space-y-1">
                                                                                                <Label htmlFor="contract-flat" className="font-medium cursor-pointer">
                                                                                                    {t('rooms.priceTableFlat')}
                                                                                                </Label>
                                                                                                <p className="text-xs text-muted-foreground">
                                                                                                    {t('rooms.priceTableFlatHint')}
                                                                                                </p>
                                                                                            </div>
                                                                                        </div>
                                                                                    </RadioGroup>
                                                                                )}
                                                                            />
                                                                        </div>

                                                                        <div className="space-y-2">
                                                                        <Label>{t('contracts.priceTable')}</Label>
                                                                        <div className="space-y-2">
                                                                            {priceFields.map((field, index) => {
                                                                                const isLast = index === priceFields.length - 1;
                                                                                const isFirst = index === 0;
                                                                                // Access errors safely
                                                                                const priceError = form.formState.errors.shortTermPrices?.[index]?.price;
                                                                                const toValueError = form.formState.errors.shortTermPrices?.[index]?.toValue;

                                                                                return (
                                                                                    <div key={field.id} className="space-y-1">
                                                                                        <div className="flex gap-2 items-center">
                                                                                            <NumberInput
                                                                                                value={field.fromValue}
                                                                                                disabled={true}
                                                                                                placeholder={t('rooms.fromHour')}
                                                                                                onChange={() => { }}
                                                                                                className="w-20"
                                                                                                decimalScale={0}
                                                                                            />
                                                                                            <span className="text-muted-foreground">-</span>
                                                                                            {isLast ? (
                                                                                                <span className="w-20 text-center text-muted-foreground italic">
                                                                                                    {t('rooms.remaining')}
                                                                                                </span>
                                                                                            ) : (
                                                                                                <FormField
                                                                                                    control={form.control}
                                                                                                    name={`shortTermPrices.${index}.toValue`}
                                                                                                    render={({ field: toField }) => (
                                                                                                        <FormItem className="space-y-0">
                                                                                                            <FormControl>
                                                                                                                <NumberInput
                                                                                                                    value={toField.value}
                                                                                                                    placeholder={t('rooms.toHour')}
                                                                                                                    onChange={(v) => {
                                                                                                                        if (v !== undefined) {
                                                                                                                            toField.onChange(v);
                                                                                                                            handleToValueChange(index, v);
                                                                                                                        }
                                                                                                                    }}
                                                                                                                    className="w-20"
                                                                                                                    decimalScale={0}
                                                                                                                    error={!!toValueError || (typeof toField.value === 'number' && toField.value >= 0 && toField.value < field.fromValue)}
                                                                                                                />
                                                                                                            </FormControl>
                                                                                                        </FormItem>
                                                                                                    )}
                                                                                                />
                                                                                            )}
                                                                                            <FormField
                                                                                                control={form.control}
                                                                                                name={`shortTermPrices.${index}.price`}
                                                                                                render={({ field: priceField }) => (
                                                                                                    <FormItem className="flex-1 space-y-0">
                                                                                                        <FormControl>
                                                                                                            <NumberInput
                                                                                                                value={priceField.value}
                                                                                                                placeholder={t('contracts.priceAmount')}
                                                                                                                onChange={priceField.onChange}
                                                                                                                className="w-full"
                                                                                                                error={!!priceError}
                                                                                                            />
                                                                                                        </FormControl>
                                                                                                    </FormItem>
                                                                                                )}
                                                                                            />
                                                                                            <div className="w-10">
                                                                                                {!isFirst && !isLast && (
                                                                                                    <Button
                                                                                                        type="button"
                                                                                                        variant="ghost"
                                                                                                        size="icon"
                                                                                                        onClick={() => {
                                                                                                            const prevField = priceFields[index - 1];
                                                                                                            const nextField = priceFields[index + 1];
                                                                                                            if (nextField) {
                                                                                                                updatePrice(index + 1, { ...nextField, fromValue: (prevField.toValue as number) + 1 });
                                                                                                            }
                                                                                                            removePrice(index);
                                                                                                        }}
                                                                                                    >
                                                                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                                                                    </Button>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                            <Button
                                                                                type="button"
                                                                                variant="outline"
                                                                                size="sm"
                                                                                onClick={handleAddPriceTier}
                                                                            >
                                                                                <Plus className="h-4 w-4 mr-2" />
                                                                                {t('rooms.addPriceTier')}
                                                                            </Button>
                                                                        </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {currentShortTermType === 'DAILY' && (
                                                            <div className="space-y-4">
                                                                {/* Price Table Type Selection */}
                                                                <div className="space-y-2">
                                                                    <Label>{t('rooms.priceTableType')}</Label>
                                                                    <FormField
                                                                        control={form.control}
                                                                        name="priceTableType"
                                                                        render={({ field }) => (
                                                                            <RadioGroup
                                                                                value={field.value || 'PROGRESSIVE'}
                                                                                onValueChange={field.onChange}
                                                                                className="flex flex-col gap-3"
                                                                            >
                                                                                <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                                                                    <RadioGroupItem value="PROGRESSIVE" id="contract-daily-progressive" className="mt-0.5" />
                                                                                    <div className="space-y-1">
                                                                                        <Label htmlFor="contract-daily-progressive" className="font-medium cursor-pointer">
                                                                                            {t('rooms.priceTableProgressive')}
                                                                                        </Label>
                                                                                        <p className="text-xs text-muted-foreground">
                                                                                            {t('rooms.priceTableProgressiveHintDaily')}
                                                                                        </p>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                                                                    <RadioGroupItem value="FLAT" id="contract-daily-flat" className="mt-0.5" />
                                                                                    <div className="space-y-1">
                                                                                        <Label htmlFor="contract-daily-flat" className="font-medium cursor-pointer">
                                                                                            {t('rooms.priceTableFlat')}
                                                                                        </Label>
                                                                                        <p className="text-xs text-muted-foreground">
                                                                                            {t('rooms.priceTableFlatHintDaily')}
                                                                                        </p>
                                                                                    </div>
                                                                                </div>
                                                                            </RadioGroup>
                                                                        )}
                                                                    />
                                                                </div>

                                                                <div className="space-y-2">
                                                                    <Label>{t('contracts.priceTable')}</Label>
                                                                    <div className="space-y-2">
                                                                        {priceFields.map((field, index) => {
                                                                            const isLast = index === priceFields.length - 1;
                                                                            const isFirst = index === 0;
                                                                            const priceError = form.formState.errors.shortTermPrices?.[index]?.price;
                                                                            const toValueError = form.formState.errors.shortTermPrices?.[index]?.toValue;

                                                                            return (
                                                                                <div key={field.id} className="space-y-1">
                                                                                    <div className="flex gap-2 items-center">
                                                                                        <NumberInput
                                                                                            value={field.fromValue}
                                                                                            disabled={true}
                                                                                            placeholder={t('rooms.fromDay')}
                                                                                            onChange={() => { }}
                                                                                            className="w-20"
                                                                                            decimalScale={0}
                                                                                        />
                                                                                        <span className="text-muted-foreground">-</span>
                                                                                        {isLast ? (
                                                                                            <span className="w-20 text-center text-muted-foreground italic">
                                                                                                {t('rooms.remaining')}
                                                                                            </span>
                                                                                        ) : (
                                                                                            <FormField
                                                                                                control={form.control}
                                                                                                name={`shortTermPrices.${index}.toValue`}
                                                                                                render={({ field: toField }) => (
                                                                                                    <FormItem className="space-y-0">
                                                                                                        <FormControl>
                                                                                                            <NumberInput
                                                                                                                value={toField.value}
                                                                                                                placeholder={t('rooms.toDay')}
                                                                                                                onChange={(v) => {
                                                                                                                    if (v !== undefined) {
                                                                                                                        toField.onChange(v);
                                                                                                                        handleToValueChange(index, v);
                                                                                                                    }
                                                                                                                }}
                                                                                                                className="w-20"
                                                                                                                decimalScale={0}
                                                                                                                error={!!toValueError || (typeof toField.value === 'number' && toField.value >= 0 && toField.value < field.fromValue)}
                                                                                                            />
                                                                                                        </FormControl>
                                                                                                    </FormItem>
                                                                                                )}
                                                                                            />
                                                                                        )}
                                                                                        <FormField
                                                                                            control={form.control}
                                                                                            name={`shortTermPrices.${index}.price`}
                                                                                            render={({ field: priceField }) => (
                                                                                                <FormItem className="flex-1 space-y-0">
                                                                                                    <FormControl>
                                                                                                        <NumberInput
                                                                                                            value={priceField.value}
                                                                                                            placeholder={t('contracts.priceAmount')}
                                                                                                            onChange={priceField.onChange}
                                                                                                            className="w-full"
                                                                                                            error={!!priceError}
                                                                                                        />
                                                                                                    </FormControl>
                                                                                                </FormItem>
                                                                                            )}
                                                                                        />
                                                                                        {!isFirst && !isLast && (
                                                                                            <Button
                                                                                                type="button"
                                                                                                variant="ghost"
                                                                                                size="icon"
                                                                                                onClick={() => {
                                                                                                    const prevField = priceFields[index - 1];
                                                                                                    const nextField = priceFields[index + 1];
                                                                                                    if (nextField) {
                                                                                                        updatePrice(index + 1, { ...nextField, fromValue: (prevField.toValue as number) + 1 });
                                                                                                    }
                                                                                                    removePrice(index);
                                                                                                }}
                                                                                            >
                                                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                                                            </Button>
                                                                                        )}
                                                                                        {(isFirst || isLast) && <div className="w-10" />}
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                        <Button
                                                                            type="button"
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={handleAddPriceTier}
                                                                        >
                                                                            <Plus className="h-4 w-4 mr-2" />
                                                                            {t('rooms.addPriceTier')}
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    )}

                                    <Card>
                                        <CardContent className="pt-6 space-y-4">
                                            {/* Deposit & Dates */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <FormField
                                                    control={form.control}
                                                    name="depositAmount"
                                                    render={({ field, fieldState }) => (
                                                        <FormItem>
                                                            <FormLabel>{t('contracts.deposit')} <span className="text-destructive">*</span></FormLabel>
                                                            <FormControl>
                                                                <NumberInput
                                                                    value={field.value}
                                                                    onChange={field.onChange}
                                                                    error={!!fieldState.error}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                {roomType === 'LONG_TERM' && (
                                                    <FormField
                                                        control={form.control}
                                                        name="paymentCycle"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>{t('contracts.paymentCycle')}</FormLabel>
                                                                <Select onValueChange={(value) => {
                                                                    field.onChange(value);
                                                                    // Set default months based on cycle
                                                                    if (value === 'MONTHLY') form.setValue('paymentCycleMonths', 1);
                                                                    else if (value === 'MONTHLY_2') form.setValue('paymentCycleMonths', 2);
                                                                    else if (value === 'QUARTERLY') form.setValue('paymentCycleMonths', 3);
                                                                    else if (value === 'MONTHLY_6') form.setValue('paymentCycleMonths', 6);
                                                                    else if (value === 'MONTHLY_12') form.setValue('paymentCycleMonths', 12);
                                                                }} value={field.value}>
                                                                    <FormControl>
                                                                        <SelectTrigger>
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                    </FormControl>
                                                                    <SelectContent>
                                                                        <SelectItem value="MONTHLY">{t('contracts.cycleMonthly')}</SelectItem>
                                                                        <SelectItem value="MONTHLY_2">{t('contracts.cycleMonthly2')}</SelectItem>
                                                                        <SelectItem value="QUARTERLY">{t('contracts.cycleQuarterly')}</SelectItem>
                                                                        <SelectItem value="MONTHLY_6">{t('contracts.cycleHalfYearly')}</SelectItem>
                                                                        <SelectItem value="MONTHLY_12">{t('contracts.cycleYearly')}</SelectItem>
                                                                        <SelectItem value="CUSTOM" className="text-primary font-medium">{t('contracts.cycleCustom')}</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                )}
                                                {form.watch('paymentCycle') === 'CUSTOM' && (
                                                    <FormField
                                                        control={form.control}
                                                        name="paymentCycleMonths"
                                                        render={({ field, fieldState }) => (
                                                            <FormItem>
                                                                <FormLabel>{t('contracts.paymentCycleMonths')} <span className="text-destructive">*</span></FormLabel>
                                                                <FormControl>
                                                                    <NumberInput
                                                                        value={field.value}
                                                                        onChange={field.onChange}
                                                                        error={!!fieldState.error}
                                                                    />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                )}

                                                {/* Payment Due Day */}
                                                {roomType === 'LONG_TERM' && (
                                                    <FormField
                                                        control={form.control}
                                                        name="paymentDueDay"
                                                        render={({ field }) => {
                                                            const value = field.value;
                                                            const isCustom = ![1, 5, 10, 15, 20, 31].includes(value || 0);

                                                            return (
                                                                <FormItem>
                                                                    <FormLabel>{t('contracts.paymentDueDay')} <span className="text-destructive">*</span></FormLabel>
                                                                    <div className="flex gap-2">
                                                                        <Select
                                                                            value={isCustom ? 'CUSTOM' : (value?.toString() || '1')}
                                                                            onValueChange={(val) => {
                                                                                if (val !== 'CUSTOM') {
                                                                                    field.onChange(parseInt(val));
                                                                                } else {
                                                                                    // Default to 1 if switching to custom
                                                                                    field.onChange(1);
                                                                                }
                                                                            }}
                                                                        >
                                                                            <FormControl>
                                                                                <SelectTrigger className="flex-1">
                                                                                    <SelectValue />
                                                                                </SelectTrigger>
                                                                            </FormControl>
                                                                            <SelectContent>
                                                                                <SelectItem value="1">{t('contracts.paymentDay1')}</SelectItem>
                                                                                <SelectItem value="5">{t('contracts.paymentDay5')}</SelectItem>
                                                                                <SelectItem value="10">{t('contracts.paymentDay10')}</SelectItem>
                                                                                <SelectItem value="15">{t('contracts.paymentDay15')}</SelectItem>
                                                                                <SelectItem value="20">{t('contracts.paymentDay20')}</SelectItem>
                                                                                <SelectItem value="31">{t('contracts.paymentDayLast')}</SelectItem>
                                                                                <SelectItem value="CUSTOM" className="text-primary font-medium">{t('contracts.paymentDayCustom')}</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                        {isCustom && (
                                                                            <NumberInput
                                                                                value={value}
                                                                                onChange={(val) => {
                                                                                    // Enforce 1-25 range for custom input
                                                                                    if (val !== undefined && val >= 1 && val <= 25) {
                                                                                        field.onChange(val);
                                                                                    }
                                                                                }}
                                                                                className="w-24"
                                                                                placeholder="1-25"
                                                                            />
                                                                        )}
                                                                    </div>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            );
                                                        }}
                                                    />
                                                )}
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <FormField
                                                    control={form.control}
                                                    name="startDate"
                                                    render={({ field, fieldState }) => (
                                                        <FormItem className="flex flex-col">
                                                            <FormLabel>{t('contracts.startDate')} <span className="text-destructive">*</span></FormLabel>
                                                            <FormControl>
                                                                {form.watch('roomType') === 'SHORT_TERM' ? (
                                                                    <DateTimePicker
                                                                        value={field.value}
                                                                        onChange={(date) => {
                                                                            field.onChange(date ? date.toISOString() : '');
                                                                        }}
                                                                        showTime={true}
                                                                        disabled={isActiveContract}
                                                                        className={cn(fieldState.error && "border-destructive focus-visible:ring-destructive")}
                                                                    />
                                                                ) : (
                                                                    <DatePicker
                                                                        value={field.value}
                                                                        onChange={(date) => {
                                                                            field.onChange(date ? format(date, 'yyyy-MM-dd') : '');
                                                                        }}
                                                                        disabled={isActiveContract}
                                                                        className={cn(fieldState.error && "border-destructive focus-visible:ring-destructive")}
                                                                    />
                                                                )}
                                                            </FormControl>
                                                            {isActiveContract && <p className="text-xs text-amber-500">{t('contracts.cannotChangeActiveField')}</p>}
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="endDate"
                                                    render={({ field, fieldState }) => {
                                                        return (
                                                            <FormItem className="flex flex-col">
                                                                <FormLabel>{t('contracts.endDate')}</FormLabel>
                                                                <FormControl>
                                                                    {form.watch('roomType') === 'SHORT_TERM' ? (
                                                                        <DateTimePicker
                                                                            value={field.value}
                                                                            onChange={(date) => {
                                                                                field.onChange(date ? date.toISOString() : undefined);
                                                                            }}
                                                                            showTime={true}
                                                                            disabledDate={(date) => {
                                                                                if (!startDate) return false;
                                                                                const start = new Date(startDate);
                                                                                // Normalize start date to beginning of day for comparison
                                                                                start.setHours(0, 0, 0, 0);
                                                                                // For Short Term, allow same day (so only disable previous days)
                                                                                // Calendar date is typically 00:00:00
                                                                                return date < start;
                                                                            }}
                                                                            className={cn(fieldState.error && "border-destructive focus-visible:ring-destructive")}
                                                                        />
                                                                    ) : (
                                                                        <DatePicker
                                                                            value={field.value}
                                                                            onChange={(date) => {
                                                                                field.onChange(date ? format(date, 'yyyy-MM-dd') : undefined);
                                                                            }}
                                                                            disabledDate={(date) => {
                                                                                if (!startDate) return false;
                                                                                const start = new Date(startDate);
                                                                                start.setHours(0, 0, 0, 0);
                                                                                
                                                                                // For LONG_TERM: End Date must be AFTER first payment due date
                                                                                // Example: startDate=20/01, cycle=3, dueDay=22 => disable <= 22/04
                                                                                const cycleMonths = form.getValues('paymentCycleMonths') || 1;
                                                                                const dueDay = form.getValues('paymentDueDay') || 1;
                                                                                
                                                                                // Step 1: Add cycle months to start date
                                                                                const targetMonth = new Date(start);
                                                                                targetMonth.setMonth(targetMonth.getMonth() + cycleMonths);
                                                                                
                                                                                // Step 2: Set due day (handle month overflow)
                                                                                const year = targetMonth.getFullYear();
                                                                                const month = targetMonth.getMonth();
                                                                                const daysInMonth = new Date(year, month + 1, 0).getDate();
                                                                                const actualDueDay = Math.min(dueDay, daysInMonth);
                                                                                
                                                                                const firstDueDate = new Date(year, month, actualDueDay);
                                                                                firstDueDate.setHours(0, 0, 0, 0);

                                                                                // Disable if date is ON or BEFORE first payment due date
                                                                                return date <= firstDueDate;
                                                                            }}
                                                                            className={cn(fieldState.error && "border-destructive focus-visible:ring-destructive")}
                                                                        />
                                                                    )}
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        );
                                                    }}
                                                />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Right Column: Tenant & Services */}
                                <div className="flex-1 space-y-4">
                                    {/* Tenant Selection Custom Tabs - only for new contracts */}
                                    {!contract ? (
                                        <div className="w-full border p-4 rounded-md space-y-4">
                                            <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1 mb-4">
                                                <button
                                                    type="button"
                                                    className={`flex-1 flex items-center justify-center py-2 px-3 rounded-md text-sm font-medium transition-all ${activeTab === 'existing'
                                                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                                        : 'text-slate-600 dark:text-slate-400'
                                                        }`}
                                                    onClick={() => {
                                                        setActiveTab('existing');
                                                        // Clear newTenant data and errors when switching to existing
                                                        form.setValue('newTenant', undefined);
                                                        form.clearErrors('newTenant');
                                                        // Trigger validation for tenantId field
                                                        form.trigger('tenantId');
                                                    }}
                                                >
                                                    {t('contracts.existingTenant')}
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`flex-1 flex items-center justify-center py-2 px-3 rounded-md text-sm font-medium transition-all ${activeTab === 'new'
                                                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                                        : 'text-slate-600 dark:text-slate-400'
                                                        }`}
                                                    onClick={() => {
                                                        setActiveTab('new');
                                                        // Clear tenantId when switching to new tenant tab
                                                        form.setValue('tenantId', '');
                                                        form.clearErrors('tenantId');
                                                    }}
                                                >
                                                    {t('contracts.newTenant')}
                                                </button>
                                            </div>

                                            {activeTab === 'existing' && (
                                                <FormField
                                                    control={form.control}
                                                    name="tenantId"
                                                    render={({ field, fieldState }) => (
                                                        <FormItem>
                                                            <FormLabel>{t('contracts.selectTenant')} <span className="text-destructive">*</span></FormLabel>
                                                            <FormControl>
                                                                <TenantSelector
                                                                    value={field.value}
                                                                    onSelect={field.onChange}
                                                                    error={!!fieldState.error}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            )}

                                            {activeTab === 'new' && (
                                                <div className="space-y-4">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <FormField
                                                            control={form.control}
                                                            name="newTenant.fullName"
                                                            render={({ field, fieldState }) => (
                                                                <FormItem>
                                                                    <FormLabel>{t('tenants.fullName')} <span className="text-destructive">*</span></FormLabel>
                                                                    <FormControl>
                                                                        <Input {...field} error={!!fieldState.error} />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                        <FormField
                                                            control={form.control}
                                                            name="newTenant.phone"
                                                            render={({ field, fieldState }) => (
                                                                <FormItem>
                                                                    <FormLabel>{t('tenants.phone')} <span className="text-destructive">*</span></FormLabel>
                                                                    <FormControl>
                                                                        <Input {...field} error={!!fieldState.error} />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                        <FormField
                                                            control={form.control}
                                                            name="newTenant.idCard"
                                                            render={({ field, fieldState }) => (
                                                                <FormItem>
                                                                    <FormLabel>{t('tenants.idNumber')} <span className="text-destructive">*</span></FormLabel>
                                                                    <FormControl>
                                                                        <Input {...field} error={!!fieldState.error} />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                        <FormField
                                                            control={form.control}
                                                            name="newTenant.email"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel>{t('tenants.email')}</FormLabel>
                                                                    <FormControl>
                                                                        <Input {...field} />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </div>
                                                    <FormField
                                                        control={form.control}
                                                        name="newTenant.permanentAddress"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>{t('tenants.address')}</FormLabel>
                                                                <FormControl>
                                                                    <Input {...field} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        /* Edit Mode: Show tenant info (read-only) */
                                        <div className="w-full border p-4 rounded-md space-y-3">
                                            <Label className="text-base font-semibold">{t('contracts.tenant')}</Label>
                                            {contract?.tenantId ? (
                                                <div className="grid grid-cols-2 gap-3 text-sm">
                                                    <div>
                                                        <span className="text-muted-foreground">{t('tenants.fullName')}:</span>
                                                        <p className="font-medium">{contract.tenantId.fullName || '-'}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-muted-foreground">{t('tenants.phone')}:</span>
                                                        <p className="font-medium">{formatPhoneNumber(contract.tenantId.phone)}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-muted-foreground">{t('tenants.idNumber')}:</span>
                                                        <p className="font-medium">{contract.tenantId.idCard || '-'}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-muted-foreground">{t('tenants.email')}:</span>
                                                        <p className="font-medium">{contract.tenantId.email || '-'}</p>
                                                    </div>
                                                    {contract.tenantId.permanentAddress && (
                                                        <div className="col-span-2">
                                                            <span className="text-muted-foreground">{t('tenants.address')}:</span>
                                                            <p className="font-medium">{contract.tenantId.permanentAddress}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <p className="text-sm text-muted-foreground">{t('common.notFound')}</p>
                                            )}
                                        </div>
                                    )}

                                    {/* Services Section */}
                                    <div className="border p-4 rounded-md space-y-4">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-base font-semibold">{t('contracts.services')}</Label>

                                            <Popover open={openServiceCombobox} onOpenChange={(open) => {
                                                setOpenServiceCombobox(open);
                                                if (!open) setServiceSearch('');
                                            }} modal={true}>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className="justify-start">
                                                        <Plus className="mr-2 h-4 w-4" />
                                                        {t('contracts.addService')}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[280px] p-0" align="end">
                                                    <Command shouldFilter={false}>
                                                        <CommandInput
                                                            placeholder={t('common.search')}
                                                            value={serviceSearch}
                                                            onValueChange={setServiceSearch}
                                                        />
                                                        <CommandEmpty>{isServicesLoading ? t('common.loading') : t('common.noData')}</CommandEmpty>
                                                        <CommandList>
                                                            <CommandGroup>
                                                                <CommandItem
                                                                    onSelect={() => {
                                                                        handleAddService('create_new');
                                                                        setOpenServiceCombobox(false);
                                                                    }}
                                                                    className="text-primary font-medium cursor-pointer"
                                                                >
                                                                    <Plus className="mr-2 h-4 w-4" />
                                                                    {t('services.createNew')}
                                                                </CommandItem>
                                                                <CommandItem
                                                                    onSelect={() => {
                                                                        handleAddService('custom');
                                                                        setOpenServiceCombobox(false);
                                                                    }}
                                                                    className="text-primary font-medium cursor-pointer"
                                                                >
                                                                    <Plus className="mr-2 h-4 w-4" />
                                                                    {t('contracts.customService')}
                                                                </CommandItem>
                                                            </CommandGroup>
                                                            <CommandSeparator />
                                                            <CommandGroup heading={t('services.available')}>
                                                                {availableServices.map((service: any) => (
                                                                    <CommandItem
                                                                        key={service._id}
                                                                        value={service.name}
                                                                        onSelect={() => {
                                                                            handleAddService(service._id);
                                                                            setOpenServiceCombobox(false);
                                                                        }}
                                                                    >
                                                                        {service.name}
                                                                        {service.priceType === 'FIXED' ? ` - ${service.fixedPrice?.toLocaleString('vi-VN')}đ` : ` - ${t('services.priceTable')}`}
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                            {hasNextServicePage && (
                                                                <div
                                                                    ref={lastServiceRef}
                                                                    className="p-4 flex justify-center items-center min-h-[40px]"
                                                                >
                                                                    {isFetchingNextServicePage && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                                                                </div>
                                                            )}
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </div>

                                        <div className="space-y-2">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-[200px]">{t('contracts.serviceName')}</TableHead>
                                                        <TableHead className="w-[100px]">{t('common.quantity')}</TableHead>
                                                        <TableHead className="w-[120px]">{t('contracts.serviceAmount')}</TableHead>
                                                        <TableHead className="w-[120px] text-right">{t('contracts.totalAmount')}</TableHead>
                                                        <TableHead className="w-[50px]"></TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {serviceFields.map((field, index) => {
                                                        const quantity = form.watch(`serviceCharges.${index}.quantity`) || 0;
                                                        const amount = form.watch(`serviceCharges.${index}.amount`) || 0;
                                                        const isPredefined = form.watch(`serviceCharges.${index}.isPredefined`);
                                                        const total = quantity * amount;

                                                        return (
                                                            <TableRow key={field.id}>
                                                                <TableCell>
                                                                    <FormField
                                                                        control={form.control}
                                                                        name={`serviceCharges.${index}.name`}
                                                                        render={({ field }) => (
                                                                            <FormItem>
                                                                                <FormControl>
                                                                                    <Input {...field} className="h-8" disabled={isPredefined} title={isPredefined ? t('contracts.predefinedServiceHint') : ''} />
                                                                                </FormControl>
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                </TableCell>
                                                                <TableCell>
                                                                    <FormField
                                                                        control={form.control}
                                                                        name={`serviceCharges.${index}.quantity`}
                                                                        render={({ field }) => (
                                                                            <FormItem>
                                                                                <FormControl>
                                                                                    <NumberInput
                                                                                        value={field.value}
                                                                                        onChange={field.onChange}
                                                                                        placeholder="1"
                                                                                        min={1}
                                                                                        decimalScale={0}
                                                                                        className="h-8"
                                                                                    />
                                                                                </FormControl>
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                </TableCell>
                                                                <TableCell>
                                                                    <FormField
                                                                        control={form.control}
                                                                        name={`serviceCharges.${index}.amount`}
                                                                        render={({ field, fieldState }) => (
                                                                            <FormItem>
                                                                                <FormControl>
                                                                                    <NumberInput
                                                                                        value={field.value}
                                                                                        onChange={field.onChange}
                                                                                        placeholder="0"
                                                                                        error={!!fieldState.error}
                                                                                        className="h-8"
                                                                                        disabled={isPredefined}
                                                                                    />
                                                                                </FormControl>
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="text-right font-medium">
                                                                    {new Intl.NumberFormat('vi-VN').format(total)}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeService(index)}>
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                    {serviceFields.length === 0 && (
                                                        <TableRow>
                                                            <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                                                                {t('contracts.noServices')}
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                                <TableFooter>
                                                    <TableRow>
                                                        <TableCell colSpan={3} className="font-bold text-right">{t('contracts.totalServiceAmount')}</TableCell>
                                                        <TableCell className="text-right font-bold text-primary">
                                                            {new Intl.NumberFormat('vi-VN').format(
                                                                serviceFields.reduce((acc, _, index) => {
                                                                    const quantity = form.watch(`serviceCharges.${index}.quantity`) || 0;
                                                                    const amount = form.watch(`serviceCharges.${index}.amount`) || 0;
                                                                    return acc + (quantity * amount);
                                                                }, 0)
                                                            )}
                                                        </TableCell>
                                                        <TableCell></TableCell>
                                                    </TableRow>
                                                </TableFooter>
                                            </Table>
                                        </div>


                                    </div>

                                    {/* Notes Card */}
                                    <div className="border p-4 rounded-md space-y-2">
                                        <FormField
                                            control={form.control}
                                            name="notes"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>{t('contracts.notes')}</FormLabel>
                                                    <FormControl>
                                                        <Textarea
                                                            {...field}
                                                            rows={3}
                                                            placeholder={t('contracts.notesPlaceholder')}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>

                            </div>

                        </div>
                        {!formId && (
                            <div className="flex justify-end gap-3 pt-4 border-t">
                                {(!contract || contract.status === 'DRAFT') && (
                                    <Button
                                        type="submit"
                                        variant="secondary"
                                        disabled={createMutation.isPending || updateMutation.isPending}
                                        onClick={() => {
                                            isDraftRef.current = true;
                                            setIsDraft(true);
                                        }}
                                    >
                                        {((createMutation.isPending || updateMutation.isPending) && isDraft) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        {!contract ? t('contracts.depositShort') : t('common.save')}
                                    </Button>
                                )}
                                <Button
                                    type="submit"
                                    disabled={createMutation.isPending || updateMutation.isPending}
                                    onClick={() => {
                                        isDraftRef.current = false;
                                        setIsDraft(false);
                                    }}
                                >
                                    {((createMutation.isPending || updateMutation.isPending) && !isDraft) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {contract ? (contract.status === 'ACTIVE' ? t('common.save') : t('contracts.activate')) : t('common.create')}
                                </Button>
                            </div>
                        )}

                    </form>
                </Form>

                <Dialog open={isServiceDialogOpen} onOpenChange={setIsServiceDialogOpen}>
                    <DialogContent
                        className="max-w-2xl"
                        onPointerDownOutside={(e) => e.preventDefault()}
                        onEscapeKeyDown={(e) => e.preventDefault()}
                    >

                        <DialogHeader>
                            <DialogTitle>{t('services.createNew')}</DialogTitle>
                        </DialogHeader>
                        <ServiceForm
                            onSubmit={(data) => createServiceMutation.mutate(data)}
                            onCancel={() => setIsServiceDialogOpen(false)}
                            isSubmitting={createServiceMutation.isPending}
                        />
                    </DialogContent>
                </Dialog>
        </>
    );
}

import type { APIRequestContext } from '@playwright/test';

const apiBaseUrl = process.env.E2E_API_BASE_URL ?? 'http://localhost:3000/api';

export const demoUser = {
    email: process.env.E2E_EMAIL ?? 'admin@example.com',
    password: process.env.E2E_PASSWORD ?? 'password123',
};

export interface DemoFixtures {
    tenantId: string;
    tenantName: string;
    buildingId: string;
    buildingName: string;
    contractId: string;
    contractCode: string;
    invoiceId: string;
    invoiceNumber: string;
}

interface PaginatedResponse<T> {
    data: T[];
}

interface TenantListItem {
    _id: string;
    fullName: string;
}

interface BuildingListItem {
    _id: string;
    name: string;
}

interface ContractListItem {
    _id: string;
    contractCode?: string;
}

interface InvoiceListItem {
    _id: string;
    invoiceNumber?: string;
}

interface TenantHistoryEvent {
    type: 'contract' | 'invoice' | 'payment';
    data: {
        contractId?: string;
        contractCode?: string;
        invoiceId?: string;
        invoiceNumber?: string;
    };
}

let fixturesPromise: Promise<DemoFixtures> | null = null;

function buildApiUrl(path: string, params?: Record<string, string | number | undefined>) {
    const url = new URL(path.replace(/^\//, ''), apiBaseUrl.endsWith('/') ? apiBaseUrl : `${apiBaseUrl}/`);

    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                url.searchParams.set(key, String(value));
            }
        });
    }

    return url.toString();
}

async function loginByApi(request: APIRequestContext) {
    const response = await request.post(buildApiUrl('/auth/login'), {
        data: demoUser,
    });

    if (!response.ok()) {
        throw new Error(`E2E login failed: ${response.status()} ${response.statusText()}`);
    }

    const body = await response.json();
    if (!body?.accessToken) {
        throw new Error('E2E login failed: accessToken missing in response');
    }

    return body.accessToken as string;
}

async function apiGet<T>(
    request: APIRequestContext,
    token: string,
    path: string,
    params?: Record<string, string | number | undefined>,
) {
    const response = await request.get(buildApiUrl(path, params), {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok()) {
        throw new Error(`E2E fixture request failed for ${path}: ${response.status()} ${response.statusText()}`);
    }

    return response.json() as Promise<T>;
}

function getEnvFixtures(): DemoFixtures | null {
    const envFixtures: DemoFixtures = {
        tenantId: process.env.E2E_TENANT_ID ?? '',
        tenantName: process.env.E2E_TENANT_NAME ?? '',
        buildingId: process.env.E2E_BUILDING_ID ?? '',
        buildingName: process.env.E2E_BUILDING_NAME ?? '',
        contractId: process.env.E2E_CONTRACT_ID ?? '',
        contractCode: process.env.E2E_CONTRACT_CODE ?? '',
        invoiceId: process.env.E2E_INVOICE_ID ?? '',
        invoiceNumber: process.env.E2E_INVOICE_NUMBER ?? '',
    };

    return Object.values(envFixtures).every(Boolean) ? envFixtures : null;
}

async function resolveFixtures(request: APIRequestContext): Promise<DemoFixtures> {
    const envFixtures = getEnvFixtures();
    if (envFixtures) {
        return envFixtures;
    }

    const token = await loginByApi(request);

    const buildings = await apiGet<PaginatedResponse<BuildingListItem>>(request, token, '/buildings', {
        page: 1,
        limit: 1,
    });
    const building = buildings.data?.[0];

    const tenants = await apiGet<PaginatedResponse<TenantListItem>>(request, token, '/tenants', {
        page: 1,
        limit: 10,
    });

    const tenantCandidates = tenants.data ?? [];
    let selectedTenant = tenantCandidates[0];
    let selectedContract: { id: string; code: string } | null = null;
    let selectedInvoice: { id: string; number: string } | null = null;

    for (const tenant of tenantCandidates) {
        const history = await apiGet<PaginatedResponse<TenantHistoryEvent>>(request, token, `/tenants/${tenant._id}/history`, {
            page: 1,
            limit: 10,
        });

        const contractEvent = history.data?.find((event) => event.type === 'contract' && event.data?.contractId && event.data?.contractCode);
        const invoiceEvent = history.data?.find((event) => event.type === 'invoice' && event.data?.invoiceId && event.data?.invoiceNumber);

        if (contractEvent || invoiceEvent) {
            selectedTenant = tenant;
            selectedContract = contractEvent
                ? { id: contractEvent.data.contractId!, code: contractEvent.data.contractCode! }
                : selectedContract;
            selectedInvoice = invoiceEvent
                ? { id: invoiceEvent.data.invoiceId!, number: invoiceEvent.data.invoiceNumber! }
                : selectedInvoice;
        }

        if (selectedTenant && selectedContract && selectedInvoice) {
            break;
        }
    }

    if (!selectedContract) {
        const contracts = await apiGet<PaginatedResponse<ContractListItem>>(request, token, '/contracts', {
            page: 1,
            limit: 1,
        });
        const contract = contracts.data?.[0];
        if (contract?._id && contract.contractCode) {
            selectedContract = { id: contract._id, code: contract.contractCode };
        }
    }

    if (!selectedInvoice) {
        const invoices = await apiGet<PaginatedResponse<InvoiceListItem>>(request, token, '/invoices', {
            page: 1,
            limit: 1,
        });
        const invoice = invoices.data?.[0];
        if (invoice?._id && invoice.invoiceNumber) {
            selectedInvoice = { id: invoice._id, number: invoice.invoiceNumber };
        }
    }

    if (!building || !selectedTenant || !selectedContract || !selectedInvoice) {
        throw new Error(
            `Unable to resolve demo fixtures. building=${Boolean(building)} tenant=${Boolean(selectedTenant)} contract=${Boolean(selectedContract)} invoice=${Boolean(selectedInvoice)}`,
        );
    }

    return {
        tenantId: selectedTenant._id,
        tenantName: selectedTenant.fullName,
        buildingId: building._id,
        buildingName: building.name,
        contractId: selectedContract.id,
        contractCode: selectedContract.code,
        invoiceId: selectedInvoice.id,
        invoiceNumber: selectedInvoice.number,
    };
}

export async function resolveDemoFixtures(request: APIRequestContext) {
    if (!fixturesPromise) {
        fixturesPromise = resolveFixtures(request);
    }

    return fixturesPromise;
}

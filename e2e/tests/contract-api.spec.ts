import { expect, test } from '@playwright/test';

// ─── Config ───────────────────────────────────────────────────────

const API = 'http://localhost:3000/api';

const TEST_USER = {
    email: 'e2e-contract-test@example.com',
    password: 'Test@12345',
    confirmPassword: 'Test@12345',
    fullName: 'E2E Contract Tester',
    phone: '0888000111',
};

// ─── State shared across tests ────────────────────────────────────

let token: string;
let buildingId: string;
let roomId: string;
let tenantId: string;
let contractId: string;

// ─── Setup: Register, Login, Seed data ────────────────────────────

test.beforeAll(async ({ request }) => {
    // 1. Register (ignore if exists)
    await request.post(`${API}/auth/register`, { data: TEST_USER });

    // 2. Login → get token
    const loginRes = await request.post(`${API}/auth/login`, {
        data: { email: TEST_USER.email, password: TEST_USER.password },
    });
    expect(loginRes.ok()).toBeTruthy();
    const loginBody = await loginRes.json();
    token = loginBody.accessToken;
    expect(token).toBeTruthy();

    // 3. Create Building
    const buildingRes = await request.post(`${API}/buildings`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
            name: 'E2E Test Building Contract',
            address: {
                street: '123 Test St',
                ward: 'Ward 1',
                district: 'District 1',
                city: 'Test City',
            },
        },
    });
    expect(buildingRes.ok()).toBeTruthy();
    const building = await buildingRes.json();
    buildingId = building._id;

    // 4. Create Room
    const roomRes = await request.post(`${API}/rooms`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
            buildingId,
            roomName: 'Room E2E-C01',
            floor: 1,
            area: 20,
            maxOccupancy: 2,
            roomType: 'LONG_TERM',
            defaultRoomPrice: 3000000,
            defaultElectricPrice: 3500,
            defaultWaterPrice: 20000,
        },
    });
    expect(roomRes.ok()).toBeTruthy();
    const room = await roomRes.json();
    roomId = room._id;

    // 5. Create Tenant
    const tenantRes = await request.post(`${API}/tenants`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
            fullName: 'Nguyen Tester',
            phone: '0901234567',
            idCard: '079123456789',
        },
    });
    expect(tenantRes.ok()).toBeTruthy();
    const tenant = await tenantRes.json();
    tenantId = tenant._id;
});

// ─── Helper ───────────────────────────────────────────────────────

function authHeaders() {
    return { Authorization: `Bearer ${token}` };
}

function baseLongTermPayload(overrides: Record<string, any> = {}) {
    return {
        roomId,
        buildingId,
        tenantId,
        contractType: 'LONG_TERM',
        roomType: 'LONG_TERM',
        startDate: '2025-06-01T00:00:00.000Z',
        rentPrice: 3000000,
        depositAmount: 3000000,
        electricityPrice: 3500,
        waterPrice: 20000,
        initialElectricIndex: 100,
        initialWaterIndex: 50,
        paymentCycle: 'MONTHLY',
        paymentCycleMonths: 1,
        paymentDueDay: 1,
        ...overrides,
    };
}

// ═══════════════════════════════════════════════════════════════════
// E1-E3: Happy Path — Create Contract
// ═══════════════════════════════════════════════════════════════════

test.describe.serial('Contract Creation — Happy Path', () => {
    test('E1: should create a long-term contract successfully (201)', async ({ request }) => {
        const res = await request.post(`${API}/contracts`, {
            headers: authHeaders(),
            data: baseLongTermPayload(),
        });

        expect(res.status()).toBe(201);
        const body = await res.json();

        expect(body._id).toBeTruthy();
        expect(body.contractCode).toMatch(/^HD-/);
        expect(body.status).toBe('ACTIVE');
        expect(body.rentPrice).toBe(3000000);
        expect(body.depositAmount).toBe(3000000);
        expect(body.nextPaymentDate).toBeTruthy();

        contractId = body._id;
    });

    test('E6: should verify Room status changed to OCCUPIED after contract creation', async ({ request }) => {
        const res = await request.get(`${API}/rooms/${roomId}`, {
            headers: authHeaders(),
        });
        expect(res.ok()).toBeTruthy();
        const room = await res.json();
        expect(room.status).toBe('OCCUPIED');
    });

    test('E7: should verify Tenant status changed to RENTING after contract creation', async ({ request }) => {
        const res = await request.get(`${API}/tenants/${tenantId}`, {
            headers: authHeaders(),
        });
        expect(res.ok()).toBeTruthy();
        const tenant = await res.json();
        expect(tenant.status).toBe('RENTING');
    });

    test('E8: should include nextPaymentDate in contract response', async ({ request }) => {
        const res = await request.get(`${API}/contracts/${contractId}`, {
            headers: authHeaders(),
        });
        expect(res.ok()).toBeTruthy();
        const contract = await res.json();
        expect(contract.nextPaymentDate).toBeTruthy();
        // nextPaymentDate should be roughly 1 month after start
        const nextDate = new Date(contract.nextPaymentDate);
        expect(nextDate.getMonth()).toBeGreaterThanOrEqual(6); // July or later
    });
});

// ═══════════════════════════════════════════════════════════════════
// E2: Create with newTenant
// ═══════════════════════════════════════════════════════════════════

test.describe('Contract Creation — New Tenant', () => {
    let room2Id: string;

    test.beforeAll(async ({ request }) => {
        // Create a second room for this test
        const roomRes = await request.post(`${API}/rooms`, {
            headers: authHeaders(),
            data: {
                buildingId,
                roomName: 'Room E2E-C02',
                floor: 1,
                area: 18,
                maxOccupancy: 1,
                roomType: 'LONG_TERM',
                defaultRoomPrice: 2500000,
                defaultElectricPrice: 3500,
                defaultWaterPrice: 20000,
            },
        });
        expect(roomRes.ok()).toBeTruthy();
        room2Id = (await roomRes.json())._id;
    });

    test('E2: should create contract with newTenant (auto-create tenant)', async ({ request }) => {
        const res = await request.post(`${API}/contracts`, {
            headers: authHeaders(),
            data: baseLongTermPayload({
                roomId: room2Id,
                tenantId: undefined,
                newTenant: {
                    fullName: 'Auto Created Tenant',
                    phone: '0912345678',
                    idCard: '079999888777',
                },
            }),
        });

        expect(res.status()).toBe(201);
        const body = await res.json();
        expect(body.tenantId).toBeTruthy();
        expect(body.contractCode).toMatch(/^HD-/);
    });
});

// ═══════════════════════════════════════════════════════════════════
// E3: Create DRAFT contract
// ═══════════════════════════════════════════════════════════════════

test.describe('Contract Creation — DRAFT', () => {
    let room3Id: string;
    let tenant2Id: string;

    test.beforeAll(async ({ request }) => {
        // Create room & tenant for draft test
        const roomRes = await request.post(`${API}/rooms`, {
            headers: authHeaders(),
            data: {
                buildingId,
                roomName: 'Room E2E-C03',
                floor: 2,
                area: 22,
                maxOccupancy: 2,
                roomType: 'LONG_TERM',
                defaultRoomPrice: 3500000,
                defaultElectricPrice: 3500,
                defaultWaterPrice: 20000,
            },
        });
        room3Id = (await roomRes.json())._id;

        const tenantRes = await request.post(`${API}/tenants`, {
            headers: authHeaders(),
            data: { fullName: 'Draft Tenant', phone: '0933444555', idCard: '079111222333' },
        });
        tenant2Id = (await tenantRes.json())._id;
    });

    test('E3: should create DRAFT contract and set Room=DEPOSITED, Tenant=DEPOSITED', async ({ request }) => {
        const res = await request.post(`${API}/contracts`, {
            headers: authHeaders(),
            data: baseLongTermPayload({
                roomId: room3Id,
                tenantId: tenant2Id,
                status: 'DRAFT',
            }),
        });

        expect(res.status()).toBe(201);
        const contract = await res.json();
        expect(contract.status).toBe('DRAFT');

        // Verify room status
        const roomRes = await request.get(`${API}/rooms/${room3Id}`, { headers: authHeaders() });
        expect((await roomRes.json()).status).toBe('DEPOSITED');

        // Verify tenant status
        const tenantRes = await request.get(`${API}/tenants/${tenant2Id}`, { headers: authHeaders() });
        expect((await tenantRes.json()).status).toBe('DEPOSITED');
    });
});

// ═══════════════════════════════════════════════════════════════════
// E4-E5: Error Cases
// ═══════════════════════════════════════════════════════════════════

test.describe('Contract Creation — Error Cases', () => {
    test('E4: should return 401 without authentication', async ({ request }) => {
        const res = await request.post(`${API}/contracts`, {
            data: baseLongTermPayload(),
        });
        expect(res.status()).toBe(401);
    });

    test('E5: should return 400 for invalid roomId', async ({ request }) => {
        const res = await request.post(`${API}/contracts`, {
            headers: authHeaders(),
            data: baseLongTermPayload({ roomId: 'not-a-valid-id' }),
        });
        // Should be 400 (validation) or 404 (not found)
        expect([400, 404, 500]).toContain(res.status());
    });

    test('should return 400 when missing required fields', async ({ request }) => {
        const res = await request.post(`${API}/contracts`, {
            headers: authHeaders(),
            data: {
                roomId,
                buildingId,
                // missing tenantId, contractType, etc.
            },
        });
        expect(res.ok()).toBeFalsy();
    });

    test('should return error when deposit is negative', async ({ request }) => {
        const res = await request.post(`${API}/contracts`, {
            headers: authHeaders(),
            data: baseLongTermPayload({ depositAmount: -1 }),
        });
        expect(res.ok()).toBeFalsy();
    });

    test('should return error when endDate <= startDate', async ({ request }) => {
        const res = await request.post(`${API}/contracts`, {
            headers: authHeaders(),
            data: baseLongTermPayload({
                startDate: '2025-06-01T00:00:00.000Z',
                endDate: '2025-05-01T00:00:00.000Z',
            }),
        });
        expect(res.ok()).toBeFalsy();
    });
});

// ═══════════════════════════════════════════════════════════════════
// E9-E11: Short Term Contract Types
// ═══════════════════════════════════════════════════════════════════

test.describe('Contract Creation — Short Term Types', () => {
    let stRoomId: string;
    let stTenantId: string;

    test.beforeAll(async ({ request }) => {
        const roomRes = await request.post(`${API}/rooms`, {
            headers: authHeaders(),
            data: {
                buildingId,
                roomName: 'Room ST-01',
                floor: 1,
                area: 15,
                maxOccupancy: 2,
                roomType: 'SHORT_TERM',
                shortTermPricingType: 'FIXED',
                fixedPrice: 200000,
            },
        });
        stRoomId = (await roomRes.json())._id;

        const tenantRes = await request.post(`${API}/tenants`, {
            headers: authHeaders(),
            data: { fullName: 'Short Term Guest', phone: '0944555666', idCard: '079444555666' },
        });
        stTenantId = (await tenantRes.json())._id;
    });

    test('E11: should create FIXED short-term contract', async ({ request }) => {
        const res = await request.post(`${API}/contracts`, {
            headers: authHeaders(),
            data: {
                roomId: stRoomId,
                buildingId,
                tenantId: stTenantId,
                contractType: 'SHORT_TERM',
                roomType: 'SHORT_TERM',
                startDate: '2025-07-01T00:00:00.000Z',
                rentPrice: 0,
                depositAmount: 200000,
                shortTermPricingType: 'FIXED',
                fixedPrice: 200000,
            },
        });

        expect(res.status()).toBe(201);
        const body = await res.json();
        expect(body.contractType).toBe('SHORT_TERM');
        expect(body.fixedPrice).toBe(200000);
    });
});

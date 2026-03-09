# Research Summary — Tenant History

## Key Findings

### Data Model (Existing — No Changes Needed)

All existing collections already have `tenantId` indexed:
- **Contracts**: `tenantId` (indexed) + `startDate`, `endDate`, `status`, `roomId`, `rentPrice`, `terminatedAt`
- **Invoices**: `tenantId` (indexed) + `totalAmount`, `paidAmount`, `status`, `dueDate`, `billingPeriod`
- **Payments**: `tenantId` (indexed) + `amount`, `paymentDate`, `paymentMethod`

**Conclusion**: History can be fully aggregated from existing collections using MongoDB aggregation pipelines. No new collection or schema needed for v1.

### Architecture Pattern

**Backend**: Single new endpoint in tenants module:
- `GET /tenants/:id/history` — Returns unified timeline of events
- MongoDB `$unionWith` or parallel queries + merge in service layer
- Sort all events by date descending

**Frontend**: Two display points:
1. **History tab in tenant modal** — Compact timeline, last ~10 events
2. **Full history page** `/tenants/:id/history` — Filterable, paginated, date range

### UI Pattern — Timeline

Best practice for activity history:
- Vertical timeline with date markers
- Color-coded event types (contract=blue, payment=green, invoice=orange)
- Icon per event type
- Expandable details on click
- Filter by event type + date range

### Pitfalls to Avoid

1. **N+1 queries**: Don't query each collection separately per request — use aggregation pipeline
2. **Missing room names**: Room references need population for display
3. **Timezone issues**: Dates stored as UTC, display in local timezone
4. **Performance**: Large tenants may have hundreds of events — paginate early
5. **Deleted records**: Must handle `isDeleted: true` properly (filter out or mark)

### Stack (No New Dependencies)

Everything needed is already in the stack:
- Backend: NestJS + Mongoose aggregation
- Frontend: React + shadcn/ui + Lucide icons for timeline
- No new libraries needed

---
*Research completed: 2026-03-10*

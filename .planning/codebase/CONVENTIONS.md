# Conventions — Room Management System

## Language & Style

### TypeScript
- Strict mode not enforced (no `strict: true` in tsconfig)
- Path aliases used: `@common/`, `@config/`, `@modules/`, `@shared/` (backend); `@/` (frontend)
- Prefer interfaces/types for data shapes, classes for NestJS constructs

### Backend Patterns

**NestJS Decorators:**
- Controllers use standard `@Controller()`, `@Get()`, `@Post()`, `@Put()`, `@Delete()`
- Auth protected via guards (JwtAuthGuard)
- DTOs use `class-validator` decorators: `@IsString()`, `@IsNotEmpty()`, `@IsOptional()`

**Module Pattern:**
```typescript
// Standard NestJS module structure
@Module({
  imports: [MongooseModule.forFeature([{ name: X.name, schema: XSchema }])],
  controllers: [XController],
  providers: [XService],
  exports: [XService],
})
export class XModule {}
```

**Service Pattern:**
```typescript
// Constructor injection of Mongoose model
@Injectable()
export class XService {
  constructor(@InjectModel(X.name) private xModel: Model<X>) {}
  // CRUD methods
}
```

**Error Handling:**
- Global `AllExceptionsFilter` in `common/filters/`
- HTTP exceptions via NestJS built-in `HttpException`
- Internationalized error messages via nestjs-i18n

### Frontend Patterns

**Component Pattern:**
- Functional components with TypeScript props interfaces
- React Hook Form + Zod for all forms
- shadcn/ui components as UI primitives

**State Pattern:**
```typescript
// Zustand store pattern
export const useXStore = create<XState>((set) => ({
  value: initialValue,
  setValue: (newValue) => set({ value: newValue }),
}));
```

**API Integration Pattern:**
```typescript
// React Query for server state
const { data, isLoading } = useQuery({
  queryKey: ['resource', params],
  queryFn: () => apiClient.get('/resource', { params }),
});
```

**Form Pattern:**
```typescript
// react-hook-form + zod resolver
const form = useForm<FormValues>({
  resolver: zodResolver(formSchema),
  defaultValues: { ... },
});
```

## Naming Conventions

| Entity | Convention | Example |
|--------|-----------|---------|
| Backend module dir | kebab-case | `room-groups/` |
| Backend files | kebab-case | `buildings.controller.ts` |
| Schema files | `{singular}.schema.ts` | `building.schema.ts` |
| DTO files | `{action}-{model}.dto.ts` | `create-building.dto.ts` |
| Frontend pages | PascalCase + `Page` suffix | `BuildingsPage.tsx` |
| Frontend modals | PascalCase + `Modal` suffix | `CreateInvoiceModal.tsx` |
| Frontend selectors | PascalCase + `Selector` suffix | `BuildingSelector.tsx` |
| Frontend hooks | camelCase + `use` prefix | `useDebounce.ts` |
| Stores | camelCase + `Store` suffix | `authStore.ts` |
| UI components | lowercase (shadcn) | `button.tsx`, `dialog.tsx` |
| Translation keys | dot-notation | `dashboard.title`, `rooms.status.available` |

## Import Order

Not enforced by linter. General observed pattern:
1. External libraries (react, react-router, etc.)
2. UI components (@/components/ui/*)
3. Custom components
4. Hooks and stores
5. Utils and types
6. Styles

## Error Handling

### Backend
- Global `AllExceptionsFilter` catches all unhandled exceptions
- Returns standardized JSON: `{ statusCode, message, error }`
- i18n-aware error messages

### Frontend
- Axios response interceptor handles 401 (redirect) and 429 (rate limit)
- `react-hot-toast` for user notifications
- Custom `use-toast.ts` hook for toaster integration
- Form validation errors via Zod + react-hook-form

## Formatting

- **Prettier** configured (backend)
- `.eslintrc.cjs` for frontend (TypeScript + React plugins)
- 4-space indentation (both sides)
- Semi-colons used
- Single quotes

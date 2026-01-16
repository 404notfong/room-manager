import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { authApi } from '@/api/auth.api';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeToggle from '@/components/ThemeToggle';
import { useRegisterSchema, type RegisterFormData } from '@/lib/validations';

export default function RegisterPage() {
    const { t, i18n } = useTranslation();
    const registerSchema = useRegisterSchema();
    const navigate = useNavigate();
    const { setAuth } = useAuthStore();
    const [serverError, setServerError] = useState<string | null>(null);

    const form = useForm<RegisterFormData>({
        resolver: zodResolver(registerSchema),
        defaultValues: {
            email: '',
            password: '',
            confirmPassword: '',
            fullName: '',
            phone: '',
        },
    });

    // Effect to trigger validation on language change for fields with errors
    useEffect(() => {
        const currentErrors = form.formState.errors;
        if (Object.keys(currentErrors).length > 0) {
            form.trigger(Object.keys(currentErrors) as any);
        }
    }, [i18n.language, form]);

    const registerMutation = useMutation({
        mutationFn: authApi.register,
        onSuccess: (data) => {
            try {
                setAuth(data.user, data.accessToken);
                toast({
                    title: t('auth.registerSuccess'),
                    description: t('auth.welcomeNewUser'),
                });
                navigate('/');
            } catch (err) {
                console.error('Register success handler error:', err);
                setServerError('An error occurred during registration');
            }
        },
        onError: (error: any) => {
            console.error('Register error:', error);
            const message = error.response?.data?.message || t('auth.registrationFailed');
            setServerError(message);
            try {
                toast({
                    variant: "destructive",
                    title: t('auth.registerError'),
                    description: message,
                });
            } catch (toastError) {
                console.error('Toast error:', toastError);
            }
        },
    });

    const onSubmit = (data: RegisterFormData) => {
        setServerError(null);
        registerMutation.mutate(data);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 relative">
            {/* Language & Theme Switcher */}
            <div className="absolute top-4 right-4 flex items-center gap-2">
                <ThemeToggle />
                <LanguageSwitcher />
            </div>

            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1">
                    <div className="flex justify-center mb-4">
                        <img src="/logo.png" alt="Nhà Trọ Số" className="h-16 w-16" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-center">
                        {t('auth.registerTitle')}
                    </CardTitle>
                    <CardDescription className="text-center">
                        {t('auth.registerSubtitle')}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            {serverError && (
                                <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-md">
                                    {serverError}
                                </div>
                            )}

                            <FormField
                                control={form.control}
                                name="fullName"
                                render={({ field, fieldState }) => (
                                    <FormItem>
                                        <FormLabel>
                                            {t('auth.fullName')}
                                            <span className="text-destructive ml-1">*</span>
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="John Doe"
                                                disabled={registerMutation.isPending}
                                                className={fieldState.invalid ? 'border-destructive focus-visible:ring-destructive' : ''}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field, fieldState }) => (
                                    <FormItem>
                                        <FormLabel>
                                            {t('auth.email')}
                                            <span className="text-destructive ml-1">*</span>
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                type="email"
                                                placeholder="name@example.com"
                                                disabled={registerMutation.isPending}
                                                className={fieldState.invalid ? 'border-destructive focus-visible:ring-destructive' : ''}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="phone"
                                render={({ field, fieldState }) => (
                                    <FormItem>
                                        <FormLabel>
                                            {t('auth.phone')}
                                            <span className="text-destructive ml-1">*</span>
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                type="tel"
                                                placeholder="0123456789"
                                                disabled={registerMutation.isPending}
                                                className={fieldState.invalid ? 'border-destructive focus-visible:ring-destructive' : ''}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field, fieldState }) => (
                                    <FormItem>
                                        <FormLabel>
                                            {t('auth.password')}
                                            <span className="text-destructive ml-1">*</span>
                                        </FormLabel>
                                        <FormControl>
                                            <PasswordInput
                                                placeholder="••••••••"
                                                disabled={registerMutation.isPending}
                                                className={fieldState.invalid ? 'border-destructive focus-visible:ring-destructive' : ''}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="confirmPassword"
                                render={({ field, fieldState }) => (
                                    <FormItem>
                                        <FormLabel>
                                            {t('auth.confirmPassword')}
                                            <span className="text-destructive ml-1">*</span>
                                        </FormLabel>
                                        <FormControl>
                                            <PasswordInput
                                                placeholder="••••••••"
                                                disabled={registerMutation.isPending}
                                                className={fieldState.invalid ? 'border-destructive focus-visible:ring-destructive' : ''}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <Button
                                type="submit"
                                className="w-full"
                                disabled={registerMutation.isPending}
                            >
                                {registerMutation.isPending && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                {registerMutation.isPending ? t('auth.registering') : t('auth.register')}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
                <CardFooter className="flex flex-col space-y-4">
                    <div className="text-sm text-center text-muted-foreground">
                        {t('auth.alreadyHaveAccount')}{' '}
                        <Link to="/login" className="text-primary font-medium hover:underline">
                            {t('auth.loginNow')}
                        </Link>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}

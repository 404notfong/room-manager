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
import { useLoginSchema, type LoginFormData } from '@/lib/validations';

export default function LoginPage() {
    const { t, i18n } = useTranslation();
    const loginSchema = useLoginSchema();
    const navigate = useNavigate();
    const { setAuth } = useAuthStore();
    const [serverError, setServerError] = useState<string | null>(null);

    const form = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: '',
            password: '',
        },
    });

    // Re-validate fields with errors when language changes
    useState(() => {
        const subscription = form.watch(() => {
            // Subscription to watch form changes if needed
        });
        return () => subscription.unsubscribe();
    });

    // Effect to trigger validation on language change for fields with errors
    useEffect(() => {
        const currentErrors = form.formState.errors;
        if (Object.keys(currentErrors).length > 0) {
            form.trigger(Object.keys(currentErrors) as any);
        }
    }, [i18n.language, form]);

    const loginMutation = useMutation({
        mutationFn: authApi.login,
        onSuccess: (data) => {
            try {
                setAuth(data.user, data.accessToken);
                toast({
                    title: t('auth.loginSuccess'),
                    description: t('auth.welcome'),
                });
                navigate('/');
            } catch (err) {
                console.error('Login success handler error:', err);
                setServerError('An error occurred during login');
            }
        },
        onError: (error: any) => {
            console.error('Login error:', error);
            let message: string;

            // Check if it's a network/server error (no response)
            if (!error.response) {
                message = t('auth.serverError');
            } else if (error.response.status === 401) {
                // Authentication failed - invalid credentials
                message = error.response?.data?.message || t('auth.invalidCredentials');
            } else {
                // Other server errors
                message = error.response?.data?.message || t('auth.serverError');
            }

            setServerError(message);
            try {
                toast({
                    variant: "destructive",
                    title: t('auth.loginError'),
                    description: message,
                });
            } catch (toastError) {
                console.error('Toast error:', toastError);
            }
        },
    });

    const onSubmit = (data: LoginFormData) => {
        setServerError(null);
        loginMutation.mutate(data);
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
                        {t('auth.loginTitle')}
                    </CardTitle>
                    <CardDescription className="text-center">
                        {t('auth.loginSubtitle')}
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
                                name="email"
                                render={({ field, fieldState }) => (
                                    <FormItem>
                                        <FormLabel>{t('auth.email')}</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="email"
                                                placeholder="name@example.com"
                                                disabled={loginMutation.isPending}
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
                                        <FormLabel>{t('auth.password')}</FormLabel>
                                        <FormControl>
                                            <PasswordInput
                                                placeholder="••••••••"
                                                disabled={loginMutation.isPending}
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
                                disabled={loginMutation.isPending}
                            >
                                {loginMutation.isPending && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                {loginMutation.isPending ? t('auth.loggingIn') : t('auth.login')}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
                <CardFooter className="flex flex-col space-y-4">
                    <div className="text-sm text-center text-muted-foreground">
                        {t('auth.dontHaveAccount')}{' '}
                        <Link to="/register" className="text-primary font-medium hover:underline">
                            {t('auth.registerNow')}
                        </Link>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { BarChart3, Building2, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeToggle from '@/components/ThemeToggle';

interface AuthHighlight {
    icon: LucideIcon;
    title: string;
    description: string;
}

interface AuthShellProps {
    title: string;
    description: string;
    children: ReactNode;
    footer: ReactNode;
    heroTitle?: string;
    heroDescription?: string;
    formEyebrow?: string;
    supportNote?: string;
    badge?: string;
    highlights?: AuthHighlight[];
}

export function AuthShell({
    title,
    description,
    children,
    footer,
    heroTitle,
    heroDescription,
    formEyebrow,
    supportNote,
    badge,
    highlights,
}: AuthShellProps) {
    const { t } = useTranslation();
    const resolvedBadge = badge ?? t('common.appName');
    const resolvedHeroTitle = heroTitle ?? title;
    const resolvedHeroDescription = heroDescription ?? description;
    const resolvedFormEyebrow = formEyebrow ?? t('auth.accessEyebrow');
    const resolvedSupportNote = supportNote ?? t('auth.supportNote');
    const resolvedHighlights =
        highlights ??
        [
            {
                icon: Building2,
                title: t('auth.highlights.manageTitle'),
                description: t('auth.highlights.manageDescription'),
            },
            {
                icon: ShieldCheck,
                title: t('auth.highlights.riskTitle'),
                description: t('auth.highlights.riskDescription'),
            },
            {
                icon: BarChart3,
                title: t('auth.highlights.actionTitle'),
                description: t('auth.highlights.actionDescription'),
            },
        ];

    return (
        <div className="relative min-h-screen overflow-hidden bg-background px-4 py-5 sm:px-6 lg:px-8">
            <div className="pointer-events-none absolute inset-0 soft-grid opacity-30" />
            <div className="relative mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-border/70 bg-card/92 shadow-[0_30px_90px_-44px_rgba(15,23,42,0.5)] backdrop-blur lg:flex-row">
                <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
                    <ThemeToggle />
                    <LanguageSwitcher />
                </div>

                <section className="relative flex flex-1 flex-col justify-between overflow-hidden border-b border-border/70 bg-gradient-to-br from-primary/[0.14] via-background to-info/[0.12] p-6 sm:p-8 lg:border-b-0 lg:border-r lg:p-12">
                    <div className="space-y-10">
                        <div className="space-y-6">
                            <div className="inline-flex items-center gap-3 rounded-full border border-primary/15 bg-background/80 px-4 py-2 text-sm font-semibold text-foreground shadow-sm backdrop-blur">
                                <img src="/logo.png" alt="Nhà Trọ Số" className="h-8 w-8 rounded-xl" />
                                <span>{resolvedBadge}</span>
                            </div>
                            <div className="max-w-xl space-y-4">
                                <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                                    {resolvedHeroTitle}
                                </h1>
                                <p className="text-base leading-7 text-muted-foreground">{resolvedHeroDescription}</p>
                            </div>
                        </div>

                        <div className="grid gap-4">
                            {resolvedHighlights.map((item) => (
                                <div
                                    key={item.title}
                                    className="flex items-start gap-4 rounded-2xl border border-white/50 bg-white/65 p-4 shadow-[0_18px_50px_-36px_rgba(15,23,42,0.45)] backdrop-blur dark:border-white/10 dark:bg-white/5"
                                >
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                                        <item.icon className="h-5 w-5" />
                                    </div>
                                    <div className="space-y-1">
                                        <h2 className="text-sm font-semibold text-foreground">{item.title}</h2>
                                        <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-10 rounded-2xl border border-white/50 bg-background/70 p-4 text-sm text-muted-foreground backdrop-blur dark:border-white/10 dark:bg-white/5">
                        {resolvedSupportNote}
                    </div>
                </section>

                <section className="flex flex-1 items-center justify-center p-5 sm:p-8 lg:p-12">
                    <div className="w-full max-w-md space-y-6">
                        <div className="space-y-2">
                            <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary/85">{resolvedFormEyebrow}</p>
                            <div className="space-y-2">
                                <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground">{title}</h2>
                                <p className="text-sm leading-6 text-muted-foreground">{description}</p>
                            </div>
                        </div>
                        <div className="space-y-5">{children}</div>
                        <div className="border-t border-border/70 pt-5 text-sm text-muted-foreground">{footer}</div>
                    </div>
                </section>
            </div>
        </div>
    );
}

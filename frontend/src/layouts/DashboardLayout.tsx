import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { useState } from 'react';
import {
    Home,
    Building2,
    DoorOpen,
    Users,
    FileText,
    Receipt,
    CreditCard,
    LogOut,
    Menu,
    X,
    Layers,
    Wrench,
    Settings,
    HelpCircle,
    Bug,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Sun,
    Moon,
    Monitor,
} from 'lucide-react';
import BuildingSelector from '@/components/BuildingSelector';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export default function DashboardLayout() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();
    const { theme, setTheme } = useThemeStore();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const menuItems = [
        { icon: Home, label: t('menu.dashboard'), path: '/' },
        { icon: Building2, label: t('menu.buildings'), path: '/buildings' },
        { icon: DoorOpen, label: t('menu.rooms'), path: '/rooms' },
        { icon: Layers, label: t('menu.roomGroups'), path: '/room-groups' },
        { icon: Users, label: t('menu.tenants'), path: '/tenants' },
        { icon: Wrench, label: t('menu.services'), path: '/services' },
        { icon: FileText, label: t('menu.contracts'), path: '/contracts' },
        { icon: Receipt, label: t('menu.invoices'), path: '/invoices' },
        { icon: CreditCard, label: t('menu.payments'), path: '/payments' },
    ];

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    // Swipe gesture handling
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const minSwipeDistance = 50;

    const onTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        // Only allow swipe from edge (first 30px) to open
        if (isRightSwipe && touchStart < 30 && !sidebarOpen) {
            setSidebarOpen(true);
        }
        // Allow swipe left anywhere on sidebar to close
        if (isLeftSwipe && sidebarOpen) {
            setSidebarOpen(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
            {/* Top Navigation Bar - Fixed at top */}
            <header className={`
                fixed top-0 left-0 right-0 z-50 h-14 lg:h-16 
                border-b bg-white dark:bg-slate-950 shadow-sm 
                flex items-center px-3 lg:px-4
                transition-transform duration-300 ease-in-out
                lg:translate-x-0 ${sidebarOpen ? 'translate-x-72' : 'translate-x-0'}
            `}>
                {/* Desktop Branding - Static on the left */}
                <div className="hidden lg:flex items-center gap-3 w-64 shrink-0">
                    <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        <img src="/logo.png" alt="Nhà Trọ Số" className="h-8 w-8" />
                        <span className="font-bold text-slate-900 dark:text-white text-lg lg:text-xl tracking-tight">Nhà Trọ Số</span>
                    </Link>
                </div>

                {/* Mobile Menu Button */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden h-9 w-9 shrink-0"
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                >
                    <Menu className="h-5 w-5" />
                </Button>

                {/* Mobile Logo - Centered (Only visible when sidebar is closed) */}
                {!sidebarOpen && (
                    <Link to="/" className="lg:hidden absolute left-1/2 -translate-x-1/2 flex items-center gap-2 font-semibold hover:opacity-80 transition-opacity">
                        <img src="/logo.png" alt="Nhà Trọ Số" className="h-7 w-7" />
                    </Link>
                )}

                <div className="flex-1" />

                {/* Right Side Actions */}
                <div className="flex items-center gap-2">
                    <BuildingSelector />

                    {/* Desktop User Dropdown */}
                    <div className="hidden lg:block">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                                    <Avatar>
                                        <AvatarFallback className="bg-primary text-primary-foreground">
                                            {user?.fullName ? getInitials(user.fullName) : 'U'}
                                        </AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56" align="end" forceMount>
                                <DropdownMenuLabel className="font-normal">
                                    <div className="flex flex-col space-y-1">
                                        <p className="text-sm font-medium leading-none">{user?.fullName}</p>
                                        <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => navigate('/settings')}>
                                    <Settings className="mr-2 h-4 w-4" />
                                    <span>{t('menu.settings')}</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate('/help')}>
                                    <HelpCircle className="mr-2 h-4 w-4" />
                                    <span>{t('menu.help')}</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate('/bug-report')}>
                                    <Bug className="mr-2 h-4 w-4" />
                                    <span>{t('menu.bugReport')}</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleLogout} className="text-red-600 dark:text-red-400">
                                    <LogOut className="mr-2 h-4 w-4" />
                                    <span>{t('menu.logout')}</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </header>

            {/* Main Layout Container - Shifted down by header height on desktop */}
            <div
                className="flex flex-1 pt-14 lg:pt-16 overflow-hidden"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                {/* Sidebar */}
                <aside
                    className={`
                        fixed lg:static inset-y-0 left-0 z-50 lg:z-40
                        bg-white dark:bg-slate-950 border-r shadow-lg lg:shadow-none
                        transition-all duration-300 ease-in-out h-full w-72 lg:relative
                        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                        ${isCollapsed ? 'lg:w-16' : 'lg:w-64'}
                    `}
                >
                    <div className={`flex flex-col h-full relative overflow-hidden w-72 ${isCollapsed ? 'lg:w-16' : 'lg:w-64'}`}>
                        {/* Mobile sidebar header (Branding preserved for mobile) */}
                        <div className="lg:hidden flex items-center justify-between px-4 h-14 border-b bg-white dark:bg-slate-950 shrink-0">
                            <div className="flex items-center gap-3">
                                <img src="/logo.png" alt="Nhà Trọ Số" className="h-8 w-8" />
                                <div>
                                    <span className="font-semibold text-slate-900 dark:text-white text-sm">Nhà Trọ Số</span>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{t('common.appDescription', 'Quản lý lưu trú')}</p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSidebarOpen(false)}
                                className="h-8 w-8"
                            >
                                <X className="h-5 w-5" />
                            </Button>
                        </div>

                        {/* Navigation */}
                        <nav className="flex-1 px-3 py-4 lg:py-6 overflow-y-auto scrollbar-thin">
                            <ul className="space-y-1">
                                {menuItems.map((item) => (
                                    <li key={item.path}>
                                        <Link
                                            to={item.path}
                                            onClick={() => setSidebarOpen(false)}
                                            className={`
                                                flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium
                                                text-slate-600 dark:text-slate-400
                                                hover:bg-primary/10 hover:text-primary dark:hover:text-primary
                                                transition-all duration-200 group
                                                ${isCollapsed ? 'lg:justify-center lg:px-2' : ''}
                                            `}
                                        >
                                            <item.icon className="h-5 w-5 shrink-0 transition-transform group-hover:scale-110" />
                                            <span className={isCollapsed ? 'lg:hidden' : ''}>{item.label}</span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </nav>

                        {/* Mobile user menu */}
                        <div className="lg:hidden border-t bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
                            <button
                                onClick={() => setUserMenuOpen(!userMenuOpen)}
                                className="w-full flex items-center gap-3 p-4 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                                    <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                                        {user?.fullName ? getInitials(user.fullName) : 'U'}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0 text-left">
                                    <p className="font-medium text-slate-900 dark:text-white truncate text-sm">{user?.fullName}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
                                </div>
                                <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
                            </button>

                            <div className={`overflow-hidden transition-all duration-200 ease-in-out ${userMenuOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                <div className="px-4 pb-4 space-y-4">
                                    {/* Language Selector */}
                                    <div>
                                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 px-1">{t('settings.language', 'Ngôn ngữ')}</p>
                                        <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
                                            <button
                                                onClick={() => i18n.changeLanguage('vi')}
                                                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${i18n.language === 'vi' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
                                            >
                                                <span>🇻🇳</span>
                                                <span>Tiếng Việt</span>
                                            </button>
                                            <button
                                                onClick={() => i18n.changeLanguage('en')}
                                                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${i18n.language === 'en' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}
                                            >
                                                <span>🇺🇸</span>
                                                <span>English</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Theme Selector */}
                                    <div>
                                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 px-1">{t('settings.theme', 'Giao diện')}</p>
                                        <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
                                            <button onClick={() => setTheme('light')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-sm font-medium transition-all ${theme === 'light' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}>
                                                <Sun className="h-4 w-4" />
                                            </button>
                                            <button onClick={() => setTheme('dark')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-sm font-medium transition-all ${theme === 'dark' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}>
                                                <Moon className="h-4 w-4" />
                                            </button>
                                            <button onClick={() => setTheme('system')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-sm font-medium transition-all ${theme === 'system' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'}`}>
                                                <Monitor className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Quick links */}
                                    <div className="space-y-1">
                                        <button onClick={() => { navigate('/settings'); setSidebarOpen(false); }} className="w-full flex items-center gap-3 px-3 h-10 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 transition-colors text-sm">
                                            <Settings className="h-4 w-4" />
                                            {t('menu.settings')}
                                        </button>
                                        <button onClick={() => { navigate('/help'); setSidebarOpen(false); }} className="w-full flex items-center gap-3 px-3 h-10 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 transition-colors text-sm">
                                            <HelpCircle className="h-4 w-4" />
                                            {t('menu.help')}
                                        </button>
                                        <button onClick={() => { navigate('/bug-report'); setSidebarOpen(false); }} className="w-full flex items-center gap-3 px-3 h-10 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 transition-colors text-sm">
                                            <Bug className="h-4 w-4" />
                                            {t('menu.bugReport')}
                                        </button>
                                    </div>

                                    <Button variant="outline" onClick={handleLogout} className="w-full h-10 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 border-red-200 dark:border-red-800">
                                        <LogOut className="h-4 w-4 mr-2" />
                                        {t('menu.logout')}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Desktop Sidebar Collapse Toggle */}
                    <div
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="hidden lg:flex absolute top-20 -right-4 -translate-y-1/2 z-[100] h-8 w-8 items-center justify-center cursor-pointer group"
                    >
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-full w-full rounded-full bg-white dark:bg-slate-950 shadow-md border-slate-200 dark:border-slate-800 pointer-events-none transition-all group-hover:bg-slate-50 dark:group-hover:bg-slate-900"
                            tabIndex={-1}
                        >
                            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                        </Button>
                    </div>
                </aside>

                {/* Overlay backdrop on mobile */}
                {sidebarOpen && (
                    <div
                        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden animate-in fade-in duration-300"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* Main Content Areas - Slides right on mobile */}
                <main className={`flex-1 overflow-y-auto p-4 lg:p-8 transition-transform duration-300 ease-in-out lg:translate-x-0 ${sidebarOpen ? 'translate-x-72' : 'translate-x-0'}`}>
                    <Outlet />
                </main>
            </div>
        </div>
    );
}





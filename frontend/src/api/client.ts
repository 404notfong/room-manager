import axios from 'axios';
import i18n from 'i18next';

const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add auth token and language header
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        // Add language header for backend i18n
        const currentLanguage = i18n.language || 'en';
        config.headers['Accept-Language'] = currentLanguage;
        config.headers['x-lang'] = currentLanguage;
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;

        // Handle 429 Too Many Requests
        if (status === 429) {
            const retryAfter = error.response?.headers?.['retry-after'];
            const translatedMessage = retryAfter
                ? i18n.t('errors.tooManyRequests', { seconds: retryAfter })
                : i18n.t('errors.tooManyRequestsShort');
            error.response.data.message = translatedMessage;
        }

        // Handle 401 Unauthorized
        if (status === 401) {
            // Don't redirect if already on auth pages (login/register)
            const currentPath = window.location.pathname;
            const isAuthPage = currentPath === '/login' || currentPath === '/register';

            if (!isAuthPage) {
                // Only clear auth and redirect if NOT on auth pages
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default apiClient;

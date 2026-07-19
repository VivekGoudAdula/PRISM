import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4021';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let accessToken: string | null = localStorage.getItem('prism_access_token');

export const setAccessToken = (token: string | null) => {
  accessToken = token;
  if (token) {
    localStorage.setItem('prism_access_token', token);
  } else {
    localStorage.removeItem('prism_access_token');
  }
};

export const getAccessToken = () => accessToken;

// Request Interceptor to inject Authorization Bearer Token
api.interceptors.request.use(
  (config) => {
    if (accessToken && config.headers) {
      config.headers['Authorization'] = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor to intercept 401 and try auto refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('prism_refresh_token');
      if (refreshToken) {
        try {
          // Attempt refresh
          const { data } = await axios.post(`${API_BASE_URL}/api/auth/refresh`, { refreshToken });
          if (data?.accessToken) {
            setAccessToken(data.accessToken);
            originalRequest.headers['Authorization'] = `Bearer ${data.accessToken}`;
            return api(originalRequest);
          }
        } catch (refreshErr) {
          // Refresh token is invalid/expired - force logout
          localStorage.removeItem('prism_access_token');
          localStorage.removeItem('prism_refresh_token');
          localStorage.removeItem('prism_logged_in_user');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// Configurar axios base
axios.defaults.baseURL = '/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    // Intentar cargar usuario desde localStorage
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }, []);

  const verifyToken = useCallback(async () => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      console.log('No token in localStorage, skipping verification');
      setLoading(false);
      return;
    }

    console.log('Verifying token, length:', storedToken.length);

    try {
      // Asegurarse de que el header Authorization se envíe explícitamente
      const response = await axios.get('/auth/verify', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${storedToken}`
        }
      });

      console.log('Token verification response:', response.status, response.data);

      if (response.data && response.data.success && response.data.user) {
        setUser(response.data.user);
        setToken(storedToken);
        // Guardar usuario en localStorage para persistencia
        localStorage.setItem('user', JSON.stringify(response.data.user));
        console.log('Token verified successfully, user loaded:', response.data.user.email);
      } else {
        // Token inválido
        console.log('Token verification returned invalid response');
        logout();
      }
    } catch (error) {
      console.error('Token verification error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        requestHeaders: error.config?.headers
      });

      // Token inválido o expirado - solo hacer logout si es 401
      if (error.response?.status === 401) {
        const errorData = error.response?.data;
        console.log('Token invalid or expired (401), error:', errorData?.error, 'debug:', errorData?.debug);
        logout();
      } else {
        // Para otros errores, no hacer logout (puede ser error de red)
        console.log('Non-401 error, keeping token but not authenticated');
        setLoading(false);
      }
    } finally {
      setLoading(false);
    }
  }, [logout]);

  // Configurar axios interceptor
  useEffect(() => {
    // Interceptor de request: agregar token
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        const currentToken = localStorage.getItem('token');
        if (currentToken) {
          config.headers.Authorization = `Bearer ${currentToken}`;
          // Log para debug
          if (config.url?.includes('/auth/verify')) {
            console.log('Sending token to /auth/verify:', currentToken.substring(0, 20) + '...');
          }
        } else {
          // Log si no hay token
          if (config.url?.includes('/auth/verify')) {
            console.log('No token found in localStorage for /auth/verify');
          }
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Interceptor de response: manejar errores de autenticación
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        // Solo hacer logout si es un 401 en rutas protegidas
        // No hacer logout en rutas públicas como /auth/verify
        if (error.response?.status === 401) {
          const url = error.config?.url || '';
          // Solo hacer logout si NO es la ruta de verificación (para evitar loops)
          if (!url.includes('/auth/verify')) {
            logout();
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, [logout]); // Remover token de dependencias para evitar re-registros

  // Verificar token al cargar (solo una vez)
  useEffect(() => {
    let mounted = true;
    let isVerifying = false;

    const verify = async () => {
      // Solo verificar si hay token en localStorage
      const storedToken = localStorage.getItem('token');

      if (storedToken && !isVerifying && mounted) {
        isVerifying = true;
        try {
          await verifyToken();
        } catch (error) {
          // Si falla la verificación, limpiar token inválido
          if (mounted) {
            console.log('Token verification failed, clearing invalid token');
            logout();
          }
        } finally {
          if (mounted) {
            isVerifying = false;
            setLoading(false);
          }
        }
      } else if (!storedToken && mounted) {
        // No hay token, simplemente marcar como no cargando
        setLoading(false);
      }
    };

    verify();

    return () => {
      mounted = false;
    };
  }, []); // Solo ejecutar una vez al montar

  const login = async (email, password) => {
    try {
      const response = await axios.post('/users/login', {
        email,
        password
      });

      const { token, user } = response.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setToken(token);
      setUser(user);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error al iniciar sesión'
      };
    }
  };

  const register = async (email, password, name) => {
    try {
      await axios.post('/users/register', {
        email,
        password,
        name
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Error al registrarse'
      };
    }
  };

  const loginWithGoogle = () => {
    // Redirigir directamente a Google OAuth
    // El backend manejará si está configurado o no
    window.location.href = '/api/auth/google';
  };


  const handleGoogleCallback = useCallback(async (tokenFromUrl) => {
    if (!tokenFromUrl) {
      return false;
    }

    try {
      // Guardar token inmediatamente
      localStorage.setItem('token', tokenFromUrl);
      setToken(tokenFromUrl);

      // Pequeño delay para dar tiempo a MongoDB si es necesario
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Verificar el token con el backend
      const response = await axios.get('/auth/verify', {
        headers: {
          'Authorization': `Bearer ${tokenFromUrl}`
        }
      });

      if (response.data.success && response.data.user) {
        setUser(response.data.user);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        console.log('Google auth successful for user:', response.data.user.email);
        return true;
      } else {
        console.error('Unexpected response from verify endpoint:', response.data);
        logout();
        return false;
      }
    } catch (error) {
      console.error('Error verifying token after Google auth:', error);

      if (error.response?.status === 401) {
        logout();
        return false;
      }

      console.log('Non-401 error, keeping token for retry');
      return false;
    }
  }, [logout]);

  const value = {
    user,
    token,
    loading,
    login,
    register,
    loginWithGoogle,
    logout,
    handleGoogleCallback,
    isAuthenticated: !!user && !!token
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};


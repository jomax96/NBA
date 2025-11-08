import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleGoogleCallback } = useAuth();
  const [status, setStatus] = useState('Procesando autenticación...');
  const hasNavigated = useRef(false);

  useEffect(() => {
    // Prevenir múltiples ejecuciones
    if (hasNavigated.current) return;
    
    const token = searchParams.get('token');
    const error = searchParams.get('error');
    const temp = searchParams.get('temp');
    let timeoutId;

    if (error) {
      setStatus(`Error de autenticación: ${error}`);
      hasNavigated.current = true;
      timeoutId = setTimeout(() => {
        navigate('/login', { replace: true });
      }, 3000);
      return () => clearTimeout(timeoutId);
    }

    if (token) {
      handleGoogleCallback(token);
      setStatus(temp ? 'Autenticación en proceso. Esperando confirmación...' : 'Autenticación exitosa. Redirigiendo...');
      
      // Esperar más tiempo para que la verificación del token se complete
      const delay = temp ? 4000 : 2500;
      hasNavigated.current = true;
      timeoutId = setTimeout(() => {
        // Verificar si hay token antes de redirigir
        const savedToken = localStorage.getItem('token');
        if (savedToken) {
          navigate('/', { replace: true });
        } else {
          navigate('/login', { replace: true });
        }
      }, delay);
      return () => clearTimeout(timeoutId);
    } else {
      setStatus('No se recibió token. Redirigiendo al login...');
      hasNavigated.current = true;
      timeoutId = setTimeout(() => {
        navigate('/login', { replace: true });
      }, 3000);
      return () => clearTimeout(timeoutId);
    }
  }, [searchParams, navigate, handleGoogleCallback]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600">{status}</p>
      </div>
    </div>
  );
}

export default AuthCallback;


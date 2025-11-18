import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleGoogleCallback } = useAuth();
  const [status, setStatus] = useState('Procesando autenticación...');
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevenir múltiples ejecuciones
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      const token = searchParams.get('token');
      const error = searchParams.get('error');
      const temp = searchParams.get('temp');

      // Manejo de errores
      if (error) {
        setStatus(`Error de autenticación: ${error}`);
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 3000);
        return;
      }

      // Sin token
      if (!token) {
        setStatus('No se recibió token. Redirigiendo al login...');
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 3000);
        return;
      }

      // Procesar token
      try {
        setStatus(temp ? 'Autenticación en proceso. Esperando confirmación...' : 'Autenticación exitosa. Redirigiendo...');

        // ESPERAR a que handleGoogleCallback termine completamente
        const success = await handleGoogleCallback(token);

        if (success) {
          // Token verificado exitosamente - redirigir al dashboard
          navigate('/', { replace: true });
        } else {
          // Si no se pudo verificar, redirigir al login
          setStatus('Error al verificar autenticación. Redirigiendo al login...');
          setTimeout(() => {
            navigate('/login', { replace: true });
          }, 2000);
        }
      } catch (error) {
        console.error('Error procesando autenticación:', error);
        setStatus('Error al procesar autenticación. Redirigiendo al login...');
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 2000);
      }
    };

    processAuth();
  }, []); // Sin dependencias - ejecutar solo una vez

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
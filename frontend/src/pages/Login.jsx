import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleError, setGoogleError] = useState('');

  const { login, register, loginWithGoogle, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      let result;
      if (isRegister) {
        result = await register(email, password, name);
        if (result.success) {
          setSuccess('Registro exitoso. Ahora puedes iniciar sesión.');
          setIsRegister(false);
          setEmail('');
          setPassword('');
          setName('');
        } else {
          setError(result.error);
        }
      } else {
        result = await login(email, password);
        if (result.success) {
          navigate('/');
        } else {
          setError(result.error);
        }
      }
    } catch (err) {
      setError('Ocurrió un error inesperado');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setGoogleError('');
    setError('');
    window.location.href = '/api/auth/google';
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center py-16 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white p-8 mb-8">
          <h2 className="text-4xl font-black text-black uppercase tracking-wider text-center mb-2">
            {isRegister ? 'Crear Cuenta' : 'Iniciar Sesión'}
          </h2>
          <p className="text-sm text-gray-500 uppercase tracking-widest font-bold text-center mb-8">
            NBA Analytics Hub
          </p>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-600 text-white px-4 py-3 font-bold uppercase tracking-wider text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-black text-white px-4 py-3 font-bold uppercase tracking-wider text-sm">
                {success}
              </div>
            )}

            <div className="space-y-4">
              {isRegister && (
                <div>
                  <label htmlFor="name" className="block text-xs font-black uppercase tracking-widest text-gray-600 mb-2">
                    Nombre Completo
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required={isRegister}
                    className="w-full px-4 py-3 border-2 border-gray-300 focus:border-red-600 focus:outline-none font-bold text-black"
                    placeholder="NOMBRE COMPLETO"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-xs font-black uppercase tracking-widest text-gray-600 mb-2">
                  Correo Electrónico
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="w-full px-4 py-3 border-2 border-gray-300 focus:border-red-600 focus:outline-none font-bold text-black"
                  placeholder="CORREO ELECTRÓNICO"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-black uppercase tracking-widest text-gray-600 mb-2">
                  Contraseña
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="w-full px-4 py-3 border-2 border-gray-300 focus:border-red-600 focus:outline-none font-bold text-black"
                  placeholder="CONTRASEÑA"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-black text-white py-4 px-6 font-black uppercase tracking-widest hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'PROCESANDO...' : isRegister ? 'Registrarse' : 'Iniciar Sesión'}
              </button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-2 border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500 font-bold uppercase tracking-wider">
                  O Continuar Con
                </span>
              </div>
            </div>

            <div>
              {googleError && (
                <div className="mb-4 bg-gray-100 border-l-4 border-red-600 px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-wider text-black">
                    Google OAuth No Disponible
                  </p>
                  <p className="text-xs text-gray-600 mt-1">{googleError}</p>
                </div>
              )}
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center px-4 py-4 border-2 border-gray-300 bg-white text-black font-bold uppercase tracking-wider hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={!!googleError}
              >
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continuar con Google
              </button>
              {googleError && (
                <p className="mt-2 text-xs text-center text-gray-500 font-medium">
                  Por favor usa la autenticación tradicional (correo/contraseña) arriba.
                </p>
              )}
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsRegister(!isRegister);
                  setError('');
                  setSuccess('');
                  setGoogleError('');
                }}
                className="text-black font-bold uppercase tracking-wider text-sm hover:text-red-600 transition-colors"
              >
                {isRegister
                  ? '¿Ya tienes una cuenta? Inicia sesión'
                  : '¿No tienes una cuenta? Regístrate'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;

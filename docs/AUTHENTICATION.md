# Sistema de Autenticación - NBA Analytics Hub

## Resumen

El sistema implementa autenticación con dos métodos:
1. **Autenticación tradicional** (email/password)
2. **Autenticación con Google OAuth 2.0**

## Rutas Públicas (Sin Autenticación)

Estas rutas están disponibles para todos los usuarios:

- `GET /api/teams` - Lista de equipos
- `GET /api/teams/:teamId` - Estadísticas de un equipo
- `GET /api/players/top` - Top jugadores
- `GET /api/players/:playerId` - Estadísticas de un jugador
- `GET /api/games/search` - Búsqueda de partidos (guarda historial si está autenticado)
- `POST /api/predictions/predict` - Predicción (opcional: guarda historial si está autenticado)
- `POST /api/users/register` - Registro de usuario
- `POST /api/users/login` - Login tradicional

## Rutas de Autenticación

- `GET /api/auth/google` - Iniciar autenticación con Google
- `GET /api/auth/google/callback` - Callback de Google OAuth
- `GET /api/auth/verify` - Verificar token JWT (requiere autenticación)

## Rutas Protegidas (Requieren Autenticación)

Estas rutas requieren un token JWT válido en el header `Authorization: Bearer <token>`:

### Usuarios
- `GET /api/users/profile` - Perfil del usuario actual
- `GET /api/users/favorites` - Lista de favoritos del usuario
- `POST /api/users/favorites` - Añadir/eliminar favorito
- `GET /api/users/search-history` - Historial de búsquedas
- `GET /api/users/alerts` - Alertas del usuario
- `POST /api/users/alerts` - Crear nueva alerta

## Flujo de Autenticación

### Autenticación Tradicional (Email/Password)

1. Usuario se registra: `POST /api/users/register`
   - Los datos se encolan en RabbitMQ
   - El usuario recibe confirmación inmediata

2. Usuario hace login: `POST /api/users/login`
   - Se valida credenciales contra MongoDB
   - Se genera token JWT
   - Se retorna token y datos del usuario

3. Usuario usa el token en requests posteriores:
   ```
   Authorization: Bearer <token>
   ```

### Autenticación con Google OAuth

1. Usuario hace clic en "Login with Google"
2. Se redirige a: `GET /api/auth/google`
3. Google muestra pantalla de autenticación
4. Usuario autoriza la aplicación
5. Google redirige a: `GET /api/auth/google/callback`
6. El sistema:
   - Verifica si el usuario existe (por Google ID o email)
   - Si no existe, crea nuevo usuario (encolado)
   - Genera token JWT
   - Redirige al frontend con el token

## Uso en el Frontend

### Almacenar Token

```javascript
// Después de login exitoso
localStorage.setItem('token', response.data.token);
```

### Enviar Token en Requests

```javascript
const token = localStorage.getItem('token');
axios.get('/api/users/profile', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### Verificar Autenticación

```javascript
// Verificar si el usuario está autenticado
axios.get('/api/auth/verify', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(response => {
  // Usuario autenticado
  const user = response.data.user;
})
.catch(error => {
  // Token inválido o expirado
  localStorage.removeItem('token');
  // Redirigir a login
});
```

## Ejemplo de Implementación en Frontend

### Componente de Login

```jsx
import React, { useState } from 'react';
import axios from 'axios';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('/api/users/login', {
        email,
        password
      });
      
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      // Redirigir al dashboard
      window.location.href = '/dashboard';
    } catch (error) {
      alert('Error de autenticación');
    }
  };

  const handleGoogleLogin = () => {
    // Redirigir a endpoint de Google OAuth
    window.location.href = '/api/auth/google';
  };

  return (
    <div>
      <form onSubmit={handleLogin}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />
        <button type="submit">Login</button>
      </form>
      
      <button onClick={handleGoogleLogin}>
        Login with Google
      </button>
    </div>
  );
}
```

### Interceptor de Axios

```javascript
import axios from 'axios';

// Interceptor para agregar token a todas las requests
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores de autenticación
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token inválido o expirado
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

## Variables de Entorno Requeridas

```bash
JWT_SECRET=tu-secret-key-muy-seguro
JWT_EXPIRES_IN=24h
GOOGLE_CLIENT_ID=tu-google-client-id
GOOGLE_CLIENT_SECRET=tu-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost/api/auth/google/callback
FRONTEND_URL=http://localhost
```

## Seguridad

- Los tokens JWT expiran después de 24 horas (configurable)
- Los passwords se hashean con bcrypt antes de guardar
- Las escrituras a MongoDB se encolan para tolerancia a fallos
- Circuit Breaker protege contra fallos de MongoDB
- Rate limiting protege contra ataques de fuerza bruta

## Tolerancia a Fallos

Si MongoDB está caído (SPOF intencional):
- El login tradicional falla gracefulmente
- Google OAuth puede crear usuarios temporalmente (se procesan cuando MongoDB recupera)
- Las escrituras se encolan en RabbitMQ
- El sistema continúa funcionando para usuarios ya autenticados (con caché)


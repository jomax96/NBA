import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

function Dashboard() {
  const { isAuthenticated, user } = useAuth();
  const [stats, setStats] = useState({ teams: 0, players: 0, games: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [teamsRes, playersRes] = await Promise.all([
          axios.get('teams'),
          axios.get('players/top')
        ]);

        setStats({
          teams: teamsRes.data.data?.length || 0,
          players: playersRes.data.data?.length || 0,
          games: 0
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center pt-24">
        <div className="text-white text-2xl font-black uppercase tracking-widest">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pt-24">
      {/* Hero Section */}
      <div className="bg-black py-16 border-b-4 border-red-600">
        <div className="max-w-7xl mx-auto px-8">
          <h1 className="text-7xl font-black text-white uppercase tracking-wider mb-4">
            NBA ANALYTICS HUB
          </h1>
          <p className="text-xl text-gray-400 uppercase tracking-widest font-bold">
            ESTADÍSTICAS. PREDICCIONES. ANÁLISIS.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {/* Teams Card */}
          <div className="bg-white p-8 relative overflow-hidden group hover:bg-gray-50 transition-colors duration-200">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-600 opacity-10 rounded-full -mr-16 -mt-16"></div>
            <h2 className="text-sm font-black uppercase tracking-widest text-gray-600 mb-4">
              EQUIPOS TOTALES
            </h2>
            <p className="text-7xl font-black text-black mb-2">{stats.teams}</p>
            <div className="h-2 w-20 bg-red-600 mt-4"></div>
          </div>

          {/* Players Card */}
          <div className="bg-white p-8 relative overflow-hidden group hover:bg-gray-50 transition-colors duration-200">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-600 opacity-10 rounded-full -mr-16 -mt-16"></div>
            <h2 className="text-sm font-black uppercase tracking-widest text-gray-600 mb-4">
              JUGADORES ACTIVOS
            </h2>
            <p className="text-7xl font-black text-black mb-2">{stats.players}</p>
            <div className="h-2 w-20 bg-red-600 mt-4"></div>
          </div>

          {/* Games Card */}
          <div className="bg-white p-8 relative overflow-hidden group hover:bg-gray-50 transition-colors duration-200">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-600 opacity-10 rounded-full -mr-16 -mt-16"></div>
            <h2 className="text-sm font-black uppercase tracking-widest text-gray-600 mb-4">
              PARTIDOS REGISTRADOS
            </h2>
            <p className="text-7xl font-black text-black mb-2">{stats.games}</p>
            <div className="h-2 w-20 bg-red-600 mt-4"></div>
          </div>
        </div>

        {/* Welcome Section */}
        <div className="bg-white p-12 mb-8">
          <h2 className="text-4xl font-black text-black uppercase tracking-wider mb-6">
            {isAuthenticated
              ? `BIENVENIDO DE NUEVO, ${user?.name?.toUpperCase() || 'ATLETA'}`
              : 'BIENVENIDO AL HUB'}
          </h2>
          <p className="text-lg text-gray-700 font-medium leading-relaxed mb-6 max-w-3xl">
            Explora estadísticas completas, predicciones avanzadas y análisis detallados sobre equipos y jugadores de la NBA. 
            Navega por el menú para acceder a diferentes secciones y desbloquear todo el poder del análisis de datos aplicado al baloncesto.
          </p>

          {!isAuthenticated && (
            <div className="mt-8 bg-black p-8 border-l-4 border-red-600">
              <p className="text-white text-xl font-black uppercase tracking-wider mb-2">
                DESBLOQUEA MÁS FUNCIONES
              </p>
              <p className="text-gray-400 mb-6 font-medium">
                Inicia sesión para acceder a favoritos, historial de búsqueda, alertas personalizadas y predicciones avanzadas.
              </p>
              <Link
                to="/login"
                className="inline-block px-8 py-3 bg-red-600 text-white font-black uppercase tracking-widest text-sm hover:bg-red-700 transition-colors duration-200"
              >
                Iniciar sesión ahora
              </Link>
            </div>
          )}

          {isAuthenticated && (
            <div className="mt-8 bg-black p-8 border-l-4 border-red-600">
              <p className="text-white text-xl font-black uppercase tracking-wider mb-4">
                TUS FUNCIONES
              </p>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-red-600 mt-2"></div>
                  <span className="text-gray-300 font-medium">Guardar equipos y jugadores favoritos</span>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-red-600 mt-2"></div>
                  <span className="text-gray-300 font-medium">Ver historial de búsqueda</span>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-red-600 mt-2"></div>
                  <span className="text-gray-300 font-medium">Configurar alertas personalizadas</span>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-red-600 mt-2"></div>
                  <span className="text-gray-300 font-medium">Acceder a predicciones avanzadas</span>
                </div>
              </div>
              <Link
                to="/profile"
                className="inline-block px-8 py-3 bg-red-600 text-white font-black uppercase tracking-widest text-sm hover:bg-red-700 transition-colors duration-200"
              >
                Ver perfil
              </Link>
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Link 
            to="/teams" 
            className="bg-white p-12 hover:bg-gray-50 transition-colors duration-200 group"
          >
            <h3 className="text-3xl font-black text-black uppercase tracking-wider mb-3 group-hover:text-red-600 transition-colors">
              EXPLORAR EQUIPOS
            </h3>
            <p className="text-gray-600 font-medium mb-4">
              Sumérgete en estadísticas completas, récords y métricas de rendimiento de cada equipo.
            </p>
            <div className="flex items-center space-x-2 text-red-600 font-black uppercase text-sm">
              <span>VER TODOS LOS EQUIPOS</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          <Link 
            to="/players" 
            className="bg-white p-12 hover:bg-gray-50 transition-colors duration-200 group"
          >
            <h3 className="text-3xl font-black text-black uppercase tracking-wider mb-3 group-hover:text-red-600 transition-colors">
              EXPLORAR JUGADORES
            </h3>
            <p className="text-gray-600 font-medium mb-4">
              Analiza perfiles, estadísticas, equipo y caracteristicas de cada jugador.
            </p>
            <div className="flex items-center space-x-2 text-red-600 font-black uppercase text-sm">
              <span>VER TODOS LOS JUGADORES</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

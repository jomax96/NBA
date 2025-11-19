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
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">NBA Analytics Hub</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-2">Teams</h2>
          <p className="text-4xl font-bold text-blue-600">{stats.teams}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-2">Players</h2>
          <p className="text-4xl font-bold text-green-600">{stats.players}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-2">Games</h2>
          <p className="text-4xl font-bold text-purple-600">{stats.games}</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-2xl font-semibold mb-4">
          {isAuthenticated ? `Bienvenido, ${user?.name || 'Usuario'}!` : 'Welcome to NBA Analytics Hub'}
        </h2>
        <p className="text-gray-700 mb-4">
          Explore statistics, predictions, and insights about NBA teams and players.
          Navigate using the menu above to access different sections.
        </p>

        {!isAuthenticated && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-gray-700 mb-2">
              <strong>¿Quieres más funcionalidades?</strong>
            </p>
            <p className="text-sm text-gray-600 mb-3">
              Inicia sesión para acceder a favoritos, historial de búsquedas, alertas personalizadas y más.
            </p>
            <Link
              to="/login"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
              Iniciar Sesión
            </Link>
          </div>
        )}

        {isAuthenticated && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-gray-700 mb-2">
              <strong>Funcionalidades disponibles:</strong>
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li>Guardar equipos y jugadores favoritos</li>
              <li>Ver historial de búsquedas</li>
              <li>Configurar alertas personalizadas</li>
              <li>Acceso a predicciones avanzadas</li>
            </ul>
            <Link
              to="/profile"
              className="inline-block mt-3 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
            >
              Ver Mi Perfil
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;


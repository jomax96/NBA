import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

function Predictions() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [homeTeamId, setHomeTeamId] = useState('');
  const [visitorTeamId, setVisitorTeamId] = useState('');
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  const handlePredict = async (e) => {
    e.preventDefault();
    setLoading(true);
    setPrediction(null);

    try {
      const response = await axios.post('/api/predictions/predict', {
        homeTeamId: parseInt(homeTeamId),
        visitorTeamId: parseInt(visitorTeamId)
      });
      setPrediction(response.data.data);
      setError('');
    } catch (err) {
      console.error('Error getting prediction:', err);
      if (err.response?.status === 401) {
        setError('Debes iniciar sesión para usar predicciones');
        navigate('/login');
      } else {
        setError(err.response?.data?.error || 'Error al obtener predicción');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return null; // Redirigirá a login
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Predicciones de Partidos</h1>
      <p className="text-gray-600 mb-6">
        Solicita predicciones de partidos usando machine learning. Esta funcionalidad está disponible solo para usuarios autenticados.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}
      
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <form onSubmit={handlePredict} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Home Team ID
            </label>
            <input
              type="number"
              value={homeTeamId}
              onChange={(e) => setHomeTeamId(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Visitor Team ID
            </label>
            <input
              type="number"
              value={visitorTeamId}
              onChange={(e) => setVisitorTeamId(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Predicting...' : 'Get Prediction'}
          </button>
        </form>
      </div>

      {prediction && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-4">Prediction Results</h2>
          <div className="space-y-2">
            <p>
              <strong>Home Team Win Probability:</strong>{' '}
              {prediction.home_team_win_probability}%
            </p>
            <p>
              <strong>Visitor Team Win Probability:</strong>{' '}
              {prediction.visitor_team_win_probability}%
            </p>
            <p>
              <strong>Predicted Winner:</strong> {prediction.predicted_winner}
            </p>
            {prediction.estimated_score && (
              <p>
                <strong>Estimated Score:</strong> {prediction.estimated_score.home} - {prediction.estimated_score.visitor}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Predictions;


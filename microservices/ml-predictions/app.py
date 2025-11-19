from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
import os
import joblib
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
import logging

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuración de BD
DB_CONFIG = {
    'host': os.getenv('MYSQL_HOST', 'localhost'),
    'user': os.getenv('MYSQL_USER', 'nba_user'),
    'password': os.getenv('MYSQL_PASSWORD', 'nba_password'),
    'database': os.getenv('MYSQL_DATABASE', 'nba_db')
}

# Modelo ML (cargado o entrenado)
ml_model = None

def get_db_connection():
    """Obtiene conexión a MySQL"""
    try:
        return mysql.connector.connect(**DB_CONFIG)
    except Exception as e:
        logger.error(f"Database connection error: {e}")
        return None

def load_or_train_model():
    """Carga modelo existente o entrena uno nuevo"""
    global ml_model
    model_path = 'models/game_predictor.pkl'
    
    try:
        if os.path.exists(model_path):
            ml_model = joblib.load(model_path)
            logger.info("Model loaded from file")
        else:
            logger.info("Training new model...")
            ml_model = train_model()
            if ml_model:
                os.makedirs('models', exist_ok=True)
                joblib.dump(ml_model, model_path)
                logger.info("Model trained and saved")
    except Exception as e:
        logger.error(f"Error loading/training model: {e}")
        ml_model = None

def train_model():
    """Entrena modelo de predicción"""
    conn = get_db_connection()
    if not conn:
        logger.warn("Cannot train model: DB unavailable")
        return None
    
    try:
        query = """
        SELECT 
            team_id_home, 
            team_id_away,
            pts_home, 
            pts_away,
            CASE WHEN pts_home > pts_away THEN 1 ELSE 0 END as home_win
        FROM game
        WHERE pts_home IS NOT NULL 
        AND pts_away IS NOT NULL
        ORDER BY game_date DESC
        LIMIT 5000
        """
        
        df = pd.read_sql(query, conn)
        conn.close()
        
        if len(df) < 100:
            logger.warn(f"Not enough data to train model. Found {len(df)} games")
            return None
        
        logger.info(f"Training model with {len(df)} games")
        
        # Convertir team_ids a números para el modelo
        from sklearn.preprocessing import LabelEncoder
        
        le_home = LabelEncoder()
        le_away = LabelEncoder()
        
        df['home_encoded'] = le_home.fit_transform(df['team_id_home'])
        df['away_encoded'] = le_away.fit_transform(df['team_id_away'])
        
        X = df[['home_encoded', 'away_encoded']].values
        y = df['home_win'].values
        
        # Entrenar Random Forest
        model = RandomForestClassifier(n_estimators=100, random_state=42, max_depth=10)
        model.fit(X, y)
        
        logger.info(f"Model trained. Accuracy: {model.score(X, y):.2f}")
        
        return {
            'model': model,
            'home_encoder': le_home,
            'away_encoder': le_away
        }
        
    except Exception as e:
        logger.error(f"Error training model: {e}")
        return None

def get_team_recent_stats(team_id, conn, limit=10):
    """Obtiene estadísticas recientes de un equipo"""
    try:
        # CORRECCIÓN 1: Agregar ORDER BY game_date DESC
        query = """
        SELECT 
            CASE WHEN team_id_home = %s THEN pts_home ELSE pts_away END as points,
            CASE 
                WHEN team_id_home = %s THEN 
                    CASE WHEN pts_home > pts_away THEN 1 ELSE 0 END
                ELSE 
                    CASE WHEN pts_away > pts_home THEN 1 ELSE 0 END
            END as won
        FROM game
        WHERE (team_id_home = %s OR team_id_away = %s)
        AND pts_home IS NOT NULL
        AND pts_away IS NOT NULL
        ORDER BY game_date DESC
        LIMIT %s
        """
        
        cursor = conn.cursor()
        cursor.execute(query, (str(team_id), str(team_id), str(team_id), str(team_id), limit))
        results = cursor.fetchall()
        cursor.close()
        
        if not results or len(results) == 0:
            logger.warn(f"No recent games found for team {team_id}")
            return {
                'avg_points': 105.0,
                'win_rate': 0.5,
                'games_played': 0
            }
        
        # CORRECCIÓN 2: Calcular correctamente las estadísticas
        points = [float(row[0]) for row in results if row[0] is not None]
        wins = [int(row[1]) for row in results if row[1] is not None]
        
        avg_points = sum(points) / len(points) if points else 105.0
        win_rate = sum(wins) / len(wins) if wins else 0.5
        games_played = len(results)
        
        logger.info(f"Team {team_id} stats: avg_points={avg_points:.1f}, win_rate={win_rate:.2f}, games={games_played}")
        
        return {
            'avg_points': round(avg_points, 1),
            'win_rate': round(win_rate, 3),
            'games_played': games_played
        }
        
    except Exception as e:
        logger.error(f"Error getting team stats for {team_id}: {e}")
        import traceback
        traceback.print_exc()
        return {
            'avg_points': 105.0,
            'win_rate': 0.5,
            'games_played': 0
        }

def get_head_to_head_stats(home_team_id, visitor_team_id, conn, limit=10):
    """Obtiene estadísticas de enfrentamientos directos"""
    try:
        # CORRECCIÓN 3: ORDER BY game_date DESC
        query = """
        SELECT 
            COUNT(*) as total_games,
            SUM(CASE WHEN pts_home > pts_away THEN 1 ELSE 0 END) as home_wins,
            AVG(pts_home) as avg_home_score,
            AVG(pts_away) as avg_away_score
        FROM game
        WHERE team_id_home = %s 
        AND team_id_away = %s
        AND pts_home IS NOT NULL
        AND pts_away IS NOT NULL
        ORDER BY game_date DESC
        LIMIT %s
        """
        
        cursor = conn.cursor()
        cursor.execute(query, (str(home_team_id), str(visitor_team_id), limit))
        result = cursor.fetchone()
        cursor.close()
        
        if result and result[0] and result[0] > 0:
            total_games = int(result[0])
            home_wins = int(result[1]) if result[1] else 0
            
            logger.info(f"H2H: {home_team_id} vs {visitor_team_id} - {home_wins}/{total_games} wins")
            
            return {
                'total_games': total_games,
                'home_wins': home_wins,
                'avg_home_score': round(float(result[2]), 1) if result[2] else 0,
                'avg_away_score': round(float(result[3]), 1) if result[3] else 0
            }
        
        logger.info(f"No H2H history found for {home_team_id} vs {visitor_team_id}")
        return None
        
    except Exception as e:
        logger.error(f"Error getting head to head stats: {e}")
        import traceback
        traceback.print_exc()
        return None

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    db_available = get_db_connection() is not None
    return jsonify({
        'status': 'healthy',
        'service': 'ml-predictions',
        'model_loaded': ml_model is not None,
        'database_available': db_available
    })

@app.route('/predict', methods=['POST'])
def predict():
    """Predice resultado de partido"""
    try:
        data = request.json
        home_team_id = str(data.get('home_team_id', ''))
        visitor_team_id = str(data.get('visitor_team_id', ''))
        
        if not home_team_id or not visitor_team_id:
            return jsonify({'error': 'home_team_id and visitor_team_id required'}), 400
        
        logger.info(f"Prediction request: {home_team_id} vs {visitor_team_id}")
        
        conn = get_db_connection()
        if not conn:
            return jsonify({
                'error': 'Database unavailable',
                'prediction': 'unavailable'
            }), 503
        
        # Obtener estadísticas recientes (últimos 10 juegos)
        home_stats = get_team_recent_stats(home_team_id, conn, limit=10)
        visitor_stats = get_team_recent_stats(visitor_team_id, conn, limit=10)
        
        # Obtener historial de enfrentamientos
        h2h_stats = get_head_to_head_stats(home_team_id, visitor_team_id, conn)
        
        conn.close()
        
        logger.info(f"Home stats: {home_stats}")
        logger.info(f"Visitor stats: {visitor_stats}")
        
        # CORRECCIÓN 4: Mejorar el cálculo de probabilidad
        base_prob = 0.55  # Ventaja de local
        
        # Factor de rendimiento reciente (más peso)
        win_rate_diff = home_stats['win_rate'] - visitor_stats['win_rate']
        perf_factor = win_rate_diff * 0.3
        
        # Factor de puntos promedio
        points_diff = (home_stats['avg_points'] - visitor_stats['avg_points']) / 200.0
        points_factor = points_diff * 0.1
        
        # Factor de historial directo
        h2h_factor = 0
        if h2h_stats and h2h_stats['total_games'] >= 3:
            h2h_win_rate = h2h_stats['home_wins'] / h2h_stats['total_games']
            h2h_factor = (h2h_win_rate - 0.5) * 0.15
        
        # Probabilidad final
        home_win_prob = base_prob + perf_factor + points_factor + h2h_factor
        home_win_prob = max(0.15, min(0.85, home_win_prob))
        
        logger.info(f"Probability calculation: base={base_prob}, perf={perf_factor:.3f}, points={points_factor:.3f}, h2h={h2h_factor:.3f}, final={home_win_prob:.3f}")
        
        # CORRECCIÓN 5: Estimar marcador basado en promedios reales
        estimated_home_score = int(home_stats['avg_points'])
        estimated_visitor_score = int(visitor_stats['avg_points'])
        
        # Ajustar marcador basado en probabilidad de victoria
        score_adjustment = int((home_win_prob - 0.5) * 20)
        estimated_home_score += score_adjustment
        estimated_visitor_score -= score_adjustment // 2
        
        # Asegurar valores razonables
        estimated_home_score = max(80, min(130, estimated_home_score))
        estimated_visitor_score = max(80, min(130, estimated_visitor_score))
        
        logger.info(f"Estimated score: {estimated_home_score} - {estimated_visitor_score}")
        
        # Determinar confianza
        prob_diff = abs(home_win_prob - 0.5)
        confidence_score = prob_diff * 2  # Normalizar a 0-1
        
        if confidence_score > 0.5:
            confidence = 'high'
        elif confidence_score > 0.3:
            confidence = 'medium'
        else:
            confidence = 'low'
        
        # Construir respuesta
        response = {
            'home_team_id': home_team_id,
            'visitor_team_id': visitor_team_id,
            'home_team_win_probability': round(home_win_prob * 100, 2),
            'visitor_team_win_probability': round((1 - home_win_prob) * 100, 2),
            'predicted_winner': 'home' if home_win_prob > 0.5 else 'visitor',
            'estimated_score': {
                'home': estimated_home_score,
                'visitor': estimated_visitor_score
            },
            'confidence': confidence,
            'factors': {
                'home_recent_win_rate': round(home_stats['win_rate'] * 100, 1),
                'visitor_recent_win_rate': round(visitor_stats['win_rate'] * 100, 1),
                'home_recent_games': home_stats['games_played'],
                'visitor_recent_games': visitor_stats['games_played'],
                'home_avg_points': round(home_stats['avg_points'], 1),
                'visitor_avg_points': round(visitor_stats['avg_points'], 1)
            }
        }
        
        if h2h_stats and h2h_stats['total_games'] > 0:
            response['head_to_head'] = {
                'total_games': h2h_stats['total_games'],
                'home_wins': h2h_stats['home_wins'],
                'visitor_wins': h2h_stats['total_games'] - h2h_stats['home_wins'],
                'avg_home_score': h2h_stats['avg_home_score'],
                'avg_visitor_score': h2h_stats['avg_away_score']
            }
        
        logger.info(f"Prediction successful: {response['predicted_winner']} with {confidence} confidence")
        
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Cargar/entrenar modelo al iniciar
    load_or_train_model()
    
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
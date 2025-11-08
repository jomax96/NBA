-- Script de inicialización de base de datos NBA
-- Este script crea las tablas necesarias para el sistema

CREATE DATABASE IF NOT EXISTS nba_db;
USE nba_db;

-- Tabla de equipos
CREATE TABLE IF NOT EXISTS teams (
    team_id INT PRIMARY KEY AUTO_INCREMENT,
    team_name VARCHAR(100) NOT NULL,
    city VARCHAR(50),
    abbreviation VARCHAR(10) UNIQUE,
    conference VARCHAR(10),
    division VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_team_name (team_name),
    INDEX idx_conference (conference)
);

-- Tabla de jugadores
CREATE TABLE IF NOT EXISTS players (
    player_id INT PRIMARY KEY AUTO_INCREMENT,
    player_name VARCHAR(100) NOT NULL,
    position VARCHAR(10),
    height VARCHAR(10),
    weight INT,
    team_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (team_id) REFERENCES teams(team_id),
    INDEX idx_player_name (player_name),
    INDEX idx_team_id (team_id)
);

-- Tabla de partidos
CREATE TABLE IF NOT EXISTS games (
    game_id INT PRIMARY KEY AUTO_INCREMENT,
    game_date DATE NOT NULL,
    home_team_id INT NOT NULL,
    visitor_team_id INT NOT NULL,
    home_team_score INT,
    visitor_team_score INT,
    season INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (home_team_id) REFERENCES teams(team_id),
    FOREIGN KEY (visitor_team_id) REFERENCES teams(team_id),
    INDEX idx_game_date (game_date),
    INDEX idx_home_team (home_team_id),
    INDEX idx_visitor_team (visitor_team_id)
);

-- Tabla de estadísticas de jugadores por partido
CREATE TABLE IF NOT EXISTS game_players (
    id INT PRIMARY KEY AUTO_INCREMENT,
    game_id INT NOT NULL,
    player_id INT NOT NULL,
    points INT DEFAULT 0,
    rebounds INT DEFAULT 0,
    assists INT DEFAULT 0,
    minutes_played INT,
    FOREIGN KEY (game_id) REFERENCES games(game_id),
    FOREIGN KEY (player_id) REFERENCES players(player_id),
    INDEX idx_game_id (game_id),
    INDEX idx_player_id (player_id)
);

-- Insertar datos de ejemplo (equipos NBA)
INSERT IGNORE INTO teams (team_id, team_name, city, abbreviation, conference, division) VALUES
(1, 'Lakers', 'Los Angeles', 'LAL', 'West', 'Pacific'),
(2, 'Warriors', 'Golden State', 'GSW', 'West', 'Pacific'),
(3, 'Celtics', 'Boston', 'BOS', 'East', 'Atlantic'),
(4, 'Heat', 'Miami', 'MIA', 'East', 'Southeast'),
(5, 'Bucks', 'Milwaukee', 'MIL', 'East', 'Central'),
(6, 'Nuggets', 'Denver', 'DEN', 'West', 'Northwest'),
(7, 'Suns', 'Phoenix', 'PHX', 'West', 'Pacific'),
(8, '76ers', 'Philadelphia', 'PHI', 'East', 'Atlantic'),
(9, 'Clippers', 'Los Angeles', 'LAC', 'West', 'Pacific'),
(10, 'Nets', 'Brooklyn', 'BKN', 'East', 'Atlantic');

-- Insertar jugadores de ejemplo
INSERT IGNORE INTO players (player_id, player_name, position, height, weight, team_id) VALUES
(1, 'LeBron James', 'SF', '6-9', 250, 1),
(2, 'Stephen Curry', 'PG', '6-3', 190, 2),
(3, 'Jayson Tatum', 'SF', '6-8', 210, 3),
(4, 'Jimmy Butler', 'SF', '6-7', 230, 4),
(5, 'Giannis Antetokounmpo', 'PF', '6-11', 242, 5),
(6, 'Nikola Jokic', 'C', '6-11', 284, 6),
(7, 'Devin Booker', 'SG', '6-5', 206, 7),
(8, 'Joel Embiid', 'C', '7-0', 280, 8),
(9, 'Kawhi Leonard', 'SF', '6-7', 225, 9),
(10, 'Kevin Durant', 'PF', '6-11', 240, 10);

-- Insertar partidos de ejemplo
INSERT IGNORE INTO games (game_id, game_date, home_team_id, visitor_team_id, home_team_score, visitor_team_score, season) VALUES
(1, '2024-01-15', 1, 2, 108, 102, 2024),
(2, '2024-01-16', 3, 4, 115, 110, 2024),
(3, '2024-01-17', 5, 6, 120, 118, 2024),
(4, '2024-01-18', 7, 8, 105, 98, 2024),
(5, '2024-01-19', 9, 10, 112, 109, 2024);

-- Insertar estadísticas de jugadores de ejemplo
INSERT IGNORE INTO game_players (game_id, player_id, points, rebounds, assists, minutes_played) VALUES
(1, 1, 28, 8, 10, 38),
(1, 2, 32, 5, 7, 35),
(2, 3, 25, 10, 5, 36),
(2, 4, 22, 6, 8, 34),
(3, 5, 30, 12, 6, 37),
(3, 6, 27, 14, 9, 39);


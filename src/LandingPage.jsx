import React from 'react';
import { Trophy, Plus, Shield, Calendar, ArrowRight, Zap, Award } from 'lucide-react';

export default function LandingPage({ 
  tournaments = [], 
  recentMatches = [], 
  onStartNewTournament, 
  onSelectTournament 
}) {
  return (
    <div className="landing-container">
      {/* Hero Banner */}
      <section className="hero-banner glass-panel">
        <div className="hero-content">
          <div className="hero-badge">
            <Award size={16} className="text-primary animate-pulse" />
            <span>Cricket Tournament Manager</span>
          </div>
          <h2>Host, Score & Broadcast Like a Pro</h2>
          <p>
            CricDeck provides ICC-standard statistical engines, real-time OBS graphics overlays, 
            and interactive scorecards for local and professional leagues.
          </p>
          <button className="btn btn-primary btn-large" onClick={onStartNewTournament}>
            <Plus size={20} /> Start New Tournament
          </button>
        </div>
        <div className="hero-visual">
          <Trophy className="hero-trophy-icon" size={180} />
        </div>
      </section>

      {/* Grid Layout: Tournaments & Matches */}
      <div className="landing-grid">
        {/* Active Tournaments Panel */}
        <div className="landing-panel glass-panel">
          <div className="panel-header">
            <h3><Trophy className="brand-icon" size={20} /> Active Tournaments</h3>
            <span className="count-badge">{tournaments.length}</span>
          </div>
          
          <div className="panel-body list-scroll">
            {tournaments.length === 0 ? (
              <div className="empty-state">
                <Shield size={40} className="empty-icon" />
                <p>No active tournaments found.</p>
                <button className="btn btn-secondary btn-sm" onClick={onStartNewTournament}>
                  Create One Now
                </button>
              </div>
            ) : (
              tournaments.map(tournament => (
                <div 
                  key={tournament.id} 
                  className="list-item clickable"
                  onClick={() => onSelectTournament(tournament.id)}
                >
                  <div className="item-details">
                    <h4>{tournament.name}</h4>
                    <span className="item-meta">
                      Format: {tournament.format} | {tournament.overs_quota} Overs
                    </span>
                  </div>
                  <button className="btn-icon">
                    <ArrowRight size={18} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Matches Panel */}
        <div className="landing-panel glass-panel">
          <div className="panel-header">
            <h3><Calendar className="brand-icon" size={20} /> Recent Matches</h3>
            <span className="count-badge">
              {recentMatches.filter(m => m.status === 'completed').length}
            </span>
          </div>

          <div className="panel-body list-scroll">
            {recentMatches.length === 0 ? (
              <div className="empty-state">
                <Zap size={40} className="empty-icon" />
                <p>No matches scored yet.</p>
              </div>
            ) : (
              recentMatches.map(match => (
                <div key={match.id} className="match-card">
                  <div className="match-card-header">
                    <span className={`match-badge ${match.status}`}>
                      {match.status === 'completed' ? 'Finished' : 'Live Now'}
                    </span>
                    <span className="match-card-meta">
                      {match.overs_quota} Overs
                    </span>
                  </div>
                  
                  <div className="match-card-score">
                    <div className="team-row">
                      <span className="team-name">{match.team_a}</span>
                      <span className="team-runs">
                        {match.team_a_score || 0}/{match.team_a_wickets || 0}
                        <span className="team-overs-sub">
                          ({match.team_a_overs || 0}.{match.team_a_balls || 0} ov)
                        </span>
                      </span>
                    </div>
                    <div className="team-row">
                      <span className="team-name">{match.team_b}</span>
                      <span className="team-runs">
                        {match.team_b_score || 0}/{match.team_b_wickets || 0}
                        <span className="team-overs-sub">
                          ({match.team_b_overs || 0}.{match.team_b_balls || 0} ov)
                        </span>
                      </span>
                    </div>
                  </div>

                  {match.status === 'completed' && match.winner_name && (
                    <div className="match-winner-banner">
                      <Trophy size={14} className="text-warning" />
                      <span>{match.winner_name} won the match</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { 
  Trophy, Calendar, Award, BarChart2, Play, Users, 
  Settings, ChevronRight, Zap, Target, Plus, RefreshCw 
} from 'lucide-react';
import { calculateStandings, calculatePlayerLeaderboards, calculateMatchAwards } from './statsEngine';

export default function TournamentDashboard({ 
  tournament, 
  matches = [], 
  onStartScoringMatch, 
  onScheduleMatch,
  onUpdateMatchDate,
  onBackToLanding,
  onDesignOverlay
}) {
  const [activeTab, setActiveTab] = useState('standings'); // standings, matches, stats, awards
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Match Schedule Form State
  const [teamAId, setTeamAId] = useState('');
  const [teamBId, setTeamBId] = useState('');
  const [matchDate, setMatchDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const teams = tournament.teams || [];
  
  // Standings
  const standings = calculateStandings(teams, matches);

  // Player Stats Leaderboard
  const allPlayers = teams.reduce((acc, t) => {
    return acc.concat(t.players.map(p => ({ ...p, team_id: t.id, teamName: t.name })));
  }, []);

  const stats = calculatePlayerLeaderboards(allPlayers, matches);

  // Schedule Match Submission
  const handleScheduleSubmit = (e) => {
    e.preventDefault();
    if (!teamAId || !teamBId) {
      alert('Please select both Team A and Team B.');
      return;
    }
    if (teamAId === teamBId) {
      alert('Team A and Team B cannot be the same.');
      return;
    }

    const teamA = teams.find(t => t.id === teamAId);
    const teamB = teams.find(t => t.id === teamBId);

    onScheduleMatch({
      team_a_id: teamAId,
      team_b_id: teamBId,
      team_a: teamA.name,
      team_b: teamB.name,
      match_date: matchDate,
      overs_quota: tournament.overs_quota
    });

    setShowScheduleModal(false);
    // Reset forms
    setTeamAId('');
    setTeamBId('');
    setMatchDate(new Date().toISOString().split('T')[0]);
  };

  return (
    <div className="tournament-dashboard">
      {/* Tournament Header */}
      <header className="dashboard-header glass-panel">
        <div className="header-meta">
          <button className="btn btn-secondary btn-sm" onClick={onBackToLanding}>
            Back to Home
          </button>
          <h2>{tournament.name}</h2>
          <span className="format-badge">{tournament.format} • {tournament.overs_quota} Overs</span>
        </div>
        
        <nav className="dashboard-nav-tabs">
          <button 
            className={`nav-tab-btn ${activeTab === 'standings' ? 'active' : ''}`}
            onClick={() => setActiveTab('standings')}
          >
            <Trophy size={16} /> Standings
          </button>
          <button 
            className={`nav-tab-btn ${activeTab === 'matches' ? 'active' : ''}`}
            onClick={() => setActiveTab('matches')}
          >
            <Calendar size={16} /> Matches
          </button>
          <button 
            className={`nav-tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            <BarChart2 size={16} /> Stats
          </button>
          <button 
            className={`nav-tab-btn ${activeTab === 'awards' ? 'active' : ''}`}
            onClick={() => setActiveTab('awards')}
          >
            <Award size={16} /> Awards
          </button>
          <button 
            className="nav-tab-btn"
            onClick={onDesignOverlay}
            style={{ marginLeft: 'auto', background: 'rgba(236, 72, 153, 0.1)', border: '1px solid rgba(236, 72, 153, 0.3)', color: '#f472b6' }}
          >
            <Zap size={16} /> Broadcast Overlay
          </button>
        </nav>
      </header>

      {/* Tab Panel Content */}
      <div className="dashboard-body-content">
        
        {/* STANDINGS TAB */}
        {activeTab === 'standings' && (
          <div className="tab-panel glass-panel animate-fade-in">
            <h3>League Standings</h3>
            <div className="table-responsive">
              <table className="standings-table">
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>Played</th>
                    <th>Won</th>
                    <th>Lost</th>
                    <th>Points</th>
                    <th>NRR</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((team, idx) => (
                    <tr key={team.id}>
                      <td className="team-td">
                        <span className="rank-index">{idx + 1}</span>
                        {team.logo_data ? (
                          <img src={team.logo_data} alt="logo" className="table-team-logo" />
                        ) : (
                          <div className="table-team-logo-placeholder">
                            {team.name.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span className="table-team-name">{team.name}</span>
                      </td>
                      <td>{team.played}</td>
                      <td>{team.won}</td>
                      <td>{team.lost}</td>
                      <td className="text-primary font-bold">{team.points}</td>
                      <td className={team.nrr >= 0 ? 'text-success' : 'text-danger'}>
                        {team.nrr >= 0 ? '+' : ''}{team.nrr.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MATCHES TAB */}
        {activeTab === 'matches' && (
          <div className="tab-panel animate-fade-in">
            <div className="panel-flex-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Match Schedule & Results</h3>
              <button className="btn btn-primary" onClick={() => setShowScheduleModal(true)}>
                <Plus size={16} /> Schedule Match
              </button>
            </div>

            <div className="matches-grid">
              {matches.length === 0 ? (
                <div className="empty-state glass-panel">
                  <Calendar size={48} className="empty-icon" />
                  <p>No matches scheduled yet.</p>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowScheduleModal(true)}>
                    Schedule First Match
                  </button>
                </div>
              ) : (
                matches.map(match => {
                  const teamA = teams.find(t => t.id === match.team_a_id);
                  const teamB = teams.find(t => t.id === match.team_b_id);

                  return (
                    <div key={match.id} className="match-card-large glass-panel">
                      <div className="card-top">
                        <span className={`status-pill ${match.status}`}>
                          {match.status.toUpperCase()}
                        </span>
                        <span className="card-overs">{match.match_date ? `${match.match_date} • ` : ''}{match.overs_quota} Overs Match</span>
                      </div>

                      <div className="match-teams-display">
                        <div className="match-team-row">
                          <div className="match-team-left">
                            {teamA?.logo_data ? (
                              <img src={teamA.logo_data} className="display-team-logo" />
                            ) : (
                              <div className="display-team-logo-placeholder">A</div>
                            )}
                            <span className="display-team-name">{match.team_a}</span>
                          </div>
                          <span className="display-team-score">
                            {match.team_a_score || 0}/{match.team_a_wickets || 0}
                            <span className="display-team-overs">
                              ({match.team_a_overs || 0}.{match.team_a_balls || 0} ov)
                            </span>
                          </span>
                        </div>

                        <div className="divider-vs">VS</div>

                        <div className="match-team-row">
                          <div className="match-team-left">
                            {teamB?.logo_data ? (
                              <img src={teamB.logo_data} className="display-team-logo" />
                            ) : (
                              <div className="display-team-logo-placeholder">B</div>
                            )}
                            <span className="display-team-name">{match.team_b}</span>
                          </div>
                          <span className="display-team-score">
                            {match.team_b_score || 0}/{match.team_b_wickets || 0}
                            <span className="display-team-overs">
                              ({match.team_b_overs || 0}.{match.team_b_balls || 0} ov)
                            </span>
                          </span>
                        </div>
                      </div>

                      {match.status === 'scheduled' && (
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
                          <button 
                            className="btn btn-success"
                            style={{ flex: 2 }}
                            onClick={() => onStartScoringMatch(match)}
                          >
                            <Play size={16} /> Start Scoring Match
                          </button>
                          <button 
                            className="btn btn-secondary"
                            style={{ flex: 1 }}
                            onClick={() => {
                              const newDate = prompt("Enter new date (YYYY-MM-DD):", match.match_date || '');
                              if (newDate) {
                                onUpdateMatchDate(match.id, newDate);
                              }
                            }}
                          >
                            Edit Date
                          </button>
                        </div>
                      )}

                      {match.status === 'live' && (
                        <button 
                          className="btn btn-primary w-full"
                          style={{ marginTop: '1.5rem' }}
                          onClick={() => onStartScoringMatch(match)}
                        >
                          <Zap size={16} /> Resume Scoring Match
                        </button>
                      )}

                      {match.status === 'completed' && (
                        <div className="match-footer-banner" style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start', padding: '12px', background: 'rgba(251, 191, 36, 0.05)', borderRadius: '8px', borderLeft: '3px solid var(--secondary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Trophy size={14} style={{ color: 'var(--secondary)' }} />
                            <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                              {teams.find(t => t.id === match.winner_id)?.name || 'Match'} won the match
                            </span>
                          </div>
                          {(() => {
                            const awards = calculateMatchAwards(match);
                            const potm = awards && awards[0];
                            if (!potm || potm.runs === 0 && potm.wickets === 0) return null;
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', opacity: 0.9 }}>
                                <Award size={14} style={{ color: 'var(--primary)' }} />
                                <span>
                                  Suggested POTM: <strong style={{ color: '#fff' }}>{potm.name}</strong> 
                                  {potm.runs > 0 ? ` (${potm.runs} runs` : ''}
                                  {potm.wickets > 0 ? `${potm.runs > 0 ? ', ' : ' ('}${potm.wickets} wkts` : ''}
                                  {potm.runs > 0 || potm.wickets > 0 ? ')' : ''}
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* STATS LEADERBOARDS TAB */}
        {activeTab === 'stats' && (() => {
          const filteredPlayers = allPlayers.map(p => {
            const pStats = stats.allPlayers.find(s => s.name === p.name) || {
              name: p.name,
              runs: 0,
              balls: 0,
              fours: 0,
              sixes: 0,
              wickets: 0,
              ballsBowled: 0,
              maidens: 0,
              runsConceded: 0,
              strikeRate: 0,
              economy: 99.99,
              impactScore: 0,
              wicketHattricks: 0,
              sixesHattricks: 0,
              foursHattricks: 0
            };
            return { ...p, ...pStats };
          }).filter(p => 
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.teamName.toLowerCase().includes(searchQuery.toLowerCase())
          );

          return (
            <div className="tab-panel animate-fade-in">
              <h3>Tournament Leaderboard</h3>
              
              <div className="stats-cards-grid">
                {/* Orange Cap: Top Batters */}
                <div className="stats-card glass-panel">
                  <div className="stats-card-header orange-gradient">
                    <Target size={20} />
                    <span>Most Runs (Orange Cap)</span>
                  </div>
                  <div className="stats-card-body">
                    {stats.topRunScorers.length === 0 ? (
                      <p className="no-stats-text">No runs scored yet.</p>
                    ) : (
                      stats.topRunScorers.slice(0, 5).map((player, idx) => (
                        <div key={idx} className="stats-row-item">
                          <span className="stats-row-rank">{idx + 1}</span>
                          <span className="stats-row-name">{player.name}</span>
                          <span className="stats-row-val">{player.runs} <span className="sub-val">({player.balls}b)</span></span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Purple Cap: Top Wickets */}
                <div className="stats-card glass-panel">
                  <div className="stats-card-header purple-gradient">
                    <Award size={20} />
                    <span>Most Wickets (Purple Cap)</span>
                  </div>
                  <div className="stats-card-body">
                    {stats.topWicketTakers.length === 0 ? (
                      <p className="no-stats-text">No wickets taken yet.</p>
                    ) : (
                      stats.topWicketTakers.slice(0, 5).map((player, idx) => (
                        <div key={idx} className="stats-row-item">
                          <span className="stats-row-rank">{idx + 1}</span>
                          <span className="stats-row-name">{player.name}</span>
                          <span className="stats-row-val text-primary">{player.wickets} <span className="sub-val">({player.runsConceded}r)</span></span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Boundary Kings */}
                <div className="stats-card glass-panel">
                  <div className="stats-card-header blue-gradient">
                    <Zap size={20} />
                    <span>Boundary Kings (4s & 6s)</span>
                  </div>
                  <div className="stats-card-body">
                    {stats.boundaryKings.length === 0 ? (
                      <p className="no-stats-text">No boundaries hit yet.</p>
                    ) : (
                      stats.boundaryKings.slice(0, 5).map((player, idx) => (
                        <div key={idx} className="stats-row-item">
                          <span className="stats-row-rank">{idx + 1}</span>
                          <span className="stats-row-name">{player.name}</span>
                          <span className="stats-row-val">
                            {player.fours + player.sixes} <span className="sub-val">(4s: {player.fours}, 6s: {player.sixes})</span>
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Best Bowler Economy */}
                <div className="stats-card glass-panel">
                  <div className="stats-card-header green-gradient">
                    <RefreshCw size={20} />
                    <span>Best Bowler Economy</span>
                  </div>
                  <div className="stats-card-body">
                    {stats.bestEconomies.length === 0 ? (
                      <p className="no-stats-text">No overs bowled yet.</p>
                    ) : (
                      stats.bestEconomies.slice(0, 5).map((player, idx) => (
                        <div key={idx} className="stats-row-item">
                          <span className="stats-row-rank">{idx + 1}</span>
                          <span className="stats-row-name">{player.name}</span>
                          <span className="stats-row-val text-success">{player.economy.toFixed(2)} <span className="sub-val">({player.runsConceded}r)</span></span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Hat-trick Heroes Card */}
                <div className="stats-card glass-panel">
                  <div className="stats-card-header" style={{ background: 'linear-gradient(135deg, #fbbf24 0%, #db2777 100%)', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff', padding: '0.75rem 1rem' }}>
                    <Zap size={20} />
                    <span>Hat-trick Heroes</span>
                  </div>
                  <div className="stats-card-body">
                    {stats.allPlayers.filter(p => (p.wicketHattricks + p.sixesHattricks + p.foursHattricks) > 0).length === 0 ? (
                      <p className="no-stats-text">No hat-tricks recorded yet.</p>
                    ) : (
                      stats.allPlayers.filter(p => (p.wicketHattricks + p.sixesHattricks + p.foursHattricks) > 0)
                        .slice(0, 5).map((player, idx) => (
                          <div key={idx} className="stats-row-item">
                            <span className="stats-row-rank">{idx + 1}</span>
                            <span className="stats-row-name">{player.name}</span>
                            <span className="stats-row-val text-warning">
                              {player.wicketHattricks + player.sixesHattricks + player.foursHattricks} <span className="sub-val">(W: {player.wicketHattricks}, 6s: {player.sixesHattricks}, 4s: {player.foursHattricks})</span>
                            </span>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>

              {/* Player Search Directory */}
              <div className="search-bar-container" style={{ marginTop: '2.5rem', marginBottom: '1.5rem' }}>
                <h4 style={{ marginBottom: '0.75rem', color: 'var(--text-light)' }}>Search Player Directory</h4>
                <input 
                  type="text"
                  className="form-control"
                  placeholder="Search players by name or team..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ 
                    width: '100%', 
                    maxWidth: '400px', 
                    background: 'rgba(255, 255, 255, 0.05)', 
                    border: '1.5px solid rgba(255, 255, 255, 0.1)', 
                    color: '#fff', 
                    borderRadius: '8px', 
                    padding: '0.75rem' 
                  }}
                />
              </div>

              <div className="table-responsive glass-panel" style={{ padding: '1rem', overflowX: 'auto', border: '1.5px solid rgba(255,255,255,0.08)' }}>
                <table className="standings-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Player Name</th>
                      <th>Team</th>
                      <th>Role</th>
                      <th>Runs (Balls)</th>
                      <th>SR</th>
                      <th>4s / 6s</th>
                      <th>Wkts (Runs)</th>
                      <th>Econ</th>
                      <th>Mdns</th>
                      <th>Hat-tricks (W / 6 / 4)</th>
                      <th>Impact Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlayers.length === 0 ? (
                      <tr>
                        <td colSpan="11" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                          No players matched your search criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredPlayers.map((player, idx) => (
                        <tr key={idx}>
                          <td style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none' }}>
                            {player.photo_data ? (
                              <img src={player.photo_data} alt="player" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                {player.name.substring(0, 2).toUpperCase()}
                              </div>
                            )}
                            <span style={{ fontWeight: '500' }}>{player.name}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>{player.teamName}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ padding: '2px 8px', fontSize: '0.7rem', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', textTransform: 'capitalize' }}>
                              {player.role}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>{player.runs} <span className="sub-val">({player.balls}b)</span></td>
                          <td style={{ textAlign: 'center' }}>{player.strikeRate.toFixed(1)}</td>
                          <td style={{ textAlign: 'center' }}>{player.fours} / {player.sixes}</td>
                          <td style={{ textAlign: 'center' }}>{player.wickets} <span className="sub-val">({player.runsConceded}r)</span></td>
                          <td style={{ textAlign: 'center' }}>{player.ballsBowled > 0 ? player.economy.toFixed(2) : '-'}</td>
                          <td style={{ textAlign: 'center' }}>{player.maidens}</td>
                          <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--primary)' }}>
                            {player.wicketHattricks || player.sixesHattricks || player.foursHattricks ? (
                              `${player.wicketHattricks} / ${player.sixesHattricks} / ${player.foursHattricks}`
                            ) : (
                              '-'
                            )}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--secondary)' }}>{player.impactScore}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* ALGORITHMIC AWARDS TAB */}
        {activeTab === 'awards' && (
          <div className="tab-panel glass-panel animate-fade-in">
            <h3>Tournament Award Nominees</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-dark)', marginBottom: '2rem' }}>
              Suggested candidates automatically calculated based on Player Impact Ratings across all deliveries.
            </p>

            <div className="awards-nominee-container">
              <div className="mvp-main-card">
                <div className="mvp-badge"><Trophy size={28} /></div>
                <h4>Suggested Player of the Tournament (MVP)</h4>
                
                {stats.allPlayers.length === 0 ? (
                  <p className="no-stats-text" style={{ padding: '2rem' }}>No stats calculated yet. Score matches to suggest awards.</p>
                ) : (
                  <div className="mvp-winner-info">
                    {stats.allPlayers[0].photo_data ? (
                      <img src={stats.allPlayers[0].photo_data} className="mvp-winner-photo" />
                    ) : (
                      <div className="mvp-winner-photo-placeholder">
                        {stats.allPlayers[0].name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="mvp-name">{stats.allPlayers[0].name}</span>
                    <span className="mvp-team">Team: {teams.find(t => t.id === stats.allPlayers[0].team_id)?.name}</span>
                    
                    <div className="mvp-metrics">
                      <div className="metric-box">
                        <span className="m-val">{stats.allPlayers[0].runs}</span>
                        <span className="m-lbl">Runs</span>
                      </div>
                      <div className="metric-box">
                        <span className="m-val">{stats.allPlayers[0].wickets}</span>
                        <span className="m-lbl">Wickets</span>
                      </div>
                      <div className="metric-box">
                        <span className="m-val text-primary">{stats.allPlayers[0].impactScore}</span>
                        <span className="m-lbl">Impact Score</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Roster rating table */}
              <div className="mvp-table-panel">
                <h4> Roster Impact Leadership Rankings</h4>
                <div className="mvp-ranking-list">
                  {stats.allPlayers.slice(0, 10).map((player, idx) => (
                    <div key={idx} className="ranking-item">
                      <div className="rank-left">
                        <span className="rank-num">{idx + 1}</span>
                        <span>{player.name}</span>
                      </div>
                      <span className="rank-impact-val">{player.impactScore}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* SCHEDULE MATCH MODAL */}
      {showScheduleModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Schedule New Live Match</h3>
              <button className="btn-close" onClick={() => setShowScheduleModal(false)}>&times;</button>
            </div>
            
            <form onSubmit={handleScheduleSubmit}>
              <div className="modal-body">
                {/* Team Selection */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Team A</label>
                    <select 
                      className="form-control"
                      value={teamAId}
                      onChange={e => setTeamAId(e.target.value)}
                      required
                    >
                      <option value="">-- Select Team --</option>
                      {teams.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Team B</label>
                    <select 
                      className="form-control"
                      value={teamBId}
                      onChange={e => setTeamBId(e.target.value)}
                      required
                    >
                      <option value="">-- Select Team --</option>
                      {teams.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Match Date */}
                <div className="form-group">
                  <label>Match Date</label>
                  <input 
                    type="date"
                    className="form-control"
                    value={matchDate}
                    onChange={e => setMatchDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowScheduleModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Schedule Match
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

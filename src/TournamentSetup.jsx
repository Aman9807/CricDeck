import React, { useState } from 'react';
import { Trophy, Users, UserPlus, Image, ChevronLeft, ChevronRight, Check, Trash2, Zap } from 'lucide-react';
import OverlayEditor from './OverlayEditor';

export default function TournamentSetup({ onComplete, onCancel }) {
  const [step, setStep] = useState(1);
  const [showDesigner, setShowDesigner] = useState(false);
  const [overlayPreset, setOverlayPreset] = useState('transparent');
  const [details, setDetails] = useState({
    name: 'CricDeck Super League',
    format: 'T20',
    overs: 20
  });

  const [teams, setTeams] = useState([
    { id: '1', name: 'Mumbai Indians', logo_data: '', players: [] },
    { id: '2', name: 'Chennai Super Kings', logo_data: '', players: [] }
  ]);

  const [activeTeamIndex, setActiveTeamIndex] = useState(0);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerRole, setNewPlayerRole] = useState('Batsman');
  const [newPlayerPhoto, setNewPlayerPhoto] = useState('');

  // Logo file-to-base64
  const handleLogoUpload = (e, index) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const updated = [...teams];
      updated[index].logo_data = reader.result;
      setTeams(updated);
    };
    reader.readAsDataURL(file);
  };

  // Player Photo file-to-base64
  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setNewPlayerPhoto(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleAddTeam = () => {
    setTeams([...teams, { 
      id: Math.random().toString(), 
      name: `Team ${teams.length + 1}`, 
      logo_data: '', 
      players: [] 
    }]);
  };

  const handleRemoveTeam = (index) => {
    if (teams.length <= 2) {
      alert('A tournament must have at least 2 teams.');
      return;
    }
    const updated = teams.filter((_, i) => i !== index);
    setTeams(updated);
    if (activeTeamIndex >= updated.length) {
      setActiveTeamIndex(updated.length - 1);
    }
  };

  const handleAddPlayer = () => {
    if (!newPlayerName.trim()) {
      alert('Player name is required.');
      return;
    }
    const updated = [...teams];
    updated[activeTeamIndex].players.push({
      id: Math.random().toString(),
      name: newPlayerName.trim(),
      role: newPlayerRole,
      photo_data: newPlayerPhoto
    });
    setTeams(updated);
    
    // Reset player inputs
    setNewPlayerName('');
    setNewPlayerRole('Batsman');
    setNewPlayerPhoto('');
  };

  const handleRemovePlayer = (playerIndex) => {
    const updated = [...teams];
    updated[activeTeamIndex].players.splice(playerIndex, 1);
    setTeams(updated);
  };

  const handleSubmit = () => {
    // Basic verification
    for (let i = 0; i < teams.length; i++) {
      if (teams[i].players.length < 2) {
        alert(`Team "${teams[i].name}" must have at least 2 players to start a match.`);
        return;
      }
    }
    onComplete({
      name: details.name,
      format: details.format,
      overs_quota: details.overs,
      teams
    });
  };

  if (showDesigner) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999, background: '#0a0d1a' }}>
        <OverlayEditor 
          matchState={null} 
          onBack={() => setShowDesigner(false)} 
        />
      </div>
    );
  }

  return (
    <div className="setup-wizard-container glass-panel">
      {/* Progress Header */}
      <div className="wizard-progress-bar">
        <div className={`step-dot ${step >= 1 ? 'active' : ''}`}>1. Details</div>
        <div className="step-connector"></div>
        <div className={`step-dot ${step >= 2 ? 'active' : ''}`}>2. Teams</div>
        <div className="step-connector"></div>
        <div className={`step-dot ${step >= 3 ? 'active' : ''}`}>3. Rosters</div>
        <div className="step-connector"></div>
        <div className={`step-dot ${step >= 4 ? 'active' : ''}`}>4. Overlay</div>
      </div>

      {/* Step 1: Tournament Details */}
      {step === 1 && (
        <div className="wizard-step animate-fade-in">
          <div className="step-header">
            <h3><Trophy className="text-primary" size={24} /> Tournament Configuration</h3>
            <p>Define the parameters of your league or cup.</p>
          </div>
          
          <div className="form-group">
            <label>Tournament Name</label>
            <input 
              type="text" 
              className="form-control" 
              value={details.name}
              onChange={e => setDetails({...details, name: e.target.value})}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Match Format</label>
              <select 
                className="form-control"
                value={details.format}
                onChange={e => {
                  let defaultOvers = 20;
                  if (e.target.value === 'ODI') defaultOvers = 50;
                  if (e.target.value === '10-Overs') defaultOvers = 10;
                  setDetails({...details, format: e.target.value, overs: defaultOvers});
                }}
              >
                <option value="T20">T20 (20 Overs)</option>
                <option value="ODI">ODI (50 Overs)</option>
                <option value="10-Overs">10-Overs (10 Overs)</option>
                <option value="Custom">Custom</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Overs Per Innings</label>
              <input 
                type="number" 
                className="form-control"
                value={details.overs}
                onChange={e => setDetails({...details, overs: parseInt(e.target.value) || 20})}
                min="1"
                max="100"
              />
            </div>
          </div>

          <div className="wizard-buttons">
            <button className="btn btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={() => setStep(2)}>
              Next Step <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Team Setup */}
      {step === 2 && (
        <div className="wizard-step animate-fade-in">
          <div className="step-header">
            <h3><Users className="text-primary" size={24} /> Team Management</h3>
            <p>Add participating teams and upload their custom logos.</p>
          </div>

          <div className="teams-list-setup">
            {teams.map((team, idx) => (
              <div key={team.id} className="team-setup-card">
                <div className="logo-upload-wrapper">
                  {team.logo_data ? (
                    <img src={team.logo_data} alt="logo" className="uploaded-logo-preview" />
                  ) : (
                    <div className="logo-placeholder">
                      <Image size={24} />
                    </div>
                  )}
                  <input 
                    type="file" 
                    accept="image/*" 
                    id={`logo-file-${team.id}`}
                    className="hidden-file-input"
                    onChange={e => handleLogoUpload(e, idx)}
                  />
                  <label htmlFor={`logo-file-${team.id}`} className="logo-upload-label">
                    Upload Logo
                  </label>
                </div>

                <div className="team-name-input-wrapper">
                  <input 
                    type="text" 
                    className="form-control" 
                    value={team.name}
                    placeholder="Enter Team Name"
                    onChange={e => {
                      const updated = [...teams];
                      updated[idx].name = e.target.value;
                      setTeams(updated);
                    }}
                  />
                </div>

                <button 
                  className="btn btn-danger btn-icon"
                  title="Remove Team"
                  onClick={() => handleRemoveTeam(idx)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <button className="btn btn-secondary btn-sm" style={{ marginTop: '1rem' }} onClick={handleAddTeam}>
            + Add Another Team
          </button>

          <div className="wizard-buttons" style={{ marginTop: '2rem' }}>
            <button className="btn btn-secondary" onClick={() => setStep(1)}>
              <ChevronLeft size={16} /> Back
            </button>
            <button className="btn btn-primary" onClick={() => setStep(3)}>
              Next Step <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Squad Rosters */}
      {step === 3 && (
        <div className="wizard-step animate-fade-in">
          <div className="step-header">
            <h3><UserPlus className="text-primary" size={24} /> Squad Rosters</h3>
            <p>Add player details and profile pictures for each team.</p>
          </div>

          {/* Team Switcher tabs */}
          <div className="roster-team-tabs">
            {teams.map((t, idx) => (
              <button 
                key={t.id}
                className={`roster-team-tab ${activeTeamIndex === idx ? 'active' : ''}`}
                onClick={() => {
                  setActiveTeamIndex(idx);
                  setNewPlayerPhoto('');
                }}
              >
                {t.name || `Team ${idx + 1}`}
                <span className="player-count">({t.players.length})</span>
              </button>
            ))}
          </div>

          <div className="roster-grid">
            {/* Player addition panel */}
            <div className="roster-add-panel">
              <h4>Add Squad Player</h4>
              
              <div className="photo-upload-selector">
                {newPlayerPhoto ? (
                  <img src={newPlayerPhoto} alt="player" className="player-photo-preview" />
                ) : (
                  <div className="photo-placeholder">
                    <span>Photo</span>
                  </div>
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  id="player-photo-file"
                  className="hidden-file-input"
                  onChange={handlePhotoUpload}
                />
                <label htmlFor="player-photo-file" className="photo-upload-label-btn">
                  Upload Photo
                </label>
              </div>

              <div className="form-group">
                <label>Player Name</label>
                <input 
                  type="text" 
                  className="form-control"
                  value={newPlayerName}
                  onChange={e => setNewPlayerName(e.target.value)}
                  placeholder="e.g. MS Dhoni"
                />
              </div>

              <div className="form-group">
                <label>Role</label>
                <select 
                  className="form-control"
                  value={newPlayerRole}
                  onChange={e => setNewPlayerRole(e.target.value)}
                >
                  <option value="Batsman">Batsman</option>
                  <option value="Bowler">Bowler</option>
                  <option value="All-rounder">All-rounder</option>
                  <option value="Wicketkeeper">Wicketkeeper</option>
                </select>
              </div>

              <button className="btn btn-primary w-full" onClick={handleAddPlayer}>
                Add to Roster
              </button>
            </div>

            {/* Current players list */}
            <div className="roster-list-panel">
              <h4>Current Roster ({teams[activeTeamIndex].players.length} players)</h4>
              
              <div className="roster-scroll-list">
                {teams[activeTeamIndex].players.length === 0 ? (
                  <div className="empty-roster">
                    <p>No players added to this team yet. Add at least 2 players to start.</p>
                  </div>
                ) : (
                  teams[activeTeamIndex].players.map((player, pIdx) => (
                    <div key={player.id} className="player-roster-item">
                      <div className="player-avatar-info">
                        {player.photo_data ? (
                          <img src={player.photo_data} alt="pic" className="player-avatar-thumbnail" />
                        ) : (
                          <div className="player-avatar-placeholder">
                            {player.name.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="player-meta-info">
                          <span className="p-name">{player.name}</span>
                          <span className="p-role">{player.role}</span>
                        </div>
                      </div>
                      
                      <button 
                        className="btn btn-danger btn-icon" 
                        onClick={() => handleRemovePlayer(pIdx)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="wizard-buttons" style={{ marginTop: '2rem' }}>
            <button className="btn btn-secondary" onClick={() => setStep(2)}>
              <ChevronLeft size={16} /> Back
            </button>
            <button className="btn btn-primary" onClick={() => {
              for (let i = 0; i < teams.length; i++) {
                if (teams[i].players.length < 2) {
                  alert(`Team "${teams[i].name}" must have at least 2 players to proceed.`);
                  return;
                }
              }
              setStep(4);
            }}>
              Next Step <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Broadcast Overlay Setup */}
      {step === 4 && (
        <div className="wizard-step animate-fade-in">
          <div className="step-header">
            <h3><Zap className="text-primary" size={24} /> Broadcast Graphic Overlay</h3>
            <p>Setup a new broadcast overlay preset or customize elements for live streaming.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            <div 
              className={`glass-panel preset-card ${overlayPreset === 'transparent' ? 'active' : ''}`}
              onClick={() => setOverlayPreset('transparent')}
              style={{
                padding: '20px',
                borderRadius: '12px',
                cursor: 'pointer',
                border: overlayPreset === 'transparent' ? '2px solid #ec4899' : '1px solid rgba(255,255,255,0.1)',
                background: overlayPreset === 'transparent' ? 'rgba(236,72,153,0.1)' : 'rgba(255,255,255,0.02)',
                transition: 'all 0.2s ease'
              }}
            >
              <h4 style={{ color: '#fff', marginBottom: '8px' }}>Transparent Preset</h4>
              <p style={{ fontSize: '13px', opacity: 0.7, lineHeight: 1.4 }}>
                Only the scoreboard text, team scores, and batter metrics are shown. The widget backgrounds are completely transparent, maximizing the view of your gameplay.
              </p>
            </div>

            <div 
              className={`glass-panel preset-card ${overlayPreset === 'classic' ? 'active' : ''}`}
              onClick={() => setOverlayPreset('classic')}
              style={{
                padding: '20px',
                borderRadius: '12px',
                cursor: 'pointer',
                border: overlayPreset === 'classic' ? '2px solid #ec4899' : '1px solid rgba(255,255,255,0.1)',
                background: overlayPreset === 'classic' ? 'rgba(236,72,153,0.1)' : 'rgba(255,255,255,0.02)',
                transition: 'all 0.2s ease'
              }}
            >
              <h4 style={{ color: '#fff', marginBottom: '8px' }}>Classic Panel Preset</h4>
              <p style={{ fontSize: '13px', opacity: 0.7, lineHeight: 1.4 }}>
                Scoreboard elements are rendered inside sleek, dark semi-transparent panels. Recommended for high visibility on bright or chaotic video feeds.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '24px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.15)', marginBottom: '24px' }}>
            <span style={{ fontSize: '14px', opacity: 0.8, textAlign: 'center' }}>
              Want to customize fonts, colors, and precise positions for each score panel?
            </span>
            <button 
              className="btn btn-primary"
              onClick={() => setShowDesigner(true)}
              style={{ padding: '10px 24px', fontWeight: 'bold' }}
            >
              🎨 Launch Full-Screen Overlay Designer
            </button>
          </div>

          <div className="wizard-buttons">
            <button className="btn btn-secondary" onClick={() => setStep(3)}>
              <ChevronLeft size={16} /> Back
            </button>
            <button className="btn btn-primary" onClick={handleSubmit}>
              <Check size={16} /> Complete Setup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { Upload, Save, RotateCcw, Eye, EyeOff, Layout, Type, Palette, Move, Sliders, ArrowLeft } from 'lucide-react';
import { getSupabaseClient, getSupabaseCredentials } from './supabaseClient';

const DEFAULT_LAYOUT = {
  team_scores: {
    id: 'team_scores',
    name: 'Team Score',
    x: 80,
    y: 880,
    visible: true,
    fontSize: 32,
    fontColor: '#00ff88',
    fontFamily: 'Orbitron',
    scale: 1.0,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    opacity: 0.0
  },
  active_batters: {
    id: 'active_batters',
    name: 'Active Batters',
    x: 520,
    y: 880,
    visible: true,
    fontSize: 22,
    fontColor: '#ffffff',
    fontFamily: 'Inter',
    scale: 1.0,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    opacity: 0.0
  },
  current_bowler: {
    id: 'current_bowler',
    name: 'Current Bowler',
    x: 1080,
    y: 880,
    visible: true,
    fontSize: 22,
    fontColor: '#ffffff',
    fontFamily: 'Inter',
    scale: 1.0,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    opacity: 0.0
  },
  timeline: {
    id: 'timeline',
    name: 'Over Timeline',
    x: 1480,
    y: 880,
    visible: true,
    fontSize: 18,
    fontColor: '#ffffff',
    fontFamily: 'Inter',
    scale: 1.0,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    opacity: 0.0
  },
  partnership: {
    id: 'partnership',
    name: 'Active Partnership',
    x: 520,
    y: 800,
    visible: true,
    fontSize: 20,
    fontColor: '#fbbf24',
    fontFamily: 'Inter',
    scale: 1.0,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    opacity: 0.0
  },
  target_badge: {
    id: 'target_badge',
    name: 'Target Info Badge',
    x: 80,
    y: 800,
    visible: true,
    fontSize: 20,
    fontColor: '#ef4444',
    fontFamily: 'Orbitron',
    scale: 1.0,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    opacity: 0.0
  },
  run_rates: {
    id: 'run_rates',
    name: 'Run Rates (CRR/RRR)',
    x: 80,
    y: 720,
    visible: true,
    fontSize: 20,
    fontColor: '#38bdf8',
    fontFamily: 'Inter',
    scale: 1.0,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    opacity: 0.0
  },
  extras_breakdown: {
    id: 'extras_breakdown',
    name: 'Extras Breakdown',
    x: 1480,
    y: 800,
    visible: true,
    fontSize: 18,
    fontColor: '#a78bfa',
    fontFamily: 'Inter',
    scale: 1.0,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    opacity: 0.0
  },
  match_info: {
    id: 'match_info',
    name: 'Match Info Banner',
    x: 1080,
    y: 800,
    visible: true,
    fontSize: 18,
    fontColor: '#f3f4f6',
    fontFamily: 'Inter',
    scale: 1.0,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    opacity: 0.0
  }
};

const getPartnershipStats = (state) => {
  if (!state || !state.delivery_history) return { runs: 0, balls: 0 };
  
  const currentInnings = state.current_innings || 1;
  const deliveries = state.delivery_history.filter(b => b.innings === currentInnings);
  
  let lastWicketIndex = -1;
  for (let i = deliveries.length - 1; i >= 0; i--) {
    if (deliveries[i].wicket_type) {
      lastWicketIndex = i;
      break;
    }
  }
  
  const partnershipDeliveries = deliveries.slice(lastWicketIndex + 1);
  let runs = 0;
  let balls = 0;
  partnershipDeliveries.forEach(d => {
    runs += (d.runs_batter || 0) + (d.runs_extras || 0);
    if (d.is_legal !== false) {
      balls += 1;
    }
  });
  
  return { runs, balls };
};

const getTargetBadgeInfo = (state) => {
  if (!state) return "No live match state";
  if (state.current_innings !== 2 || state.innings1_score === null || state.innings1_score === undefined) {
    return "1st Innings in progress";
  }
  const target = state.innings1_score + 1;
  const runsNeeded = target - state.total_runs;
  
  const totalOvers = state.overs_quota || 20;
  const totalBalls = totalOvers * 6;
  const ballsBowled = (state.overs || 0) * 6 + (state.balls_in_over || 0);
  const ballsRemaining = Math.max(0, totalBalls - ballsBowled);
  
  return `Target: ${target} • Need ${runsNeeded} runs off ${ballsRemaining} balls`;
};

const getRunRatesInfo = (state) => {
  if (!state) return "CRR: 0.00";
  const crr = state.run_rate || 0.00;
  if (state.current_innings !== 2 || state.innings1_score === null || state.innings1_score === undefined) {
    return `CRR: ${crr.toFixed(2)}`;
  }
  
  const target = state.innings1_score + 1;
  const runsNeeded = target - state.total_runs;
  const totalOvers = state.overs_quota || 20;
  const totalBalls = totalOvers * 6;
  const ballsBowled = (state.overs || 0) * 6 + (state.balls_in_over || 0);
  const ballsRemaining = Math.max(0, totalBalls - ballsBowled);
  
  const rrr = ballsRemaining > 0 ? (runsNeeded / (ballsRemaining / 6)) : 0.00;
  return `CRR: ${crr.toFixed(2)} • RRR: ${rrr.toFixed(2)}`;
};

const getExtrasBreakdown = (state) => {
  if (!state || !state.delivery_history) return "Extras: 0";
  
  let w = 0, n = 0, b = 0, l = 0;
  state.delivery_history.forEach(d => {
    if (d.extra_type === 'WIDE') w += d.runs_extras;
    else if (d.extra_type === 'NO_BALL') n += d.runs_extras;
    else if (d.extra_type === 'BYES') b += d.runs_extras;
    else if (d.extra_type === 'LEG_BYES') l += d.runs_extras;
  });
  
  const total = w + n + b + l;
  return `Extras: ${total} (Wd ${w}, Nb ${n}, B ${b}, Lb ${l})`;
};

const getMatchInfo = (state) => {
  if (!state) return "";
  return `${state.toss_winner || 'Toss Winner'} won toss, elected to ${state.elected_to || 'Bat/Bowl'} first`;
};

const FONT_FAMILIES = [
  { value: 'Inter', label: 'Inter (Sans-Serif)' },
  { value: 'Roboto', label: 'Roboto (Modern)' },
  { value: 'Orbitron', label: 'Orbitron (Digital)' },
  { value: 'Impact', label: 'Impact (Bold)' },
  { value: 'Courier New', label: 'Courier New (Retro)' }
];

export default function OverlayEditor({ matchState, onBack }) {
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [backgroundUrl, setBackgroundUrl] = useState('');
  const [selectedWidgetId, setSelectedWidgetId] = useState('team_scores');
  const [draggingWidget, setDraggingWidget] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [scale, setScale] = useState(0.5);

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Monitor resize to scale the 1920x1080 canvas
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && canvasRef.current.parentElement) {
        const parentWidth = canvasRef.current.parentElement.clientWidth;
        setScale(parentWidth / 1920);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    const timer = setTimeout(handleResize, 150);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, []);

  // Broadcast layout updates to other tabs in real-time (for OBS preview sync)
  useEffect(() => {
    const creds = getSupabaseCredentials();
    const matchId = creds.matchId || 'local';
    
    // Sync local storage on any drag or setting change
    localStorage.setItem(`cricdeck_layout_${matchId}`, JSON.stringify({
      layout,
      backgroundUrl
    }));

    const channel = new BroadcastChannel('cricdeck_sync');
    channel.postMessage({
      type: 'layout_update',
      layout,
      backgroundUrl
    });
    channel.close();
  }, [layout, backgroundUrl]);

  // Load saved layout on match changes
  useEffect(() => {
    const loadLayout = async () => {
      const supabase = getSupabaseClient();
      const creds = getSupabaseCredentials();
      const matchId = creds.matchId || 'local';

      // Load from localStorage first (offline fallback cache)
      const localData = localStorage.getItem(`cricdeck_layout_${matchId}`);
      if (localData) {
        try {
          const parsed = JSON.parse(localData);
          if (parsed.layout) setLayout(parsed.layout);
          if (parsed.backgroundUrl) setBackgroundUrl(parsed.backgroundUrl);
        } catch (e) {
          console.error(e);
        }
      }

      if (!supabase || !creds.matchId) return;

      try {
        const { data, error } = await supabase
          .from('custom_layouts')
          .select('layout_data, background_url')
          .eq('match_id', creds.matchId)
          .maybeSingle();

        if (error) throw error;
        
        if (data) {
          if (data.layout_data && Object.keys(data.layout_data).length > 0) {
            // Merge defaults to ensure no missing properties
            const merged = { ...DEFAULT_LAYOUT };
            Object.keys(data.layout_data).forEach(key => {
              if (merged[key]) {
                merged[key] = { ...merged[key], ...data.layout_data[key] };
              }
            });
            setLayout(merged);
          }
          if (data.background_url) {
            setBackgroundUrl(data.background_url);
          }
        }
      } catch (err) {
        console.error('Failed to load layout from Supabase:', err);
      }
    };

    loadLayout();
  }, [matchState]);

  // Handle Dragging coordinates
  const handleDragStart = (e, widgetId) => {
    e.preventDefault();
    setSelectedWidgetId(widgetId);
    setDraggingWidget(widgetId);

    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);

    const startX = clientX;
    const startY = clientY;
    
    const initialX = layout[widgetId].x;
    const initialY = layout[widgetId].y;

    const scaleFactor = canvasRef.current ? canvasRef.current.offsetWidth / 1920 : 1;

    const handleDragMove = (moveEvent) => {
      const moveClientX = moveEvent.clientX || (moveEvent.touches && moveEvent.touches[0].clientX);
      const moveClientY = moveEvent.clientY || (moveEvent.touches && moveEvent.touches[0].clientY);

      const deltaX = (moveClientX - startX) / scaleFactor;
      const deltaY = (moveClientY - startY) / scaleFactor;

      setLayout(prev => ({
        ...prev,
        [widgetId]: {
          ...prev[widgetId],
          x: Math.max(0, Math.min(1920 - 150, Math.round(initialX + deltaX))),
          y: Math.max(0, Math.min(1080 - 60, Math.round(initialY + deltaY)))
        }
      }));
    };

    const handleDragEnd = () => {
      setDraggingWidget(null);
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      document.removeEventListener('touchmove', handleDragMove);
      document.removeEventListener('touchend', handleDragEnd);
    };

    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    document.addEventListener('touchmove', handleDragMove, { passive: false });
    document.addEventListener('touchend', handleDragEnd);
  };

  // Upload custom background PNG
  const handleBgUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setUploadStatus('');

    const supabase = getSupabaseClient();
    const creds = getSupabaseCredentials();

    if (!supabase || !creds.matchId) {
      // Offline fallback: Use blob URL for preview
      const localUrl = URL.createObjectURL(file);
      setBackgroundUrl(localUrl);
      setUploading(false);
      setUploadStatus('Local preview loaded (Offline Mode)');
      return;
    }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${creds.matchId}_bg_${Date.now()}.${fileExt}`;
      const filePath = `backgrounds/${fileName}`;

      const { error } = await supabase.storage
        .from('overlays')
        .upload(filePath, file, { upsert: true });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('overlays')
        .getPublicUrl(filePath);

      setBackgroundUrl(publicUrl);
      setUploadStatus('Background uploaded successfully!');
    } catch (err) {
      console.error('Upload error:', err);
      setUploadStatus(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  // Save current coordinates and settings
  const handleSaveLayout = async () => {
    setSaving(true);
    setSaveStatus('');

    const supabase = getSupabaseClient();
    const creds = getSupabaseCredentials();
    const matchId = creds.matchId || 'local';

    // Persist locally first
    localStorage.setItem(`cricdeck_layout_${matchId}`, JSON.stringify({
      layout,
      backgroundUrl
    }));

    if (!supabase || !creds.matchId) {
      setSaveStatus('Saved locally!');
      setSaving(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('custom_layouts')
        .upsert({
          match_id: creds.matchId,
          layout_data: layout,
          background_url: backgroundUrl,
          updated_at: new Date().toISOString()
        }, { onConflict: 'match_id' });

      if (error) throw error;
      setSaveStatus('Saved to Supabase successfully!');
    } catch (err) {
      console.error('Save error:', err);
      setSaveStatus(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleResetLayout = () => {
    if (window.confirm('Reset layouts to defaults?')) {
      setLayout(DEFAULT_LAYOUT);
      setBackgroundUrl('');
      setSaveStatus('');
      setUploadStatus('');
    }
  };

  // Property update helper
  const updateWidgetProp = (prop, value) => {
    setLayout(prev => ({
      ...prev,
      [selectedWidgetId]: {
        ...prev[selectedWidgetId],
        [prop]: value
      }
    }));
  };

  const selectedWidget = layout[selectedWidgetId];

  // Helper styles for widgets on the canvas
  const getWidgetStyle = (config) => ({
    position: 'absolute',
    left: `${config.x}px`,
    top: `${config.y}px`,
    fontSize: `${config.fontSize}px`,
    color: config.fontColor,
    fontFamily: config.fontFamily || 'Inter',
    transform: `scale(${config.scale || 1.0})`,
    transformOrigin: 'top left',
    display: config.visible ? 'block' : 'none',
    backgroundColor: config.opacity > 0.05 ? (config.backgroundColor || 'rgba(10, 25, 20, 0.85)') : 'transparent',
    backdropFilter: config.opacity > 0.05 ? 'blur(8px)' : 'none',
    border: config.opacity > 0.05 ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
    padding: '12px 20px',
    borderRadius: '8px',
    boxShadow: config.opacity > 0.05 ? '0 8px 32px 0 rgba(0, 0, 0, 0.37)' : 'none',
    textShadow: config.opacity <= 0.05 ? '2px 2px 4px rgba(0, 0, 0, 0.95), -1px -1px 0px rgba(0,0,0,0.8), 1px -1px 0px rgba(0,0,0,0.8), -1px 1px 0px rgba(0,0,0,0.8), 1px 1px 0px rgba(0,0,0,0.8)' : 'none',
    cursor: 'grab',
    userSelect: 'none',
    zIndex: selectedWidgetId === config.id ? 10 : 5
  });

  // Default values for display if matchState is missing/empty
  const activeBatState = matchState || {
    team_a: 'Warriors',
    team_b: 'Titans',
    total_runs: 120,
    wickets: 4,
    overs: 15,
    balls_in_over: 2,
    run_rate: 7.83,
    striker: { name: 'Steven Smith', runs: 45, balls: 32, fours: 4, sixes: 1 },
    non_striker: { name: 'David Warner', runs: 12, balls: 10, fours: 1, sixes: 0 },
    current_bowler: { name: 'Mitchell Starc', overs: 3.2, runs: 24, wickets: 1, maidens: 0, balls: 2 },
    current_over_timeline: ['1', '4', 'Wd', 'W', '•']
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', overflow: 'hidden' }}>
      <header className="app-header glass-panel" style={{ flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="brand" onClick={onBack} style={{ cursor: 'pointer' }}>
          <ArrowLeft className="brand-icon" size={24} />
          <h1>Overlay Designer</h1>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={onBack}>
            Back to Dashboard
          </button>
        </div>
      </header>

      <div className="overlay-editor-layout" style={{ flexGrow: 1, overflow: 'hidden' }}>
        {/* Settings Pane */}
        <div className="settings-pane glass-panel">
          <div className="pane-header">
            <Layout className="pane-icon" size={20} />
            <h2>Overlay Designer</h2>
          </div>

        {/* Background Upload */}
        <div className="settings-section">
          <h3><Upload size={14} style={{ marginRight: '6px' }} /> Broadcast Canvas Background</h3>
          <div className="upload-container">
            <input 
              type="file" 
              accept="image/png" 
              ref={fileInputRef} 
              onChange={handleBgUpload} 
              style={{ display: 'none' }}
            />
            <button 
              className="btn btn-secondary btn-icon"
              onClick={() => fileInputRef.current.click()}
              disabled={uploading}
              style={{ width: '100%' }}
            >
              <Upload size={16} /> {uploading ? 'Uploading...' : 'Upload Background PNG (1920x1080)'}
            </button>
            {backgroundUrl && (
              <button 
                className="btn btn-danger btn-icon"
                onClick={() => setBackgroundUrl('')}
                style={{ width: '100%', marginTop: '0.5rem', padding: '0.4rem' }}
              >
                Clear Background
              </button>
            )}
            {uploadStatus && <div className="status-message">{uploadStatus}</div>}
          </div>
        </div>

        {/* Select Widget */}
        <div className="settings-section">
          <h3><Sliders size={14} style={{ marginRight: '6px' }} /> Select Widget</h3>
          <div className="widget-selector-grid">
            {Object.values(layout).map(widget => (
              <button
                key={widget.id}
                className={`widget-select-btn ${selectedWidgetId === widget.id ? 'active' : ''}`}
                onClick={() => setSelectedWidgetId(widget.id)}
              >
                <span>{widget.name}</span>
                {widget.visible ? <Eye size={14} /> : <EyeOff size={14} style={{ opacity: 0.5 }} />}
              </button>
            ))}
          </div>
        </div>

        {/* Selected Widget Properties */}
        {selectedWidget && (
          <div className="settings-section property-panel">
            <h3><Type size={14} style={{ marginRight: '6px' }} /> Customize {selectedWidget.name}</h3>
            
            <div className="property-row">
              <label>Visibility</label>
              <button 
                type="button"
                className={`btn ${selectedWidget.visible ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => updateWidgetProp('visible', !selectedWidget.visible)}
                style={{ padding: '0.3rem 1rem' }}
              >
                {selectedWidget.visible ? 'Visible' : 'Hidden'}
              </button>
            </div>

            <div className="property-row flex-column">
              <div className="label-with-value">
                <label>Font Size</label>
                <span>{selectedWidget.fontSize}px</span>
              </div>
              <input 
                type="range" 
                min="12" 
                max="72" 
                value={selectedWidget.fontSize} 
                onChange={e => updateWidgetProp('fontSize', parseInt(e.target.value))}
                className="slider"
              />
            </div>

            <div className="property-row flex-column">
              <div className="label-with-value">
                <label>Widget Scale</label>
                <span>{selectedWidget.scale.toFixed(1)}x</span>
              </div>
              <input 
                type="range" 
                min="0.5" 
                max="2.5" 
                step="0.1"
                value={selectedWidget.scale} 
                onChange={e => updateWidgetProp('scale', parseFloat(e.target.value))}
                className="slider"
              />
            </div>

            <div className="property-row">
              <label>Font Family</label>
              <select 
                className="form-control select-control" 
                value={selectedWidget.fontFamily}
                onChange={e => updateWidgetProp('fontFamily', e.target.value)}
                style={{ width: '60%' }}
              >
                {FONT_FAMILIES.map(font => (
                  <option key={font.value} value={font.value}>{font.label}</option>
                ))}
              </select>
            </div>

            <div className="property-row">
              <label><Palette size={14} style={{ marginRight: '6px' }} /> Text Color</label>
              <input 
                type="color" 
                value={selectedWidget.fontColor} 
                onChange={e => updateWidgetProp('fontColor', e.target.value)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', width: '40px', height: '30px' }}
              />
            </div>

            <div className="property-row flex-column">
              <div className="label-with-value">
                <label>Background Opacity</label>
                <span>{Math.round(selectedWidget.opacity * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.05"
                value={selectedWidget.opacity} 
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  updateWidgetProp('opacity', val);
                  updateWidgetProp('backgroundColor', `rgba(8, 12, 28, ${val})`);
                }}
                className="slider"
              />
            </div>
            
            <div className="property-coordinates">
              <span>X: {selectedWidget.x}px</span>
              <span>Y: {selectedWidget.y}px</span>
            </div>
          </div>
        )}

        {/* Persistence Controls */}
        <div className="settings-section pane-footer-buttons">
          <button 
            className="btn btn-primary btn-icon" 
            onClick={handleSaveLayout}
            disabled={saving}
          >
            <Save size={16} /> {saving ? 'Saving...' : 'Save Broadcast Layout'}
          </button>
          <button 
            className="btn btn-secondary btn-icon" 
            onClick={handleResetLayout}
          >
            <RotateCcw size={16} /> Reset defaults
          </button>
          {saveStatus && <div className="status-message persist-message">{saveStatus}</div>}
        </div>
      </div>

      {/* Scaled Preview Canvas */}
      <div className="canvas-wrapper-container">
        <div className="canvas-header-info">
          <span><Move size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} /> Click and drag widgets to position on screen. Settings will apply instantly.</span>
        </div>
        <div className="canvas-scaler">
          <div 
            className="broadcast-canvas" 
            ref={canvasRef}
            style={{ 
              backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              transform: `scale(${scale})`
            }}
          >
            {/* Checkerboard Pattern overlay when no background */}
            {!backgroundUrl && <div className="checkerboard-overlay" />}

            {/* 1. Team Scores Widget */}
            <div 
              style={getWidgetStyle(layout.team_scores)}
              onMouseDown={e => handleDragStart(e, 'team_scores')}
              onTouchStart={e => handleDragStart(e, 'team_scores')}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.55em', opacity: 0.65, fontWeight: 'normal', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {activeBatState.team_a} vs {activeBatState.team_b}
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', fontWeight: 'bold' }}>
                  <span>{activeBatState.total_runs}/{activeBatState.wickets}</span>
                  <span style={{ fontSize: '0.6em', opacity: 0.8, fontWeight: 'normal' }}>
                    ({activeBatState.overs}.{activeBatState.balls_in_over} Ov)
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Active Batters Widget */}
            <div 
              style={getWidgetStyle(layout.active_batters)}
              onMouseDown={e => handleDragStart(e, 'active_batters')}
              onTouchStart={e => handleDragStart(e, 'active_batters')}
            >
              <div style={{ display: 'flex', gap: '16px', fontSize: '0.85em' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ display: 'inline-block', width: '6px', height: '6px', backgroundColor: '#00ff88', borderRadius: '50%' }} />
                  <strong>{activeBatState.striker.name}</strong> <span>{activeBatState.striker.runs} ({activeBatState.striker.balls})</span>
                </div>
                <div style={{ opacity: 0.4 }}>|</div>
                <div>
                  <span style={{ opacity: 0.7 }}>{activeBatState.non_striker.name}</span> <span>{activeBatState.non_striker.runs} ({activeBatState.non_striker.balls})</span>
                </div>
              </div>
            </div>

            {/* 3. Current Bowler Widget */}
            <div 
              style={getWidgetStyle(layout.current_bowler)}
              onMouseDown={e => handleDragStart(e, 'current_bowler')}
              onTouchStart={e => handleDragStart(e, 'current_bowler')}
            >
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '0.85em' }}>
                <strong>{activeBatState.current_bowler.name}</strong>
                <span style={{ opacity: 0.8 }}>
                  {activeBatState.current_bowler.overs || 0}.{activeBatState.current_bowler.balls || 0} - 
                  {activeBatState.current_bowler.maidens || 0}m - 
                  {activeBatState.current_bowler.runs || 0}r - 
                  {activeBatState.current_bowler.wickets || 0}w
                </span>
              </div>
            </div>

            {/* 4. Over Timeline Widget */}
            <div 
              style={getWidgetStyle(layout.timeline)}
              onMouseDown={e => handleDragStart(e, 'timeline')}
              onTouchStart={e => handleDragStart(e, 'timeline')}
            >
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.7em', textTransform: 'uppercase', opacity: 0.6, marginRight: '4px' }}>This Over</span>
                {activeBatState.current_over_timeline.length === 0 ? (
                  <span style={{ fontSize: '0.75em', opacity: 0.4 }}>• • • • • •</span>
                ) : (
                  activeBatState.current_over_timeline.map((ball, i) => {
                    let styleBg = 'rgba(255,255,255,0.1)';
                    let styleBorder = '1px solid rgba(255,255,255,0.2)';
                    let styleColor = '#fff';
                    if (ball === '4') { styleBg = '#0062ff'; styleColor = '#fff'; }
                    else if (ball === '6') { styleBg = '#8800ff'; styleColor = '#fff'; }
                    else if (ball === 'W') { styleBg = '#ff003c'; styleColor = '#fff'; }
                    else if (ball.includes('Wd') || ball.includes('NB') || ball.includes('B') || ball.includes('LB')) { styleBg = '#e67300'; styleColor = '#fff'; }

                    return (
                      <div 
                        key={i} 
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          backgroundColor: styleBg,
                          border: styleBorder,
                          color: styleColor,
                          fontSize: '11px',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          lineHeight: 1
                        }}
                      >
                        {ball}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 5. Active Partnership Widget */}
            {layout.partnership?.visible && (
              <div 
                style={getWidgetStyle(layout.partnership)}
                onMouseDown={e => handleDragStart(e, 'partnership')}
                onTouchStart={e => handleDragStart(e, 'partnership')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.85em', fontWeight: 'bold' }}>
                    Partnership: {getPartnershipStats(activeBatState).runs} runs off {getPartnershipStats(activeBatState).balls} balls
                  </span>
                </div>
              </div>
            )}

            {/* 6. Target Info Widget */}
            {layout.target_badge?.visible && (
              <div 
                style={getWidgetStyle(layout.target_badge)}
                onMouseDown={e => handleDragStart(e, 'target_badge')}
                onTouchStart={e => handleDragStart(e, 'target_badge')}
              >
                <div style={{ fontSize: '0.85em', fontWeight: 'bold' }}>
                  {getTargetBadgeInfo(activeBatState)}
                </div>
              </div>
            )}

            {/* 7. Run Rates Widget */}
            {layout.run_rates?.visible && (
              <div 
                style={getWidgetStyle(layout.run_rates)}
                onMouseDown={e => handleDragStart(e, 'run_rates')}
                onTouchStart={e => handleDragStart(e, 'run_rates')}
              >
                <div style={{ fontSize: '0.85em', fontWeight: 'bold' }}>
                  {getRunRatesInfo(activeBatState)}
                </div>
              </div>
            )}

            {/* 8. Extras Breakdown Widget */}
            {layout.extras_breakdown?.visible && (
              <div 
                style={getWidgetStyle(layout.extras_breakdown)}
                onMouseDown={e => handleDragStart(e, 'extras_breakdown')}
                onTouchStart={e => handleDragStart(e, 'extras_breakdown')}
              >
                <div style={{ fontSize: '0.85em', fontWeight: 'bold' }}>
                  {getExtrasBreakdown(activeBatState)}
                </div>
              </div>
            )}

            {/* 9. Match Info Widget */}
            {layout.match_info?.visible && (
              <div 
                style={getWidgetStyle(layout.match_info)}
                onMouseDown={e => handleDragStart(e, 'match_info')}
                onTouchStart={e => handleDragStart(e, 'match_info')}
              >
                <div style={{ fontSize: '0.85em', fontWeight: 'bold' }}>
                  {getMatchInfo(activeBatState)}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

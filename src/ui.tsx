import { h, render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import './ui.css';

interface ConversionSettings {
  preserveColors: boolean;
  showPlaceholders: boolean;
}

interface ProgressState {
  current: number;
  total: number;
}

const App = () => {
  const [isConverting, setIsConverting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [progress, setProgress] = useState<ProgressState>({ current: 0, total: 0 });
  const [settings, setSettings] = useState<ConversionSettings>({
    preserveColors: false,
    showPlaceholders: true
  });

  useEffect(() => {
    // Listen for messages from the plugin
    window.onmessage = (event) => {
      const message = event.data.pluginMessage;
      if (message.type === 'progress') {
        setProgress({ current: message.value, total: message.total });
      } else if (message.type === 'complete' || message.type === 'error') {
        setIsConverting(false);
        setProgress({ current: 0, total: 0 });
      }
    };
  }, []);

  const onConvertClick = () => {
    setIsConverting(true);
    setProgress({ current: 0, total: 0 });
    parent.postMessage({
      pluginMessage: {
        type: 'convert-to-wireframe'
      }
    }, '*');
  };

  const toggleSettings = () => setShowSettings(!showSettings);

  const progressPercentage = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div class="container">
      <header>
        <h2>Wireframe Converter</h2>
        <button
          class="icon-button"
          onClick={toggleSettings}
          title={showSettings ? "Hide settings" : "Show settings"}
        >
          {showSettings ? '×' : '⚙️'}
        </button>
      </header>

      {showSettings ? (
        <div class="settings-panel">
          <label class="setting-item">
            <input
              type="checkbox"
              checked={settings.preserveColors}
              onChange={e => setSettings({
                ...settings,
                preserveColors: (e.target as HTMLInputElement).checked
              })}
            />
            <span>Preserve some colors</span>
          </label>
          <label class="setting-item">
            <input
              type="checkbox"
              checked={settings.showPlaceholders}
              onChange={e => setSettings({
                ...settings,
                showPlaceholders: (e.target as HTMLInputElement).checked
              })}
            />
            <span>Show image placeholders</span>
          </label>
        </div>
      ) : (
        <div class="instructions">
          <p>1. Select a frame in your design</p>
          <p>2. Click the button below to convert</p>
          <p>3. A wireframe copy will be created</p>
        </div>
      )}

      {isConverting && progress.total > 0 && (
        <div class="progress-container">
          <div class="progress-bar">
            <div
              class="progress-fill"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div class="progress-text">
            Processing: {progress.current} / {progress.total} nodes ({progressPercentage}%)
          </div>
        </div>
      )}

      <button
        class={`button ${isConverting ? 'converting' : ''}`}
        onClick={onConvertClick}
        disabled={isConverting}
      >
        {isConverting ? (
          <span class="spinner">Converting...</span>
        ) : (
          'Convert to Wireframe'
        )}
      </button>

      <footer>
        <button
          class="text-button"
          onClick={() => parent.postMessage({ pluginMessage: { type: 'help' } }, '*')}
        >
          Need help?
        </button>
      </footer>
    </div>
  );
};

render(<App />, document.getElementById('app')!);
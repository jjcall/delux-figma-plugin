import { h, render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import './ui.css';

interface ProgressState {
  current: number;
  total: number;
}

const App = () => {
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState<ProgressState>({ current: 0, total: 0 });
  const [selectedFont, setSelectedFont] = useState('figma-hand');

  useEffect(() => {
    // Listen for messages from the plugin
    window.onmessage = (event) => {
      const message = event.data.pluginMessage;
      if (message.type === 'progress') {
        setProgress({ current: message.value, total: message.total });
      } else if (message.type === 'complete') {
        setIsConverting(false);
        setProgress({ current: 0, total: 0 });
      }
    };
  }, []);

  const handleConvert = () => {
    setIsConverting(true);
    parent.postMessage({ pluginMessage: { type: 'convert' } }, '*');
  };

  const handleFontChange = (e: h.JSX.TargetedEvent<HTMLSelectElement, Event>) => {
    setSelectedFont(e.currentTarget.value);
  };

  return (
    <div className="container">

      <div className="main-container">

        <div className="form-section">
          <div className="section-heading">Style</div>
          <label className="form-label">Font</label>
          <select
            className="font-select"
            value={selectedFont}
            onChange={handleFontChange}
          >
            <option value="figma-hand">Figma Hand</option>
            <option value="sans-serif">Sans-serif</option>
            <option value="serif">Serif</option>
          </select>
        </div>

        <div className="info-banner">
          <div className="info-icon"></div>
          <div className="info-content">
            <div className="info-title">How it works</div>
            <div className="info-description">
              Select a frame, click to convert, and get a wireframe copy instantly.
            </div>
          </div>
        </div>
      </div>

      <div className="divider"></div>

      <div className="footer">
        <button
          className="convert-button"
          onClick={handleConvert}
          disabled={isConverting}
        >
          {isConverting ? `Converting ${progress.current}/${progress.total}...` : 'De-lux it'}
        </button>
      </div>
    </div>
  );
};

render(<App />, document.getElementById('app')!);
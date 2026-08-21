import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Client-side console sanitizer: noop noisy console calls in production
import './core/console_sanitizer';
// Client-side API & WebSocket routing configuration
import './lib/api-config';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

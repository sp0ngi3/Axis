import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { registerAxisServiceWorker } from './pwa';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

registerAxisServiceWorker();

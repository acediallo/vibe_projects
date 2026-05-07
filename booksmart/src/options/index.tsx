import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import OptionsPage from './OptionsPage';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root container missing in options');

createRoot(container).render(
  <StrictMode>
    <OptionsPage />
  </StrictMode>,
);

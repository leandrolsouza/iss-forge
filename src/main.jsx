import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { I18nProvider } from './i18n';
import { ThemeProvider } from './theme/ThemeProvider';
import { RomProvider } from './context/RomContext';
import { SettingsProvider } from './context/SettingsContext';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <SettingsProvider>
          <RomProvider>
            <App />
          </RomProvider>
        </SettingsProvider>
      </I18nProvider>
    </ThemeProvider>
  </React.StrictMode>,
);

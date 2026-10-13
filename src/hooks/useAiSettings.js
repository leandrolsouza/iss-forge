import { useMemo } from 'react';
import { useSettings } from '../context/SettingsContext';
import { getProvider, modelForProvider } from '../services/aiProviders';

/**
 * AI request settings from the app settings ({ provider, endpoint, model, apiKey,
 * temperature, maxTokens }), the same object while they do not change.
 */
export default function useAiSettings() {
  const { settings: appSettings } = useSettings();
  return useMemo(
    () => ({
      provider: appSettings.aiProvider,
      endpoint: appSettings.aiEndpoint,
      // never a model of another provider (old settings could keep one)
      model: modelForProvider(getProvider(appSettings.aiProvider), appSettings.aiModel),
      apiKey: appSettings.aiApiKey,
      temperature: appSettings.aiTemperature,
      maxTokens: appSettings.aiMaxTokens,
    }),
    [appSettings],
  );
}

import { useRef, useState } from 'react';
import { loadImageFile } from '../utils/imageToLogo';

/** Image file picker (button + hidden input) that hands back an HTMLImageElement */
export default function ImagePicker({ t, onImage, fileName }) {
  const ref = useRef(null);
  const [error, setError] = useState(false);
  return (
    <span className="ts-picker">
      <button className="kit-btn" onClick={() => ref.current?.click()}>
        {t('tsChooseImage')}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            onImage(await loadImageFile(file), file.name);
            setError(false);
          } catch {
            setError(true);
          }
          e.target.value = '';
        }}
      />
      {fileName && <span className="mp-hint">{fileName}</span>}
      {error && <span className="mp-warning">{t('tsErr_logoLoad')}</span>}
    </span>
  );
}

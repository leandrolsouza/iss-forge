import { useMemo } from 'react';
import { useI18n } from '../i18n';
import { useRom } from '../context/RomContext';
import { isTeamPartOriginal } from '../rom/restoreOriginal';
import { originalTeams } from '../utils/originalTeams';

/**
 * "Restore original" for one part of a team (kit, hair/skin, flag, name, player...).
 * Disabled while the part still has its original value; the restore is one undo step.
 * @param {{ teamIndex: number, part: string, label?: string, className?: string }} props
 */
export default function RestoreOriginalButton({ teamIndex, part, label, className = '' }) {
  const { t } = useI18n();
  const { romParser, teams, handleRestoreOriginal } = useRom();
  const original = useMemo(() => originalTeams(romParser)[teamIndex], [romParser, teamIndex]);
  const isOriginal = isTeamPartOriginal(teams[teamIndex], original, part);
  return (
    <button
      type="button"
      className={`kit-btn ${className}`}
      disabled={!romParser || isOriginal}
      title={isOriginal ? t('restoreIsOriginal') : t('restoreOriginalHint')}
      onClick={() => handleRestoreOriginal(teamIndex, part)}
    >
      {label || t('restoreOriginal')}
    </button>
  );
}

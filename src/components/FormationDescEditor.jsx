import { useI18n } from '../i18n';
import { IconFormation } from './Icons';
import TeamDescriptionPanel from './TeamDescriptionPanel';
import '../styles/formation.css';

/**
 * Standalone editor for the team selection-screen description.
 * Extracted from FormationEditor so it can live in its own sidebar sub-tab.
 */
export default function FormationDescEditor({ team, teamIndex }) {
  const { t } = useI18n();

  if (!team || !team.description) {
    return <div className="editor-panel empty">{t('selectTeamToEdit')}</div>;
  }

  return (
    <div className="editor-panel formation-editor">
      <div className="editor-header">
        <div className="editor-header-title">
          <span className="editor-icon">
            <IconFormation size={18} />
          </span>
          <h2>{team.name}</h2>
        </div>
      </div>
      <div className="formation-body">
        <div className="formation-side formation-side--full">
          <TeamDescriptionPanel team={team} teamIndex={teamIndex} />
        </div>
      </div>
    </div>
  );
}

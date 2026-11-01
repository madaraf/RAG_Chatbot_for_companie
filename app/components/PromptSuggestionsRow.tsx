import PromptSuggestionButton from "./PromptSuggestionButton";
const PromptSuggestionsRow = ({ onPromptClick }) => {
  const prompts = [
    "What is the company's mission statement?",
    "Comment configurer la connexion à la base de données de pointage (ZKTeco / SQL Server) et importer les pointages ?",
    "Comment créer ou modifier un planning de travail",
    "Quelles sont les étapes pour vérifier les anomalies/retards et effectuer le transfert du pointage vers la paie ?",
  ];

  return (
    <div className="prompt-suggestions-row">
      {prompts.map((prompt, index) => (
        <PromptSuggestionButton
          key={`suggestion-${index}`}
          text={prompt}
          onClick={() => onPromptClick(prompt)}
        />
      ))}
    </div>
  );
};
export default PromptSuggestionsRow;

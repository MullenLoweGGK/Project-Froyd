import { froydContent } from "@/lib/ldz-content";

export function AiSimulationLabel({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`ldz-ai-label${compact ? " ldz-ai-label--compact" : ""}`}>
      <span className="ldz-ai-label__badge">{froydContent.aiDisclosure.label}</span>
      {!compact && <p className="ldz-ai-label__note">{froydContent.aiDisclosure.note}</p>}
    </div>
  );
}

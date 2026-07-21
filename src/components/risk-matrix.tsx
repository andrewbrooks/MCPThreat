import { Badge } from "@/components/ui/badge";
import {
  projectRisk,
  riskBand,
  riskScore,
  RISK_BAND_CELL,
  RISK_BAND_CLASSES,
  RISK_BAND_LABELS,
  RISK_BAND_ORDER,
  type RiskVector,
} from "@/lib/risk";
import { RISK_LEVEL_LABELS, type RiskLevel } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";

const LIKELIHOODS: RiskLevel[] = ["LOW", "MEDIUM", "HIGH"]; // columns, left→right
const IMPACTS: RiskLevel[] = ["HIGH", "MEDIUM", "LOW"]; // rows, top→bottom

export function RiskMatrix({ vectors }: { vectors: (RiskVector & { title?: string })[] }) {
  if (vectors.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No threat vectors mapped yet — map vectors with likelihood and impact to see the risk
        matrix.
      </p>
    );
  }

  const { overall, counts } = projectRisk(vectors);
  const countAt = (l: string, i: string) =>
    vectors.filter((v) => v.likelihood === l && v.impact === i).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Overall residual risk</span>
          {overall ? (
            <Badge className={RISK_BAND_CLASSES[overall]}>{RISK_BAND_LABELS[overall]}</Badge>
          ) : (
            <span className="text-sm">—</span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {RISK_BAND_ORDER.slice()
            .reverse()
            .map((b) => (
              <span key={b} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <span className={cn("inline-block size-2.5 rounded-sm", RISK_BAND_CELL[b])} />
                {RISK_BAND_LABELS[b]} {counts[b]}
              </span>
            ))}
        </div>
      </div>

      <div className="flex gap-2">
        {/* Vertical impact axis label */}
        <div className="flex items-center">
          <span className="rotate-180 text-xs font-medium uppercase tracking-wide text-muted-foreground [writing-mode:vertical-rl]">
            Impact
          </span>
        </div>

        <div>
          <div className="inline-grid grid-cols-[auto_repeat(3,72px)] gap-1">
            {/* top-left spacer */}
            <div />
            {LIKELIHOODS.map((l) => (
              <div key={l} className="pb-1 text-center text-[11px] font-medium text-muted-foreground">
                {RISK_LEVEL_LABELS[l]}
              </div>
            ))}

            {IMPACTS.map((imp) => (
              <ImpactRow key={imp} imp={imp} likelihoods={LIKELIHOODS} countAt={countAt} />
            ))}
          </div>
          <div className="mt-1.5 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Likelihood
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Cells show inherent risk (likelihood × impact); the number is how many vectors sit in each
        cell. Overall risk is residual — it drops a band once a vector has a mitigated or closed
        finding.
      </p>
    </div>
  );
}

function ImpactRow({
  imp,
  likelihoods,
  countAt,
}: {
  imp: RiskLevel;
  likelihoods: RiskLevel[];
  countAt: (l: string, i: string) => number;
}) {
  return (
    <>
      <div className="flex items-center pr-1 text-[11px] font-medium text-muted-foreground">
        {RISK_LEVEL_LABELS[imp]}
      </div>
      {likelihoods.map((l) => {
        const band = riskBand(riskScore(l, imp));
        const n = countAt(l, imp);
        return (
          <div
            key={l}
            className={cn(
              "flex h-14 flex-col items-center justify-center gap-0.5 rounded-sm border",
              RISK_BAND_CELL[band],
              n === 0 && "opacity-55",
            )}
            title={`${RISK_LEVEL_LABELS[l]} likelihood × ${RISK_LEVEL_LABELS[imp]} impact — ${band.toLowerCase()} risk`}
          >
            <span className="text-base font-semibold tabular-nums">{n}</span>
            <span className="text-[9px] font-medium uppercase tracking-wide opacity-80">
              {RISK_BAND_LABELS[band]}
            </span>
          </div>
        );
      })}
    </>
  );
}

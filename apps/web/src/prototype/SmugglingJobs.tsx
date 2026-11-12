import type { NodeId, PrototypeJob } from '@x-yard/game-core';

import { JobIcon } from './JobIcon';

interface SmugglingJobsProps {
  readonly jobs: readonly PrototypeJob[];
  readonly activeJobId: string | null;
  readonly selectedJobId: string | null;
  readonly cash: number;
  readonly jobsDelivered: number;
  readonly turn: number;
  readonly currentNode: NodeId;
  readonly disabled: boolean;
  readonly onSelectJob: (jobId: string) => void;
  readonly onCollect: (jobId: string) => void;
  readonly onDeliver: () => void;
}

function stationNumber(id: NodeId): string {
  return id.replace(/^[^0-9]*/, '');
}

/** The Fugitive's private job board. Agents never see this panel. */
export function SmugglingJobs({
  jobs,
  activeJobId,
  selectedJobId,
  cash,
  jobsDelivered,
  turn,
  currentNode,
  disabled,
  onSelectJob,
  onCollect,
  onDeliver,
}: SmugglingJobsProps): React.JSX.Element {
  const active = jobs.find((job) => job.id === activeJobId && job.status === 'active');
  const offers = jobs
    .filter((job) => job.status === 'available')
    .sort((left, right) => left.expiresTurn - right.expiresTurn || left.id.localeCompare(right.id));
  const selected = jobs.find(
    (job) =>
      job.id === selectedJobId && (job.status === 'available' || job.status === 'active'),
  );
  const canDeliver = active !== undefined && currentNode === active.destination;

  return (
    <section className="side-section jobs-section">
      <div className="side-heading">
        <span>Smuggling jobs</span>
        <span className="side-note">
          £{cash} · {jobsDelivered} DELIVERED
        </span>
      </div>

      {active !== undefined && (
        <article
          className={`job-card job-active${selected?.id === active.id ? ' selected' : ''}`}
          onClick={() => onSelectJob(active.id)}
        >
          <div className="job-card-head">
            <span className="job-icon-badge">
              <JobIcon icon={active.icon} size={18} />
            </span>
            <div>
              <span className="job-kicker">IN TRANSIT</span>
              <strong>{active.title}</strong>
            </div>
            <b className="job-prize">£{active.prize}</b>
          </div>
          <div className="job-route">
            <span>
              <em>PICKUP</em> {active.pickupLabel} · n{stationNumber(active.pickup)}
            </span>
            <span>
              <em>DROP</em> n{stationNumber(active.destination)}
            </span>
          </div>
          {canDeliver ? (
            <button
              type="button"
              className="job-action"
              disabled={disabled}
              onClick={(event) => {
                event.stopPropagation();
                onDeliver();
              }}
            >
              Deliver shipment · £{active.prize}
            </button>
          ) : (
            <p className="job-hint">Take it to n{stationNumber(active.destination)}.</p>
          )}
        </article>
      )}

      <div className="jobs-offer-head">
        <span>ON OFFER</span>
        {offers.length > 0 && <span>{offers.length} AVAILABLE</span>}
      </div>

      {offers.length === 0 ? (
        <p className="jobs-empty">
          {active !== undefined ? 'No other jobs on offer.' : 'No jobs on offer.'}
        </p>
      ) : (
        <div className="jobs-offers">
          {offers.map((job) => {
            const isSelected = selected?.id === job.id;
            const atPickup = currentNode === job.pickup;
            const locked = activeJobId !== null;
            return (
              <article
                key={job.id}
                className={`job-card job-offer${isSelected ? ' selected' : ''}${locked ? ' locked' : ''}`}
                onClick={() => onSelectJob(job.id)}
              >
                <div className="job-card-head">
                  <span className="job-icon-badge">
                    <JobIcon icon={job.icon} size={16} />
                  </span>
                  <div>
                    <span className="job-kicker">
                      {job.pickupLabel.toUpperCase()} · n{stationNumber(job.pickup)}
                    </span>
                    <strong>{job.title}</strong>
                  </div>
                  <b className="job-prize">£{job.prize}</b>
                </div>
                <div className="job-route">
                  <span>
                    <em>DROP</em> n{stationNumber(job.destination)}
                  </span>
                  <span className="job-expiry">{job.expiresTurn - turn} turns left</span>
                </div>
                {locked ? (
                  <p className="job-hint">Locked — you are already carrying a shipment.</p>
                ) : atPickup ? (
                  <button
                    type="button"
                    className="job-action"
                    disabled={disabled}
                    onClick={(event) => {
                      event.stopPropagation();
                      onCollect(job.id);
                    }}
                  >
                    Collect shipment · ends your turn
                  </button>
                ) : (
                  <p className="job-hint">Go to {job.pickupLabel} to collect.</p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

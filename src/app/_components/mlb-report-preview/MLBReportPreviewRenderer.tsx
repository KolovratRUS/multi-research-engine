import React from 'react';
import type {
  MLBReportPreviewUIAdapterDocument,
  MLBReportPreviewUIAdapterNode,
  MLBReportPreviewUIAdapterHeaderNode,
  MLBReportPreviewUIAdapterMetadataNode,
  MLBReportPreviewUIAdapterSectionListNode,
  MLBReportPreviewUIAdapterSectionNode,
  MLBReportPreviewUIAdapterGameCardListNode,
  MLBReportPreviewUIAdapterGameCardNode,
  MLBReportPreviewUIAdapterGameDetailListNode,
  MLBReportPreviewUIAdapterGameDetailNode,
  MLBReportPreviewUIAdapterWarningsNode,
  MLBReportPreviewUIAdapterWarningNode,
  MLBReportPreviewUIAdapterLimitationsNode,
} from '@/prospective/mlb/report-preview-ui-adapter';
import { assertMLBReportPreviewUIAdapterDocument } from '@/prospective/mlb/report-preview-ui-adapter';

export interface MLBReportPreviewRendererProps {
  readonly document: MLBReportPreviewUIAdapterDocument;
}

export function MLBReportPreviewRenderer({
  document,
}: MLBReportPreviewRendererProps) {
  assertMLBReportPreviewUIAdapterDocument(document);

  return (
    <article className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {document.nodes.map((node) => renderNode(node))}
    </article>
  );
}

function renderNode(node: MLBReportPreviewUIAdapterNode) {
  switch (node.kind) {
    case 'header':
      return renderHeader(node);
    case 'metadata':
      return renderMetadata(node);
    case 'section-list':
      return renderSectionList(node);
    case 'game-card-list':
      return renderGameCardList(node);
    case 'game-detail-list':
      return renderGameDetailList(node);
    case 'warnings':
      return renderWarnings(node);
    case 'limitations':
      return renderLimitations(node);
    default:
      return null;
  }
}

function renderHeader(node: MLBReportPreviewUIAdapterHeaderNode) {
  return (
    <header key="header" className="space-y-4">
      <h1 className="text-2xl font-semibold">{node.title}</h1>
      <p className="text-sm text-gray-600">{node.subtitle}</p>
      <dl className="space-y-1">
        <div>
          <dt>Generated at</dt>
          <dd>{node.generatedAtLabel}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{node.sourceLabel}</dd>
        </div>
      </dl>
    </header>
  );
}

function renderMetadata(node: MLBReportPreviewUIAdapterMetadataNode) {
  const rendererVersion = node.rendererVersion;
  const adapterVersion = node.adapterVersion;
  const handlerVersion = node.handlerVersion;
  const contractVersion = node.contractVersion;
  const deterministic = node.deterministic ? 'Yes' : 'No';
  const source = node.source;
  const generatedAt = node.generatedAt ?? 'Not provided';

  return (
    <section key="metadata" className="space-y-3">
      <h2 className="text-lg font-medium">Technical metadata</h2>
      <dl className="space-y-1">
        <div>
          <dt>Handler version</dt>
          <dd>{handlerVersion}</dd>
        </div>
        <div>
          <dt>Contract version</dt>
          <dd>{contractVersion}</dd>
        </div>
        <div>
          <dt>Renderer version</dt>
          <dd>{rendererVersion}</dd>
        </div>
        <div>
          <dt>Adapter version</dt>
          <dd>{adapterVersion}</dd>
        </div>
        <div>
          <dt>Deterministic</dt>
          <dd>{deterministic}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{source}</dd>
        </div>
        <div>
          <dt>Generated at</dt>
          <dd>{generatedAt}</dd>
        </div>
      </dl>
    </section>
  );
}

function renderSectionList(node: MLBReportPreviewUIAdapterSectionListNode) {
  if (node.sections.length === 0 && node.emptyState !== null) {
    return (
      <section key="section-list" className="space-y-3">
        {renderEmptyState(node.emptyState)}
      </section>
    );
  }

  return (
    <section key="section-list" className="space-y-3">
      {node.sections.map((section, sectionIndex) =>
        renderSection(section, sectionIndex),
      )}
    </section>
  );
}

function renderSection(
  node: MLBReportPreviewUIAdapterSectionNode,
  index: number,
) {
  const heading = node.heading;
  const body = node.body;

  if (body.length === 0 && node.emptyState !== null) {
    return (
      <section key={`${heading}-${index}`} className="space-y-3">
        <h3 className="text-lg font-medium">{heading}</h3>
        {renderEmptyState(node.emptyState)}
      </section>
    );
  }

  if (body.length === 1) {
    return (
      <section key={`${heading}-${index}`} className="space-y-3">
        <h3 className="text-lg font-medium">{heading}</h3>
        <p>{body[0]}</p>
      </section>
    );
  }

  return (
    <section key={`${heading}-${index}`} className="space-y-3">
      <h3 className="text-lg font-medium">{heading}</h3>
      <ul className="list-disc pl-5 space-y-1">
        {body.map((line, lineIndex) => (
          <li key={`${index}-${lineIndex}`}>{line}</li>
        ))}
      </ul>
    </section>
  );
}

function renderGameCardList(node: MLBReportPreviewUIAdapterGameCardListNode) {
  if (node.gameCards.length === 0 && node.emptyState !== null) {
    return (
      <section key="game-card-list" className="space-y-3">
        {renderEmptyState(node.emptyState)}
      </section>
    );
  }

  return (
    <section key="game-card-list" className="space-y-3">
      <h2 className="text-lg font-medium">Game cards</h2>
      <ul className="list-disc pl-5 space-y-1">
        {node.gameCards.map((card) => (
          <li key={card.gameId}>
            <article>
              <h3>{card.heading}</h3>
              <dl className="space-y-1">
                <div>
                  <dt>Official date</dt>
                  <dd>{card.officialDate}</dd>
                </div>
                <div>
                  <dt>Scheduled start time</dt>
                  <dd>{card.scheduledStartTime}</dd>
                </div>
                <div>
                  <dt>Module summary</dt>
                  <dd>{card.moduleSummary}</dd>
                </div>
                <div>
                  <dt>Data quality</dt>
                  <dd>{card.dataQualityLabel}</dd>
                </div>
                <div>
                  <dt>Confidence</dt>
                  <dd>{card.confidenceLabel}</dd>
                </div>
                <div>
                  <dt>Research strength</dt>
                  <dd>{card.researchStrengthLabel}</dd>
                </div>
                <div>
                  <dt>Warnings</dt>
                  <dd>{card.warningSummary}</dd>
                </div>
                <div>
                  <dt>Schedule context</dt>
                  <dd>{card.scheduleContextSummary}</dd>
                </div>
                <div>
                  <dt>Team quality context</dt>
                  <dd>{card.teamQualityContextSummary}</dd>
                </div>
              </dl>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}

function renderGameDetailList(node: MLBReportPreviewUIAdapterGameDetailListNode) {
  if (node.gameDetails.length === 0 && node.emptyState !== null) {
    return (
      <section key="game-detail-list" className="space-y-3">
        {renderEmptyState(node.emptyState)}
      </section>
    );
  }

  return (
    <section key="game-detail-list" className="space-y-3">
      <h2 className="text-lg font-medium">Game details</h2>
      <ul className="list-disc pl-5 space-y-1">
        {node.gameDetails.map((detail) => (
          <li key={detail.gameId}>
            <article>
              <h3>{detail.heading}</h3>
              <dl className="space-y-1">
                <div>
                  <dt>Available research modules</dt>
                  <dd>{detail.availableResearchModules}</dd>
                </div>
                <div>
                  <dt>Team recent form summary</dt>
                  <dd>{detail.teamRecentFormSummary}</dd>
                </div>
                <div>
                  <dt>Schedule context summary</dt>
                  <dd>{detail.scheduleContextSummary}</dd>
                </div>
                <div>
                  <dt>Team quality context summary</dt>
                  <dd>{detail.teamQualityContextSummary}</dd>
                </div>
                <div>
                  <dt>Warnings</dt>
                  <dd>{detail.warnings}</dd>
                </div>
                <div>
                  <dt>Data quality explanation</dt>
                  <dd>{detail.dataQualityExplanation}</dd>
                </div>
                <div>
                  <dt>Evidence limitations</dt>
                  <dd>{detail.evidenceLimitations}</dd>
                </div>
              </dl>
              <p>{detail.technicalMetadataSummary}</p>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}

function renderWarnings(node: MLBReportPreviewUIAdapterWarningsNode) {
  if (node.warnings.length === 0 && node.emptyState === null) {
    return null;
  }

  if (node.warnings.length === 0 && node.emptyState !== null) {
    return (
      <section
        key="warnings"
        className="rounded border border-gray-200 bg-gray-50 p-3"
      >
        {renderEmptyState(node.emptyState)}
      </section>
    );
  }

  return (
    <section
      aria-label="Warnings"
      key="warnings"
      className="rounded border border-gray-200 bg-gray-50 p-3"
    >
      <h2 className="text-lg font-medium">Warnings</h2>
      <ul className="list-disc pl-5 space-y-1">
        {node.warnings.map((warning, index) => (
          <li key={`${warning.code}-${index}`}>
            <strong>{warning.code}</strong>
            <span> — {warning.message}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function renderLimitations(node: MLBReportPreviewUIAdapterLimitationsNode) {
  return (
    <section
      key="limitations"
      className="rounded border border-gray-200 bg-gray-50 p-3"
    >
      <h2 className="text-lg font-medium">{node.heading}</h2>
      <ul className="list-disc pl-5 space-y-1">
        {node.notes.map((note, index) => (
          <li key={index}>{note}</li>
        ))}
      </ul>
    </section>
  );
}

function renderEmptyState(message: string) {
  return <p>{message}</p>;
}

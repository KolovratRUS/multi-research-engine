import React from 'react';
import { MLBReportPreviewRenderer } from '@/app/_components/mlb-report-preview/MLBReportPreviewRenderer';
import { buildMLBReportPreviewLocalPageDocument } from '@/prospective/mlb/report-preview-local-page-document';

export default function MLBReportPreviewPage() {
  const adapterDocument = buildMLBReportPreviewLocalPageDocument();

  return (
    <main>
      <MLBReportPreviewRenderer document={adapterDocument} />
    </main>
  );
}

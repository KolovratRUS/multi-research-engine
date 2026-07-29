import {
  buildMLBResearchReportFromPackage,
  type MLBResearchReportInputPackage,
} from './research-report-adapter';
import { assertRendererOutputSafeForDisplay, renderMLBResearchReport } from './research-report-renderer';
import { handleMLBReportPreviewApiRequest, assertMLBReportPreviewApiHandlerSuccess } from './report-preview-api-handler';
import { buildMLBReportPreviewUIViewModelFromHandlerSuccess } from './report-preview-ui-view-model';
import { buildMLBReportPreviewUIPresentation } from './report-preview-ui-components';
import {
  buildMLBReportPreviewUIAdapterDocument,
  type MLBReportPreviewUIAdapterDocument,
} from './report-preview-ui-adapter';

const LOCAL_PAGE_DOCUMENT_GENERATED_AT: string | null = null;
const LOCAL_PAGE_DOCUMENT_RENDERER_TITLE = 'MLB Report Preview';

function buildLocalInputPackage(): MLBResearchReportInputPackage {
  return {
    researchPackageVersion: 'local-page-document-v1',
    games: [
      {
        gameId: 'local-game-1',
        officialDate: '2024-07-01',
        scheduledStartTime: '2024-07-01T19:05:00.000Z',
        awayTeam: 'LOCAL_AWAY_1',
        homeTeam: 'LOCAL_HOME_1',
        researchStatus: 'complete',
        completedResearchModules: ['TEAM_RECENT_FORM'],
        researchFindings: {
          teamRecentForm: {
            dataQuality: 'partial',
            confidence: 'medium',
            researchStrengthScore: 'medium',
            warnings: ['Local synthetic evidence only.'],
          },
        },
      },
    ],
    researchModules: [{ moduleName: 'TEAM_RECENT_FORM' }],
  };
}

export function buildMLBReportPreviewLocalPageDocument(): MLBReportPreviewUIAdapterDocument {
  try {
    const researchPackage = buildLocalInputPackage();
    const report = buildMLBResearchReportFromPackage(researchPackage, {
      generatedAt: LOCAL_PAGE_DOCUMENT_GENERATED_AT,
    });
    const rendered = renderMLBResearchReport(report, {
      title: LOCAL_PAGE_DOCUMENT_RENDERER_TITLE,
    });
    assertRendererOutputSafeForDisplay(rendered);
    const response = handleMLBReportPreviewApiRequest({
      reportPreview: rendered,
      source: 'local-report-preview',
    });
    assertMLBReportPreviewApiHandlerSuccess(response);
    const viewModel = buildMLBReportPreviewUIViewModelFromHandlerSuccess(response);
    const presentation = buildMLBReportPreviewUIPresentation(viewModel);
    return buildMLBReportPreviewUIAdapterDocument(presentation);
  } catch (cause) {
    throw new Error('MLB report preview page construction failed', { cause });
  }
}

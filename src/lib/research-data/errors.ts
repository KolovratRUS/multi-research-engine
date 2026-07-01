export class ResearchDataError extends Error {
  readonly source: string;
  readonly statusCode?: number;
  readonly isRetryable: boolean;

  constructor(params: {
    message: string;
    source: string;
    statusCode?: number;
    isRetryable?: boolean;
  }) {
    super(params.message);
    this.name = 'ResearchDataError';
    this.source = params.source;
    this.statusCode = params.statusCode;
    this.isRetryable = params.isRetryable ?? false;
  }
}

export class ResearchDataValidationError extends ResearchDataError {
  constructor(params: { message: string; source: string }) {
    super({ ...params, isRetryable: false });
    this.name = 'ResearchDataValidationError';
  }
}

export class ResearchDataTimeoutError extends ResearchDataError {
  constructor(params: { message: string; source: string }) {
    super({ ...params, isRetryable: true });
    this.name = 'ResearchDataTimeoutError';
  }
}

export class ResearchDataUnavailableError extends ResearchDataError {
  constructor(params: { message: string; source: string }) {
    super({ ...params, isRetryable: false });
    this.name = 'ResearchDataUnavailableError';
  }
}

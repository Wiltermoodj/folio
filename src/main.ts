import {
  createD3MarketSparkline,
  type D3SparklineOptions,
  type D3SparklinePoint
} from './charts/d3MarketSparkline';
import { DEFAULT_FOLIO_DATA, DEFAULT_REPORT_META } from './data/defaultData';
import {
  formatFolioDataAsJsBlock,
  formatFolioDataAsJson,
  formatFolioDataAsTypeScript,
  generateStandaloneIndexHtml
} from './exporter/folioExporter';
import { parseAnyInput, parseDelimitedText } from './importer/csvParser';
import {
  assertRequiredHeaders,
  filterOutFailedRowsToCsv,
  FolioDataImporter,
  SAMPLE_VALIDATION_TEST_CSV,
  SECTION_HEADER_SPECS,
  validateCsvHeaders,
  validateUploadedRows
} from './importer/dataTransformer';
import {
  adoptCsvHeadersAsDisplayLabels,
  DEFAULT_COLUMN_DISPLAY_LABELS,
  extractDatasetFacts,
  requestAiReportSynthesis,
  synthesizeThematicReportMeta
} from './importer/reportSynthesizer';
import { validateAndNormalizeFolioData } from './importer/schemaValidator';
import {
  exportFolioToXlsxBuffer,
  importAllXlsxSheets,
  isExcelFileName,
  parseXlsxBuffer,
  XLSX_WORKBOOK_SHEETS
} from './importer/xlsxParser';
import { FolioDataStudio } from './studio/DataStudio';

// Export reusable TypeScript library API on window.FolioToolkit as well as ES module exports
export {
  adoptCsvHeadersAsDisplayLabels,
  assertRequiredHeaders,
  createD3MarketSparkline,
  type D3SparklineOptions,
  type D3SparklinePoint,
  DEFAULT_COLUMN_DISPLAY_LABELS,
  DEFAULT_FOLIO_DATA,
  DEFAULT_REPORT_META,
  exportFolioToXlsxBuffer,
  extractDatasetFacts,
  filterOutFailedRowsToCsv,
  FolioDataImporter,
  FolioDataStudio,
  formatFolioDataAsJsBlock,
  formatFolioDataAsJson,
  formatFolioDataAsTypeScript,
  generateStandaloneIndexHtml,
  importAllXlsxSheets,
  isExcelFileName,
  parseAnyInput,
  parseDelimitedText,
  parseXlsxBuffer,
  requestAiReportSynthesis,
  SAMPLE_VALIDATION_TEST_CSV,
  SECTION_HEADER_SPECS,
  synthesizeThematicReportMeta,
  validateAndNormalizeFolioData,
  validateCsvHeaders,
  validateUploadedRows,
  XLSX_WORKBOOK_SHEETS
};

declare global {
  interface Window {
    FolioToolkit?: {
      FolioDataImporter: typeof FolioDataImporter;
      validateCsvHeaders: typeof validateCsvHeaders;
      assertRequiredHeaders: typeof assertRequiredHeaders;
      validateUploadedRows: typeof validateUploadedRows;
      filterOutFailedRowsToCsv: typeof filterOutFailedRowsToCsv;
      SAMPLE_VALIDATION_TEST_CSV: typeof SAMPLE_VALIDATION_TEST_CSV;
      SECTION_HEADER_SPECS: typeof SECTION_HEADER_SPECS;
      validateAndNormalizeFolioData: typeof validateAndNormalizeFolioData;
      formatFolioDataAsJsBlock: typeof formatFolioDataAsJsBlock;
      formatFolioDataAsJson: typeof formatFolioDataAsJson;
      formatFolioDataAsTypeScript: typeof formatFolioDataAsTypeScript;
      generateStandaloneIndexHtml: typeof generateStandaloneIndexHtml;
      parseXlsxBuffer: typeof parseXlsxBuffer;
      importAllXlsxSheets: typeof importAllXlsxSheets;
      exportFolioToXlsxBuffer: typeof exportFolioToXlsxBuffer;
      isExcelFileName: typeof isExcelFileName;
      XLSX_WORKBOOK_SHEETS: typeof XLSX_WORKBOOK_SHEETS;
      createD3MarketSparkline: typeof createD3MarketSparkline;
      synthesizeThematicReportMeta: typeof synthesizeThematicReportMeta;
      requestAiReportSynthesis: typeof requestAiReportSynthesis;
      extractDatasetFacts: typeof extractDatasetFacts;
      adoptCsvHeadersAsDisplayLabels: typeof adoptCsvHeadersAsDisplayLabels;
      DEFAULT_COLUMN_DISPLAY_LABELS: typeof DEFAULT_COLUMN_DISPLAY_LABELS;
    };
  }
}

window.FolioToolkit = {
  FolioDataImporter,
  validateCsvHeaders,
  assertRequiredHeaders,
  validateUploadedRows,
  filterOutFailedRowsToCsv,
  SAMPLE_VALIDATION_TEST_CSV,
  SECTION_HEADER_SPECS,
  validateAndNormalizeFolioData,
  formatFolioDataAsJsBlock,
  formatFolioDataAsJson,
  formatFolioDataAsTypeScript,
  generateStandaloneIndexHtml,
  parseXlsxBuffer,
  importAllXlsxSheets,
  exportFolioToXlsxBuffer,
  isExcelFileName,
  XLSX_WORKBOOK_SHEETS,
  createD3MarketSparkline,
  synthesizeThematicReportMeta,
  requestAiReportSynthesis,
  extractDatasetFacts,
  adoptCsvHeadersAsDisplayLabels,
  DEFAULT_COLUMN_DISPLAY_LABELS
};

function bootStudio(): void {
  if (!window.FolioApp) {
    window.setTimeout(bootStudio, 30);
    return;
  }
  if (typeof window.FolioApp.setSparklineRenderer === 'function') {
    window.FolioApp.setSparklineRenderer(createD3MarketSparkline);
  }
  const studio = new FolioDataStudio(window.FolioApp);
  studio.init();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootStudio);
} else {
  bootStudio();
}

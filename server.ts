import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import type {
  ColumnDisplayLabels,
  FolioEvidenceStatCopy,
  FolioReportMeta,
  FolioReportNarrative,
  FolioScrollyStepCopy,
  FolioSectionCopy,
} from './src/types/folio';
import type { DatasetStatisticalDigest } from './src/importer/reportSynthesizer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function createSectionCopySchema() {
  return {
    type: Type.OBJECT,
    properties: {
      kicker: {
        type: Type.STRING,
        description: 'Short uppercase section category label (2-4 words)',
      },
      headline: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Exactly 3 short editorial headline lines',
      },
      paragraphs: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description:
          '2 to 4 data-grounded editorial paragraphs referencing the actual dataset numbers and entity names',
      },
      chartSubtitle: {
        type: Type.STRING,
        description:
          'Analytical chart subtitle describing the metrics and dimensions plotted',
      },
      figureCaption: {
        type: Type.STRING,
        description:
          'Figure caption summarizing methodological note and sample size',
      },
    },
    required: [
      'kicker',
      'headline',
      'paragraphs',
      'chartSubtitle',
      'figureCaption',
    ],
  };
}

const REPORT_SYNTHESIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: 'Concise report title matching the dataset theme',
    },
    mastheadNote: {
      type: Type.STRING,
      description: 'Short masthead note summarizing sample size and coverage',
    },
    heroHeadline: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        'Exactly 3 dramatic editorial hero headline lines grounded in the dataset theme and top findings',
    },
    heroLede: {
      type: Type.STRING,
      description:
        '2-3 sentence executive summary citing actual record counts, top entities, and metrics',
    },
    sourceLabel: {
      type: Type.STRING,
      description: 'Data source attribution label',
    },
    narrative: {
      type: Type.OBJECT,
      properties: {
        kpiCaptions: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description:
            'Exactly 4 short captions for the 4 hero KPI callouts (total records, entity count, cumulative volume, mean metric %)',
        },
        s01ChartSubtitle: { type: Type.STRING },
        s01FigureCaption: { type: Type.STRING },
        s02: {
          type: Type.OBJECT,
          properties: {
            ...createSectionCopySchema().properties,
            secondaryChartSubtitle: { type: Type.STRING },
            secondaryFigureCaption: { type: Type.STRING },
          },
          required: [
            'kicker',
            'headline',
            'paragraphs',
            'chartSubtitle',
            'secondaryChartSubtitle',
            'figureCaption',
          ],
        },
        s03: createSectionCopySchema(),
        s04: {
          type: Type.OBJECT,
          properties: {
            ...createSectionCopySchema().properties,
            leadStatValue: {
              type: Type.STRING,
              description: 'Lead percentage stat e.g. 64 %',
            },
            leadStatCaption: {
              type: Type.STRING,
              description:
                'Supporting explanation referencing actual top categories and metrics',
            },
          },
          required: [
            'kicker',
            'headline',
            'paragraphs',
            'chartSubtitle',
            'figureCaption',
            'leadStatValue',
            'leadStatCaption',
          ],
        },
        s05: createSectionCopySchema(),
        s06: {
          type: Type.OBJECT,
          properties: {
            kicker: { type: Type.STRING },
            headline: { type: Type.ARRAY, items: { type: Type.STRING } },
            paragraphs: { type: Type.ARRAY, items: { type: Type.STRING } },
            figureCaption: { type: Type.STRING },
            scrollySteps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  kicker: { type: Type.STRING },
                  title: { type: Type.STRING },
                  body: { type: Type.STRING },
                },
                required: ['kicker', 'title', 'body'],
              },
              description:
                'Exactly 3 scrollytelling steps corresponding to the stacked volume series progression',
            },
          },
          required: [
            'kicker',
            'headline',
            'paragraphs',
            'figureCaption',
            'scrollySteps',
          ],
        },
        s07: createSectionCopySchema(),
        s08: {
          type: Type.OBJECT,
          properties: {
            ...createSectionCopySchema().properties,
            secondaryChartSubtitle: { type: Type.STRING },
            waffleCalloutTitle: { type: Type.STRING },
            evidenceStats: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  value: { type: Type.STRING },
                  caption: { type: Type.STRING },
                },
                required: ['value', 'caption'],
              },
              description:
                'Exactly 3 evidence summary stats grounded in the dataset',
            },
          },
          required: [
            'kicker',
            'headline',
            'paragraphs',
            'chartSubtitle',
            'secondaryChartSubtitle',
            'figureCaption',
            'waffleCalloutTitle',
            'evidenceStats',
          ],
        },
        s09: createSectionCopySchema(),
        s10: {
          type: Type.OBJECT,
          properties: {
            ...createSectionCopySchema().properties,
            tableHeading: { type: Type.STRING },
            searchPlaceholder: { type: Type.STRING },
          },
          required: [
            'kicker',
            'headline',
            'paragraphs',
            'chartSubtitle',
            'figureCaption',
            'tableHeading',
            'searchPlaceholder',
          ],
        },
      },
      required: [
        'kpiCaptions',
        's01ChartSubtitle',
        's01FigureCaption',
        's02',
        's03',
        's04',
        's05',
        's06',
        's07',
        's08',
        's09',
        's10',
      ],
    },
  },
  required: [
    'title',
    'mastheadNote',
    'heroHeadline',
    'heroLede',
    'sourceLabel',
    'narrative',
  ],
};

function sanitizeSection(
  aiSec: Partial<FolioSectionCopy> | undefined,
  fallbackSec: FolioSectionCopy
): FolioSectionCopy {
  if (!aiSec) return fallbackSec;
  return {
    kicker: aiSec.kicker?.trim() || fallbackSec.kicker,
    headline:
      Array.isArray(aiSec.headline) && aiSec.headline.length >= 3
        ? [
            String(aiSec.headline[0]),
            String(aiSec.headline[1]),
            String(aiSec.headline[2]),
          ]
        : fallbackSec.headline,
    paragraphs:
      Array.isArray(aiSec.paragraphs) && aiSec.paragraphs.length > 0
        ? aiSec.paragraphs.map(String)
        : fallbackSec.paragraphs,
    chartSubtitle: aiSec.chartSubtitle?.trim() || fallbackSec.chartSubtitle,
    secondaryChartSubtitle:
      aiSec.secondaryChartSubtitle?.trim() ||
      fallbackSec.secondaryChartSubtitle,
    figureCaption: aiSec.figureCaption?.trim() || fallbackSec.figureCaption,
    secondaryFigureCaption:
      aiSec.secondaryFigureCaption?.trim() ||
      fallbackSec.secondaryFigureCaption,
  };
}

const synthesisCache = new Map<string, { meta: FolioReportMeta; model: string }>();
const modelCooldownUntil: Record<string, number> = {};

function parseRetryDelayMs(err: unknown): number {
  const msg = err instanceof Error ? err.message : String(err);
  const match = msg.match(/retry in (\d+(?:\.\d+)?)(ms|s)/i);
  if (!match) return 60_000;
  const val = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  return unit === 'ms' ? Math.max(5_000, Math.ceil(val)) : Math.ceil(val * 1000) + 1000;
}

function isQuotaOrRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota');
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  app.post('/api/ai/synthesize-report', async (req, res) => {
    const {
      contextPrompt,
      columnLabels,
      facts,
      fallbackMeta,
    }: {
      contextPrompt?: string;
      columnLabels?: ColumnDisplayLabels;
      facts?: DatasetStatisticalDigest;
      fallbackMeta?: FolioReportMeta;
    } = req.body || {};

    if (!facts || !fallbackMeta) {
      res.status(400).json({
        error: 'Missing dataset facts or fallbackMeta in request body.',
      });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(200).json({
        meta: fallbackMeta,
        synthesizedBy: 'deterministic-fallback',
        notice:
          'GEMINI_API_KEY not configured; using deterministic data-grounded synthesis.',
      });
      return;
    }

    const cacheKey = JSON.stringify({
      cp: (contextPrompt || '').trim(),
      cl: columnLabels,
      total: facts.totalRecords,
      entities: facts.entityCount,
      avgShare: facts.avgShare,
      top1: facts.topEntitiesByShare[0]?.name || '',
    });

    const cached = synthesisCache.get(cacheKey);
    if (cached) {
      res.status(200).json({
        meta: cached.meta,
        synthesizedBy: cached.model,
        cached: true,
      });
      return;
    }

    const candidateModels = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite-preview'];
    const now = Date.now();
    const availableModels = candidateModels.filter(
      (m) => !modelCooldownUntil[m] || now >= modelCooldownUntil[m]
    );

    if (availableModels.length === 0) {
      res.status(200).json({
        meta: fallbackMeta,
        synthesizedBy: 'deterministic-fallback',
        notice: 'Rate limit cooldown active; applied deterministic data-grounded synthesis.',
      });
      return;
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const prompt = `You are the chief data journalist for Folio Research. Rewrite this 10-section data visualization report so that all headlines, kickers, body paragraphs, chart subtitles, figure captions, scrollytelling steps, and KPI captions match the user's dataset theme and cite the EXACT statistics and entity names from the imported dataset.

USER DATASET CONTEXT PROMPT:
"${contextPrompt?.trim() || 'Empirical multi-dimensional dataset benchmark across entities, categories, and time periods.'}"

USER CUSTOM COLUMN DISPLAY NAMES:
${JSON.stringify(columnLabels, null, 2)}

ACTUAL IMPORTED DATASET STATISTICAL DIGEST (YOU MUST USE THESE EXACT NUMBERS AND NAMES):
${JSON.stringify(facts, null, 2)}

REQUIREMENTS:
1. Every section's headline must be an array of 3 concise lines suitable for an editorial broadsheet display heading.
2. Every section's paragraphs must cite real entity names, region/group names, percentages, basis points, and regression numbers from the statistical digest above. Never invent fake entities or numbers.
3. Match the tone, terminology, and subject matter described in USER DATASET CONTEXT PROMPT and USER CUSTOM COLUMN DISPLAY NAMES.
4. For Section 06 (s06.scrollySteps), generate 3 steps that correspond in order to the stacked volume series progression (${facts.volume.seriesSummary.map((s) => s.label).join(', ')}).
5. Return valid JSON matching the schema.`;

    let rawText: string | undefined;
    let usedModel = availableModels[0];

    for (const modelName of availableModels) {
      try {
        usedModel = modelName;
        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: REPORT_SYNTHESIS_SCHEMA,
          },
        });
        rawText = response.text;
        if (rawText) break;
      } catch (err) {
        if (isQuotaOrRateLimitError(err)) {
          modelCooldownUntil[modelName] = Date.now() + parseRetryDelayMs(err);
          continue;
        }
        // Non-quota error: fall back cleanly without crashing or spamming stderr
        break;
      }
    }

    if (!rawText) {
      res.status(200).json({
        meta: fallbackMeta,
        synthesizedBy: 'deterministic-fallback',
        notice: 'Applied deterministic data-grounded thematic synthesis.',
      });
      return;
    }

    try {
      const parsed = JSON.parse(rawText);
      const fbNarrative = fallbackMeta.narrative!;
      const aiNarrative: Partial<FolioReportNarrative> =
        parsed.narrative || {};

      const rawSteps = aiNarrative.s06?.scrollySteps;
      const scrollySteps: [
        FolioScrollyStepCopy,
        FolioScrollyStepCopy,
        FolioScrollyStepCopy,
      ] =
        Array.isArray(rawSteps) && rawSteps.length >= 3
          ? [
              {
                kicker:
                  rawSteps[0]?.kicker ||
                  fbNarrative.s06.scrollySteps[0].kicker,
                title:
                  rawSteps[0]?.title || fbNarrative.s06.scrollySteps[0].title,
                body: rawSteps[0]?.body || fbNarrative.s06.scrollySteps[0].body,
              },
              {
                kicker:
                  rawSteps[1]?.kicker ||
                  fbNarrative.s06.scrollySteps[1].kicker,
                title:
                  rawSteps[1]?.title || fbNarrative.s06.scrollySteps[1].title,
                body: rawSteps[1]?.body || fbNarrative.s06.scrollySteps[1].body,
              },
              {
                kicker:
                  rawSteps[2]?.kicker ||
                  fbNarrative.s06.scrollySteps[2].kicker,
                title:
                  rawSteps[2]?.title || fbNarrative.s06.scrollySteps[2].title,
                body: rawSteps[2]?.body || fbNarrative.s06.scrollySteps[2].body,
              },
            ]
          : fbNarrative.s06.scrollySteps;

      const rawStats = aiNarrative.s08?.evidenceStats;
      const evidenceStats: [
        FolioEvidenceStatCopy,
        FolioEvidenceStatCopy,
        FolioEvidenceStatCopy,
      ] =
        Array.isArray(rawStats) && rawStats.length >= 3
          ? [
              {
                value:
                  rawStats[0]?.value ||
                  fbNarrative.s08.evidenceStats[0].value,
                caption:
                  rawStats[0]?.caption ||
                  fbNarrative.s08.evidenceStats[0].caption,
              },
              {
                value:
                  rawStats[1]?.value ||
                  fbNarrative.s08.evidenceStats[1].value,
                caption:
                  rawStats[1]?.caption ||
                  fbNarrative.s08.evidenceStats[1].caption,
              },
              {
                value:
                  rawStats[2]?.value ||
                  fbNarrative.s08.evidenceStats[2].value,
                caption:
                  rawStats[2]?.caption ||
                  fbNarrative.s08.evidenceStats[2].caption,
              },
            ]
          : fbNarrative.s08.evidenceStats;

      const mergedNarrative: FolioReportNarrative = {
        kpiCaptions:
          Array.isArray(aiNarrative.kpiCaptions) &&
          aiNarrative.kpiCaptions.length >= 4
            ? [
                String(aiNarrative.kpiCaptions[0]),
                String(aiNarrative.kpiCaptions[1]),
                String(aiNarrative.kpiCaptions[2]),
                String(aiNarrative.kpiCaptions[3]),
              ]
            : fbNarrative.kpiCaptions,
        s01ChartSubtitle:
          aiNarrative.s01ChartSubtitle || fbNarrative.s01ChartSubtitle,
        s01FigureCaption:
          aiNarrative.s01FigureCaption || fbNarrative.s01FigureCaption,
        s02: sanitizeSection(aiNarrative.s02, fbNarrative.s02),
        s03: sanitizeSection(aiNarrative.s03, fbNarrative.s03),
        s04: {
          ...sanitizeSection(aiNarrative.s04, fbNarrative.s04),
          leadStatValue:
            aiNarrative.s04?.leadStatValue || fbNarrative.s04.leadStatValue,
          leadStatCaption:
            aiNarrative.s04?.leadStatCaption ||
            fbNarrative.s04.leadStatCaption,
        },
        s05: sanitizeSection(aiNarrative.s05, fbNarrative.s05),
        s06: {
          ...sanitizeSection(aiNarrative.s06, fbNarrative.s06),
          scrollySteps,
        },
        s07: sanitizeSection(aiNarrative.s07, fbNarrative.s07),
        s08: {
          ...sanitizeSection(aiNarrative.s08, fbNarrative.s08),
          waffleCalloutTitle:
            aiNarrative.s08?.waffleCalloutTitle ||
            fbNarrative.s08.waffleCalloutTitle,
          evidenceStats,
        },
        s09: sanitizeSection(aiNarrative.s09, fbNarrative.s09),
        s10: {
          ...sanitizeSection(aiNarrative.s10, fbNarrative.s10),
          tableHeading:
            aiNarrative.s10?.tableHeading || fbNarrative.s10.tableHeading,
          searchPlaceholder:
            aiNarrative.s10?.searchPlaceholder ||
            fbNarrative.s10.searchPlaceholder,
          entitySingular: fbNarrative.s10.entitySingular,
          entityPlural: fbNarrative.s10.entityPlural,
        },
      };

      const synthesizedMeta: FolioReportMeta = {
        ...fallbackMeta,
        title: parsed.title?.trim() || fallbackMeta.title,
        mastheadNote: parsed.mastheadNote?.trim() || fallbackMeta.mastheadNote,
        heroHeadline:
          Array.isArray(parsed.heroHeadline) && parsed.heroHeadline.length >= 3
            ? [
                String(parsed.heroHeadline[0]),
                String(parsed.heroHeadline[1]),
                String(parsed.heroHeadline[2]),
              ]
            : fallbackMeta.heroHeadline,
        heroLede: parsed.heroLede?.trim() || fallbackMeta.heroLede,
        sourceLabel: parsed.sourceLabel?.trim() || fallbackMeta.sourceLabel,
        contextPrompt: contextPrompt?.trim() || fallbackMeta.contextPrompt,
        columnLabels: columnLabels || fallbackMeta.columnLabels,
        narrative: mergedNarrative,
      };

      synthesisCache.set(cacheKey, { meta: synthesizedMeta, model: usedModel });

      res.status(200).json({
        meta: synthesizedMeta,
        synthesizedBy: usedModel,
      });
    } catch {
      res.status(200).json({
        meta: fallbackMeta,
        synthesizedBy: 'deterministic-fallback',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'mpa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Folio server listening on http://localhost:${PORT}`);
  });
}

startServer();

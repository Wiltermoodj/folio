/**
 * Folio — CSV Header Validation Utility
 * Verifies that uploaded CSV/TSV/tabular files contain the required columns
 * (e.g., 'market', 'region', 'value') before proceeding to template transformation.
 */

import type {
  ColumnMappingConfig,
  HeaderColumnRequirement,
  HeaderMatchDetail,
  HeaderMissingDetail,
  HeaderValidationResult,
  ImportTargetSection
} from '../types/folio';

export const SECTION_HEADER_SPECS: Record<
  Exclude<ImportTargetSection, 'auto' | 'full-json'>,
  HeaderColumnRequirement[]
> = {
  'master-records': [
    {
      key: 'market',
      label: 'Market / Entity',
      required: true,
      canonicalNames: ['market', 'entity', 'country', 'name'],
      aliases: [/^(market|country|entity|name|city|hub|account)$/i],
      mappingKey: 'marketCol'
    },
    {
      key: 'region',
      label: 'Region / Geography',
      required: true,
      canonicalNames: ['region', 'geography', 'zone'],
      aliases: [/^(region|geography|geo|continent|zone|area)$/i],
      mappingKey: 'regionCol'
    },
    {
      key: 'value',
      label: 'Value / Adoption Share (%)',
      required: true,
      canonicalNames: ['value', 'share', 'adoption 2026 (%)', 'adoption', 'rate'],
      aliases: [/^(value|adoption|adoption\s*2026(\s*\(%\))?|share(\s*\(%\))?|rate|current|y2026)$/i],
      mappingKey: 'shareCol'
    },
    {
      key: 'records',
      label: 'Records Count (n)',
      required: false,
      canonicalNames: ['records', 'n', 'count'],
      aliases: [/^(records|n|count|sample|units|workloads)$/i],
      mappingKey: 'recordsCol'
    },
    {
      key: 'policy',
      label: 'Policy / Readiness (%)',
      required: false,
      canonicalNames: ['policy', 'policy (%)', 'readiness', 'score'],
      aliases: [/^(policy(\s*\(%\))?|readiness|score|compliance)$/i],
      mappingKey: 'policyCol'
    },
    {
      key: 'bps',
      label: 'Efficiency / Cost Index (bps)',
      required: false,
      canonicalNames: ['bps', 'efficiency gain (bps)', 'cost index'],
      aliases: [/^(bps|efficiency(\s*gain)?(\s*\(bps\))?|cost(\s*index)?)$/i],
      mappingKey: 'bpsCol'
    },
    {
      key: 'delta',
      label: 'YoY Delta (pp)',
      required: false,
      canonicalNames: ['delta', 'delta yoy (pp)', 'change'],
      aliases: [/^(delta(\s*yoy)?(\s*\(pp\))?|change|yoy|pp|growth)$/i],
      mappingKey: 'deltaCol'
    }
  ],

  's10b-markets': [
    {
      key: 'market',
      label: 'Market',
      required: true,
      canonicalNames: ['market', 'country', 'entity'],
      aliases: [/^(market|country|entity|name)$/i],
      mappingKey: 'marketCol'
    },
    {
      key: 'region',
      label: 'Region',
      required: true,
      canonicalNames: ['region', 'geography'],
      aliases: [/^(region|geography|geo|zone)$/i],
      mappingKey: 'regionCol'
    },
    {
      key: 'value',
      label: 'Value / Adoption 2026 (%)',
      required: true,
      canonicalNames: ['value', 'share', 'adoption 2026 (%)', 'adoption'],
      aliases: [/^(value|share(\s*\(%\))?|adoption(\s*2026)?(\s*\(%\))?|rate)$/i],
      mappingKey: 'shareCol'
    }
  ],

  's01-heroMatrix': [
    {
      key: 'dimension',
      label: 'Dimension (region / assetSize / role)',
      required: true,
      canonicalNames: ['dimension', 'group', 'type'],
      aliases: [/^(dimension|group|group_type|type)$/i]
    },
    {
      key: 'name',
      label: 'Category Name',
      required: true,
      canonicalNames: ['name', 'category', 'label', 'market', 'region'],
      aliases: [/^(name|category|label|market|region)$/i],
      mappingKey: 'marketCol'
    },
    {
      key: 'count',
      label: 'Count / Value',
      required: true,
      canonicalNames: ['count', 'value', 'n', 'records'],
      aliases: [/^(count|value|n|records)$/i],
      mappingKey: 'recordsCol'
    }
  ],

  's02a-sampleFunction': [
    {
      key: 'category',
      label: 'Category / Function Name',
      required: true,
      canonicalNames: ['category', 'name', 'function', 'role', 'market'],
      aliases: [/^(category|name|function|role|segment|market)$/i],
      mappingKey: 'marketCol'
    },
    {
      key: 'value',
      label: 'Value / Share (%)',
      required: true,
      canonicalNames: ['value', 'share (%)', 'share', 'percent'],
      aliases: [/^(value|share(\s*\(%\))?|percent|percentage)$/i],
      mappingKey: 'shareCol'
    }
  ],

  's02b-sampleRegion': [
    {
      key: 'region',
      label: 'Region',
      required: true,
      canonicalNames: ['region', 'geography'],
      aliases: [/^(region|geography|name)$/i],
      mappingKey: 'regionCol'
    },
    {
      key: 'records',
      label: 'Records (n)',
      required: true,
      canonicalNames: ['records', 'n', 'count'],
      aliases: [/^(records|n|count)$/i],
      mappingKey: 'recordsCol'
    },
    {
      key: 'value',
      label: 'Median Volume ($bn) / Value',
      required: true,
      canonicalNames: ['median volume ($bn)', 'medianbook', 'value', 'volume'],
      aliases: [/^(median(\s*volume)?(\s*\(\$bn\))?|medianbook|value|volume|share(\s*\(%\))?)$/i],
      mappingKey: 'medianVolumeCol'
    }
  ],

  's03-priorities': [
    {
      key: 'item',
      label: 'Initiative / Category',
      required: true,
      canonicalNames: ['initiative', 'item', 'category', 'name', 'market'],
      aliases: [/^(initiative|item|category|name|priority|market)$/i],
      mappingKey: 'marketCol'
    },
    {
      key: 'y2024',
      label: 'Baseline Period (2024 %)',
      required: true,
      canonicalNames: ['2024 (%)', 'y2024', '2024', 'baseline'],
      aliases: [/^(2024(\s*\(%\))?|y2024|baseline|prior|start)$/i],
      mappingKey: 'y2024Col'
    },
    {
      key: 'y2026',
      label: 'Latest Period (2026 % / Value)',
      required: true,
      canonicalNames: ['2026 (%)', 'y2026', '2026', 'value', 'latest'],
      aliases: [/^(2026(\s*\(%\))?|y2026|value|latest|current|end)$/i],
      mappingKey: 'y2026Col'
    }
  ],

  's04-riskLimits': [
    {
      key: 'region',
      label: 'Region',
      required: true,
      canonicalNames: ['region', 'geography'],
      aliases: [/^(region|geography|group)$/i],
      mappingKey: 'regionCol'
    },
    {
      key: 'increasing',
      label: 'Increasing (%)',
      required: true,
      canonicalNames: ['increasing (%)', 'increasing', 'expand'],
      aliases: [/^(increasing(\s*\(%\))?|inc|expand)$/i]
    },
    {
      key: 'unchanged',
      label: 'Unchanged (%)',
      required: true,
      canonicalNames: ['unchanged (%)', 'unchanged', 'hold'],
      aliases: [/^(unchanged(\s*\(%\))?|unch|hold|steady)$/i]
    },
    {
      key: 'decreasing',
      label: 'Decreasing (%)',
      required: true,
      canonicalNames: ['decreasing (%)', 'decreasing', 'reduce'],
      aliases: [/^(decreasing(\s*\(%\))?|dec|reduce)$/i]
    }
  ],

  's05a-regulationLine': [
    {
      key: 'year',
      label: 'Year',
      required: true,
      canonicalNames: ['year', 'date', 'period'],
      aliases: [/^(year|date|period)$/i]
    },
    {
      key: 'value',
      label: 'Value / Adoption (%)',
      required: true,
      canonicalNames: ['value', 'adoption (%)', 'adoption', 'rate'],
      aliases: [/^(value|adoption(\s*\(%\))?|rate|share)$/i],
      mappingKey: 'shareCol'
    }
  ],

  's05b-regulationEvents': [
    {
      key: 'date',
      label: 'Display Date',
      required: true,
      canonicalNames: ['date', 'year'],
      aliases: [/^(date|year|period)$/i]
    },
    {
      key: 'short',
      label: 'Short Marker Label',
      required: true,
      canonicalNames: ['short', 'label'],
      aliases: [/^(short|label|tag)$/i]
    },
    {
      key: 'title',
      label: 'Milestone Title',
      required: true,
      canonicalNames: ['title', 'headline', 'name'],
      aliases: [/^(title|headline|name)$/i]
    }
  ],

  's06-volume': [
    {
      key: 'year',
      label: 'Year',
      required: true,
      canonicalNames: ['year', 'period'],
      aliases: [/^(year|period)$/i]
    }
  ],

  's07-exposure': [
    {
      key: 'category',
      label: 'Category / Sector',
      required: true,
      canonicalNames: ['category', 'sector', 'item'],
      aliases: [/^(category|sector|item|name)$/i]
    }
  ],

  's08a-waffle': [
    {
      key: 'segment',
      label: 'Segment Name',
      required: true,
      canonicalNames: ['segment', 'group', 'tier'],
      aliases: [/^(segment|group|tier|name)$/i]
    },
    {
      key: 'verified',
      label: 'Verified (%)',
      required: true,
      canonicalNames: ['verified (%)', 'verified'],
      aliases: [/^verified(\s*\(%\))?$/i]
    },
    {
      key: 'estimated',
      label: 'Estimated (%)',
      required: true,
      canonicalNames: ['estimated (%)', 'estimated', 'proxy'],
      aliases: [/^(estimated(\s*\(%\))?|proxy)$/i]
    },
    {
      key: 'none',
      label: 'Unverified / None (%)',
      required: true,
      canonicalNames: ['unverified (%)', 'unverified', 'none'],
      aliases: [/^(unverified(\s*\(%\))?|none)$/i]
    }
  ],

  's08b-likert': [
    {
      key: 'statement',
      label: 'Survey Statement',
      required: true,
      canonicalNames: ['statement', 'text', 'question'],
      aliases: [/^(statement|text|question|item)$/i]
    },
    {
      key: 'sd',
      label: 'Strongly Disagree (SD %)',
      required: true,
      canonicalNames: ['sd (%)', 'sd', 'strongly disagree'],
      aliases: [/^(sd(\s*\(%\))?|strongly\s*disagree)$/i]
    },
    {
      key: 'a',
      label: 'Agree (A %)',
      required: true,
      canonicalNames: ['a (%)', 'a', 'agree'],
      aliases: [/^(a(\s*\(%\))?|agree)$/i]
    }
  ],

  's09-pricing': [
    {
      key: 'sector',
      label: 'Sector / Category',
      required: true,
      canonicalNames: ['sector', 'category', 'region', 'segment'],
      aliases: [/^(sector|category|region|segment|group)$/i],
      mappingKey: 'segmentCol'
    },
    {
      key: 'score',
      label: 'Readiness Score (x)',
      required: true,
      canonicalNames: ['readiness score', 'score', 'x', 'policy'],
      aliases: [/^(readiness(\s*score)?|score|x|policy)$/i],
      mappingKey: 'policyCol'
    },
    {
      key: 'bps',
      label: 'Cost Index / Value (y)',
      required: true,
      canonicalNames: ['cost index', 'bps', 'value', 'y'],
      aliases: [/^(cost(\s*index)?|bps|value|y)$/i],
      mappingKey: 'bpsCol'
    }
  ],

  's10a-outlookBars': [
    {
      key: 'scenario',
      label: 'Scenario Label',
      required: true,
      canonicalNames: ['scenario', 'label', 'name'],
      aliases: [/^(scenario|label|name|category)$/i]
    },
    {
      key: 'value',
      label: 'Value / Share (%)',
      required: true,
      canonicalNames: ['share (%)', 'value', 'share'],
      aliases: [/^(share(\s*\(%\))?|value|percent)$/i],
      mappingKey: 'shareCol'
    }
  ]
};

/**
 * Computes normalized similarity between two header strings to suggest close matches
 * when a required column is misspelled (e.g. 'mrket' -> 'market', 'regn' -> 'region').
 */
function findClosestHeaderSuggestion(
  expectedNames: string[],
  availableHeaders: string[]
): string | undefined {
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const cand of availableHeaders) {
    const cClean = clean(cand);
    if (!cClean) continue;
    for (const exp of expectedNames) {
      const eClean = clean(exp);
      if (
        cClean.includes(eClean) ||
        eClean.includes(cClean) ||
        levenshteinDistance(cClean, eClean) <= 2
      ) {
        return cand;
      }
    }
  }
  return undefined;
}

function levenshteinDistance(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

/**
 * Direct utility function to check whether a list of CSV headers contains
 * an explicit array of required column names (e.g., ['market', 'region', 'value']).
 */
export function assertRequiredHeaders(
  headers: string[],
  requiredColumns: string[] = ['market', 'region', 'value'],
  options: { allowCommonAliases?: boolean } = { allowCommonAliases: true }
): {
  valid: boolean;
  matched: Record<string, string>;
  missing: string[];
  message: string;
} {
  const normalizedHeaders = headers.map(h => h.trim());
  const matched: Record<string, string> = {};
  const missing: string[] = [];

  const commonAliasMap: Record<string, RegExp> = {
    market: /^(market|country|entity|name|item|category)$/i,
    region: /^(region|geography|geo|zone|area)$/i,
    value: /^(value|share(\s*\(%\))?|adoption(\s*2026)?(\s*\(%\))?|count|n|records|rate)$/i
  };

  for (const req of requiredColumns) {
    const reqLower = req.trim().toLowerCase();
    // 1. Exact case-insensitive match
    let hit = normalizedHeaders.find(h => h.toLowerCase() === reqLower);

    // 2. Alias match if enabled
    if (!hit && options.allowCommonAliases !== false && commonAliasMap[reqLower]) {
      hit = normalizedHeaders.find(h => commonAliasMap[reqLower].test(h));
    }

    if (hit) {
      matched[req] = hit;
    } else {
      missing.push(req);
    }
  }

  const valid = missing.length === 0;
  const message = valid
    ? `All ${requiredColumns.length} required columns verified (${requiredColumns
        .map(k => `"${matched[k]}"`)
        .join(', ')}).`
    : `Missing required CSV column${missing.length > 1 ? 's' : ''}: ${missing
        .map(m => `'${m}'`)
        .join(', ')}. Detected headers: [${normalizedHeaders.join(', ') || 'none'}].`;

  return { valid, matched, missing, message };
}

/**
 * Validates CSV/TSV headers against the required schema for the target Folio section
 * (or Master Dataset) before proceeding to template transformation.
 */
export function validateCsvHeaders(
  headers: string[],
  target: ImportTargetSection = 'master-records',
  customMapping?: ColumnMappingConfig
): HeaderValidationResult {
  const cleanHeaders = headers.map(h => h.trim()).filter(Boolean);

  if (target === 'full-json') {
    return {
      valid: cleanHeaders.length > 0,
      target,
      detectedHeaders: cleanHeaders,
      matched: [],
      missing: [],
      unrecognizedHeaders: [],
      summary: 'Full JSON / DATA object structure detected.'
    };
  }

  const effectiveTarget: Exclude<ImportTargetSection, 'auto' | 'full-json'> =
    target === 'auto' ? 'master-records' : target;
  const specs = SECTION_HEADER_SPECS[effectiveTarget] || SECTION_HEADER_SPECS['master-records'];

  const matched: HeaderMatchDetail[] = [];
  const missing: HeaderMissingDetail[] = [];
  const usedHeaders = new Set<string>();

  for (const spec of specs) {
    let foundHeader: string | undefined;
    let matchType: 'exact' | 'alias' | 'mapped' = 'exact';

    // 1. Check exact canonical match first
    foundHeader = cleanHeaders.find(h =>
      spec.canonicalNames.some(c => c.toLowerCase() === h.toLowerCase())
    );

    // 2. Check regex aliases
    if (!foundHeader) {
      foundHeader = cleanHeaders.find(h => spec.aliases.some(re => re.test(h)));
      if (foundHeader) matchType = 'alias';
    }

    // 3. Check if user explicitly mapped this column in ColumnMappingConfig
    if (!foundHeader && spec.mappingKey && customMapping) {
      const mappedVal = customMapping[spec.mappingKey];
      if (typeof mappedVal === 'string' && cleanHeaders.includes(mappedVal)) {
        foundHeader = mappedVal;
        matchType = 'mapped';
      }
    }

    if (foundHeader) {
      usedHeaders.add(foundHeader);
      matched.push({
        key: spec.key,
        label: spec.label,
        matchedHeader: foundHeader,
        matchType,
        required: spec.required
      });
    } else if (spec.required) {
      const suggestion = findClosestHeaderSuggestion(
        spec.canonicalNames,
        cleanHeaders.filter(h => !usedHeaders.has(h))
      );
      missing.push({
        key: spec.key,
        label: spec.label,
        expectedExamples: spec.canonicalNames.slice(0, 3),
        suggestedHeader: suggestion
      });
    }
  }

  // Special check for multi-column matrix sections (s06-volume and s07-exposure)
  if ((effectiveTarget === 's06-volume' || effectiveTarget === 's07-exposure') && cleanHeaders.length < 2) {
    missing.push({
      key: 'value',
      label: 'Numeric Series / Region Value Columns',
      expectedExamples:
        effectiveTarget === 's06-volume'
          ? ['Core platforms ($bn)', 'Cloud infrastructure ($bn)']
          : ['Europe', 'Asia-Pacific', 'Americas', 'Global']
    });
  }

  const unrecognizedHeaders = cleanHeaders.filter(h => !usedHeaders.has(h));
  const valid = missing.length === 0 && cleanHeaders.length > 0;

  let summary = '';
  if (cleanHeaders.length === 0) {
    summary = 'Header validation failed: No CSV column headers detected.';
  } else if (valid) {
    const reqMatches = matched.filter(m => m.required);
    summary = `CSV header check passed: All ${reqMatches.length} required columns verified (${reqMatches
      .map(m => `'${m.key}' → "${m.matchedHeader}"`)
      .join(', ')}).`;
  } else {
    const missList = missing
      .map(
        m =>
          `'${m.key}' (expected ${m.expectedExamples.map(e => `"${e}"`).join(' or ')}${
            m.suggestedHeader ? ` — did you mean "${m.suggestedHeader}"?` : ''
          })`
      )
      .join('; ');
    summary = `CSV header validation failed — missing required column${
      missing.length > 1 ? 's' : ''
    }: ${missList}.`;
  }

  return {
    valid,
    target: effectiveTarget,
    detectedHeaders: cleanHeaders,
    matched,
    missing,
    unrecognizedHeaders,
    summary
  };
}

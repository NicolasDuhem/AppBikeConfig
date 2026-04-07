import { NextResponse } from 'next/server';
import { requireApiRole } from '@/lib/api-auth';
import { sql } from '@/lib/db';
import { CPQ_OPTION_NAMES, isValidCharacter17, normalizeCharacter17, parseSimpleCsv } from '@/lib/cpq';

type ImportPhase =
  | 'created'
  | 'parsing_csv'
  | 'validating_rows'
  | 'updating_sku_definition'
  | 'completed'
  | 'failed';

type ImportRowIssue = {
  rowNumber: number;
  optionName: string;
  reason: string;
  status: 'skipped' | 'error';
};

type RowDiagnostic = {
  rowNumber: number;
  optionName: string | null;
  choiceValue: string | null;
  digitPosition: number | null;
  codeValue: string | null;
  rawOptionName: string | null;
  rawDigit: string | null;
  rawCodeValue: string | null;
  normalizedOptionName: string | null;
  status: 'imported' | 'skipped' | 'error';
  reason: string | null;
  actionAttempted: string | null;
};

type ImportFailure = {
  success: false;
  importRunId: number | null;
  phase: ImportPhase;
  message: string;
  details?: unknown;
  rowNumber?: number;
};

function logPhase(message: string, data?: Record<string, unknown>) {
  if (data) {
    console.info(`[CPQ_IMPORT] ${message}`, data);
    return;
  }
  console.info(`[CPQ_IMPORT] ${message}`);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected import error';
}

function getErrorStack(error: unknown) {
  return error instanceof Error ? error.stack || null : null;
}

async function updateRun(runId: number, patch: Record<string, unknown>) {
  await sql`
    update cpq_import_runs
    set
      status = coalesce(${patch.status as any}, status),
      current_phase = coalesce(${patch.currentPhase as any}, current_phase),
      rows_imported = coalesce(${patch.rowsImported as any}, rows_imported),
      rows_skipped = coalesce(${patch.rowsSkipped as any}, rows_skipped),
      rows_deactivated = coalesce(${patch.rowsDeactivated as any}, rows_deactivated),
      rows_inserted = coalesce(${patch.rowsInserted as any}, rows_inserted),
      error_message = ${patch.errorMessage as any},
      error_stack = ${patch.errorStack as any},
      failed_at = ${patch.failedAt as any},
      completed_at = ${patch.completedAt as any}
    where id = ${runId}
  `;
}

async function persistDiagnostics(runId: number, diagnostics: RowDiagnostic[]) {
  for (const row of diagnostics) {
    await sql`
      insert into cpq_import_rows (
        import_run_id,
        row_number,
        option_name,
        choice_value,
        digit_position,
        code_value,
        raw_option_name,
        raw_digit,
        raw_code_value,
        normalized_option_name,
        status,
        reason,
        action_attempted
      )
      values (
        ${runId},
        ${row.rowNumber},
        ${row.optionName},
        ${row.choiceValue},
        ${row.digitPosition},
        ${row.codeValue},
        ${row.rawOptionName},
        ${row.rawDigit},
        ${row.rawCodeValue},
        ${row.normalizedOptionName},
        ${row.status},
        ${row.reason},
        ${row.actionAttempted}
      )
    `;
  }
}

function jsonFailure(payload: ImportFailure, status = 500) {
  return NextResponse.json(payload, { status });
}

export async function POST(request: Request) {
  let runId: number | null = null;
  let currentPhase: ImportPhase = 'created';
  const diagnosticsBuffer: RowDiagnostic[] = [];

  try {
    const auth = await requireApiRole('builder.use');
    if (auth instanceof NextResponse) return auth;

    const form = await request.formData();
    const file = form.get('file') as File | null;
    const selectedLine = String(form.get('selectedLine') || '').trim();
    const electricType = String(form.get('electricType') || '').trim();
    const isSpecial = String(form.get('isSpecial') || '').trim() === 'Yes';
    const specialEditionName = String(form.get('specialEditionName') || '').trim();
    const character17 = normalizeCharacter17(String(form.get('character17') || ''));
    const dryRun = String(form.get('dryRun') || '').toLowerCase() === 'true';

    if (!file) return jsonFailure({ success: false, importRunId: null, phase: currentPhase, message: 'CSV file is required' }, 400);
    if (!isValidCharacter17(character17)) {
      return jsonFailure({ success: false, importRunId: null, phase: currentPhase, message: 'Character 17 must be one uppercase A-Z or 0-9 character' }, 400);
    }
    if (isSpecial && !specialEditionName) {
      return jsonFailure({ success: false, importRunId: null, phase: currentPhase, message: 'Special edition name is required when special is Yes' }, 400);
    }

    const runRows = await sql`
      insert into cpq_import_runs (
        file_name,
        selected_line,
        electric_type,
        is_special,
        special_edition_name,
        character_17,
        uploaded_by,
        rows_read,
        status,
        current_phase,
        is_dry_run,
        started_at
      )
      values (
        ${file.name},
        ${selectedLine},
        ${electricType},
        ${isSpecial},
        ${isSpecial ? specialEditionName : null},
        ${character17},
        ${auth.user.id},
        0,
        'created',
        'created',
        ${dryRun},
        now()
      )
      returning id
    ` as any[];
    runId = Number(runRows[0].id);

    logPhase(`start import run ${runId}`, { dryRun, fileName: file.name });

    currentPhase = 'parsing_csv';
    await updateRun(runId, { status: 'created', currentPhase });
    logPhase('parsing csv', { runId });

    const content = await file.text();
    const parsed = parseSimpleCsv(content);

    await sql`update cpq_import_runs set rows_read = ${parsed.rows.length} where id = ${runId}`;

    if (parsed.diagnostics.validationErrors.length > 0) {
      currentPhase = 'validating_rows';
      await updateRun(runId, {
        status: 'failed',
        currentPhase,
        errorMessage: 'CSV validation failed',
        errorStack: JSON.stringify(parsed.diagnostics.validationErrors),
        failedAt: new Date()
      });

      return jsonFailure({
        success: false,
        importRunId: runId,
        phase: currentPhase,
        message: 'CSV validation failed',
        details: {
          headerDetected: parsed.diagnostics.headerDetected,
          header: parsed.diagnostics.header,
          errors: parsed.diagnostics.validationErrors
        }
      }, 400);
    }

    currentPhase = 'validating_rows';
    await updateRun(runId, { status: 'created', currentPhase });

    let rowsImported = 0;
    let rowsSkipped = 0;
    let rowsDeactivated = 0;
    let rowsInserted = 0;
    let duplicateRowsSkipped = 0;
    let unknownOptionsSkipped = 0;
    const rowIssues: ImportRowIssue[] = [];

    for (const row of parsed.rows) {
      logPhase(`validating row ${row.rowNumber}`, { runId, optionName: row.optionName, digit: row.digitPosition, code: row.codeValue });
      const optionName = row.optionName;

      const baseDiagnostic: Omit<RowDiagnostic, 'status' | 'reason' | 'actionAttempted'> = {
        rowNumber: row.rowNumber,
        optionName,
        choiceValue: row.choiceValue,
        digitPosition: row.digitPosition,
        codeValue: row.codeValue,
        rawOptionName: row.rawOptionName,
        rawDigit: String(row.digitPosition),
        rawCodeValue: row.codeValue,
        normalizedOptionName: optionName
      };

      if (!CPQ_OPTION_NAMES.includes(optionName as any)) {
        rowsSkipped += 1;
        unknownOptionsSkipped += 1;
        const reason = 'Unknown option name skipped';
        rowIssues.push({ rowNumber: row.rowNumber, optionName: row.rawOptionName, reason, status: 'skipped' });
        diagnosticsBuffer.push({ ...baseDiagnostic, status: 'skipped', reason, actionAttempted: 'skip_unknown_option' });
        continue;
      }

      const normalizedCodeValue = row.digitPosition === 0 ? (row.codeValue || '-') : row.codeValue;
      const validNonStatic = row.digitPosition > 0 && /^[A-Z0-9]$/.test(normalizedCodeValue) && !!row.choiceValue;
      const validStatic = row.digitPosition === 0 && !!row.choiceValue && normalizedCodeValue === '-';
      if (!validNonStatic && !validStatic) {
        rowsSkipped += 1;
        const reason = 'Invalid digit/code/choice';
        rowIssues.push({ rowNumber: row.rowNumber, optionName, reason, status: 'error' });
        diagnosticsBuffer.push({ ...baseDiagnostic, status: 'error', reason, actionAttempted: 'validate_row' });
        continue;
      }

      if (row.digitPosition > 0) {
        const digitConflict = await sql`
          select id, option_name
          from sku_rules
          where digit_position = ${row.digitPosition}
            and is_active = true
          limit 1
        ` as any[];

        if (digitConflict.length && String(digitConflict[0].option_name).toLowerCase() !== optionName.toLowerCase()) {
          rowsSkipped += 1;
          const reason = `Digit ${row.digitPosition} is tied to option ${digitConflict[0].option_name}`;
          rowIssues.push({ rowNumber: row.rowNumber, optionName, reason, status: 'error' });
          diagnosticsBuffer.push({ ...baseDiagnostic, status: 'error', reason, actionAttempted: 'validate_digit_ownership' });
          continue;
        }
      }

      const existingActive = await sql`
        select id
        from sku_rules
        where digit_position = ${row.digitPosition}
          and lower(option_name) = lower(${optionName})
          and upper(code_value) = upper(${normalizedCodeValue})
          and is_active = true
        limit 1
      ` as any[];

      if (existingActive.length) {
        rowsSkipped += 1;
        duplicateRowsSkipped += 1;
        const reason = 'Duplicate digit/value skipped';
        rowIssues.push({ rowNumber: row.rowNumber, optionName, reason, status: 'skipped' });
        diagnosticsBuffer.push({ ...baseDiagnostic, status: 'skipped', reason, codeValue: normalizedCodeValue, actionAttempted: 'skip_duplicate' });
        logPhase(`duplicate skipped row ${row.rowNumber}`, { runId, optionName, digit: row.digitPosition, code: normalizedCodeValue });
        continue;
      }

      if (dryRun) {
        rowsImported += 1;
        rowsInserted += 1;
        diagnosticsBuffer.push({ ...baseDiagnostic, status: 'imported', reason: 'Dry-run validated', codeValue: normalizedCodeValue, actionAttempted: 'dry_run_validate' });
        continue;
      }

      currentPhase = 'updating_sku_definition';
      await updateRun(runId, { currentPhase });

      await sql`
        insert into sku_rules (digit_position, option_name, code_value, choice_value, description_element, is_active)
        values (${row.digitPosition}, ${optionName}, ${normalizedCodeValue.toUpperCase()}, ${row.choiceValue}, ${row.choiceValue}, true)
      `;

      rowsImported += 1;
      rowsInserted += 1;
      diagnosticsBuffer.push({ ...baseDiagnostic, status: 'imported', reason: null, codeValue: normalizedCodeValue, actionAttempted: 'insert_sku_rule' });
    }

    await persistDiagnostics(runId, diagnosticsBuffer);

    currentPhase = 'completed';
    await updateRun(runId, {
      status: 'completed',
      currentPhase,
      rowsImported,
      rowsSkipped,
      rowsDeactivated,
      rowsInserted,
      errorMessage: null,
      errorStack: null,
      failedAt: null,
      completedAt: new Date()
    });

    logPhase(`completed import run ${runId}`, { rowsImported, rowsSkipped, dryRun });

    return NextResponse.json({
      success: true,
      importRunId: runId,
      phase: currentPhase,
      dryRun,
      summary: {
        rowsRead: parsed.rows.length,
        rowsImported,
        rowsSkipped,
        duplicateRowsSkipped,
        unknownOptionsSkipped,
        rowsDeactivated,
        rowsInserted,
        rowIssues
      }
    });
  } catch (error) {
    const message = getErrorMessage(error);
    const stack = getErrorStack(error);
    logPhase(`failure in phase ${currentPhase}: ${message}`, { runId });

    if (runId) {
      try {
        if (diagnosticsBuffer.length > 0) {
          await persistDiagnostics(runId, diagnosticsBuffer);
        }
        await updateRun(runId, {
          status: 'failed',
          currentPhase,
          errorMessage: message,
          errorStack: stack,
          failedAt: new Date()
        });
      } catch (runUpdateError) {
        console.error('[CPQ_IMPORT] failed to persist import diagnostics', runUpdateError);
      }
    }

    return jsonFailure({
      success: false,
      importRunId: runId,
      phase: currentPhase,
      message: 'CPQ import failed',
      details: { error: message }
    }, 500);
  }
}

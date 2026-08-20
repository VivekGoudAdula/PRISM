import { Task } from '../../models/Task';

/** A resolved file ready for text extraction, code review, or semantic mapping. */
export interface ResolvedFile {
  filename: string;
  content_base64?: string;
  text?: string;
  code_content?: string;
  file_path?: string;
  raw_url?: string;
  semantic_map?: any;
}

/**
 * Resolves file content and task description from a handler request body.
 *
 * Supports two modes:
 *  1. **Inline mode** (old flow): `files[]` or `{file_path, raw_url}` directly in body.
 *  2. **Reference mode** (new flow): `file_index` + `plan_id` in body reference stored task data.
 */
export async function resolveFiles(body: any): Promise<{
  files: ResolvedFile[];
  taskDescription: string;
}> {
  const { task_description = '', files = [], file_index, plan_id } = body;

  // ── Reference mode: look up stored file by plan_id + file_index ─────────────
  if (typeof file_index === 'number' && plan_id) {
    const task = await Task.findById(plan_id);
    if (!task) {
      throw new Error(`Plan not found for file lookup: ${plan_id}`);
    }

    const storedFiles: any[] = task.plannerOutput?.files || [];
    const storedFile = storedFiles.find((f: any) => f.index === file_index) || storedFiles[file_index];
    if (!storedFile) {
      throw new Error(`File index ${file_index} not found in plan ${plan_id}`);
    }

    return {
      files: [{
        filename: storedFile.filename || storedFile.path || `file-${file_index + 1}`,
        content_base64: storedFile.content_base64 || '',
        text: storedFile.extracted_text || storedFile.text || storedFile.content || '',
        code_content: storedFile.content || storedFile.extracted_text || '',
        file_path: storedFile.path || storedFile.filename || '',
        raw_url: storedFile.raw_url || storedFile.download_url || storedFile.url || '',
        semantic_map: storedFile.semantic_map,
      }],
      taskDescription: task_description || task.prompt,
    };
  }

  // ── Inline mode: files are in the request body ───────────────────────────────
  return { files, taskDescription: task_description };
}

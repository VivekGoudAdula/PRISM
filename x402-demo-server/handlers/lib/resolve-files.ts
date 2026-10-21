import { Task } from '../../models/Task';
import { decryptDocument } from '../../services/encryption';

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
export async function resolveFiles(
  body: any,
  requestingUserId?: string
): Promise<{
  files: ResolvedFile[];
  taskDescription: string;
}> {
  const { task_description = '', files = [], file_index, plan_id, all_files } = body;

  // ── Reference mode: look up stored file(s) by plan_id ─────────────────────
  if (plan_id) {
    const task = await Task.findById(plan_id);
    if (!task) {
      throw new Error(`Plan not found for file lookup: ${plan_id}`);
    }

    // Access control: if requesting user is provided, verify plan ownership
    if (requestingUserId && task.userId && task.userId.toString() !== requestingUserId) {
      throw new Error(`Unauthorized: You do not have permission to access files from plan ${plan_id}`);
    }

    const storedFiles: any[] = task.plannerOutput?.files || [];

    if (all_files || file_index === undefined || file_index === null || file_index < 0) {
      return {
        files: storedFiles.map((sf, idx) => ({
          filename: sf.filename || sf.path || `file-${idx + 1}`,
          content_base64: sf.content_base64 ? decryptDocument(sf.content_base64) : '',
          text: decryptDocument(sf.extracted_text || sf.text || sf.content || ''),
          code_content: decryptDocument(sf.content || sf.extracted_text || ''),
          file_path: sf.path || sf.filename || '',
          raw_url: sf.raw_url || sf.download_url || sf.url || '',
          semantic_map: sf.semantic_map,
        })),
        taskDescription: task_description || task.prompt,
      };
    }

    const storedFile = storedFiles.find((f: any) => f.index === file_index) || storedFiles[file_index];
    if (!storedFile) {
      throw new Error(`File index ${file_index} not found in plan ${plan_id}`);
    }

    return {
      files: [{
        filename: storedFile.filename || storedFile.path || `file-${file_index + 1}`,
        content_base64: storedFile.content_base64 ? decryptDocument(storedFile.content_base64) : '',
        text: decryptDocument(storedFile.extracted_text || storedFile.text || storedFile.content || ''),
        code_content: decryptDocument(storedFile.content || storedFile.extracted_text || ''),
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

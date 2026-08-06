import { Task } from '../../models/Task';

/** A resolved file ready for text extraction or semantic mapping. */
export interface ResolvedFile {
  filename: string;
  content_base64: string;
  text?: string;
  semantic_map?: any;
}

/**
 * Resolves file content and task description from a handler request body.
 *
 * Supports two modes:
 *
 *  1. **Inline mode** (old flow): `files[]` in the request body contains `content_base64`
 *     directly. Used for single-file calls or backward-compatible requests.
 *
 *  2. **Reference mode** (new flow): `file_index` + `plan_id` in the body reference a file
 *     that was stored server-side during `/plan-task`. The content is fetched from MongoDB.
 *     This keeps the x402 payment request payload tiny (< 100 bytes), so the middleware
 *     can verify the payment quickly and it registers correctly on the x402 leaderboard.
 *
 * @param body - Parsed request body from the Hono context
 * @returns Resolved list of files and the task description string
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
    const storedFile = storedFiles.find((f: any) => f.index === file_index);
    if (!storedFile) {
      throw new Error(`File index ${file_index} not found in plan ${plan_id}`);
    }

    return {
      files: [{
        filename: storedFile.filename,
        content_base64: storedFile.content_base64 || '',
      }],
      taskDescription: task_description || task.prompt,
    };
  }

  // ── Inline mode: files are in the request body ───────────────────────────────
  return { files, taskDescription: task_description };
}

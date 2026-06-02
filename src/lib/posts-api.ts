import { apiPatch } from '@/lib/api-client'

export async function updatePostNote(
  projectId: string,
  postId: string,
  manualNote: string | null,
): Promise<void> {
  await apiPatch(`/api/projects/${projectId}/posts/${postId}`, { manual_note: manualNote })
}

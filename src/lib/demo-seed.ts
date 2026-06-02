import { createDemoProject as createDemoProjectApi } from '@/lib/projects-api'

export async function createDemoProject(): Promise<string | null> {
  try {
    return await createDemoProjectApi()
  } catch (e) {
    console.error('[demo-seed]', e)
    return null
  }
}

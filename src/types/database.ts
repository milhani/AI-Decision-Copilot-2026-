export type HypothesisStatus =
  | 'draft'
  | 'testing'
  | 'confirmed'
  | 'rejected'
  | 'postponed'

export type AiMode = 'analyst' | 'coach' | 'chat'

export interface UserProfile {
  id: string
  onboarding_completed: boolean
  onboarding_track: 'analytics' | 'hypothesis' | null
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  user_id: string
  name: string
  description: string | null
  niche_tags: string[]
  channels: string[]
  optional_goal_text: string | null
  optional_kpi_list: string[] | null
  is_demo: boolean
  created_at: string
  updated_at: string
}

export interface Dataset {
  id: string
  project_id: string
  file_name: string
  imported_at: string
  row_count: number
}

export interface Post {
  id: string
  project_id: string
  published_at: string
  post_type: string
  caption_preview: string | null
  external_url: string | null
  manual_note: string | null
  created_at: string
}

export interface PostMetric {
  id: string
  post_id: string
  reach: number | null
  impressions: number | null
  er: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  clicks: number | null
  saves: number | null
  custom_fields: Record<string, unknown> | null
  recorded_at: string
}

export interface Hypothesis {
  id: string
  project_id: string
  title: string
  description: string | null
  status: HypothesisStatus
  kpi_name: string | null
  baseline_value: number | null
  target_value: number | null
  deadline: string | null
  tags: string[]
  linked_post_ids: string[]
  result_summary: string | null
  actual_value: number | null
  created_at: string
  closed_at: string | null
}

export interface AiChatSnapshot {
  aiContext: unknown
  coachStep?: number
}

export interface AiSession {
  id: string
  project_id: string
  mode: AiMode
  title: string | null
  messages: AiMessage[]
  context_snapshot: AiChatSnapshot | null
  created_at: string
  updated_at: string
}

export interface AiMessage {
  id?: string
  role: 'user' | 'assistant' | 'system'
  content: string
  evidence?: EvidenceBlock
  confidence?: 'низкая' | 'средняя' | 'высокая'
  timestamp?: string
  /** Ответ ещё генерируется */
  streaming?: boolean
  /** Текст до первого токена (вместо курсора) */
  pendingLabel?: string
}

export interface EvidenceBlock {
  items: { label: string; value: string }[]
}

export interface PostWithMetrics extends Post {
  post_metrics: PostMetric[]
}

export interface Database {
  public: {
    Tables: {
      user_profiles: { Row: UserProfile; Insert: Partial<UserProfile>; Update: Partial<UserProfile> }
      projects: { Row: Project; Insert: Partial<Project> & { name: string; user_id: string }; Update: Partial<Project> }
      datasets: { Row: Dataset; Insert: Partial<Dataset> & { project_id: string; file_name: string }; Update: Partial<Dataset> }
      posts: { Row: Post; Insert: Partial<Post> & { project_id: string; published_at: string }; Update: Partial<Post> }
      post_metrics: { Row: PostMetric; Insert: Partial<PostMetric> & { post_id: string }; Update: Partial<PostMetric> }
      hypotheses: { Row: Hypothesis; Insert: Partial<Hypothesis> & { project_id: string; title: string }; Update: Partial<Hypothesis> }
      ai_sessions: { Row: AiSession; Insert: Partial<AiSession> & { project_id: string; mode: AiMode }; Update: Partial<AiSession> }
    }
  }
}

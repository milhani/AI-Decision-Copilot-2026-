export interface Project {
  id: string
  user_id: string
  name: string
  description: string | null
  niche_tags: string[]
  channels: string[]
  optional_goal_text: string | null
  optional_kpi_list: unknown
  is_demo: boolean
  created_at: string
  updated_at: string
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
  custom_fields: unknown
  recorded_at: string
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
  post_metrics: PostMetric[]
}

export interface Hypothesis {
  id: string
  project_id: string
  title: string
  description: string | null
  status: string
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

export interface ProjectBundle {
  project: Project
  posts: Post[]
  hypotheses: Hypothesis[]
}

export interface UserProfile {
  id: string
  onboarding_completed: boolean
  onboarding_track: 'analytics' | 'hypothesis' | null
  created_at: string
  updated_at: string
}

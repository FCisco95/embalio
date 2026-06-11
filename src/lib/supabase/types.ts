export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          meta: Json
          profile_id: string
          ref_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          meta?: Json
          profile_id: string
          ref_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          meta?: Json
          profile_id?: string
          ref_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      algorithm_briefs: {
        Row: {
          brief: Json
          created_at: string
          id: string
          profile_id: string
          researched_at: string
        }
        Insert: {
          brief: Json
          created_at?: string
          id?: string
          profile_id: string
          researched_at?: string
        }
        Update: {
          brief?: Json
          created_at?: string
          id?: string
          profile_id?: string
          researched_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "algorithm_briefs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          author_handle: string
          id: string
          metrics_snapshot: Json
          profile_id: string
          pulled_at: string
          score_composite: number | null
          score_recency: number | null
          score_relevance: number | null
          score_velocity: number | null
          source_tweet_id: string
          status: string
          tweet_text: string
          tweet_url: string
        }
        Insert: {
          author_handle: string
          id?: string
          metrics_snapshot?: Json
          profile_id: string
          pulled_at?: string
          score_composite?: number | null
          score_recency?: number | null
          score_relevance?: number | null
          score_velocity?: number | null
          source_tweet_id: string
          status?: string
          tweet_text: string
          tweet_url: string
        }
        Update: {
          author_handle?: string
          id?: string
          metrics_snapshot?: Json
          profile_id?: string
          pulled_at?: string
          score_composite?: number | null
          score_recency?: number | null
          score_relevance?: number | null
          score_velocity?: number | null
          source_tweet_id?: string
          status?: string
          tweet_text?: string
          tweet_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidates_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      drafts: {
        Row: {
          body: string
          candidate_id: string | null
          created_at: string
          engagement_scenario: string | null
          id: string
          kind: string
          model_used: string | null
          profile_id: string
          status: string
          suggested_visual: string | null
        }
        Insert: {
          body: string
          candidate_id?: string | null
          created_at?: string
          engagement_scenario?: string | null
          id?: string
          kind: string
          model_used?: string | null
          profile_id: string
          status?: string
          suggested_visual?: string | null
        }
        Update: {
          body?: string
          candidate_id?: string | null
          created_at?: string
          engagement_scenario?: string | null
          id?: string
          kind?: string
          model_used?: string | null
          profile_id?: string
          status?: string
          suggested_visual?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drafts_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drafts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follower_snapshots: {
        Row: {
          annotation: string | null
          captured_at: string
          followers: number
          following: number | null
          id: string
          profile_id: string
          snapshot_date: string
          source: string
        }
        Insert: {
          annotation?: string | null
          captured_at?: string
          followers: number
          following?: number | null
          id?: string
          profile_id: string
          snapshot_date?: string
          source?: string
        }
        Update: {
          annotation?: string | null
          captured_at?: string
          followers?: number
          following?: number | null
          id?: string
          profile_id?: string
          snapshot_date?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "follower_snapshots_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posting_accounts: {
        Row: {
          active: boolean
          adspower_user_id: string
          created_at: string
          id: string
          profile_id: string
        }
        Insert: {
          active?: boolean
          adspower_user_id: string
          created_at?: string
          id?: string
          profile_id: string
        }
        Update: {
          active?: boolean
          adspower_user_id?: string
          created_at?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posting_accounts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posting_jobs: {
        Row: {
          attempts: number
          created_at: string
          draft_id: string | null
          error: string | null
          id: string
          method: string
          profile_id: string
          result_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          draft_id?: string | null
          error?: string | null
          id?: string
          method?: string
          profile_id: string
          result_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          draft_id?: string | null
          error?: string | null
          id?: string
          method?: string
          profile_id?: string
          result_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posting_jobs_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posting_jobs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          draft_id: string | null
          id: string
          last_scraped_at: string | null
          metrics: Json
          posted_at: string
          profile_id: string
          tweet_url: string | null
        }
        Insert: {
          draft_id?: string | null
          id?: string
          last_scraped_at?: string | null
          metrics?: Json
          posted_at?: string
          profile_id: string
          tweet_url?: string | null
        }
        Update: {
          draft_id?: string | null
          id?: string
          last_scraped_at?: string | null
          metrics?: Json
          posted_at?: string
          profile_id?: string
          tweet_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_size: string | null
          channel_playbook: Json | null
          content_pillars: string[]
          created_at: string
          daily_capacity: string | null
          display_name: string | null
          goals: string | null
          growth_plan: Json | null
          handle: string
          id: string
          niche_description: string | null
          north_star_metric: string | null
          onboarding_answers: Json
          premium_account: boolean
          reply_playbook: string | null
          retention: Json
          user_id: string | null
          voice_corpus: string[]
          voice_notes: string | null
          voice_spec: string | null
        }
        Insert: {
          account_size?: string | null
          channel_playbook?: Json | null
          content_pillars?: string[]
          created_at?: string
          daily_capacity?: string | null
          display_name?: string | null
          goals?: string | null
          growth_plan?: Json | null
          handle: string
          id?: string
          niche_description?: string | null
          north_star_metric?: string | null
          onboarding_answers?: Json
          premium_account?: boolean
          reply_playbook?: string | null
          retention?: Json
          user_id?: string | null
          voice_corpus?: string[]
          voice_notes?: string | null
          voice_spec?: string | null
        }
        Update: {
          account_size?: string | null
          channel_playbook?: Json | null
          content_pillars?: string[]
          created_at?: string
          daily_capacity?: string | null
          display_name?: string | null
          goals?: string | null
          growth_plan?: Json | null
          handle?: string
          id?: string
          niche_description?: string | null
          north_star_metric?: string | null
          onboarding_answers?: Json
          premium_account?: boolean
          reply_playbook?: string | null
          retention?: Json
          user_id?: string | null
          voice_corpus?: string[]
          voice_notes?: string | null
          voice_spec?: string | null
        }
        Relationships: []
      }
      recording_profiles: {
        Row: {
          capture_tool: string
          created_at: string
          device_label: string
          export_path: string | null
          id: string
          mic: string | null
          monitors: Json
          os: string
          profile_id: string
          scene_presets: Json
          sync_target: string | null
          teleprompter_placement: string
          webcam: string | null
        }
        Insert: {
          capture_tool: string
          created_at?: string
          device_label: string
          export_path?: string | null
          id?: string
          mic?: string | null
          monitors?: Json
          os: string
          profile_id: string
          scene_presets?: Json
          sync_target?: string | null
          teleprompter_placement?: string
          webcam?: string | null
        }
        Update: {
          capture_tool?: string
          created_at?: string
          device_label?: string
          export_path?: string | null
          id?: string
          mic?: string | null
          monitors?: Json
          os?: string
          profile_id?: string
          scene_presets?: Json
          sync_target?: string | null
          teleprompter_placement?: string
          webcam?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recording_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      research_briefings: {
        Row: {
          created_at: string
          date: string
          id: string
          profile_id: string
          raw_data: Json | null
          summary: string
          topics: Json
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          profile_id: string
          raw_data?: Json | null
          summary?: string
          topics?: Json
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          profile_id?: string
          raw_data?: Json | null
          summary?: string
          topics?: Json
        }
        Relationships: []
      }
      seed_targets: {
        Row: {
          active: boolean
          added_at: string
          handle: string | null
          id: string
          list_url: string | null
          note: string | null
          profile_id: string
        }
        Insert: {
          active?: boolean
          added_at?: string
          handle?: string | null
          id?: string
          list_url?: string | null
          note?: string | null
          profile_id: string
        }
        Update: {
          active?: boolean
          added_at?: string
          handle?: string | null
          id?: string
          list_url?: string | null
          note?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seed_targets_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      signal_tweets: {
        Row: {
          author_followers: number
          author_handle: string
          deleted_at: string | null
          first_seen_at: string
          id: string
          lang: string | null
          last_seen_at: string
          raw: Json | null
          source: string
          source_tweet_id: string
          text: string
          tweet_created_at: string | null
          url: string
        }
        Insert: {
          author_followers?: number
          author_handle: string
          deleted_at?: string | null
          first_seen_at?: string
          id?: string
          lang?: string | null
          last_seen_at?: string
          raw?: Json | null
          source: string
          source_tweet_id: string
          text?: string
          tweet_created_at?: string | null
          url?: string
        }
        Update: {
          author_followers?: number
          author_handle?: string
          deleted_at?: string | null
          first_seen_at?: string
          id?: string
          lang?: string | null
          last_seen_at?: string
          raw?: Json | null
          source?: string
          source_tweet_id?: string
          text?: string
          tweet_created_at?: string | null
          url?: string
        }
        Relationships: []
      }
      topic_history: {
        Row: {
          angle: string | null
          expires_at: string | null
          generated_at: string
          id: string
          profile_id: string
          score: number | null
          sources: Json
          status: string
          topic: string
          why: Json
        }
        Insert: {
          angle?: string | null
          expires_at?: string | null
          generated_at?: string
          id?: string
          profile_id: string
          score?: number | null
          sources?: Json
          status?: string
          topic: string
          why?: Json
        }
        Update: {
          angle?: string | null
          expires_at?: string | null
          generated_at?: string
          id?: string
          profile_id?: string
          score?: number | null
          sources?: Json
          status?: string
          topic?: string
          why?: Json
        }
        Relationships: [
          {
            foreignKeyName: "topic_history_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tweet_metric_snapshots: {
        Row: {
          bookmarks: number | null
          captured_at: string
          id: string
          likes: number
          replies: number
          reposts: number | null
          signal_tweet_id: string
          views: number
        }
        Insert: {
          bookmarks?: number | null
          captured_at?: string
          id?: string
          likes?: number
          replies?: number
          reposts?: number | null
          signal_tweet_id: string
          views?: number
        }
        Update: {
          bookmarks?: number | null
          captured_at?: string
          id?: string
          likes?: number
          replies?: number
          reposts?: number | null
          signal_tweet_id?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "tweet_metric_snapshots_signal_tweet_id_fkey"
            columns: ["signal_tweet_id"]
            isOneToOne: false
            referencedRelation: "signal_tweets"
            referencedColumns: ["id"]
          },
        ]
      }
      video_projects: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          publish: Json | null
          recording: Json | null
          script: Json | null
          stage: string
          topic: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          publish?: Json | null
          recording?: Json | null
          script?: Json | null
          stage?: string
          topic?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          publish?: Json | null
          recording?: Json | null
          script?: Json | null
          stage?: string
          topic?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_projects_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_credentials: {
        Row: {
          obtained_at: string
          profile_id: string
          refresh_token: string
          scope: string | null
        }
        Insert: {
          obtained_at?: string
          profile_id: string
          refresh_token: string
          scope?: string | null
        }
        Update: {
          obtained_at?: string
          profile_id?: string
          refresh_token?: string
          scope?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "youtube_credentials_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      save_persona: {
        Args: {
          p_content_pillars: string[]
          p_goals: string
          p_onboarding_answers: Json
          p_profile_id: string
          p_seed_handles: string[]
          p_voice_spec: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

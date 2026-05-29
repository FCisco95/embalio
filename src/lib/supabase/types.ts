export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
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
          tweet_url: string
        }
        Insert: {
          draft_id?: string | null
          id?: string
          last_scraped_at?: string | null
          metrics?: Json
          posted_at?: string
          profile_id: string
          tweet_url: string
        }
        Update: {
          draft_id?: string | null
          id?: string
          last_scraped_at?: string | null
          metrics?: Json
          posted_at?: string
          profile_id?: string
          tweet_url?: string
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
          content_pillars: string[]
          created_at: string
          display_name: string | null
          goals: string | null
          handle: string
          id: string
          niche_description: string | null
          onboarding_answers: Json
          user_id: string
          voice_corpus: string[]
          voice_notes: string | null
          voice_spec: string | null
        }
        Insert: {
          content_pillars?: string[]
          created_at?: string
          display_name?: string | null
          goals?: string | null
          handle: string
          id?: string
          niche_description?: string | null
          onboarding_answers?: Json
          user_id?: string
          voice_corpus?: string[]
          voice_notes?: string | null
          voice_spec?: string | null
        }
        Update: {
          content_pillars?: string[]
          created_at?: string
          display_name?: string | null
          goals?: string | null
          handle?: string
          id?: string
          niche_description?: string | null
          onboarding_answers?: Json
          user_id?: string
          voice_corpus?: string[]
          voice_notes?: string | null
          voice_spec?: string | null
        }
        Relationships: []
      }
      research_briefings: {
        Row: {
          id: string
          profile_id: string
          date: string
          summary: string
          topics: Json
          raw_data: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          date: string
          summary?: string
          topics?: Json
          raw_data?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          date?: string
          summary?: string
          topics?: Json
          raw_data?: Json | null
          created_at?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      save_persona: {
        Args: {
          p_profile_id: string
          p_voice_spec: string
          p_goals: string
          p_content_pillars: string[]
          p_onboarding_answers: Json
          p_seed_handles: string[]
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const


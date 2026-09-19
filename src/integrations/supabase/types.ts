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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          detail: string | null
          id: string
          node_id: string | null
          resolved_at: string | null
          rule: string
          severity: string
          started_at: string
          state: string
          summary: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          detail?: string | null
          id?: string
          node_id?: string | null
          resolved_at?: string | null
          rule: string
          severity?: string
          started_at?: string
          state?: string
          summary: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          detail?: string | null
          id?: string
          node_id?: string | null
          resolved_at?: string | null
          rule?: string
          severity?: string
          started_at?: string
          state?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_label: string | null
          details: Json
          id: number
          occurred_at: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_label?: string | null
          details?: Json
          id?: number
          occurred_at?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_label?: string | null
          details?: Json
          id?: number
          occurred_at?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      commands: {
        Row: {
          action: string
          args: Json
          attempt: number
          dispatched_at: string | null
          duration_ms: number | null
          error: string | null
          exit_code: number | null
          finished_at: string | null
          id: string
          idempotency_key: string
          node_id: string
          queued_at: string
          reason: string | null
          requested_by: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["command_status"]
          stderr: string | null
          stdout: string | null
          timeout_seconds: number
          updated_at: string
        }
        Insert: {
          action: string
          args?: Json
          attempt?: number
          dispatched_at?: string | null
          duration_ms?: number | null
          error?: string | null
          exit_code?: number | null
          finished_at?: string | null
          id?: string
          idempotency_key: string
          node_id: string
          queued_at?: string
          reason?: string | null
          requested_by?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["command_status"]
          stderr?: string | null
          stdout?: string | null
          timeout_seconds?: number
          updated_at?: string
        }
        Update: {
          action?: string
          args?: Json
          attempt?: number
          dispatched_at?: string | null
          duration_ms?: number | null
          error?: string | null
          exit_code?: number | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string
          node_id?: string
          queued_at?: string
          reason?: string | null
          requested_by?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["command_status"]
          stderr?: string | null
          stdout?: string | null
          timeout_seconds?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commands_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          environment: string
          expires_at: string
          group_id: string | null
          id: string
          label: string | null
          max_uses: number
          revoked_at: string | null
          token_hash: string
          token_prefix: string
          used_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          environment?: string
          expires_at?: string
          group_id?: string | null
          id?: string
          label?: string | null
          max_uses?: number
          revoked_at?: string | null
          token_hash: string
          token_prefix: string
          used_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          environment?: string
          expires_at?: string
          group_id?: string | null
          id?: string
          label?: string | null
          max_uses?: number
          revoked_at?: string | null
          token_hash?: string
          token_prefix?: string
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_tokens_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "node_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      heartbeats: {
        Row: {
          cpu_percent: number | null
          disk_percent: number | null
          disk_total_bytes: number | null
          disk_used_bytes: number | null
          id: number
          load1: number | null
          load15: number | null
          load5: number | null
          memory_percent: number | null
          memory_total_bytes: number | null
          memory_used_bytes: number | null
          net_rx_bytes: number | null
          net_tx_bytes: number | null
          node_id: string
          payload: Json
          received_at: string
          reported_health: string | null
          uptime_seconds: number | null
        }
        Insert: {
          cpu_percent?: number | null
          disk_percent?: number | null
          disk_total_bytes?: number | null
          disk_used_bytes?: number | null
          id?: number
          load1?: number | null
          load15?: number | null
          load5?: number | null
          memory_percent?: number | null
          memory_total_bytes?: number | null
          memory_used_bytes?: number | null
          net_rx_bytes?: number | null
          net_tx_bytes?: number | null
          node_id: string
          payload?: Json
          received_at?: string
          reported_health?: string | null
          uptime_seconds?: number | null
        }
        Update: {
          cpu_percent?: number | null
          disk_percent?: number | null
          disk_total_bytes?: number | null
          disk_used_bytes?: number | null
          id?: number
          load1?: number | null
          load15?: number | null
          load5?: number | null
          memory_percent?: number | null
          memory_total_bytes?: number | null
          memory_used_bytes?: number | null
          net_rx_bytes?: number | null
          net_tx_bytes?: number | null
          node_id?: string
          payload?: Json
          received_at?: string
          reported_health?: string | null
          uptime_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "heartbeats_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      node_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      node_secrets: {
        Row: {
          agent_key_hash: string
          node_id: string
          rotated_at: string
        }
        Insert: {
          agent_key_hash: string
          node_id: string
          rotated_at?: string
        }
        Update: {
          agent_key_hash?: string
          node_id?: string
          rotated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "node_secrets_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: true
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      nodes: {
        Row: {
          address: string | null
          agent_version: string | null
          architecture: string | null
          boot_time: string | null
          capabilities: Json
          display_name: string | null
          enabled: boolean
          environment: string
          fingerprint: string | null
          group_id: string | null
          heartbeat_interval_seconds: number
          hostname: string
          id: string
          is_simulated: boolean
          kernel: string | null
          labels: Json
          last_heartbeat_at: string | null
          last_metrics_at: string | null
          node_exporter_port: number
          os: string | null
          os_version: string | null
          protocol_version: string | null
          registered_at: string
          status: Database["public"]["Enums"]["node_status"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          agent_version?: string | null
          architecture?: string | null
          boot_time?: string | null
          capabilities?: Json
          display_name?: string | null
          enabled?: boolean
          environment?: string
          fingerprint?: string | null
          group_id?: string | null
          heartbeat_interval_seconds?: number
          hostname: string
          id?: string
          is_simulated?: boolean
          kernel?: string | null
          labels?: Json
          last_heartbeat_at?: string | null
          last_metrics_at?: string | null
          node_exporter_port?: number
          os?: string | null
          os_version?: string | null
          protocol_version?: string | null
          registered_at?: string
          status?: Database["public"]["Enums"]["node_status"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          agent_version?: string | null
          architecture?: string | null
          boot_time?: string | null
          capabilities?: Json
          display_name?: string | null
          enabled?: boolean
          environment?: string
          fingerprint?: string | null
          group_id?: string | null
          heartbeat_interval_seconds?: number
          hostname?: string
          id?: string
          is_simulated?: boolean
          kernel?: string | null
          labels?: Json
          last_heartbeat_at?: string | null
          last_metrics_at?: string | null
          node_exporter_port?: number
          os?: string | null
          os_version?: string | null
          protocol_version?: string | null
          registered_at?: string
          status?: Database["public"]["Enums"]["node_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nodes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "node_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_operate: { Args: { _user_id: string }; Returns: boolean }
      evaluate_node_availability: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "operator" | "viewer"
      command_status:
        | "queued"
        | "dispatched"
        | "running"
        | "succeeded"
        | "failed"
        | "timed_out"
        | "cancelled"
        | "rejected"
      node_status:
        | "enrolling"
        | "online"
        | "degraded"
        | "offline"
        | "recovering"
        | "unknown"
        | "disabled"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "operator", "viewer"],
      command_status: [
        "queued",
        "dispatched",
        "running",
        "succeeded",
        "failed",
        "timed_out",
        "cancelled",
        "rejected",
      ],
      node_status: [
        "enrolling",
        "online",
        "degraded",
        "offline",
        "recovering",
        "unknown",
        "disabled",
      ],
    },
  },
} as const

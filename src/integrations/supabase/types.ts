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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      canais: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      ciclos: {
        Row: {
          created_at: string
          data_fim: string
          data_inicio: string
          id: string
          meta_contratos: number
          meta_vgl: number
          nome: string
          status: string
        }
        Insert: {
          created_at?: string
          data_fim: string
          data_inicio: string
          id?: string
          meta_contratos?: number
          meta_vgl?: number
          nome: string
          status?: string
        }
        Update: {
          created_at?: string
          data_fim?: string
          data_inicio?: string
          id?: string
          meta_contratos?: number
          meta_vgl?: number
          nome?: string
          status?: string
        }
        Relationships: []
      }
      consultores: {
        Row: {
          ativo: boolean
          created_at: string
          equipe_id: string | null
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          equipe_id?: string | null
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          equipe_id?: string | null
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultores_equipe_id_fkey"
            columns: ["equipe_id"]
            isOneToOne: false
            referencedRelation: "equipes"
            referencedColumns: ["id"]
          },
        ]
      }
      equipes: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      jornada_eventos: {
        Row: {
          created_at: string
          detalhes: Json
          etapa_anterior: string | null
          etapa_nova: string | null
          id: string
          jornada_id: string
          justificativa: string | null
          tipo: string
        }
        Insert: {
          created_at?: string
          detalhes?: Json
          etapa_anterior?: string | null
          etapa_nova?: string | null
          id?: string
          jornada_id: string
          justificativa?: string | null
          tipo: string
        }
        Update: {
          created_at?: string
          detalhes?: Json
          etapa_anterior?: string | null
          etapa_nova?: string | null
          id?: string
          jornada_id?: string
          justificativa?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "jornada_eventos_jornada_id_fkey"
            columns: ["jornada_id"]
            isOneToOne: false
            referencedRelation: "jornadas"
            referencedColumns: ["id"]
          },
        ]
      }
      jornadas: {
        Row: {
          canal_id: string
          cliente_nome: string
          consultor_id: string
          cpf: string
          created_at: string
          data_assinatura: string | null
          data_entrada_crm: string
          data_envio_contrato: string | null
          data_fechamento: string | null
          data_primeiro_contato: string
          data_proposta: string
          data_visita: string
          descricao_perda: string | null
          etapa: string
          id: string
          imovel: string
          justificativa_nova_jornada: string | null
          motivo_perda_id: string | null
          percentual_intermediacao: number
          telefone: string
          updated_at: string
          valor_atualizado: number | null
          valor_final: number | null
          valor_original: number
          valor_proposta: number
        }
        Insert: {
          canal_id: string
          cliente_nome: string
          consultor_id: string
          cpf: string
          created_at?: string
          data_assinatura?: string | null
          data_entrada_crm: string
          data_envio_contrato?: string | null
          data_fechamento?: string | null
          data_primeiro_contato: string
          data_proposta: string
          data_visita: string
          descricao_perda?: string | null
          etapa?: string
          id?: string
          imovel: string
          justificativa_nova_jornada?: string | null
          motivo_perda_id?: string | null
          percentual_intermediacao: number
          telefone: string
          updated_at?: string
          valor_atualizado?: number | null
          valor_final?: number | null
          valor_original: number
          valor_proposta: number
        }
        Update: {
          canal_id?: string
          cliente_nome?: string
          consultor_id?: string
          cpf?: string
          created_at?: string
          data_assinatura?: string | null
          data_entrada_crm?: string
          data_envio_contrato?: string | null
          data_fechamento?: string | null
          data_primeiro_contato?: string
          data_proposta?: string
          data_visita?: string
          descricao_perda?: string | null
          etapa?: string
          id?: string
          imovel?: string
          justificativa_nova_jornada?: string | null
          motivo_perda_id?: string | null
          percentual_intermediacao?: number
          telefone?: string
          updated_at?: string
          valor_atualizado?: number | null
          valor_final?: number | null
          valor_original?: number
          valor_proposta?: number
        }
        Relationships: [
          {
            foreignKeyName: "jornadas_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jornadas_consultor_id_fkey"
            columns: ["consultor_id"]
            isOneToOne: false
            referencedRelation: "consultores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jornadas_motivo_perda_id_fkey"
            columns: ["motivo_perda_id"]
            isOneToOne: false
            referencedRelation: "motivos_perda"
            referencedColumns: ["id"]
          },
        ]
      }
      motivos_perda: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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

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
      ej_directory: {
        Row: {
          created_at: string
          id: string
          name: string
          region: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          region: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          region?: string
          slug?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          address: string | null
          cancellation_policy: string | null
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string
          id: string
          is_published: boolean
          location_name: string | null
          max_tickets_per_user: number
          organizer: string
          starts_at: string
          title: string
          transfer_deadline: string | null
        }
        Insert: {
          address?: string | null
          cancellation_policy?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at: string
          id?: string
          is_published?: boolean
          location_name?: string | null
          max_tickets_per_user?: number
          organizer: string
          starts_at: string
          title: string
          transfer_deadline?: string | null
        }
        Update: {
          address?: string | null
          cancellation_policy?: string | null
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string
          id?: string
          is_published?: boolean
          location_name?: string | null
          max_tickets_per_user?: number
          organizer?: string
          starts_at?: string
          title?: string
          transfer_deadline?: string | null
        }
        Relationships: []
      }
      order_participants: {
        Row: {
          address_district: string | null
          address_number: string | null
          address_street: string | null
          address_zip: string | null
          birth_date: string | null
          course_name: string | null
          cpf: string | null
          created_at: string
          ej_owner_id: string | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          full_name: string
          id: string
          order_id: string
          phone: string | null
          rg: string | null
          rg_issuer: string | null
          transferred_at: string | null
          transferred_from_ej_id: string | null
          university_id: string | null
          wants_caravan: boolean
        }
        Insert: {
          address_district?: string | null
          address_number?: string | null
          address_street?: string | null
          address_zip?: string | null
          birth_date?: string | null
          course_name?: string | null
          cpf?: string | null
          created_at?: string
          ej_owner_id?: string | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name: string
          id?: string
          order_id: string
          phone?: string | null
          rg?: string | null
          rg_issuer?: string | null
          transferred_at?: string | null
          transferred_from_ej_id?: string | null
          university_id?: string | null
          wants_caravan?: boolean
        }
        Update: {
          address_district?: string | null
          address_number?: string | null
          address_street?: string | null
          address_zip?: string | null
          birth_date?: string | null
          course_name?: string | null
          cpf?: string | null
          created_at?: string
          ej_owner_id?: string | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string
          id?: string
          order_id?: string
          phone?: string | null
          rg?: string | null
          rg_issuer?: string | null
          transferred_at?: string | null
          transferred_from_ej_id?: string | null
          university_id?: string | null
          wants_caravan?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "order_participants_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          billing_city: string | null
          billing_complement: string | null
          billing_district: string | null
          billing_doc: string | null
          billing_doc_type: string | null
          billing_number: string | null
          billing_phone: string | null
          billing_state: string | null
          billing_street: string | null
          billing_zip: string | null
          created_at: string
          event_id: string
          id: string
          lot_id: string
          paddle_transaction_id: string | null
          paid_at: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          quantity: number
          reserved_until: string
          status: Database["public"]["Enums"]["order_status"]
          total_cents: number
          user_id: string
        }
        Insert: {
          billing_city?: string | null
          billing_complement?: string | null
          billing_district?: string | null
          billing_doc?: string | null
          billing_doc_type?: string | null
          billing_number?: string | null
          billing_phone?: string | null
          billing_state?: string | null
          billing_street?: string | null
          billing_zip?: string | null
          created_at?: string
          event_id: string
          id?: string
          lot_id: string
          paddle_transaction_id?: string | null
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          quantity: number
          reserved_until: string
          status?: Database["public"]["Enums"]["order_status"]
          total_cents: number
          user_id: string
        }
        Update: {
          billing_city?: string | null
          billing_complement?: string | null
          billing_district?: string | null
          billing_doc?: string | null
          billing_doc_type?: string | null
          billing_number?: string | null
          billing_phone?: string | null
          billing_state?: string | null
          billing_street?: string | null
          billing_zip?: string | null
          created_at?: string
          event_id?: string
          id?: string
          lot_id?: string
          paddle_transaction_id?: string | null
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          quantity?: number
          reserved_until?: string
          status?: Database["public"]["Enums"]["order_status"]
          total_cents?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "ticket_lots"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          ej_name: string | null
          ej_slug: string | null
          email: string | null
          full_name: string | null
          id: string
          region: string | null
        }
        Insert: {
          created_at?: string
          ej_name?: string | null
          ej_slug?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          region?: string | null
        }
        Update: {
          created_at?: string
          ej_name?: string | null
          ej_slug?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          region?: string | null
        }
        Relationships: []
      }
      ticket_lots: {
        Row: {
          closes_at: string
          created_at: string
          event_id: string
          id: string
          name: string
          opens_at: string
          price_cents: number
          reserved_quantity: number
          sold_quantity: number
          sort_order: number
          total_quantity: number
        }
        Insert: {
          closes_at: string
          created_at?: string
          event_id: string
          id?: string
          name: string
          opens_at: string
          price_cents: number
          reserved_quantity?: number
          sold_quantity?: number
          sort_order?: number
          total_quantity: number
        }
        Update: {
          closes_at?: string
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          opens_at?: string
          price_cents?: number
          reserved_quantity?: number
          sold_quantity?: number
          sort_order?: number
          total_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "ticket_lots_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      confirm_payment: {
        Args: {
          _method: Database["public"]["Enums"]["payment_method"]
          _order_id: string
        }
        Returns: undefined
      }
      confirm_payment_by_admin: {
        Args: {
          _method: Database["public"]["Enums"]["payment_method"]
          _order_id: string
          _paddle_tx: string
        }
        Returns: undefined
      }
      create_reservation: {
        Args: { _lot_id: string; _quantity: number }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      transfer_participant: {
        Args: { _participant_id: string; _target_email: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user"
      order_status: "pending" | "paid" | "expired" | "cancelled"
      payment_method: "pix" | "credit_card"
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
    Enums: {
      app_role: ["admin", "user"],
      order_status: ["pending", "paid", "expired", "cancelled"],
      payment_method: ["pix", "credit_card"],
    },
  },
} as const

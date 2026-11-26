export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string;
          actor_id: string | null;
          agency_id: string;
          created_at: string;
          details: NonNullable<Json>;
          entity: string;
          entity_id: string | null;
          id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          agency_id: string;
          created_at?: string;
          details?: NonNullable<Json>;
          entity: string;
          entity_id?: string | null;
          id?: string;
          updated_at?: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          agency_id?: string;
          created_at?: string;
          details?: NonNullable<Json>;
          entity?: string;
          entity_id?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_log_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
        ];
      };
      agencies: {
        Row: {
          address: string | null;
          ai_enabled: boolean;
          alert_days_before: number;
          alert_km_before: number;
          alert_roles: string[];
          alerts_sent_on: string | null;
          brand_color: string | null;
          city: string | null;
          cnss: string | null;
          contract_number_prefix: string;
          contract_terms: string | null;
          created_at: string;
          current_period_end: string | null;
          default_deposit: number;
          default_franchise: number;
          default_language: string;
          document_items: string[];
          email: string | null;
          equipment_items: string[];
          ice: string | null;
          id: string;
          if_number: string | null;
          inspection_enabled: boolean;
          inspection_mode: string;
          logo_path: string | null;
          min_driver_age: number;
          min_license_years: number;
          name: string;
          next_contract_number: number;
          patente: string | null;
          phone: string | null;
          plan_id: string | null;
          public_booking_enabled: boolean;
          public_booking_message: string | null;
          rc: string | null;
          slug: string;
          subscription_status: string;
          trial_ends_at: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          address?: string | null;
          ai_enabled?: boolean;
          alert_days_before?: number;
          alert_km_before?: number;
          alert_roles?: string[];
          alerts_sent_on?: string | null;
          brand_color?: string | null;
          city?: string | null;
          cnss?: string | null;
          contract_number_prefix?: string;
          contract_terms?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          default_deposit?: number;
          default_franchise?: number;
          default_language?: string;
          document_items?: string[];
          email?: string | null;
          equipment_items?: string[];
          ice?: string | null;
          id?: string;
          if_number?: string | null;
          inspection_enabled?: boolean;
          inspection_mode?: string;
          logo_path?: string | null;
          min_driver_age?: number;
          min_license_years?: number;
          name: string;
          next_contract_number?: number;
          patente?: string | null;
          phone?: string | null;
          plan_id?: string | null;
          public_booking_enabled?: boolean;
          public_booking_message?: string | null;
          rc?: string | null;
          slug: string;
          subscription_status?: string;
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          ai_enabled?: boolean;
          alert_days_before?: number;
          alert_km_before?: number;
          alert_roles?: string[];
          alerts_sent_on?: string | null;
          brand_color?: string | null;
          city?: string | null;
          cnss?: string | null;
          contract_number_prefix?: string;
          contract_terms?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          default_deposit?: number;
          default_franchise?: number;
          default_language?: string;
          document_items?: string[];
          email?: string | null;
          equipment_items?: string[];
          ice?: string | null;
          id?: string;
          if_number?: string | null;
          inspection_enabled?: boolean;
          inspection_mode?: string;
          logo_path?: string | null;
          min_driver_age?: number;
          min_license_years?: number;
          name?: string;
          next_contract_number?: number;
          patente?: string | null;
          phone?: string | null;
          plan_id?: string | null;
          public_booking_enabled?: boolean;
          public_booking_message?: string | null;
          rc?: string | null;
          slug?: string;
          subscription_status?: string;
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agencies_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
      agency_members: {
        Row: {
          agency_id: string;
          created_at: string;
          id: string;
          invited_by: string | null;
          role: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          agency_id: string;
          created_at?: string;
          id?: string;
          invited_by?: string | null;
          role: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          agency_id?: string;
          created_at?: string;
          id?: string;
          invited_by?: string | null;
          role?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agency_members_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agency_members_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agency_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_chunks: {
        Row: {
          agency_id: string;
          content: string;
          created_at: string;
          document_id: string;
          embedding: string | null;
          fts: unknown;
          id: string;
          metadata: NonNullable<Json>;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          agency_id: string;
          content: string;
          created_at?: string;
          document_id: string;
          embedding?: string | null;
          fts?: never;
          id?: string;
          metadata?: NonNullable<Json>;
          updated_at?: string;
        };
        Update: {
          agency_id?: string;
          content?: string;
          created_at?: string;
          document_id?: string;
          embedding?: string | null;
          fts?: never;
          id?: string;
          metadata?: NonNullable<Json>;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_chunks_agency_id_document_id_fkey";
            columns: ["agency_id", "document_id"];
            isOneToOne: false;
            referencedRelation: "ai_documents";
            referencedColumns: ["agency_id", "id"];
          },
          {
            foreignKeyName: "ai_chunks_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_documents: {
        Row: {
          agency_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          source: string;
          storage_path: string | null;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          agency_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          source?: string;
          storage_path?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          agency_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          source?: string;
          storage_path?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_documents_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_documents_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      booking_requests: {
        Row: {
          agency_id: string;
          created_at: string;
          delivery_place: string | null;
          email: string | null;
          end_date: string;
          full_name: string;
          handled_by: string | null;
          id: string;
          ip_hash: string | null;
          message: string | null;
          phone: string;
          start_date: string;
          status: string;
          updated_at: string;
          vehicle_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          agency_id: string;
          created_at?: string;
          delivery_place?: string | null;
          email?: string | null;
          end_date: string;
          full_name: string;
          handled_by?: string | null;
          id?: string;
          ip_hash?: string | null;
          message?: string | null;
          phone: string;
          start_date: string;
          status?: string;
          updated_at?: string;
          vehicle_id?: string | null;
        };
        Update: {
          agency_id?: string;
          created_at?: string;
          delivery_place?: string | null;
          email?: string | null;
          end_date?: string;
          full_name?: string;
          handled_by?: string | null;
          id?: string;
          ip_hash?: string | null;
          message?: string | null;
          phone?: string;
          start_date?: string;
          status?: string;
          updated_at?: string;
          vehicle_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "booking_requests_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "booking_requests_agency_id_vehicle_id_fkey";
            columns: ["agency_id", "vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["agency_id", "id"];
          },
          {
            foreignKeyName: "booking_requests_handled_by_fkey";
            columns: ["handled_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      charges: {
        Row: {
          agency_id: string;
          amount: number;
          campaign_name: string | null;
          category: string;
          created_at: string;
          created_by: string | null;
          date: string;
          id: string;
          is_recurring: boolean;
          note: string | null;
          receipt_path: string | null;
          recurring_parent_id: string | null;
          updated_at: string;
          vehicle_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          agency_id: string;
          amount: number;
          campaign_name?: string | null;
          category: string;
          created_at?: string;
          created_by?: string | null;
          date?: string;
          id?: string;
          is_recurring?: boolean;
          note?: string | null;
          receipt_path?: string | null;
          recurring_parent_id?: string | null;
          updated_at?: string;
          vehicle_id?: string | null;
        };
        Update: {
          agency_id?: string;
          amount?: number;
          campaign_name?: string | null;
          category?: string;
          created_at?: string;
          created_by?: string | null;
          date?: string;
          id?: string;
          is_recurring?: boolean;
          note?: string | null;
          receipt_path?: string | null;
          recurring_parent_id?: string | null;
          updated_at?: string;
          vehicle_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "charges_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "charges_agency_id_vehicle_id_fkey";
            columns: ["agency_id", "vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["agency_id", "id"];
          },
          {
            foreignKeyName: "charges_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "charges_recurring_parent_id_fkey";
            columns: ["recurring_parent_id"];
            isOneToOne: false;
            referencedRelation: "charges";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: {
          address: string | null;
          agency_id: string;
          anonymized_at: string | null;
          birth_date: string | null;
          birth_place: string | null;
          created_at: string;
          email: string | null;
          full_name: string;
          id: string;
          id_expires_on: string | null;
          id_issued_on: string | null;
          id_issued_place: string | null;
          id_number: string;
          id_number_norm: string | null;
          id_type: string;
          license_issued_on: string | null;
          license_issued_place: string | null;
          license_number: string | null;
          nationality: string | null;
          notes: string | null;
          phone: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          address?: string | null;
          agency_id: string;
          anonymized_at?: string | null;
          birth_date?: string | null;
          birth_place?: string | null;
          created_at?: string;
          email?: string | null;
          full_name: string;
          id?: string;
          id_expires_on?: string | null;
          id_issued_on?: string | null;
          id_issued_place?: string | null;
          id_number: string;
          id_number_norm?: never;
          id_type: string;
          license_issued_on?: string | null;
          license_issued_place?: string | null;
          license_number?: string | null;
          nationality?: string | null;
          notes?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          agency_id?: string;
          anonymized_at?: string | null;
          birth_date?: string | null;
          birth_place?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id?: string;
          id_expires_on?: string | null;
          id_issued_on?: string | null;
          id_issued_place?: string | null;
          id_number?: string;
          id_number_norm?: never;
          id_type?: string;
          license_issued_on?: string | null;
          license_issued_place?: string | null;
          license_number?: string | null;
          nationality?: string | null;
          notes?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clients_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
        ];
      };
      inspection_damages: {
        Row: {
          agency_id: string;
          confirmed: boolean;
          created_at: string;
          created_by: string | null;
          id: string;
          inspection_id: string;
          note: string | null;
          source: string;
          type: string;
          updated_at: string;
          view: string | null;
          x: number;
          y: number;
        };
        ComputedFields: never;
        Insert: {
          agency_id: string;
          confirmed?: boolean;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          inspection_id: string;
          note?: string | null;
          source?: string;
          type: string;
          updated_at?: string;
          view?: string | null;
          x: number;
          y: number;
        };
        Update: {
          agency_id?: string;
          confirmed?: boolean;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          inspection_id?: string;
          note?: string | null;
          source?: string;
          type?: string;
          updated_at?: string;
          view?: string | null;
          x?: number;
          y?: number;
        };
        Relationships: [
          {
            foreignKeyName: "inspection_damages_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspection_damages_agency_id_inspection_id_fkey";
            columns: ["agency_id", "inspection_id"];
            isOneToOne: false;
            referencedRelation: "inspections";
            referencedColumns: ["agency_id", "id"];
          },
          {
            foreignKeyName: "inspection_damages_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      inspection_photos: {
        Row: {
          agency_id: string;
          created_at: string;
          id: string;
          inspection_id: string;
          storage_path: string;
          updated_at: string;
          view: string;
        };
        ComputedFields: never;
        Insert: {
          agency_id: string;
          created_at?: string;
          id?: string;
          inspection_id: string;
          storage_path: string;
          updated_at?: string;
          view: string;
        };
        Update: {
          agency_id?: string;
          created_at?: string;
          id?: string;
          inspection_id?: string;
          storage_path?: string;
          updated_at?: string;
          view?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inspection_photos_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspection_photos_agency_id_inspection_id_fkey";
            columns: ["agency_id", "inspection_id"];
            isOneToOne: false;
            referencedRelation: "inspections";
            referencedColumns: ["agency_id", "id"];
          },
        ];
      };
      inspections: {
        Row: {
          agency_id: string;
          ai_checked_at: string | null;
          ai_status: string;
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          kind: string;
          mode: string;
          notes: string | null;
          reservation_id: string;
          updated_at: string;
          video_path: string | null;
        };
        ComputedFields: never;
        Insert: {
          agency_id: string;
          ai_checked_at?: string | null;
          ai_status?: string;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind: string;
          mode?: string;
          notes?: string | null;
          reservation_id: string;
          updated_at?: string;
          video_path?: string | null;
        };
        Update: {
          agency_id?: string;
          ai_checked_at?: string | null;
          ai_status?: string;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind?: string;
          mode?: string;
          notes?: string | null;
          reservation_id?: string;
          updated_at?: string;
          video_path?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inspections_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inspections_agency_id_reservation_id_fkey";
            columns: ["agency_id", "reservation_id"];
            isOneToOne: false;
            referencedRelation: "reservation_totals";
            referencedColumns: ["agency_id", "id"];
          },
          {
            foreignKeyName: "inspections_agency_id_reservation_id_fkey";
            columns: ["agency_id", "reservation_id"];
            isOneToOne: false;
            referencedRelation: "reservations";
            referencedColumns: ["agency_id", "id"];
          },
          {
            foreignKeyName: "inspections_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      invitations: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          agency_id: string;
          created_at: string;
          email: string | null;
          expires_at: string;
          id: string;
          invited_by: string | null;
          phone: string | null;
          role: string;
          token_hash: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          agency_id: string;
          created_at?: string;
          email?: string | null;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          phone?: string | null;
          role: string;
          token_hash: string;
          updated_at?: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          agency_id?: string;
          created_at?: string;
          email?: string | null;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          phone?: string | null;
          role?: string;
          token_hash?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invitations_accepted_by_fkey";
            columns: ["accepted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invitations_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invitations_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      maintenance_periods: {
        Row: {
          agency_id: string;
          created_at: string;
          created_by: string | null;
          ended_on: string | null;
          expected_end_on: string | null;
          id: string;
          note: string | null;
          reason: string;
          starts_on: string;
          updated_at: string;
          vehicle_id: string;
        };
        ComputedFields: never;
        Insert: {
          agency_id: string;
          created_at?: string;
          created_by?: string | null;
          ended_on?: string | null;
          expected_end_on?: string | null;
          id?: string;
          note?: string | null;
          reason: string;
          starts_on?: string;
          updated_at?: string;
          vehicle_id: string;
        };
        Update: {
          agency_id?: string;
          created_at?: string;
          created_by?: string | null;
          ended_on?: string | null;
          expected_end_on?: string | null;
          id?: string;
          note?: string | null;
          reason?: string;
          starts_on?: string;
          updated_at?: string;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "maintenance_periods_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "maintenance_periods_agency_id_vehicle_id_fkey";
            columns: ["agency_id", "vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["agency_id", "id"];
          },
          {
            foreignKeyName: "maintenance_periods_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      oil_changes: {
        Row: {
          agency_id: string;
          created_at: string;
          created_by: string | null;
          date: string;
          id: string;
          items: string[];
          km: number;
          next_km: number | null;
          note: string | null;
          updated_at: string;
          vehicle_id: string;
        };
        ComputedFields: never;
        Insert: {
          agency_id: string;
          created_at?: string;
          created_by?: string | null;
          date?: string;
          id?: string;
          items?: string[];
          km: number;
          next_km?: number | null;
          note?: string | null;
          updated_at?: string;
          vehicle_id: string;
        };
        Update: {
          agency_id?: string;
          created_at?: string;
          created_by?: string | null;
          date?: string;
          id?: string;
          items?: string[];
          km?: number;
          next_km?: number | null;
          note?: string | null;
          updated_at?: string;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "oil_changes_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "oil_changes_agency_id_vehicle_id_fkey";
            columns: ["agency_id", "vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["agency_id", "id"];
          },
          {
            foreignKeyName: "oil_changes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      plans: {
        Row: {
          active: boolean;
          ai_enabled: boolean;
          ai_monthly_questions: number | null;
          code: string;
          created_at: string;
          id: string;
          max_users: number | null;
          max_vehicles: number | null;
          name: string;
          price_mad_month: number;
          price_mad_year: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          ai_enabled?: boolean;
          ai_monthly_questions?: number | null;
          code: string;
          created_at?: string;
          id?: string;
          max_users?: number | null;
          max_vehicles?: number | null;
          name: string;
          price_mad_month?: number;
          price_mad_year?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          ai_enabled?: boolean;
          ai_monthly_questions?: number | null;
          code?: string;
          created_at?: string;
          id?: string;
          max_users?: number | null;
          max_vehicles?: number | null;
          name?: string;
          price_mad_month?: number;
          price_mad_year?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      platform_admins: {
        Row: {
          created_at: string;
          id: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_admins_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          phone: string | null;
          preferred_locale: string;
          preferred_theme: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          phone?: string | null;
          preferred_locale?: string;
          preferred_theme?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          phone?: string | null;
          preferred_locale?: string;
          preferred_theme?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rate_limits: {
        Row: {
          created_at: string;
          hits: number;
          key: string;
          updated_at: string;
          window_start: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          hits?: number;
          key: string;
          updated_at?: string;
          window_start?: string;
        };
        Update: {
          created_at?: string;
          hits?: number;
          key?: string;
          updated_at?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      reservation_payments: {
        Row: {
          agency_id: string;
          amount: number;
          created_at: string;
          created_by: string | null;
          id: string;
          kind: string;
          method: string;
          note: string | null;
          paid_at: string;
          reservation_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          agency_id: string;
          amount: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind: string;
          method: string;
          note?: string | null;
          paid_at?: string;
          reservation_id: string;
          updated_at?: string;
        };
        Update: {
          agency_id?: string;
          amount?: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind?: string;
          method?: string;
          note?: string | null;
          paid_at?: string;
          reservation_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reservation_payments_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reservation_payments_agency_id_reservation_id_fkey";
            columns: ["agency_id", "reservation_id"];
            isOneToOne: false;
            referencedRelation: "reservation_totals";
            referencedColumns: ["agency_id", "id"];
          },
          {
            foreignKeyName: "reservation_payments_agency_id_reservation_id_fkey";
            columns: ["agency_id", "reservation_id"];
            isOneToOne: false;
            referencedRelation: "reservations";
            referencedColumns: ["agency_id", "id"];
          },
          {
            foreignKeyName: "reservation_payments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      reservations: {
        Row: {
          actual_return_at: string | null;
          advance_paid: number;
          agency_id: string;
          cancel_reason: string | null;
          cancelled_at: string | null;
          client_id: string;
          contract_number: string;
          created_at: string;
          created_by: string | null;
          daily_price: number;
          damage_fee: number;
          damage_note: string | null;
          delivery: boolean;
          delivery_fee: number;
          delivery_place: string | null;
          deposit_amount: number;
          deposit_taken: boolean;
          documents_given: string[];
          end_at: string;
          equipment: string[];
          extended_days: number;
          franchise: number;
          fuel_in: number | null;
          fuel_out: number | null;
          id: string;
          km_in: number | null;
          km_out: number | null;
          notes: string | null;
          return_place: string | null;
          second_driver_id: string | null;
          signed_at: string | null;
          signed_by: string | null;
          start_at: string;
          status: string;
          updated_at: string;
          vehicle_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          actual_return_at?: string | null;
          advance_paid?: number;
          agency_id: string;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          client_id: string;
          contract_number?: string;
          created_at?: string;
          created_by?: string | null;
          daily_price: number;
          damage_fee?: number;
          damage_note?: string | null;
          delivery?: boolean;
          delivery_fee?: number;
          delivery_place?: string | null;
          deposit_amount?: number;
          deposit_taken?: boolean;
          documents_given?: string[];
          end_at: string;
          equipment?: string[];
          extended_days?: number;
          franchise?: number;
          fuel_in?: number | null;
          fuel_out?: number | null;
          id?: string;
          km_in?: number | null;
          km_out?: number | null;
          notes?: string | null;
          return_place?: string | null;
          second_driver_id?: string | null;
          signed_at?: string | null;
          signed_by?: string | null;
          start_at: string;
          status?: string;
          updated_at?: string;
          vehicle_id?: string | null;
        };
        Update: {
          actual_return_at?: string | null;
          advance_paid?: number;
          agency_id?: string;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          client_id?: string;
          contract_number?: string;
          created_at?: string;
          created_by?: string | null;
          daily_price?: number;
          damage_fee?: number;
          damage_note?: string | null;
          delivery?: boolean;
          delivery_fee?: number;
          delivery_place?: string | null;
          deposit_amount?: number;
          deposit_taken?: boolean;
          documents_given?: string[];
          end_at?: string;
          equipment?: string[];
          extended_days?: number;
          franchise?: number;
          fuel_in?: number | null;
          fuel_out?: number | null;
          id?: string;
          km_in?: number | null;
          km_out?: number | null;
          notes?: string | null;
          return_place?: string | null;
          second_driver_id?: string | null;
          signed_at?: string | null;
          signed_by?: string | null;
          start_at?: string;
          status?: string;
          updated_at?: string;
          vehicle_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "reservations_agency_id_client_id_fkey";
            columns: ["agency_id", "client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["agency_id", "id"];
          },
          {
            foreignKeyName: "reservations_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reservations_agency_id_second_driver_id_fkey";
            columns: ["agency_id", "second_driver_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["agency_id", "id"];
          },
          {
            foreignKeyName: "reservations_agency_id_vehicle_id_fkey";
            columns: ["agency_id", "vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["agency_id", "id"];
          },
          {
            foreignKeyName: "reservations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reservations_signed_by_fkey";
            columns: ["signed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      subscription_payments: {
        Row: {
          agency_id: string;
          amount: number;
          confirmed_by: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          invoice_number: string | null;
          method: string;
          paid_at: string | null;
          period: string;
          period_end: string | null;
          period_start: string | null;
          plan_id: string;
          provider: string;
          provider_ref: string | null;
          reference: string;
          status: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          agency_id: string;
          amount: number;
          confirmed_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          invoice_number?: string | null;
          method: string;
          paid_at?: string | null;
          period: string;
          period_end?: string | null;
          period_start?: string | null;
          plan_id: string;
          provider?: string;
          provider_ref?: string | null;
          reference: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          agency_id?: string;
          amount?: number;
          confirmed_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          invoice_number?: string | null;
          method?: string;
          paid_at?: string | null;
          period?: string;
          period_end?: string | null;
          period_start?: string | null;
          plan_id?: string;
          provider?: string;
          provider_ref?: string | null;
          reference?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscription_payments_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_payments_confirmed_by_fkey";
            columns: ["confirmed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_payments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_payments_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
      usage_alerts_sent: {
        Row: {
          level: number;
          metric: string;
          sent_on: string;
        };
        ComputedFields: never;
        Insert: {
          level: number;
          metric: string;
          sent_on?: string;
        };
        Update: {
          level?: number;
          metric?: string;
          sent_on?: string;
        };
        Relationships: [];
      };
      vehicle_finance: {
        Row: {
          agency_id: string;
          created_at: string;
          down_payment: number;
          first_payment_on: string | null;
          id: string;
          lender: string | null;
          mode: string;
          monthly_payment: number | null;
          months: number | null;
          purchase_date: string;
          purchase_price: number;
          updated_at: string;
          vehicle_id: string;
        };
        ComputedFields: never;
        Insert: {
          agency_id: string;
          created_at?: string;
          down_payment?: number;
          first_payment_on?: string | null;
          id?: string;
          lender?: string | null;
          mode: string;
          monthly_payment?: number | null;
          months?: number | null;
          purchase_date: string;
          purchase_price: number;
          updated_at?: string;
          vehicle_id: string;
        };
        Update: {
          agency_id?: string;
          created_at?: string;
          down_payment?: number;
          first_payment_on?: string | null;
          id?: string;
          lender?: string | null;
          mode?: string;
          monthly_payment?: number | null;
          months?: number | null;
          purchase_date?: string;
          purchase_price?: number;
          updated_at?: string;
          vehicle_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_finance_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vehicle_finance_agency_id_vehicle_id_fkey";
            columns: ["agency_id", "vehicle_id"];
            isOneToOne: true;
            referencedRelation: "vehicles";
            referencedColumns: ["agency_id", "id"];
          },
        ];
      };
      vehicles: {
        Row: {
          agency_id: string;
          brand_model: string;
          category: string;
          created_at: string;
          current_km: number;
          daily_rate: number;
          first_registration_date: string | null;
          fuel: string;
          gearbox: string;
          id: string;
          insurance_expires_on: string | null;
          insurer: string | null;
          notes: string | null;
          oil_last_date: string | null;
          oil_last_km: number | null;
          oil_next_km: number | null;
          plate: string;
          plate_norm: string | null;
          policy_number: string | null;
          status: string;
          technical_visit_expires_on: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          agency_id: string;
          brand_model: string;
          category: string;
          created_at?: string;
          current_km?: number;
          daily_rate: number;
          first_registration_date?: string | null;
          fuel: string;
          gearbox: string;
          id?: string;
          insurance_expires_on?: string | null;
          insurer?: string | null;
          notes?: string | null;
          oil_last_date?: string | null;
          oil_last_km?: number | null;
          oil_next_km?: number | null;
          plate: string;
          plate_norm?: never;
          policy_number?: string | null;
          status?: string;
          technical_visit_expires_on?: string | null;
          updated_at?: string;
        };
        Update: {
          agency_id?: string;
          brand_model?: string;
          category?: string;
          created_at?: string;
          current_km?: number;
          daily_rate?: number;
          first_registration_date?: string | null;
          fuel?: string;
          gearbox?: string;
          id?: string;
          insurance_expires_on?: string | null;
          insurer?: string | null;
          notes?: string | null;
          oil_last_date?: string | null;
          oil_last_km?: number | null;
          oil_next_km?: number | null;
          plate?: string;
          plate_norm?: never;
          policy_number?: string | null;
          status?: string;
          technical_visit_expires_on?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vehicles_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      reservation_totals: {
        Row: {
          agency_id: string;
          balance: number | null;
          damage_fee: number;
          days: number | null;
          id: string;
          paid: number | null;
          planned_days: number | null;
          total: number | null;
        };
        ComputedFields: never;
        Insert: {
          agency_id?: string | null;
          balance?: never;
          damage_fee?: number | null;
          days?: never;
          id?: string | null;
          paid?: never;
          planned_days?: never;
          total?: never;
        };
        Update: {
          agency_id?: string | null;
          balance?: never;
          damage_fee?: number | null;
          days?: never;
          id?: string | null;
          paid?: never;
          planned_days?: never;
          total?: never;
        };
        Relationships: [
          {
            foreignKeyName: "reservations_agency_id_fkey";
            columns: ["agency_id"];
            isOneToOne: false;
            referencedRelation: "agencies";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      _anonymize_client_row: { Args: { p_client: string }; Returns: undefined };
      _assert_admin: { Args: { p_agency: string }; Returns: undefined };
      _assert_platform_admin: { Args: Record<PropertyKey, never>; Returns: undefined };
      _create_agency: {
        Args: {
          p_brand_color?: string;
          p_city?: string;
          p_name: string;
          p_phone?: string;
          p_slug: string;
          p_user: string;
        };
        Returns: string;
      };
      _next_contract_number: { Args: { p_agency: string }; Returns: string };
      _upsert_client: { Args: { p: Json; p_agency: string }; Returns: string };
      accept_invitation: { Args: { p_token: string }; Returns: string };
      ai_quota: {
        Args: { p_agency: string };
        Returns: {
          enabled: boolean;
          plan_allows: boolean;
          quota: number;
          used: number;
        }[];
      };
      anonymize_client: { Args: { p_agency: string; p_client: string }; Returns: undefined };
      anonymize_old_clients: { Args: { p_agency: string; p_years: number }; Returns: number };
      assign_vehicle: {
        Args: {
          p_agency: string;
          p_daily_price?: number;
          p_reservation: string;
          p_vehicle: string;
        };
        Returns: undefined;
      };
      confirm_subscription_payment: {
        Args: { p_payment: string; p_provider_ref?: string };
        Returns: string;
      };
      create_agency: {
        Args: {
          p_brand_color?: string;
          p_city?: string;
          p_name: string;
          p_phone?: string;
          p_slug: string;
        };
        Returns: string;
      };
      create_agency_for_user: {
        Args: {
          p_brand_color?: string;
          p_city?: string;
          p_name: string;
          p_phone?: string;
          p_slug: string;
          p_user: string;
        };
        Returns: string;
      };
      current_agency_ids: { Args: { p_roles?: string[] }; Returns: string[] };
      damage_fee_rows: {
        Args: { p_agency: string; p_from: string; p_to: string };
        Returns: {
          amount: number;
          day: string;
          reservation_id: string;
          vehicle_id: string;
        }[];
      };
      delete_agency: { Args: { p_agency: string; p_confirm_name: string }; Returns: undefined };
      generate_recurring_charges: { Args: { p_agency: string; p_month?: string }; Returns: number };
      has_role: { Args: { p_agency: string; p_roles: string[] }; Returns: boolean };
      invitation_preview: {
        Args: { p_token: string };
        Returns: {
          agency_name: string;
          brand_color: string;
          email: string;
          logo_path: string;
          phone: string;
          role: string;
          state: string;
        }[];
      };
      is_member: { Args: { p_agency: string }; Returns: boolean };
      is_platform_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      maintenance_blocked_days: {
        Args: { p_ended_on: string; p_expected_end_on: string; p_starts_on: string };
        Returns: unknown;
      };
      match_chunks: {
        Args: { p_agency: string; p_k?: number; p_query_embedding: string };
        Returns: {
          content: string;
          document_id: string;
          id: string;
          metadata: Json;
          similarity: number;
        }[];
      };
      mfa_satisfied: { Args: Record<PropertyKey, never>; Returns: boolean };
      next_contract_number: { Args: { p_agency: string }; Returns: string };
      old_clients: { Args: { p_agency: string; p_years: number }; Returns: string[] };
      platform_agency_activity: { Args: { p_agency: string }; Returns: Json };
      platform_overview: {
        Args: Record<PropertyKey, never>;
        Returns: {
          city: string;
          created_at: string;
          current_period_end: string;
          id: string;
          members: number;
          name: string;
          pending_payments: number;
          plan_code: string;
          plan_name: string;
          reservations_30d: number;
          slug: string;
          subscription_status: string;
          trial_ends_at: string;
          vehicles: number;
          writable: boolean;
        }[];
      };
      platform_set_admin: { Args: { p_email: string; p_on: boolean }; Returns: undefined };
      platform_stats: { Args: Record<PropertyKey, never>; Returns: Json };
      platform_usage: {
        Args: Record<PropertyKey, never>;
        Returns: {
          active_users_30d: number;
          agencies: number;
          auth_users: number;
          database_bytes: number;
          storage_bytes: number;
          vehicles: number;
        }[];
      };
      platform_users: {
        Args: Record<PropertyKey, never>;
        Returns: {
          agencies: Json;
          created_at: string;
          email: string;
          email_confirmed: boolean;
          full_name: string;
          id: string;
          last_sign_in_at: string;
          mfa: boolean;
          platform_admin: boolean;
        }[];
      };
      preview_contract_number: { Args: { p_agency: string }; Returns: string };
      public_agency: { Args: { p_slug: string }; Returns: Json };
      rate_limit_cleanup: { Args: Record<PropertyKey, never>; Returns: number };
      rate_limit_hit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number };
        Returns: boolean;
      };
      rental_day_rows: {
        Args: { p_agency: string; p_from: string; p_to: string };
        Returns: {
          day: string;
          reservation_id: string;
          revenue: number;
          vehicle_id: string;
        }[];
      };
      rental_days: { Args: { p_end: string; p_start: string }; Returns: number };
      request_subscription: {
        Args: { p_agency: string; p_method: string; p_period: string; p_plan_code: string };
        Returns: {
          amount: number;
          id: string;
          reference: string;
        }[];
      };
      reservation_days: { Args: { p_end_at: string; p_start_at: string }; Returns: unknown };
      return_reservation: {
        Args: { p: Json; p_agency: string; p_reservation: string };
        Returns: undefined;
      };
      save_reservation: {
        Args: { p: Json; p_agency: string; p_reservation: string };
        Returns: string;
      };
      search_chunks: {
        Args: { p_agency: string; p_k?: number; p_query: string };
        Returns: {
          chunk_id: string;
          content: string;
          document_id: string;
          rank: number;
          title: string;
        }[];
      };
      search_reservation_ids: { Args: { p_agency: string; p_q: string }; Returns: string[] };
      stats_by_vehicle: {
        Args: { p_agency: string; p_from: string; p_to: string };
        Returns: {
          brand_model: string;
          charges: number;
          damages: number;
          plate: string;
          rented_days: number;
          revenue: number;
          vehicle_id: string;
        }[];
      };
      stats_daily: {
        Args: { p_agency: string; p_from: string; p_to: string };
        Returns: {
          charges: number;
          damages: number;
          day: string;
          rented_days: number;
          revenue: number;
        }[];
      };
      subscription_is_writable: {
        Args: { p_current_period_end: string; p_status: string; p_trial_ends_at: string };
        Returns: boolean;
      };
      vehicle_availability: {
        Args: { p_agency: string; p_end: string; p_exclude_reservation?: string; p_start: string };
        Returns: {
          reason: string;
          vehicle_id: string;
        }[];
      };
      vehicle_profitability: {
        Args: { p_agency: string };
        Returns: {
          brand_model: string;
          charges: number;
          charges_month: number;
          credit_left: number;
          credit_month: number;
          damages: number;
          damages_month: number;
          down_payment: number;
          first_payment_on: string;
          gain: number;
          lender: string;
          mode: string;
          monthly_payment: number;
          months: number;
          months_paid: number;
          paid_so_far: number;
          plate: string;
          purchase_date: string;
          purchase_price: number;
          revenue: number;
          revenue_month: number;
          status: string;
          total_cost: number;
          vehicle_id: string;
        }[];
      };
      who_had_car: {
        Args: { p_agency: string; p_from: string; p_plate: string; p_to: string };
        Returns: string[];
      };
      writable_agency_ids: { Args: { p_roles?: string[] }; Returns: string[] };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;

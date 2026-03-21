export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string;
          name: string;
          documentary_prefix: string | null;
          tax_id: string | null;
          contact_name: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          documentary_prefix?: string | null;
          tax_id?: string | null;
          contact_name?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          documentary_prefix?: string | null;
          tax_id?: string | null;
          contact_name?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          role:
            | "super_admin"
            | "gerente_operativo"
            | "administrativo"
            | "contable"
            | "almacen"
            | "lider_operativo"
            | "tecnico"
            | "administrador"
            | "asistente"
            | "contabilidad"
            | "cliente";
          full_name: string | null;
          client_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?:
            | "super_admin"
            | "gerente_operativo"
            | "administrativo"
            | "contable"
            | "almacen"
            | "lider_operativo"
            | "tecnico"
            | "administrador"
            | "asistente"
            | "contabilidad"
            | "cliente";
          full_name?: string | null;
          client_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          role?:
            | "super_admin"
            | "gerente_operativo"
            | "administrativo"
            | "contable"
            | "almacen"
            | "lider_operativo"
            | "tecnico"
            | "administrador"
            | "asistente"
            | "contabilidad"
            | "cliente";
          full_name?: string | null;
          client_id?: string | null;
          updated_at?: string;
        };
      };
    };
  };
}

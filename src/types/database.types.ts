export type UserRole = 'admin' | 'employee' | 'client'
export type UserStatus = 'pending' | 'approved' | 'rejected'
export type FormStatus = 'pending' | 'approved' | 'rejected'
export type AnnouncementAudience = 'all' | 'admins' | 'employees' | 'clients' | 'specific'
export type InquiryStatus = 'new' | 'in_progress' | 'closed'
export type NotificationRecipients = 'admin' | 'employee' | 'both' | 'none'

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string
          role: UserRole
          status: UserStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          full_name: string
          role?: UserRole
          status?: UserStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          role?: UserRole
          status?: UserStatus
          created_at?: string
          updated_at?: string
        }
      }
      forms: {
        Row: {
          id: string
          form_name: string
          form_type: string
          fields_schema: Record<string, unknown>
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          form_name: string
          form_type: string
          fields_schema: Record<string, unknown>
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          form_name?: string
          form_type?: string
          fields_schema?: Record<string, unknown>
          created_at?: string
          updated_at?: string
        }
      }
      form_submissions: {
        Row: {
          id: string
          form_id: string
          submitted_by: string
          data: Record<string, unknown>
          status: FormStatus
          reviewed_by: string | null
          review_comment: string | null
          resume_url: string | null
          signed_pdf_url: string | null
          submitted_at: string
          reviewed_at: string | null
        }
        Insert: {
          id?: string
          form_id: string
          submitted_by: string
          data: Record<string, unknown>
          status?: FormStatus
          reviewed_by?: string | null
          review_comment?: string | null
          resume_url?: string | null
          signed_pdf_url?: string | null
          submitted_at?: string
          reviewed_at?: string | null
        }
        Update: {
          id?: string
          form_id?: string
          submitted_by?: string
          data?: Record<string, unknown>
          status?: FormStatus
          reviewed_by?: string | null
          review_comment?: string | null
          resume_url?: string | null
          signed_pdf_url?: string | null
          submitted_at?: string
          reviewed_at?: string | null
        }
      }
      videos: {
        Row: {
          id: string
          title: string
          description: string
          video_url: string
          duration_seconds: number
          thumbnail_url: string | null
          category: string | null
          is_required: boolean
          uploaded_by: string | null
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string
          video_url: string
          duration_seconds?: number
          thumbnail_url?: string | null
          category?: string | null
          is_required?: boolean
          uploaded_by?: string | null
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string
          video_url?: string
          duration_seconds?: number
          thumbnail_url?: string | null
          category?: string | null
          is_required?: boolean
          uploaded_by?: string | null
          sort_order?: number
          created_at?: string
        }
      }
      video_quizzes: {
        Row: {
          id: string
          video_id: string
          questions: Record<string, unknown>[]
          passing_score: number
          created_at: string
        }
        Insert: {
          id?: string
          video_id: string
          questions: Record<string, unknown>[]
          passing_score: number
          created_at?: string
        }
        Update: {
          id?: string
          video_id?: string
          questions?: Record<string, unknown>[]
          passing_score?: number
          created_at?: string
        }
      }
      video_progress: {
        Row: {
          id: string
          user_id: string
          video_id: string
          progress_seconds: number
          completed: boolean
          engagement_score: number
          quiz_score: number | null
          quiz_passed: boolean
          certificate_url: string | null
          started_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          video_id: string
          progress_seconds?: number
          completed?: boolean
          engagement_score?: number
          quiz_score?: number | null
          quiz_passed?: boolean
          certificate_url?: string | null
          started_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          video_id?: string
          progress_seconds?: number
          completed?: boolean
          engagement_score?: number
          quiz_score?: number | null
          quiz_passed?: boolean
          certificate_url?: string | null
          started_at?: string
          completed_at?: string | null
        }
      }
      engagement_checkins: {
        Row: {
          id: string
          user_id: string
          video_id: string
          timestamp_seconds: number
          responded: boolean
          response_time_ms: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          video_id: string
          timestamp_seconds: number
          responded?: boolean
          response_time_ms?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          video_id?: string
          timestamp_seconds?: number
          responded?: boolean
          response_time_ms?: number | null
          created_at?: string
        }
      }
      announcements: {
        Row: {
          id: string
          title: string
          content: string
          target_audience: AnnouncementAudience
          specific_users: string[] | null
          scheduled_for: string | null
          sent_at: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          content: string
          target_audience?: AnnouncementAudience
          specific_users?: string[] | null
          scheduled_for?: string | null
          sent_at?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          content?: string
          target_audience?: AnnouncementAudience
          specific_users?: string[] | null
          scheduled_for?: string | null
          sent_at?: string | null
          created_by?: string
          created_at?: string
        }
      }
      announcement_reads: {
        Row: {
          id: string
          announcement_id: string
          user_id: string
          read_at: string
        }
        Insert: {
          id?: string
          announcement_id: string
          user_id: string
          read_at?: string
        }
        Update: {
          id?: string
          announcement_id?: string
          user_id?: string
          read_at?: string
        }
      }
      job_positions: {
        Row: {
          id: string
          title: string
          description: string
          department: string | null
          location: string | null
          employment_type: string | null
          is_visible: boolean
          sort_order: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string
          department?: string | null
          location?: string | null
          employment_type?: string | null
          is_visible?: boolean
          sort_order?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string
          department?: string | null
          location?: string | null
          employment_type?: string | null
          is_visible?: boolean
          sort_order?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      services: {
        Row: {
          id: string
          service_name: string
          description: string
          inquiry_form_schema: Record<string, unknown>
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          service_name: string
          description: string
          inquiry_form_schema: Record<string, unknown>
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          service_name?: string
          description?: string
          inquiry_form_schema?: Record<string, unknown>
          active?: boolean
          created_at?: string
        }
      }
      notification_settings: {
        Row: {
          id: string
          notification_type: string
          recipients: NotificationRecipients
          enabled: boolean
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          notification_type: string
          recipients?: NotificationRecipients
          enabled?: boolean
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          notification_type?: string
          recipients?: NotificationRecipients
          enabled?: boolean
          updated_by?: string | null
          updated_at?: string
        }
      }
      service_inquiries: {
        Row: {
          id: string
          service_id: string
          submitted_by: string | null
          contact_name: string
          contact_email: string
          contact_phone: string
          inquiry_data: Record<string, unknown>
          status: InquiryStatus
          created_at: string
        }
        Insert: {
          id?: string
          service_id: string
          submitted_by?: string | null
          contact_name: string
          contact_email: string
          contact_phone: string
          inquiry_data: Record<string, unknown>
          status?: InquiryStatus
          created_at?: string
        }
        Update: {
          id?: string
          service_id?: string
          submitted_by?: string | null
          contact_name?: string
          contact_email?: string
          contact_phone?: string
          inquiry_data?: Record<string, unknown>
          status?: InquiryStatus
          created_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      user_role: UserRole
      form_status: FormStatus
      announcement_audience: AnnouncementAudience
      inquiry_status: InquiryStatus
      notification_recipients: NotificationRecipients
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

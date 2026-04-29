-- RTI Agency Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE user_role AS ENUM ('admin', 'employee', 'client');
CREATE TYPE form_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE announcement_audience AS ENUM ('all', 'employees', 'clients', 'specific');
CREATE TYPE inquiry_status AS ENUM ('new', 'in_progress', 'closed');

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'employee',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Forms (master form definitions)
CREATE TABLE forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_name TEXT NOT NULL,
    form_type TEXT NOT NULL UNIQUE,
    fields_schema JSONB NOT NULL DEFAULT '{}',
    show_in_educator_area BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Educator Resources (files/documents for employees)
CREATE TABLE educator_resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER,
    category TEXT,
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_visible BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Form submissions
CREATE TABLE form_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    submitted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data JSONB NOT NULL DEFAULT '{}',
    status form_status NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    review_comment TEXT,
    resume_url TEXT,
    signed_pdf_url TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

-- Videos
CREATE TABLE videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    video_url TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    thumbnail_url TEXT,
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Video quizzes
CREATE TABLE video_quizzes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    questions JSONB NOT NULL DEFAULT '[]',
    passing_score INTEGER NOT NULL DEFAULT 70,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Video progress
CREATE TABLE video_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    progress_seconds INTEGER NOT NULL DEFAULT 0,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    engagement_score INTEGER NOT NULL DEFAULT 0,
    quiz_score INTEGER,
    quiz_passed BOOLEAN NOT NULL DEFAULT FALSE,
    certificate_url TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    UNIQUE(user_id, video_id)
);

-- Engagement check-ins
CREATE TABLE engagement_checkins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    timestamp_seconds INTEGER NOT NULL,
    responded BOOLEAN NOT NULL DEFAULT FALSE,
    response_time_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Announcements
CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    target_audience announcement_audience NOT NULL DEFAULT 'all',
    specific_users UUID[],
    scheduled_for TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Announcement reads
CREATE TABLE announcement_reads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(announcement_id, user_id)
);

-- Services (for Coordinated Family Service)
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    inquiry_form_schema JSONB NOT NULL DEFAULT '{}',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Service inquiries
CREATE TABLE service_inquiries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    contact_name TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    contact_phone TEXT NOT NULL,
    inquiry_data JSONB NOT NULL DEFAULT '{}',
    status inquiry_status NOT NULL DEFAULT 'new',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Job Applications
CREATE TYPE application_status AS ENUM ('pending', 'reviewed', 'interviewed', 'hired', 'rejected');

CREATE TABLE job_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    position_applied TEXT NOT NULL,
    experience_years INTEGER,
    availability TEXT,
    start_date DATE,
    resume_url TEXT,
    cover_letter TEXT,
    status application_status NOT NULL DEFAULT 'pending',
    notes TEXT,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_applications_status ON job_applications(status);
CREATE INDEX idx_job_applications_email ON job_applications(email);

-- Contact Us Submissions
CREATE TYPE contact_status AS ENUM ('new', 'read', 'replied', 'archived', 'spam');

CREATE TABLE contact_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status contact_status NOT NULL DEFAULT 'new',
    replied_by UUID REFERENCES users(id) ON DELETE SET NULL,
    replied_at TIMESTAMPTZ,
    notes TEXT,
    spam_score INTEGER,
    spam_reasons JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contact_submissions_status ON contact_submissions(status);
CREATE INDEX idx_contact_submissions_email ON contact_submissions(email);
CREATE INDEX idx_contact_submissions_spam ON contact_submissions(status) WHERE status = 'spam';

-- Job Positions (managed by admins, displayed on public /jobs page)
CREATE TABLE job_positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    department TEXT,
    location TEXT,
    employment_type TEXT,
    is_visible BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_positions_is_visible ON job_positions(is_visible);
CREATE INDEX idx_job_positions_sort_order ON job_positions(sort_order);

-- Advisories (PDFs for educators)
CREATE TABLE advisories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    pdf_url TEXT NOT NULL,
    is_visible BOOLEAN NOT NULL DEFAULT false,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    category TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Custom file categories/folders (admin-managed)
CREATE TABLE advisory_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO advisory_categories (name, sort_order, is_default) VALUES
    ('Advisories', 1, true),
    ('Downloads', 2, true)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE advisory_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view categories" ON advisory_categories
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage categories" ON advisory_categories
    USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE INDEX idx_advisories_is_visible ON advisories(is_visible);
CREATE INDEX idx_advisories_created_at ON advisories(created_at DESC);

-- Create indexes for better query performance
CREATE INDEX idx_form_submissions_form_id ON form_submissions(form_id);
CREATE INDEX idx_form_submissions_submitted_by ON form_submissions(submitted_by);
CREATE INDEX idx_form_submissions_status ON form_submissions(status);
CREATE INDEX idx_video_progress_user_id ON video_progress(user_id);
CREATE INDEX idx_video_progress_video_id ON video_progress(video_id);
CREATE INDEX idx_engagement_checkins_user_video ON engagement_checkins(user_id, video_id);
CREATE INDEX idx_announcements_target_audience ON announcements(target_audience);
CREATE INDEX idx_announcement_reads_user_id ON announcement_reads(user_id);
CREATE INDEX idx_service_inquiries_service_id ON service_inquiries(service_id);
CREATE INDEX idx_service_inquiries_status ON service_inquiries(status);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE job_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_inquiries ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all users" ON users
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can insert users" ON users
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
        OR auth.uid() = id
    );

CREATE POLICY "Admins can update users" ON users
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
        OR auth.uid() = id
    );

CREATE POLICY "Admins can delete users" ON users
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Forms policies (viewable by all authenticated users)
CREATE POLICY "Authenticated users can view forms" ON forms
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage forms" ON forms
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Form submissions policies
CREATE POLICY "Users can view their own submissions" ON form_submissions
    FOR SELECT USING (submitted_by = auth.uid());

CREATE POLICY "Admins can view all submissions" ON form_submissions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Users can create submissions" ON form_submissions
    FOR INSERT WITH CHECK (submitted_by = auth.uid());

CREATE POLICY "Admins can update submissions" ON form_submissions
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Videos policies
CREATE POLICY "Authenticated users can view videos" ON videos
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage videos" ON videos
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Video quizzes policies
CREATE POLICY "Authenticated users can view quizzes" ON video_quizzes
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage quizzes" ON video_quizzes
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Video progress policies
CREATE POLICY "Users can view their own progress" ON video_progress
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own progress" ON video_progress
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Admins can view all progress" ON video_progress
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Engagement check-ins policies
CREATE POLICY "Users can manage their own check-ins" ON engagement_checkins
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Admins can view all check-ins" ON engagement_checkins
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Announcements policies
CREATE POLICY "Users can view relevant announcements" ON announcements
    FOR SELECT USING (
        target_audience = 'all'
        OR (target_audience = 'employees' AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'employee'))
        OR (target_audience = 'clients' AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'client'))
        OR (target_audience = 'specific' AND auth.uid() = ANY(specific_users))
        OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can manage announcements" ON announcements
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Announcement reads policies
CREATE POLICY "Users can manage their own reads" ON announcement_reads
    FOR ALL USING (user_id = auth.uid());

-- Services policies
CREATE POLICY "Anyone can view active services" ON services
    FOR SELECT USING (active = TRUE OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can manage services" ON services
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Service inquiries policies
CREATE POLICY "Users can view their own inquiries" ON service_inquiries
    FOR SELECT USING (submitted_by = auth.uid());

CREATE POLICY "Anyone can create inquiries" ON service_inquiries
    FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Admins can view all inquiries" ON service_inquiries
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can update inquiries" ON service_inquiries
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Job positions policies
CREATE POLICY "Anyone can view visible job positions" ON job_positions
    FOR SELECT USING (is_visible = true);

CREATE POLICY "Admins can view all job positions" ON job_positions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can manage job positions" ON job_positions
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Create triggers for updated_at
CREATE TRIGGER update_job_positions_updated_at
    BEFORE UPDATE ON job_positions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_forms_updated_at
    BEFORE UPDATE ON forms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'employee')
    );
    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Trigger to create user profile on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- Admin notification dismissals (tracks which updates have been seen/dismissed)
CREATE TABLE admin_notification_dismissals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL,
    notification_id TEXT NOT NULL,
    dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(admin_id, notification_type, notification_id)
);

CREATE INDEX idx_admin_notification_dismissals_admin ON admin_notification_dismissals(admin_id);

-- RLS for admin_notification_dismissals
ALTER TABLE admin_notification_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage their own dismissals" ON admin_notification_dismissals
    FOR ALL USING (admin_id = auth.uid());

-- Site popups (shown on landing/public pages)
CREATE TABLE site_popups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    delay_seconds INTEGER NOT NULL DEFAULT 3,
    is_visible BOOLEAN NOT NULL DEFAULT false,
    active_from TIMESTAMPTZ,
    active_until TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admin settings (key-value store for dashboard notes, etc.)
CREATE TABLE admin_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT NOT NULL UNIQUE,
    value TEXT,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Video categories (for organizing training videos)
CREATE TABLE video_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_video_categories_sort_order ON video_categories(sort_order);

-- Add category_id to videos if not exists (run separately if table already exists)
-- ALTER TABLE videos ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES video_categories(id) ON DELETE SET NULL;

-- RLS for site_popups (public read, admin write)
ALTER TABLE site_popups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view visible popups" ON site_popups
    FOR SELECT USING (is_visible = true);

CREATE POLICY "Admins can manage popups" ON site_popups
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- RLS for admin_settings
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view settings" ON admin_settings
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can manage settings" ON admin_settings
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- RLS for video_categories
ALTER TABLE video_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view categories" ON video_categories
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage categories" ON video_categories
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- RLS for advisories (missing from original schema)
ALTER TABLE advisories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view visible advisories" ON advisories
    FOR SELECT USING (
        is_visible = true
        OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can manage advisories" ON advisories
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- RLS for educator_resources (missing from original schema)
ALTER TABLE educator_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view visible resources" ON educator_resources
    FOR SELECT USING (
        is_visible = true
        OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can manage resources" ON educator_resources
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- RLS for job_applications
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create applications" ON job_applications
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view all applications" ON job_applications
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can manage applications" ON job_applications
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- RLS for contact_submissions
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create contact submissions" ON contact_submissions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view all contact submissions" ON contact_submissions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can manage contact submissions" ON contact_submissions
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Storage buckets (run these in Supabase Dashboard > Storage or via API)
-- Create 'forms' bucket for PDF form uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('forms', 'forms', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for forms bucket
CREATE POLICY "Admins can upload forms" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'forms' AND
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Anyone can view forms" ON storage.objects
    FOR SELECT USING (bucket_id = 'forms');

CREATE POLICY "Admins can delete forms" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'forms' AND
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

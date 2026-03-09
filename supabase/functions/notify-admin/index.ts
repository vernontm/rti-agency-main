import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "notifications@resend.dev";
const DASHBOARD_URL = Deno.env.get("DASHBOARD_URL") || "https://app.roadtoindependence.org";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ---------- Table-to-notification-type mapping ----------

const TABLE_TO_NOTIFICATION_TYPE: Record<string, string> = {
  users: "user_registration",
  form_submissions: "form_submission",
  job_applications: "job_application",
  contact_submissions: "contact_submission",
  announcements: "announcement",
  calendar_notes: "calendar_event",
};

// ---------- Email template helpers ----------

function buildBaseEmail(title: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f3f4f6; font-family:Arial, Helvetica, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6; padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%;">
          <!-- Header -->
          <tr>
            <td style="background-color:#1f2937; padding:24px 32px; border-radius:12px 12px 0 0; text-align:center;">
              <img src="https://vernon-tech-media.s3.us-east-1.amazonaws.com/RTI-agency/logos/RTI-logo.png"
                   alt="RTI Agency" height="40" style="height:40px;" />
            </td>
          </tr>
          <!-- Title Bar -->
          <tr>
            <td style="background-color:#f97316; padding:16px 32px;">
              <h1 style="margin:0; color:#ffffff; font-size:20px; font-weight:700;">
                ${title}
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff; padding:32px; border-radius:0 0 12px 12px;">
              ${bodyContent}
              <hr style="border:none; border-top:1px solid #e5e7eb; margin:24px 0;" />
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <a href="${DASHBOARD_URL}/dashboard"
                       style="display:inline-block; background-color:#f97316; color:#ffffff; text-decoration:none; padding:10px 24px; border-radius:8px; font-size:14px; font-weight:600;">
                      View in Dashboard
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color:#9ca3af; font-size:12px; margin:16px 0 0 0;">
                This is an automated notification from RTI Agency.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="color:#6b7280; font-size:13px; padding:8px; width:140px; vertical-align:top;">${label}</td>
    <td style="color:#111827; font-size:14px; padding:8px;">${value}</td>
  </tr>`;
}

function detailTable(rows: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0"
    style="background-color:#f9fafb; border-radius:8px; margin:16px 0; border:1px solid #e5e7eb;">
    ${rows}
  </table>`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return dateStr || "N/A";
  }
}

// ---------- Recipient resolver ----------

async function getRecipientEmails(notificationType: string): Promise<string[]> {
  // Check notification settings
  const { data: setting } = await supabaseAdmin
    .from("notification_settings")
    .select("recipients, enabled")
    .eq("notification_type", notificationType)
    .single();

  // Default to admin if no setting found
  const recipients = setting?.recipients || "admin";
  const enabled = setting?.enabled ?? true;

  if (!enabled) {
    console.log(`Notification type '${notificationType}' is disabled`);
    return [];
  }

  // Build role filter based on recipients setting
  let roleFilter: string[];
  switch (recipients) {
    case "admin":
      roleFilter = ["admin"];
      break;
    case "employee":
      roleFilter = ["employee"];
      break;
    case "both":
      roleFilter = ["admin", "employee"];
      break;
    case "none":
      return [];
    default:
      roleFilter = ["admin"];
  }

  const { data: users, error } = await supabaseAdmin
    .from("users")
    .select("email")
    .in("role", roleFilter);

  if (error || !users || users.length === 0) {
    console.error("No recipient emails found:", error);
    return [];
  }

  // TODO: Remove override once a domain is verified in Resend
  // return users.map((u: { email: string }) => u.email);
  return ["ray@vernontm.com"];
}

// ---------- Notification builders ----------

function buildUserRegistrationEmail(record: Record<string, unknown>): { subject: string; html: string } {
  const body = `
    <p style="color:#374151; font-size:15px; line-height:1.6;">
      A new user has registered and is awaiting approval.
    </p>
    ${detailTable(
      detailRow("Name", String(record.full_name || "N/A")) +
      detailRow("Email", String(record.email || "N/A")) +
      detailRow("Role", String(record.role || "N/A")) +
      detailRow("Registered", formatDate(String(record.created_at)))
    )}`;

  return {
    subject: `New User Registration: ${record.full_name}`,
    html: buildBaseEmail("New User Registration", body),
  };
}

async function buildFormSubmissionEmail(record: Record<string, unknown>): Promise<{ subject: string; html: string }> {
  let formName = "Unknown Form";
  let submitterName = "Unknown";
  let submitterEmail = "";

  if (record.form_id) {
    const { data: form } = await supabaseAdmin
      .from("forms")
      .select("form_name")
      .eq("id", record.form_id)
      .single();
    if (form) formName = form.form_name;
  }

  if (record.submitted_by) {
    const { data: submitter } = await supabaseAdmin
      .from("users")
      .select("full_name, email")
      .eq("id", record.submitted_by)
      .single();
    if (submitter) {
      submitterName = submitter.full_name;
      submitterEmail = submitter.email;
    }
  }

  const body = `
    <p style="color:#374151; font-size:15px; line-height:1.6;">
      A new form has been submitted and is pending review.
    </p>
    ${detailTable(
      detailRow("Form", formName) +
      detailRow("Submitted By", `${submitterName}${submitterEmail ? ` (${submitterEmail})` : ""}`) +
      detailRow("Submitted At", formatDate(String(record.submitted_at || record.created_at)))
    )}`;

  return {
    subject: `New Form Submission: ${formName}`,
    html: buildBaseEmail("New Form Submission", body),
  };
}

function buildJobApplicationEmail(record: Record<string, unknown>): { subject: string; html: string } {
  const body = `
    <p style="color:#374151; font-size:15px; line-height:1.6;">
      A new job application has been received.
    </p>
    ${detailTable(
      detailRow("Applicant", String(record.full_name || "N/A")) +
      detailRow("Email", String(record.email || "N/A")) +
      detailRow("Phone", String(record.phone || "N/A")) +
      detailRow("Position", String(record.position_applied || "N/A")) +
      detailRow("Experience", record.experience_years ? `${record.experience_years} years` : "N/A") +
      detailRow("Availability", String(record.availability || "N/A")) +
      detailRow("Applied", formatDate(String(record.created_at)))
    )}`;

  return {
    subject: `New Job Application: ${record.full_name} - ${record.position_applied}`,
    html: buildBaseEmail("New Job Application", body),
  };
}

function buildContactSubmissionEmail(record: Record<string, unknown>): { subject: string; html: string } {
  const body = `
    <p style="color:#374151; font-size:15px; line-height:1.6;">
      A new contact message has been received.
    </p>
    ${detailTable(
      detailRow("From", String(record.name || "N/A")) +
      detailRow("Email", String(record.email || "N/A")) +
      detailRow("Phone", String(record.phone || "N/A")) +
      detailRow("Subject", String(record.subject || "N/A")) +
      detailRow("Received", formatDate(String(record.created_at)))
    )}
    <div style="background-color:#f9fafb; border-radius:8px; padding:16px; margin:16px 0; border:1px solid #e5e7eb;">
      <p style="color:#6b7280; font-size:12px; margin:0 0 8px 0; text-transform:uppercase; letter-spacing:0.05em;">Message</p>
      <p style="color:#374151; font-size:14px; line-height:1.6; margin:0; white-space:pre-wrap;">${String(record.message || "N/A")}</p>
    </div>`;

  return {
    subject: `New Contact Message: ${record.subject}`,
    html: buildBaseEmail("New Contact Message", body),
  };
}

async function buildAnnouncementEmail(record: Record<string, unknown>): Promise<{ subject: string; html: string }> {
  let creatorName = "Unknown";

  if (record.created_by) {
    const { data: creator } = await supabaseAdmin
      .from("users")
      .select("full_name")
      .eq("id", record.created_by)
      .single();
    if (creator) creatorName = creator.full_name;
  }

  const audienceLabels: Record<string, string> = {
    all: "Everyone",
    admins: "Admins Only",
    employees: "Employees Only",
    clients: "Clients Only",
    specific: "Specific Users",
  };

  const content = String(record.content || "");
  const truncatedContent = content.length > 300 ? content.substring(0, 300) + "..." : content;

  const body = `
    <p style="color:#374151; font-size:15px; line-height:1.6;">
      A new announcement has been posted.
    </p>
    ${detailTable(
      detailRow("Title", String(record.title || "N/A")) +
      detailRow("Posted By", creatorName) +
      detailRow("Audience", audienceLabels[String(record.target_audience)] || String(record.target_audience || "N/A")) +
      detailRow("Posted", formatDate(String(record.created_at)))
    )}
    <div style="background-color:#f9fafb; border-radius:8px; padding:16px; margin:16px 0; border:1px solid #e5e7eb;">
      <p style="color:#6b7280; font-size:12px; margin:0 0 8px 0; text-transform:uppercase; letter-spacing:0.05em;">Content</p>
      <p style="color:#374151; font-size:14px; line-height:1.6; margin:0; white-space:pre-wrap;">${truncatedContent}</p>
    </div>`;

  return {
    subject: `New Announcement: ${record.title}`,
    html: buildBaseEmail("New Announcement", body),
  };
}

function buildCalendarNoteEmail(record: Record<string, unknown>): { subject: string; html: string } {
  const colorLabels: Record<string, string> = {
    blue: "General",
    orange: "Important",
    green: "Event",
    purple: "Meeting",
    red: "Urgent",
  };

  const body = `
    <p style="color:#374151; font-size:15px; line-height:1.6;">
      A new calendar event has been added.
    </p>
    ${detailTable(
      detailRow("Title", String(record.title || "N/A")) +
      detailRow("Date", String(record.date || "N/A")) +
      detailRow("Category", colorLabels[String(record.color)] || String(record.color || "N/A")) +
      detailRow("Added", formatDate(String(record.created_at)))
    )}
    ${record.description ? `
    <div style="background-color:#f9fafb; border-radius:8px; padding:16px; margin:16px 0; border:1px solid #e5e7eb;">
      <p style="color:#6b7280; font-size:12px; margin:0 0 8px 0; text-transform:uppercase; letter-spacing:0.05em;">Description</p>
      <p style="color:#374151; font-size:14px; line-height:1.6; margin:0; white-space:pre-wrap;">${String(record.description)}</p>
    </div>` : ""}`;

  return {
    subject: `New Calendar Event: ${record.title} (${record.date})`,
    html: buildBaseEmail("New Calendar Event", body),
  };
}

// ---------- Main handler ----------

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const payload = await req.json();
    const { type, table, record } = payload;

    console.log(`Received webhook: type=${type}, table=${table}`);

    // Only process INSERT events
    if (type !== "INSERT") {
      return new Response(JSON.stringify({ message: "Ignored non-INSERT event" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Resolve notification type from table name
    const notificationType = TABLE_TO_NOTIFICATION_TYPE[table];
    if (!notificationType) {
      console.log(`Unknown table: ${table}`);
      return new Response(JSON.stringify({ message: `Unknown table: ${table}` }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get recipient emails based on notification settings
    const recipientEmails = await getRecipientEmails(notificationType);
    if (recipientEmails.length === 0) {
      console.log(`No recipients for notification type '${notificationType}' — skipping`);
      return new Response(JSON.stringify({ message: "No recipients — skipped" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Sending '${notificationType}' notification to ${recipientEmails.length} recipient(s)`);

    // Build email based on table
    let email: { subject: string; html: string };

    switch (table) {
      case "users":
        email = buildUserRegistrationEmail(record);
        break;
      case "form_submissions":
        email = await buildFormSubmissionEmail(record);
        break;
      case "job_applications":
        email = buildJobApplicationEmail(record);
        break;
      case "contact_submissions":
        email = buildContactSubmissionEmail(record);
        break;
      case "announcements":
        email = await buildAnnouncementEmail(record);
        break;
      case "calendar_notes":
        email = buildCalendarNoteEmail(record);
        break;
      default:
        return new Response(JSON.stringify({ message: `Unhandled table: ${table}` }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
    }

    // Send via Resend
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: recipientEmails,
        subject: email.subject,
        html: email.html,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend API error:", JSON.stringify(resendData));
      return new Response(JSON.stringify({ error: "Email send failed", details: resendData }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Email sent successfully: ${resendData.id}`);
    return new Response(JSON.stringify({ success: true, emailId: resendData.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

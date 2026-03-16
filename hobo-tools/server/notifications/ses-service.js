'use strict';

// ═══════════════════════════════════════════════════════════════
// Amazon SES Email Service
// Sends critical notification emails via AWS SES.
// Only sends for CRITICAL priority + eligible categories.
// Configuration stored in site_settings and managed via admin UI.
// ═══════════════════════════════════════════════════════════════

/**
 * SES Service — lazy-loads @aws-sdk/client-ses only when enabled.
 * This prevents startup failures when SES isn't configured.
 */
class SESService {
    constructor(db) {
        this.db = db;
        this._client = null;
        this._enabled = false;
        this._fromEmail = 'noreply@hobo.tools';
        this._fromName = 'Hobo Network';
        this._loadConfig();
    }

    _loadConfig() {
        this._enabled = this.db.getSetting('ses_enabled') === true;
        this._fromEmail = this.db.getSetting('ses_from_email') || 'noreply@hobo.tools';
        this._fromName = this.db.getSetting('ses_from_name') || 'Hobo Network';

        if (this._enabled) {
            this._initClient();
        }
    }

    _initClient() {
        try {
            const region = this.db.getSetting('ses_region') || 'us-east-1';
            const accessKeyId = this.db.getSetting('ses_access_key_id');
            const secretAccessKey = this.db.getSetting('ses_secret_access_key');

            if (!accessKeyId || !secretAccessKey) {
                console.warn('[SES] Enabled but missing credentials — disabled');
                this._enabled = false;
                return;
            }

            const { SESClient } = require('@aws-sdk/client-ses');
            this._client = new SESClient({
                region,
                credentials: { accessKeyId, secretAccessKey },
            });
            console.log(`[SES] Initialized (region: ${region}, from: ${this._fromEmail})`);
        } catch (err) {
            console.error('[SES] Failed to initialize:', err.message);
            this._enabled = false;
        }
    }

    /** Reload config (call after admin changes settings). */
    reload() {
        this._client = null;
        this._loadConfig();
    }

    get isEnabled() { return this._enabled && this._client !== null; }

    /**
     * Send a notification email.
     * @param {Object} opts - { to, username, subject, notification }
     * @returns {Promise<boolean>} true on success
     */
    async sendNotificationEmail({ to, username, subject, notification }) {
        if (!this.isEnabled) return false;
        if (!to) return false;

        const htmlBody = this._buildEmailHtml({ username, notification });
        const textBody = this._buildEmailText({ username, notification });

        try {
            const { SendEmailCommand } = require('@aws-sdk/client-ses');
            const cmd = new SendEmailCommand({
                Source: `${this._fromName} <${this._fromEmail}>`,
                Destination: { ToAddresses: [to] },
                Message: {
                    Subject: { Data: subject || notification.title || 'Notification', Charset: 'UTF-8' },
                    Body: {
                        Html: { Data: htmlBody, Charset: 'UTF-8' },
                        Text: { Data: textBody, Charset: 'UTF-8' },
                    },
                },
            });
            await this._client.send(cmd);
            console.log(`[SES] Email sent to ${to}: ${subject}`);
            return true;
        } catch (err) {
            console.error(`[SES] Send failed (to: ${to}):`, err.message);
            return false;
        }
    }

    /**
     * Process the email queue — finds critical notifications not yet emailed.
     * @param {import('./notification-service').NotificationService} notifService
     */
    async processQueue(notifService) {
        if (!this.isEnabled) return;

        const pending = notifService.getUnemaledCritical();
        if (pending.length === 0) return;

        console.log(`[SES] Processing ${pending.length} pending email(s)...`);

        for (const notif of pending) {
            const sent = await this.sendNotificationEmail({
                to: notif.email,
                username: notif.display_name || notif.username,
                subject: `🔥 ${notif.title}`,
                notification: notif,
            });
            if (sent) notifService.markEmailed(notif.id);
        }
    }

    // ─── Email Templates ───────────────────────────────────────

    _buildEmailHtml({ username, notification }) {
        const priorityColor = { low: '#888', normal: '#c0965c', high: '#f39c12', critical: '#e74c3c' };
        const color = priorityColor[notification.priority] || '#c0965c';

        return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body { margin: 0; padding: 0; background: #1a1a24; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
.container { max-width: 560px; margin: 0 auto; padding: 24px; }
.card { background: #22222c; border-radius: 12px; border: 1px solid #333340; overflow: hidden; }
.header { background: linear-gradient(135deg, #2a2a38, #1a1a24); padding: 24px; text-align: center; border-bottom: 2px solid ${color}; }
.header .flame { font-size: 32px; margin-bottom: 8px; }
.header h1 { margin: 0; color: #e0e0e0; font-size: 18px; font-weight: 700; }
.body { padding: 24px; color: #b0b0b8; font-size: 14px; line-height: 1.6; }
.body .greeting { color: #e0e0e0; font-weight: 600; margin-bottom: 12px; }
.notif-box { background: #1a1a24; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 3px solid ${color}; }
.notif-box .icon { font-size: 20px; margin-bottom: 6px; }
.notif-box .title { color: #e0e0e0; font-weight: 600; font-size: 15px; }
.notif-box .message { color: #b0b0b8; margin-top: 6px; }
.notif-box .meta { color: #707080; font-size: 11px; margin-top: 8px; }
.cta { display: inline-block; background: ${color}; color: #fff; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-weight: 600; margin: 16px 0; }
.footer { padding: 16px 24px; text-align: center; color: #505060; font-size: 11px; border-top: 1px solid #333340; }
.footer a { color: #c0965c; text-decoration: none; }
</style></head>
<body><div class="container"><div class="card">
<div class="header"><div class="flame">🔥</div><h1>Hobo Network</h1></div>
<div class="body">
<div class="greeting">Hey ${username || 'there'},</div>
<p>You have an important notification:</p>
<div class="notif-box">
<div class="icon">${notification.icon || '🔔'}</div>
<div class="title">${notification.title}</div>
${notification.message ? `<div class="message">${notification.message}</div>` : ''}
<div class="meta">${notification.service ? `From ${notification.service} · ` : ''}${notification.priority?.toUpperCase()} priority</div>
</div>
${notification.url ? `<a class="cta" href="${notification.url}">View Details →</a>` : ''}
</div>
<div class="footer">
<p>You're receiving this because it's a critical notification.</p>
<p><a href="https://my.hobo.tools/notifications">Manage notification preferences</a> · <a href="https://hobo.tools">hobo.tools</a></p>
</div>
</div></div></body></html>`;
    }

    _buildEmailText({ username, notification }) {
        return [
            `Hey ${username || 'there'},`,
            '',
            'You have an important notification from Hobo Network:',
            '',
            `${notification.icon || '🔔'} ${notification.title}`,
            notification.message || '',
            '',
            notification.url ? `View details: ${notification.url}` : '',
            '',
            '---',
            'Manage preferences: https://my.hobo.tools/notifications',
            'Hobo Network · https://hobo.tools',
        ].join('\n');
    }

    /**
     * Get current SES configuration status (for admin panel).
     */
    getStatus() {
        return {
            enabled: this._enabled,
            hasClient: this._client !== null,
            region: this.db.getSetting('ses_region') || 'us-east-1',
            fromEmail: this._fromEmail,
            fromName: this._fromName,
            hasCredentials: !!(this.db.getSetting('ses_access_key_id')),
        };
    }

    /**
     * Send a test email (admin only).
     */
    async sendTestEmail(to) {
        return this.sendNotificationEmail({
            to,
            username: 'Admin',
            subject: '🔥 Hobo Network — SES Test Email',
            notification: {
                icon: '🧪',
                title: 'Test Email',
                message: 'If you received this, Amazon SES is configured correctly!',
                priority: 'normal',
                service: 'hobo-tools',
                url: 'https://hobo.tools/admin',
            },
        });
    }
}

module.exports = { SESService };

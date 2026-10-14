# WhatsApp Business app coexistence

Workspace Settings includes an official Meta Embedded Signup flow for
connecting an existing WhatsApp Business app number to the WhatsApp Cloud
API. The **Meta Business Portfolio** settings menu opens the flow where
the user selects a portfolio and follows Meta's number-verification steps.
wacrm does not generate a QR code or use an unofficial WhatsApp Web client.

## Meta setup

This feature requires the installation's Meta app to be approved as a Tech
Provider or Solution Partner and configured for WhatsApp Business app user
onboarding. In the Meta App Dashboard, open **Facebook Login for Business →
Configurations**, create a **new** configuration, choose **Embedded Signup**,
and select **WhatsApp Business app user onboarding**. Selecting products in a
new configuration enables the v4 experience; its SDK call uses an empty
`extras` object. Add the CRM's HTTPS domain to both **Allowed domains** and
**Valid OAuth redirect URIs**. Subscribe the Meta app to the `history`,
`smb_app_state_sync`, and `smb_message_echoes` webhook fields.
The Facebook JavaScript SDK login must be launched from HTTPS. HTTP is
supported only for localhost while the Meta app is in development mode.
When testing on a non-localhost domain, configure TLS and open the CRM using
its `https://` URL before starting signup.

Workspace owners and admins can configure these values under **Settings →
WhatsApp coexistence**. Open Meta for Developers, select the app, and copy
the App ID and App Secret from **App settings → Basic**. Copy the ID of the
new v4 configuration from **Facebook Login for Business → Configurations**.
Use the same Meta app for the App ID, App Secret, and configuration.
The configuration ID is issued separately after you create the configuration;
it is not the Meta App ID or Business Portfolio ID.

The App Secret is encrypted with the application's `ENCRYPTION_KEY` before it
is persisted and is never returned to the browser. Existing plaintext values
are encrypted when an administrator loads the settings page.

The settings can alternatively be supplied as server-side variables:

| Variable                          | Description                                                 |
| --------------------------------- | ----------------------------------------------------------- |
| `META_APP_ID`                     | The Meta app ID used for the Embedded Signup configuration. |
| `META_EMBEDDED_SIGNUP_CONFIG_ID`  | The Facebook Login for Business configuration ID.           |
| `META_EMBEDDED_SIGNUP_APP_SECRET` | The exact app secret for `META_APP_ID`; server-side only.   |

The app secret is used to exchange the one-time authorization code on the
server. The resulting access token is encrypted and stored using the
existing WhatsApp configuration flow; it is never returned to the browser.
Only workspace owners and admins can start a connection.

## Current scope

The flow connects the selected coexistence number and subscribes its WABA to
the app as part of the existing WhatsApp setup. The current inbox does not
yet import the WhatsApp Business app's historical messages or contacts, and
messages sent from the Business app are not yet mirrored into the inbox.
Those behaviors require additional handling for Meta's `history`,
`smb_app_state_sync`, and `smb_message_echoes` webhook payloads.

For coexistence onboarding, Meta currently presents a verification code
that the business enters in WhatsApp Business. It is not a QR-code pairing
flow, and the app must not generate or display a homemade QR code as a
substitute for Meta's verification.

# WhatsApp Business app coexistence

Workspace Settings includes an official Meta Embedded Signup flow for
connecting an existing WhatsApp Business app number to the WhatsApp Cloud
API. Meta presents the approval and number-verification steps; wacrm does
not generate a QR code or use an unofficial WhatsApp Web client.

## Meta setup

This feature requires the installation's Meta app to be approved as a Tech
Provider or Solution Partner and configured for WhatsApp Business app user
onboarding. Create a Facebook Login for Business Embedded Signup
configuration using the current v4 experience, enable WhatsApp Business app
user onboarding, and subscribe the Meta app to the `history`,
`smb_app_state_sync`, and `smb_message_echoes` webhook fields.

Set these server-side variables and restart/redeploy the application:

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

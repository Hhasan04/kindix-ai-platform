# User Guide

KINDIX AI Knowledge Platform has two kinds of users: **schools** (who chat with the assistant)
and **KINDIX admins** (customer-service staff, who work the feedback/ticket dashboard).

## For schools

### Creating an account

1. Open the app and go to **Register**.
2. Fill in your school name, email, phone number, and country, and choose a password.
3. Submit — you're logged in immediately.

There's no separate approval step; any school can self-register.

### Asking a question

1. On the home screen you'll see **"أهلاً بك! كيف يمكنني مساعدتك اليوم؟"** with a question box
   centered on the screen — nothing is pre-filled, this is a real blank state, not a fake sample
   conversation.
2. Type your question in Arabic or English and send it.
3. The layout switches to a normal chat view once the conversation starts. Each answer is grounded
   in KINDIX's actual documentation and shows the source article(s) it was drawn from.
4. If the assistant doesn't have the information, it says so plainly instead of guessing — that's
   intentional, not a bug.

### Rating an answer

Every assistant answer has 👍/👎 buttons.

- 👍 just records that the answer was helpful.
- 👎 opens an escalation: KINDIX's support team gets a ticket with your school's contact
  information, so they can follow up with you directly if the assistant couldn't help.

### Managing conversations

- The left sidebar lists your previous conversations — click one to reopen it.
- **New chat** starts a fresh conversation without losing the old ones.
- If you leave the app idle for more than 10 minutes, the next visit starts fresh on the empty
  "how can I help you" screen rather than silently resuming your last chat — your conversation
  history is still there in the sidebar, it's just not auto-resumed.
- You only ever see your own school's conversations — accounts are fully separated.

## For KINDIX admins

Admin accounts aren't self-service — they're created out-of-band by whoever provisions KINDIX
staff accounts (see `docs/API.md`, `POST /auth/register-admin`). If you don't have credentials,
ask whoever manages the platform.

### Logging in

Log in at the same login screen schools use, with your admin email/password. You're taken to
`/admin` — schools never see this page and can't navigate to it.

### The dashboard

- **Feedback summary**: total 👍 and 👎 counts across all schools, so you can see at a glance
  whether the assistant is generally landing well.
- **Ticket count**: how many escalations are open vs. resolved.
- **Ticket list**: every escalation, newest first, with:
  - the reason it was escalated
  - the reporting school's name, email, phone, and country — so you can follow up with the right
    people without having to look them up elsewhere
  - a **Mark resolved** action once you've dealt with it

### Handling an escalation

1. Open the ticket list and pick an open ticket.
2. Use the school's contact info to follow up directly (by phone/email, outside this app — there's
   no in-app messaging to schools yet).
3. Once resolved, click **Mark resolved**. This just updates the ticket's status; it doesn't
   notify the school automatically.

## Language

The knowledge base and most questions are in Arabic, with some English content; the interface
switches text direction automatically per message (`dir="auto"`) while the KINDIX branding stays
left-to-right. Ask in whichever language you're comfortable with — the assistant is instructed to
answer in the same language as the question.

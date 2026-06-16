-- ============================================================
-- Align jojo_configs with Jojo's actual behavior: there is no
-- live voice AI. The phone rings the practice directly; Jojo
-- only activates on a missed call, via WhatsApp text. So:
--   greeting_message -> missed_call_message (first WhatsApp text sent after a miss)
--   call_flow         -> conversation_flow (WhatsApp text qualification/booking steps)
--   voicemail_message -> removed (no voicemail; nothing answers the call)
-- ============================================================

ALTER TABLE jojo_configs RENAME COLUMN greeting_message TO missed_call_message;
ALTER TABLE jojo_configs RENAME COLUMN call_flow TO conversation_flow;
ALTER TABLE jojo_configs DROP COLUMN voicemail_message;

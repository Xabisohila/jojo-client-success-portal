-- Correct the default timezone from Australia/Sydney to Africa/Johannesburg
UPDATE system_settings
SET value = 'Africa/Johannesburg'
WHERE key = 'company_timezone' AND value = 'Australia/Sydney';

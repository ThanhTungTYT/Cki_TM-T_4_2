-- Add the column required by ReportTicket.firstRespondedAt.
-- Safe to run more than once on MySQL.
SET @report_first_responded_column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'report_tickets'
      AND COLUMN_NAME = 'first_responded_at'
);

SET @report_first_responded_ddl = IF(
    @report_first_responded_column_exists = 0,
    'ALTER TABLE report_tickets ADD COLUMN first_responded_at DATETIME NULL',
    'SELECT 1'
);

PREPARE report_first_responded_stmt FROM @report_first_responded_ddl;
EXECUTE report_first_responded_stmt;
DEALLOCATE PREPARE report_first_responded_stmt;

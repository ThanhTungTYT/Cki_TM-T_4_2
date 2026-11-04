-- Test fixture for ServiceReviewService; run against tmdt_cki_4_2.
-- Re-running reuses this booking. No review is inserted.
SET NAMES utf8mb4;
START TRANSACTION;
SET @seed_code = 'TEST-REVIEW-13004-01';
SET @finished = DATE_SUB(NOW(), INTERVAL 1 DAY);

INSERT INTO bookings
    (booking_code, customer_id, partner_id, address_id, scheduled_start,
     scheduled_end, subtotal, discount_amount, points_discount, total_amount,
     status, version, customer_note, created_at, updated_at, completed_at)
SELECT @seed_code, u.id, ps.partner_id, a.id,
       DATE_SUB(@finished, INTERVAL 2 HOUR), @finished,
       s.base_price, 0, 0, s.base_price, 'COMPLETED', 0,
       'Test fixture: completed order for review testing, user 13004',
       DATE_SUB(@finished, INTERVAL 1 DAY), @finished, @finished
FROM users u
JOIN addresses a ON a.user_id = u.id AND a.id = 40021
JOIN services s ON s.id = 31001 AND s.status = 'ACTIVE'
JOIN partner_services ps ON ps.service_id = s.id AND ps.partner_id = 20001 AND ps.status = 'ACTIVE'
WHERE u.id = 13004 AND u.role = 'CUSTOMER'
  AND NOT EXISTS (SELECT 1 FROM bookings WHERE booking_code = @seed_code);

SET @booking_id = (SELECT id FROM bookings WHERE booking_code = @seed_code AND customer_id = 13004);

INSERT INTO booking_items
    (booking_id, service_id, service_name, quantity, unit_price, total_price, note, created_at)
SELECT b.id, s.id, s.name, 1, b.subtotal, b.subtotal,
       'Test fixture for customer review', b.created_at
FROM bookings b JOIN services s ON s.id = 31001
WHERE b.id = @booking_id
  AND NOT EXISTS (SELECT 1 FROM booking_items WHERE booking_id = @booking_id);

INSERT INTO payments
    (booking_id, payment_method, payment_provider, amount, status, created_at, paid_at)
SELECT id, 'CASH_ON_SERVICE', 'CASH', total_amount, 'SUCCESS', created_at, completed_at
FROM bookings WHERE id = @booking_id
  AND NOT EXISTS (SELECT 1 FROM payments WHERE booking_id = @booking_id);

INSERT INTO booking_status_history
    (booking_id, old_status, new_status, changed_by, note, created_at)
SELECT id, NULL, 'COMPLETED', customer_id,
       'Seeded completed test order for review testing', completed_at
FROM bookings WHERE id = @booking_id
  AND NOT EXISTS (SELECT 1 FROM booking_status_history WHERE booking_id = @booking_id);

COMMIT;

SELECT b.id AS booking_id, b.booking_code, b.customer_id, b.status,
       i.service_id, i.service_name, b.total_amount, p.status AS payment_status,
       (b.status = 'COMPLETED' AND NOT EXISTS (
           SELECT 1 FROM reviews r WHERE r.customer_id = b.customer_id AND r.service_id = i.service_id
       )) AS can_review
FROM bookings b JOIN booking_items i ON i.booking_id = b.id
JOIN payments p ON p.booking_id = b.id
WHERE b.id = @booking_id;

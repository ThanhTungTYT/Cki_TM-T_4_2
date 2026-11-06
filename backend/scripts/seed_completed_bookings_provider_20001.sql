-- Script tao 16 don hang mau hoan thanh (COMPLETED) cho Cong ty Nha Sach An Tam (partner_id = 20001)
-- Gan cho cac nhan vien:
--   21101 (Tran Thi Mai): 5 don
--   21102 (Nguyen Van Hung): 4 don
--   21103 (Pham Thi Lan): 3 don
--   21104 (Dang Quoc Bao): 4 don
-- Cap nhat day du bookings, booking_items, booking_assignments, payments, reviews, booking_status_history
-- Va dong bo total_completed_jobs, rating_average cho employees va partners.

SET NAMES utf8mb4;

START TRANSACTION;

-- 1. Cap nhat thoi gian completed_at cho 3 don COMPLETED cu neu con NULL
UPDATE bookings SET completed_at = '2026-10-30 10:00:00' WHERE id = 50086 AND completed_at IS NULL;
UPDATE bookings SET completed_at = '2026-10-31 10:00:00' WHERE id = 50087 AND completed_at IS NULL;
UPDATE bookings SET completed_at = '2026-10-31 11:00:00' WHERE id = 50088 AND completed_at IS NULL;

-- 2. Tao 16 don hang COMPLETED trong bookings
INSERT INTO bookings (
    id, booking_code, customer_id, address_id, scheduled_start, scheduled_end,
    subtotal, discount_amount, points_discount, total_amount, status,
    customer_note, created_at, updated_at, completed_at, idempotency_key, version,
    partner_id, full_address_snapshot, receiver_name_snapshot, receiver_phone_snapshot
) VALUES
-- Tran Thi Mai (21101) - 5 don
(50101, 'CLM-20001-01', 10004, 40004, '2026-08-10 08:00:00', '2026-08-10 10:00:00', 180000.00, 0.00, 0.00, 180000.00, 'COMPLETED', 'Lau sach san phong khach va phong ngu.', '2026-08-08 09:00:00', '2026-08-10 10:00:00', '2026-08-10 10:00:00', 'IDEM-20001-01', 0, 20001, '15 Võ Văn Tần, Phường Võ Thị Sáu, Quận 3, TP. Hồ Chí Minh', 'Phạm Quốc Bảo', '0911000003'),
(50102, 'CLM-20001-02', 10006, 40006, '2026-08-25 13:00:00', '2026-08-25 17:00:00', 340000.00, 0.00, 0.00, 340000.00, 'COMPLETED', 'Don dep can nha 2 tang, ve sinh nha tam ky.', '2026-08-23 10:00:00', '2026-08-25 17:00:00', '2026-08-25 17:00:00', 'IDEM-20001-02', 0, 20001, '53 Phan Xích Long, Phường 7, Phú Nhuận, TP. Hồ Chí Minh', 'Huỳnh Thanh Tùng', '0911000005'),
(50103, 'CLM-20001-03', 10007, 40007, '2026-09-12 09:00:00', '2026-09-12 12:00:00', 420000.00, 0.00, 0.00, 420000.00, 'COMPLETED', 'Ve sinh can ho chung cu 2 phong ngu truoc khi don vao.', '2026-09-10 14:00:00', '2026-09-12 12:00:00', '2026-09-12 12:00:00', 'IDEM-20001-03', 0, 20001, '68 Quang Trung, Phường 10, Gò Vấp, TP. Hồ Chí Minh', 'Đỗ Khánh Linh', '0911000006'),
(50104, 'CLM-20001-04', 10010, 40010, '2026-09-28 14:00:00', '2026-09-28 16:00:00', 180000.00, 0.00, 0.00, 180000.00, 'COMPLETED', 'Don dep nhanh phong khach va bep.', '2026-09-26 11:00:00', '2026-09-28 16:00:00', '2026-09-28 16:00:00', 'IDEM-20001-04', 0, 20001, '18 Sư Vạn Hạnh, Phường 12, Quận 10, TP. Hồ Chí Minh', 'Đặng Gia Hân', '0911000009'),
(50105, 'CLM-20001-05', 10012, 40012, '2026-10-15 08:00:00', '2026-10-15 15:00:00', 1450000.00, 0.00, 0.00, 1450000.00, 'COMPLETED', 'Tong ve sinh nha moi sua xong, tay sach vet son va xi mang.', '2026-10-13 16:00:00', '2026-10-15 15:00:00', '2026-10-15 15:00:00', 'IDEM-20001-05', 0, 20001, '88 Nguyễn Gia Trí, Phường 25, Bình Thạnh, TP. Hồ Chí Minh', 'Trương Kim Ngân', '0911000011'),

-- Nguyen Van Hung (21102) - 4 don
(50106, 'CLM-20001-06', 10013, 40013, '2026-08-18 08:30:00', '2026-08-18 10:30:00', 180000.00, 0.00, 0.00, 180000.00, 'COMPLETED', 'Lau chui cua kinh va phong khach.', '2026-08-16 15:00:00', '2026-08-18 10:30:00', '2026-08-18 10:30:00', 'IDEM-20001-06', 0, 20001, '27 Nguyễn Huệ, Bến Nghé, Quận 1, TP. Hồ Chí Minh', 'Hoàng Minh Khang', '0911000012'),
(50107, 'CLM-20001-07', 10014, 40014, '2026-09-05 13:00:00', '2026-09-05 17:00:00', 340000.00, 0.00, 0.00, 340000.00, 'COMPLETED', 'Ve sinh toan bo can nha 3 phong.', '2026-09-03 11:00:00', '2026-09-05 17:00:00', '2026-09-05 17:00:00', 'IDEM-20001-07', 0, 20001, '15 Võ Văn Tần, Phường Võ Thị Sáu, Quận 3, TP. Hồ Chí Minh', 'Vũ Thảo Nhi', '0911000013'),
(50108, 'CLM-20001-08', 10016, 40016, '2026-09-22 09:00:00', '2026-09-22 12:00:00', 420000.00, 0.00, 0.00, 420000.00, 'COMPLETED', 'Don can ho 2 phong ngu, khu vuc toilet va ban cong.', '2026-09-20 09:00:00', '2026-09-22 12:00:00', '2026-09-22 12:00:00', 'IDEM-20001-08', 0, 20001, '53 Phan Xích Long, Phường 7, Phú Nhuận, TP. Hồ Chí Minh', 'Lê Quỳnh Như', '0911000015'),
(50109, 'CLM-20001-09', 10019, 40019, '2026-10-10 08:00:00', '2026-10-10 15:00:00', 1450000.00, 0.00, 0.00, 1450000.00, 'COMPLETED', 'Tong ve sinh nha pho 1 tret 1 lau sau xay dung.', '2026-10-08 13:00:00', '2026-10-10 15:00:00', '2026-10-10 15:00:00', 'IDEM-20001-09', 0, 20001, '46 Tên Lửa, Bình Trị Đông, Bình Tân, TP. Hồ Chí Minh', 'Hồ Anh Thư', '0911000018'),

-- Pham Thi Lan (21103) - 3 don
(50110, 'CLM-20001-10', 10005, 40005, '2026-08-20 14:00:00', '2026-08-20 16:00:00', 180000.00, 0.00, 0.00, 180000.00, 'COMPLETED', 'Don nha 2 gio dinh ky.', '2026-08-18 10:00:00', '2026-08-20 16:00:00', '2026-08-20 16:00:00', 'IDEM-20001-10', 0, 20001, '35 Nguyễn Thị Thập, Tân Phong, Quận 7, TP. Hồ Chí Minh', 'Võ Ngọc Trâm', '0911000004'),
(50111, 'CLM-20001-11', 10007, 40007, '2026-09-15 08:00:00', '2026-09-15 12:00:00', 340000.00, 0.00, 0.00, 340000.00, 'COMPLETED', 'Don sach nha 4 gio, chu y phong bep.', '2026-09-13 14:00:00', '2026-09-15 12:00:00', '2026-09-15 12:00:00', 'IDEM-20001-11', 0, 20001, '68 Quang Trung, Phường 10, Gò Vấp, TP. Hồ Chí Minh', 'Đỗ Khánh Linh', '0911000006'),
(50112, 'CLM-20001-12', 10008, 40008, '2026-10-05 08:00:00', '2026-10-05 15:00:00', 1450000.00, 0.00, 0.00, 1450000.00, 'COMPLETED', 'Tong ve sinh can nha 100m2 sau thi cong noi that.', '2026-10-03 08:00:00', '2026-10-05 15:00:00', '2026-10-05 15:00:00', 'IDEM-20001-12', 0, 20001, '120 Cộng Hòa, Phường 2, Tân Bình, TP. Hồ Chí Minh', 'Bùi Đức Huy', '0911000007'),

-- Dang Quoc Bao (21104) - 4 don
(50113, 'CLM-20001-13', 10002, 40002, '2026-08-30 09:00:00', '2026-08-30 11:00:00', 180000.00, 0.00, 0.00, 180000.00, 'COMPLETED', 'Don dep can ho chung cu 2 gio.', '2026-08-28 17:00:00', '2026-08-30 11:00:00', '2026-08-30 11:00:00', 'IDEM-20001-13', 0, 20001, '88 Nguyễn Gia Trí, Phường 25, Bình Thạnh, TP. Hồ Chí Minh', 'Trần Hải Đăng', '0911000001'),
(50114, 'CLM-20001-14', 10004, 40004, '2026-09-18 13:00:00', '2026-09-18 17:00:00', 340000.00, 0.00, 0.00, 340000.00, 'COMPLETED', 'Lau chui toan dien nha 4 tieng.', '2026-09-16 10:00:00', '2026-09-18 17:00:00', '2026-09-18 17:00:00', 'IDEM-20001-14', 0, 20001, '15 Võ Văn Tần, Phường Võ Thị Sáu, Quận 3, TP. Hồ Chí Minh', 'Phạm Quốc Bảo', '0911000003'),
(50115, 'CLM-20001-15', 10006, 40006, '2026-10-02 08:30:00', '2026-10-02 11:30:00', 420000.00, 0.00, 0.00, 420000.00, 'COMPLETED', 'Ve sinh can ho 2 phong ngu, lau cua so kinh.', '2026-09-30 15:00:00', '2026-10-02 11:30:00', '2026-10-02 11:30:00', 'IDEM-20001-15', 0, 20001, '53 Phan Xích Long, Phường 7, Phú Nhuận, TP. Hồ Chí Minh', 'Huỳnh Thanh Tùng', '0911000005'),
(50116, 'CLM-20001-16', 10009, 40009, '2026-10-24 08:00:00', '2026-10-24 15:00:00', 1450000.00, 0.00, 0.00, 1450000.00, 'COMPLETED', 'Tong ve sinh nha sau son sua.', '2026-10-22 14:00:00', '2026-10-24 15:00:00', '2026-10-24 15:00:00', 'IDEM-20001-16', 0, 20001, '46 Tên Lửa, Bình Trị Đông, Bình Tân, TP. Hồ Chí Minh', 'Ngô Thị Ngọc Mai', '0911000008');

-- 3. Tao 16 items trong booking_items
INSERT INTO booking_items (
    id, booking_id, service_id, service_name, quantity, unit_price, total_price, note, created_at
) VALUES
-- Tran Thi Mai (50101 - 50105)
(51101, 50101, 31001, 'Dọn nhà 2 giờ', 1, 180000.00, 180000.00, 'Gói 2 giờ cơ bản', '2026-08-08 09:00:00'),
(51102, 50102, 31002, 'Dọn nhà 4 giờ', 1, 340000.00, 340000.00, 'Gói 4 giờ chuyên sâu', '2026-08-23 10:00:00'),
(51103, 50103, 31003, 'Vệ sinh căn hộ 2 phòng ngủ', 1, 420000.00, 420000.00, 'Gói căn hộ tiêu chuẩn', '2026-09-10 14:00:00'),
(51104, 50104, 31001, 'Dọn nhà 2 giờ', 1, 180000.00, 180000.00, 'Gói 2 giờ cơ bản', '2026-09-26 11:00:00'),
(51105, 50105, 31005, 'Tổng vệ sinh nhà sau xây dựng', 1, 1450000.00, 1450000.00, 'Gói sau xây dựng chuyên sâu', '2026-10-13 16:00:00'),

-- Nguyen Van Hung (50106 - 50109)
(51106, 50106, 31001, 'Dọn nhà 2 giờ', 1, 180000.00, 180000.00, 'Gói 2 giờ cơ bản', '2026-08-16 15:00:00'),
(51107, 50107, 31002, 'Dọn nhà 4 giờ', 1, 340000.00, 340000.00, 'Gói 4 giờ chuyên sâu', '2026-09-03 11:00:00'),
(51108, 50108, 31003, 'Vệ sinh căn hộ 2 phòng ngủ', 1, 420000.00, 420000.00, 'Gói căn hộ tiêu chuẩn', '2026-09-20 09:00:00'),
(51109, 50109, 31005, 'Tổng vệ sinh nhà sau xây dựng', 1, 1450000.00, 1450000.00, 'Gói sau xây dựng chuyên sâu', '2026-10-08 13:00:00'),

-- Pham Thi Lan (50110 - 50112)
(51110, 50110, 31001, 'Dọn nhà 2 giờ', 1, 180000.00, 180000.00, 'Gói 2 giờ cơ bản', '2026-08-18 10:00:00'),
(51111, 50111, 31002, 'Dọn nhà 4 giờ', 1, 340000.00, 340000.00, 'Gói 4 giờ chuyên sâu', '2026-09-13 14:00:00'),
(51112, 50112, 31005, 'Tổng vệ sinh nhà sau xây dựng', 1, 1450000.00, 1450000.00, 'Gói sau xây dựng chuyên sâu', '2026-10-03 08:00:00'),

-- Dang Quoc Bao (50113 - 50116)
(51113, 50113, 31001, 'Dọn nhà 2 giờ', 1, 180000.00, 180000.00, 'Gói 2 giờ cơ bản', '2026-08-28 17:00:00'),
(51114, 50114, 31002, 'Dọn nhà 4 giờ', 1, 340000.00, 340000.00, 'Gói 4 giờ chuyên sâu', '2026-09-16 10:00:00'),
(51115, 50115, 31003, 'Vệ sinh căn hộ 2 phòng ngủ', 1, 420000.00, 420000.00, 'Gói căn hộ tiêu chuẩn', '2026-09-30 15:00:00'),
(51116, 50116, 31005, 'Tổng vệ sinh nhà sau xây dựng', 1, 1450000.00, 1450000.00, 'Gói sau xây dựng chuyên sâu', '2026-10-22 14:00:00');

-- 4. Tao 16 phan cong trong booking_assignments
INSERT INTO booking_assignments (
    id, booking_id, partner_id, employee_id, status, assigned_at, accepted_at, started_at, completed_at, note
) VALUES
-- Tran Thi Mai (21101) - 5 assignments
(52101, 50101, 20001, 21101, 'COMPLETED', '2026-08-08 10:00:00', '2026-08-08 10:15:00', '2026-08-10 08:00:00', '2026-08-10 10:00:00', 'Hoàn thành tốt công việc'),
(52102, 50102, 20001, 21101, 'COMPLETED', '2026-08-23 11:00:00', '2026-08-23 11:10:00', '2026-08-25 13:00:00', '2026-08-25 17:00:00', 'Khách hàng rất hài lòng'),
(52103, 50103, 20001, 21101, 'COMPLETED', '2026-09-10 15:00:00', '2026-09-10 15:05:00', '2026-09-12 09:00:00', '2026-09-12 12:00:00', 'Vệ sinh sạch sẽ đúng cam kết'),
(52104, 50104, 20001, 21101, 'COMPLETED', '2026-09-26 12:00:00', '2026-09-26 12:10:00', '2026-09-28 14:00:00', '2026-09-28 16:00:00', 'Hoàn thành đúng giờ'),
(52105, 50105, 20001, 21101, 'COMPLETED', '2026-10-13 17:00:00', '2026-10-13 17:15:00', '2026-10-15 08:00:00', '2026-10-15 15:00:00', 'Công trình sau xây dựng xử lý rất kỹ'),

-- Nguyen Van Hung (21102) - 4 assignments
(52106, 50106, 20001, 21102, 'COMPLETED', '2026-08-16 16:00:00', '2026-08-16 16:10:00', '2026-08-18 08:30:00', '2026-08-18 10:30:00', 'Hoàn thành tốt công việc'),
(52107, 50107, 20001, 21102, 'COMPLETED', '2026-09-03 12:00:00', '2026-09-03 12:15:00', '2026-09-05 13:00:00', '2026-09-05 17:00:00', 'Nhân viên nhiệt tình, cẩn thận'),
(52108, 50108, 20001, 21102, 'COMPLETED', '2026-09-20 10:00:00', '2026-09-20 10:05:00', '2026-09-22 09:00:00', '2026-09-22 12:00:00', 'Căn hộ sạch tinh tươm'),
(52109, 50109, 20001, 21102, 'COMPLETED', '2026-10-08 14:00:00', '2026-10-08 14:20:00', '2026-10-10 08:00:00', '2026-10-10 15:00:00', 'Hoàn thành xuất sắc khối lượng nặng'),

-- Pham Thi Lan (21103) - 3 assignments
(52110, 50110, 20001, 21103, 'COMPLETED', '2026-08-18 11:00:00', '2026-08-18 11:15:00', '2026-08-20 14:00:00', '2026-08-20 16:00:00', 'Hoàn thành tốt công việc'),
(52111, 50111, 20001, 21103, 'COMPLETED', '2026-09-13 15:00:00', '2026-09-13 15:10:00', '2026-09-15 08:00:00', '2026-09-15 12:00:00', 'Khách hàng khen nhân viên chu đáo'),
(52112, 50112, 20001, 21103, 'COMPLETED', '2026-10-03 09:00:00', '2026-10-03 09:10:00', '2026-10-05 08:00:00', '2026-10-05 15:00:00', 'Công trình hoàn thành đúng tiến độ'),

-- Dang Quoc Bao (21104) - 4 assignments
(52113, 50113, 20001, 21104, 'COMPLETED', '2026-08-28 18:00:00', '2026-08-28 18:15:00', '2026-08-30 09:00:00', '2026-08-30 11:00:00', 'Thao tác chuyên nghiệp'),
(52114, 50114, 20001, 21104, 'COMPLETED', '2026-09-16 11:00:00', '2026-09-16 11:20:00', '2026-09-18 13:00:00', '2026-09-18 17:00:00', 'Lau dọn rất sạch sẽ và tận tâm'),
(52115, 50115, 20001, 21104, 'COMPLETED', '2026-09-30 16:00:00', '2026-09-30 16:10:00', '2026-10-02 08:30:00', '2026-10-02 11:30:00', 'Khách hàng đánh giá rất cao'),
(52116, 50116, 20001, 21104, 'COMPLETED', '2026-10-22 15:00:00', '2026-10-22 15:10:00', '2026-10-24 08:00:00', '2026-10-24 15:00:00', 'Nhà sạch bóng kin kít sau xây dựng');

-- 5. Tao 16 thanh toan trong payments
INSERT INTO payments (
    id, booking_id, payment_method, payment_provider, amount, transaction_code, status, created_at, paid_at
) VALUES
(54101, 50101, 'VNPAY', 'VNPAY_QR', 180000.00, 'TXN-CLM-20001-01', 'SUCCESS', '2026-08-08 09:05:00', '2026-08-08 09:07:00'),
(54102, 50102, 'VNPAY', 'VNPAY_QR', 340000.00, 'TXN-CLM-20001-02', 'SUCCESS', '2026-08-23 10:05:00', '2026-08-23 10:08:00'),
(54103, 50103, 'VNPAY', 'VNPAY_QR', 420000.00, 'TXN-CLM-20001-03', 'SUCCESS', '2026-09-10 14:05:00', '2026-09-10 14:09:00'),
(54104, 50104, 'VNPAY', 'VNPAY_QR', 180000.00, 'TXN-CLM-20001-04', 'SUCCESS', '2026-09-26 11:05:00', '2026-09-26 11:08:00'),
(54105, 50105, 'VNPAY', 'VNPAY_QR', 1450000.00, 'TXN-CLM-20001-05', 'SUCCESS', '2026-10-13 16:05:00', '2026-10-13 16:10:00'),
(54106, 50106, 'VNPAY', 'VNPAY_QR', 180000.00, 'TXN-CLM-20001-06', 'SUCCESS', '2026-08-16 15:05:00', '2026-08-16 15:08:00'),
(54107, 50107, 'VNPAY', 'VNPAY_QR', 340000.00, 'TXN-CLM-20001-07', 'SUCCESS', '2026-09-03 11:05:00', '2026-09-03 11:09:00'),
(54108, 50108, 'VNPAY', 'VNPAY_QR', 420000.00, 'TXN-CLM-20001-08', 'SUCCESS', '2026-09-20 09:05:00', '2026-09-20 09:08:00'),
(54109, 50109, 'VNPAY', 'VNPAY_QR', 1450000.00, 'TXN-CLM-20001-09', 'SUCCESS', '2026-10-08 13:05:00', '2026-10-08 13:12:00'),
(54110, 50110, 'VNPAY', 'VNPAY_QR', 180000.00, 'TXN-CLM-20001-10', 'SUCCESS', '2026-08-18 10:05:00', '2026-08-18 10:08:00'),
(54111, 50111, 'VNPAY', 'VNPAY_QR', 340000.00, 'TXN-CLM-20001-11', 'SUCCESS', '2026-09-13 14:05:00', '2026-09-13 14:10:00'),
(54112, 50112, 'VNPAY', 'VNPAY_QR', 1450000.00, 'TXN-CLM-20001-12', 'SUCCESS', '2026-10-03 08:05:00', '2026-10-03 08:12:00'),
(54113, 50113, 'VNPAY', 'VNPAY_QR', 180000.00, 'TXN-CLM-20001-13', 'SUCCESS', '2026-08-28 17:05:00', '2026-08-28 17:09:00'),
(54114, 50114, 'VNPAY', 'VNPAY_QR', 340000.00, 'TXN-CLM-20001-14', 'SUCCESS', '2026-09-16 10:05:00', '2026-09-16 10:08:00'),
(54115, 50115, 'VNPAY', 'VNPAY_QR', 420000.00, 'TXN-CLM-20001-15', 'SUCCESS', '2026-09-30 15:05:00', '2026-09-30 15:10:00'),
(54116, 50116, 'VNPAY', 'VNPAY_QR', 1450000.00, 'TXN-CLM-20001-16', 'SUCCESS', '2026-10-22 14:05:00', '2026-10-22 14:15:00');

-- 6. Tao 16 danh gia reviews (doc nhat giua customer_id va service_id)
INSERT INTO reviews (
    id, booking_id, customer_id, service_id, partner_id, employee_id, rating, comment, created_at
) VALUES
-- Tran Thi Mai (21101): ratings 5, 5, 5, 4, 5 => Avg 4.80
(55101, 50101, 10004, 31001, 20001, 21101, 5, 'Bạn Mai dọn dẹp rất tỉ mỉ, nhà cửa thơm tho sạch sẽ, tác phong nhanh nhẹn và lễ phép.', '2026-08-10 11:30:00'),
(55102, 50102, 10006, 31002, 20001, 21101, 5, 'Rất hài lòng về bạn Mai, lau dọn từ phòng khách đến nhà bếp đều sáng bóng, cẩn thận từng chi tiết.', '2026-08-25 18:00:00'),
(55103, 50103, 10007, 31003, 20001, 21101, 5, 'Căn hộ 2 phòng ngủ được vệ sinh sạch sẽ, nhà tắm và ban công đều được cọ rửa rất kỹ càng.', '2026-09-12 13:00:00'),
(55104, 50104, 10010, 31001, 20001, 21101, 4, 'Nhân viên làm việc nhiệt tình, đến đúng giờ, phòng khách và bếp rất sạch sẽ.', '2026-09-28 17:00:00'),
(55105, 50105, 10012, 31005, 20001, 21101, 5, 'Tổng vệ sinh rất chuyên nghiệp, xử lý sạch các vết sơn và bụi bám sau xây dựng, cho 5 sao!', '2026-10-15 16:30:00'),

-- Nguyen Van Hung (21102): ratings 5, 5, 4, 5 => Avg 4.75 (~4.8)
(55106, 50106, 10013, 31001, 20001, 21102, 5, 'Anh Hùng làm rất kỹ, lau cửa kính và sàn nhà sáng bóng, thái độ cực kỳ chuyên nghiệp.', '2026-08-18 11:30:00'),
(55107, 50107, 10014, 31002, 20001, 21102, 5, 'Nhân viên làm việc chăm chỉ, dọn dẹp gọn gàng ngăn nắp toàn bộ các phòng trong 4 tiếng.', '2026-09-05 18:00:00'),
(55108, 50108, 10016, 31003, 20001, 21102, 4, 'Dịch vụ tốt, nhân viên thân thiện, các khu vực toilet và bếp đều được chà rửa sạch sẽ.', '2026-09-22 13:30:00'),
(55109, 50109, 10019, 31005, 20001, 21102, 5, 'Rất hài lòng, khối lượng công việc sau xây dựng rất nặng nhưng anh Hùng làm rất tận tâm.', '2026-10-10 16:00:00'),

-- Pham Thi Lan (21103): ratings 5, 5, 4 => Avg 4.67 (~4.7)
(55110, 50110, 10005, 31001, 20001, 21103, 5, 'Chị Lan dọn rất chu đáo, dọn dẹp sạch tinh tươm và sắp xếp đồ đạc rất ngăn nắp, gọn gàng.', '2026-08-20 17:00:00'),
(55111, 50111, 10007, 31002, 20001, 21103, 5, 'Nhân viên làm việc nhiệt tình, vệ sinh sạch sẽ từng góc nhà, chắc chắn sẽ tiếp tục ủng hộ.', '2026-09-15 13:00:00'),
(55112, 50112, 10008, 31005, 20001, 21103, 4, 'Chất lượng dịch vụ tốt, nhân viên cẩn thận và có trách nhiệm cao với công việc.', '2026-10-05 16:00:00'),

-- Dang Quoc Bao (21104): ratings 5, 5, 5, 5 => Avg 5.00
(55113, 50113, 10002, 31001, 20001, 21104, 5, 'Anh Bảo rất chuyên nghiệp, dọn dẹp nhanh, sạch bóng và rất đúng hẹn.', '2026-08-30 12:00:00'),
(55114, 50114, 10004, 31002, 20001, 21104, 5, 'Cực kỳ ưng ý với thái độ và tay nghề của bạn Bảo, dọn rất kỹ không bỏ sót chỗ nào.', '2026-09-18 18:00:00'),
(55115, 50115, 10006, 31003, 20001, 21104, 5, 'Đánh giá 5 sao cho bạn Bảo, căn hộ được làm sạch đẹp tinh tươm, thơm mát dễ chịu.', '2026-10-02 12:30:00'),
(55116, 50116, 10009, 31005, 20001, 21104, 5, 'Làm việc rất chu đáo và tỉ mỉ, sàn nhà và cửa kính sáng choang không còn vết bụi bẩn nào.', '2026-10-24 16:30:00');

-- 7. Tao lich su trang thai trong booking_status_history
INSERT INTO booking_status_history (booking_id, old_status, new_status, changed_by, note, created_at) VALUES
-- 50101
(50101, NULL, 'CONFIRMED', 10004, 'Khách hàng đặt lịch thành công', '2026-08-08 09:00:00'),
(50101, 'CONFIRMED', 'ASSIGNED', 11001, 'Phân công cho nhân viên Trần Thị Mai', '2026-08-08 10:00:00'),
(50101, 'ASSIGNED', 'IN_PROGRESS', 12101, 'Nhân viên bắt đầu thực hiện công việc', '2026-08-10 08:00:00'),
(50101, 'IN_PROGRESS', 'COMPLETED', 12101, 'Nhân viên hoàn thành dịch vụ', '2026-08-10 10:00:00'),

-- 50102
(50102, NULL, 'CONFIRMED', 10006, 'Khách hàng đặt lịch thành công', '2026-08-23 10:00:00'),
(50102, 'CONFIRMED', 'ASSIGNED', 11001, 'Phân công cho nhân viên Trần Thị Mai', '2026-08-23 11:00:00'),
(50102, 'ASSIGNED', 'IN_PROGRESS', 12101, 'Nhân viên bắt đầu thực hiện công việc', '2026-08-25 13:00:00'),
(50102, 'IN_PROGRESS', 'COMPLETED', 12101, 'Nhân viên hoàn thành dịch vụ', '2026-08-25 17:00:00'),

-- 50103
(50103, NULL, 'CONFIRMED', 10007, 'Khách hàng đặt lịch thành công', '2026-09-10 14:00:00'),
(50103, 'CONFIRMED', 'ASSIGNED', 11001, 'Phân công cho nhân viên Trần Thị Mai', '2026-09-10 15:00:00'),
(50103, 'ASSIGNED', 'IN_PROGRESS', 12101, 'Nhân viên bắt đầu thực hiện công việc', '2026-09-12 09:00:00'),
(50103, 'IN_PROGRESS', 'COMPLETED', 12101, 'Nhân viên hoàn thành dịch vụ', '2026-09-12 12:00:00'),

-- 50104
(50104, NULL, 'CONFIRMED', 10010, 'Khách hàng đặt lịch thành công', '2026-09-26 11:00:00'),
(50104, 'CONFIRMED', 'ASSIGNED', 11001, 'Phân công cho nhân viên Trần Thị Mai', '2026-09-26 12:00:00'),
(50104, 'ASSIGNED', 'IN_PROGRESS', 12101, 'Nhân viên bắt đầu thực hiện công việc', '2026-09-28 14:00:00'),
(50104, 'IN_PROGRESS', 'COMPLETED', 12101, 'Nhân viên hoàn thành dịch vụ', '2026-09-28 16:00:00'),

-- 50105
(50105, NULL, 'CONFIRMED', 10012, 'Khách hàng đặt lịch thành công', '2026-10-13 16:00:00'),
(50105, 'CONFIRMED', 'ASSIGNED', 11001, 'Phân công cho nhân viên Trần Thị Mai', '2026-10-13 17:00:00'),
(50105, 'ASSIGNED', 'IN_PROGRESS', 12101, 'Nhân viên bắt đầu thực hiện công việc', '2026-10-15 08:00:00'),
(50105, 'IN_PROGRESS', 'COMPLETED', 12101, 'Nhân viên hoàn thành dịch vụ', '2026-10-15 15:00:00'),

-- 50106
(50106, NULL, 'CONFIRMED', 10013, 'Khách hàng đặt lịch thành công', '2026-08-16 15:00:00'),
(50106, 'CONFIRMED', 'ASSIGNED', 11001, 'Phân công cho nhân viên Nguyễn Văn Hùng', '2026-08-16 16:00:00'),
(50106, 'ASSIGNED', 'IN_PROGRESS', 12102, 'Nhân viên bắt đầu thực hiện công việc', '2026-08-18 08:30:00'),
(50106, 'IN_PROGRESS', 'COMPLETED', 12102, 'Nhân viên hoàn thành dịch vụ', '2026-08-18 10:30:00'),

-- 50107
(50107, NULL, 'CONFIRMED', 10014, 'Khách hàng đặt lịch thành công', '2026-09-03 11:00:00'),
(50107, 'CONFIRMED', 'ASSIGNED', 11001, 'Phân công cho nhân viên Nguyễn Văn Hùng', '2026-09-03 12:00:00'),
(50107, 'ASSIGNED', 'IN_PROGRESS', 12102, 'Nhân viên bắt đầu thực hiện công việc', '2026-09-05 13:00:00'),
(50107, 'IN_PROGRESS', 'COMPLETED', 12102, 'Nhân viên hoàn thành dịch vụ', '2026-09-05 17:00:00'),

-- 50108
(50108, NULL, 'CONFIRMED', 10016, 'Khách hàng đặt lịch thành công', '2026-09-20 09:00:00'),
(50108, 'CONFIRMED', 'ASSIGNED', 11001, 'Phân công cho nhân viên Nguyễn Văn Hùng', '2026-09-20 10:00:00'),
(50108, 'ASSIGNED', 'IN_PROGRESS', 12102, 'Nhân viên bắt đầu thực hiện công việc', '2026-09-22 09:00:00'),
(50108, 'IN_PROGRESS', 'COMPLETED', 12102, 'Nhân viên hoàn thành dịch vụ', '2026-09-22 12:00:00'),

-- 50109
(50109, NULL, 'CONFIRMED', 10019, 'Khách hàng đặt lịch thành công', '2026-10-08 13:00:00'),
(50109, 'CONFIRMED', 'ASSIGNED', 11001, 'Phân công cho nhân viên Nguyễn Văn Hùng', '2026-10-08 14:00:00'),
(50109, 'ASSIGNED', 'IN_PROGRESS', 12102, 'Nhân viên bắt đầu thực hiện công việc', '2026-10-10 08:00:00'),
(50109, 'IN_PROGRESS', 'COMPLETED', 12102, 'Nhân viên hoàn thành dịch vụ', '2026-10-10 15:00:00'),

-- 50110
(50110, NULL, 'CONFIRMED', 10005, 'Khách hàng đặt lịch thành công', '2026-08-18 10:00:00'),
(50110, 'CONFIRMED', 'ASSIGNED', 11001, 'Phân công cho nhân viên Phạm Thị Lan', '2026-08-18 11:00:00'),
(50110, 'ASSIGNED', 'IN_PROGRESS', 12103, 'Nhân viên bắt đầu thực hiện công việc', '2026-08-20 14:00:00'),
(50110, 'IN_PROGRESS', 'COMPLETED', 12103, 'Nhân viên hoàn thành dịch vụ', '2026-08-20 16:00:00'),

-- 50111
(50111, NULL, 'CONFIRMED', 10007, 'Khách hàng đặt lịch thành công', '2026-09-13 14:00:00'),
(50111, 'CONFIRMED', 'ASSIGNED', 11001, 'Phân công cho nhân viên Phạm Thị Lan', '2026-09-13 15:00:00'),
(50111, 'ASSIGNED', 'IN_PROGRESS', 12103, 'Nhân viên bắt đầu thực hiện công việc', '2026-09-15 08:00:00'),
(50111, 'IN_PROGRESS', 'COMPLETED', 12103, 'Nhân viên hoàn thành dịch vụ', '2026-09-15 12:00:00'),

-- 50112
(50112, NULL, 'CONFIRMED', 10008, 'Khách hàng đặt lịch thành công', '2026-10-03 08:00:00'),
(50112, 'CONFIRMED', 'ASSIGNED', 11001, 'Phân công cho nhân viên Phạm Thị Lan', '2026-10-03 09:00:00'),
(50112, 'ASSIGNED', 'IN_PROGRESS', 12103, 'Nhân viên bắt đầu thực hiện công việc', '2026-10-05 08:00:00'),
(50112, 'IN_PROGRESS', 'COMPLETED', 12103, 'Nhân viên hoàn thành dịch vụ', '2026-10-05 15:00:00'),

-- 50113
(50113, NULL, 'CONFIRMED', 10002, 'Khách hàng đặt lịch thành công', '2026-08-28 17:00:00'),
(50113, 'CONFIRMED', 'ASSIGNED', 11001, 'Phân công cho nhân viên Đặng Quốc Bảo', '2026-08-28 18:00:00'),
(50113, 'ASSIGNED', 'IN_PROGRESS', 12104, 'Nhân viên bắt đầu thực hiện công việc', '2026-08-30 09:00:00'),
(50113, 'IN_PROGRESS', 'COMPLETED', 12104, 'Nhân viên hoàn thành dịch vụ', '2026-08-30 11:00:00'),

-- 50114
(50114, NULL, 'CONFIRMED', 10004, 'Khách hàng đặt lịch thành công', '2026-09-16 10:00:00'),
(50114, 'CONFIRMED', 'ASSIGNED', 11001, 'Phân công cho nhân viên Đặng Quốc Bảo', '2026-09-16 11:00:00'),
(50114, 'ASSIGNED', 'IN_PROGRESS', 12104, 'Nhân viên bắt đầu thực hiện công việc', '2026-09-18 13:00:00'),
(50114, 'IN_PROGRESS', 'COMPLETED', 12104, 'Nhân viên hoàn thành dịch vụ', '2026-09-18 17:00:00'),

-- 50115
(50115, NULL, 'CONFIRMED', 10006, 'Khách hàng đặt lịch thành công', '2026-09-30 15:00:00'),
(50115, 'CONFIRMED', 'ASSIGNED', 11001, 'Phân công cho nhân viên Đặng Quốc Bảo', '2026-09-30 16:00:00'),
(50115, 'ASSIGNED', 'IN_PROGRESS', 12104, 'Nhân viên bắt đầu thực hiện công việc', '2026-10-02 08:30:00'),
(50115, 'IN_PROGRESS', 'COMPLETED', 12104, 'Nhân viên hoàn thành dịch vụ', '2026-10-02 11:30:00'),

-- 50116
(50116, NULL, 'CONFIRMED', 10009, 'Khách hàng đặt lịch thành công', '2026-10-22 14:00:00'),
(50116, 'CONFIRMED', 'ASSIGNED', 11001, 'Phân công cho nhân viên Đặng Quốc Bảo', '2026-10-22 15:00:00'),
(50116, 'ASSIGNED', 'IN_PROGRESS', 12104, 'Nhân viên bắt đầu thực hiện công việc', '2026-10-24 08:00:00'),
(50116, 'IN_PROGRESS', 'COMPLETED', 12104, 'Nhân viên hoàn thành dịch vụ', '2026-10-24 15:00:00');

-- 8. Dong bo lai thong ke total_completed_jobs va rating_average cho employees
UPDATE employees e SET 
    total_completed_jobs = (SELECT COUNT(*) FROM booking_assignments ba WHERE ba.employee_id = e.id AND ba.status = 'COMPLETED'),
    rating_average = (SELECT ROUND(AVG(r.rating), 2) FROM reviews r WHERE r.employee_id = e.id)
WHERE e.partner_id = 20001;

-- 9. Dong bo lai thong ke total_completed_jobs va rating_average cho partner 20001
UPDATE partners p SET 
    total_completed_jobs = (SELECT COUNT(*) FROM bookings b WHERE b.partner_id = p.id AND b.status = 'COMPLETED'),
    rating_average = (SELECT ROUND(AVG(r.rating), 2) FROM reviews r WHERE r.partner_id = p.id)
WHERE p.id = 20001;

COMMIT;

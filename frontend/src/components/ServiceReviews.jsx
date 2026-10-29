import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { reviewApi } from '../services/api';
import './ServiceReviews.css';

const PAGE_SIZE = 10;

function hasAccessToken() {
    return Boolean(
        sessionStorage.getItem('accessToken') ||
        localStorage.getItem('accessToken')
    );
}

function StarRating({ value, interactive = false, onChange }) {
    return (
        <div className={`service-review-stars${interactive ? ' is-interactive' : ''}`}>
            {[1, 2, 3, 4, 5].map(star => interactive ? (
                <button
                    key={star}
                    type="button"
                    className={star <= value ? 'is-selected' : ''}
                    aria-label={`${star} sao`}
                    aria-pressed={star === value}
                    onClick={() => onChange(star)}
                >
                    ★
                </button>
            ) : (
                <span key={star} className={star <= value ? 'is-selected' : ''}>★</span>
            ))}
        </div>
    );
}

function formatReviewDate(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? ''
        : date.toLocaleDateString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
}

export default function ServiceReviews({ serviceId }) {
    const navigate = useNavigate();
    const [reviews, setReviews] = useState([]);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [hasReviewed, setHasReviewed] = useState(false);
    const [canReview, setCanReview] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(hasAccessToken);
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [error, setError] = useState('');

    async function loadPage(nextPage, append = false, signal) {
        const result = await reviewApi.getServiceReviews(serviceId, nextPage, signal);
        setReviews(current => append ? [...current, ...result.reviews] : result.reviews);
        setPage(result.page);
        setHasMore(result.hasMore);
        setHasReviewed(result.hasReviewed);
        setCanReview(result.canReview);
    }

    useEffect(() => {
        const controller = new AbortController();
        setIsLoading(true);
        setError('');
        setReviews([]);
        setPage(0);
        loadPage(0, false, controller.signal)
            .catch(err => {
                if (err.name !== 'AbortError') setError(err.message || 'Không thể tải bình luận.');
            })
            .finally(() => {
                if (!controller.signal.aborted) setIsLoading(false);
            });
        return () => controller.abort();
    }, [serviceId]);

    async function handleLoadMore() {
        setIsLoadingMore(true);
        setError('');
        try {
            await loadPage(page + 1, true);
        } catch (err) {
            setError(err.message || 'Không thể tải thêm bình luận.');
        } finally {
            setIsLoadingMore(false);
        }
    }

    async function handleSubmit(event) {
        event.preventDefault();
        if (!isLoggedIn) {
            navigate('/login');
            return;
        }

        setIsSubmitting(true);
        setError('');
        try {
            await reviewApi.createServiceReview(serviceId, { rating, comment });
            setComment('');
            setRating(5);
            setHasReviewed(true);
            await loadPage(0);
        } catch (err) {
            setError(err.message || 'Không thể gửi đánh giá.');
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleDelete(reviewId) {
        setDeletingId(reviewId);
        setError('');
        try {
            await reviewApi.deleteServiceReview(serviceId, reviewId);
            setHasReviewed(false);
            await loadPage(0);
        } catch (err) {
            setError(err.message || 'Không thể xóa bình luận.');
        } finally {
            setDeletingId(null);
        }
    }

    return (
        <section className="service-reviews" aria-labelledby="service-reviews-title">
            <div className="service-reviews-heading">
                <div>
                    <span className="service-reviews-eyebrow">Trải nghiệm khách hàng</span>
                    <h2 id="service-reviews-title">Đánh giá và bình luận</h2>
                </div>
                <span className="service-reviews-count">
                    {reviews.length}{hasMore ? '+' : ''} đánh giá
                </span>
            </div>

            {isLoggedIn && canReview && !hasReviewed && (
                <form className="service-review-form" onSubmit={handleSubmit}>
                    <label className="service-review-form-label">Đánh giá của bạn</label>
                    <StarRating value={rating} interactive onChange={setRating} />
                    <label className="service-review-form-label" htmlFor="service-review-comment">
                        Nội dung bình luận
                    </label>
                    <textarea
                        id="service-review-comment"
                        value={comment}
                        onChange={event => setComment(event.target.value)}
                        maxLength={2000}
                        placeholder="Chia sẻ trải nghiệm của bạn về dịch vụ..."
                        required
                    />
                    <div className="service-review-form-footer">
                        <span>{comment.length}/2000 ký tự</span>
                        <button type="submit" disabled={isSubmitting || !comment.trim()}>
                            {isSubmitting ? 'Đang gửi...' : 'Gửi đánh giá'}
                        </button>
                    </div>
                </form>
            )}

            {!isLoggedIn && (
                <div className="service-review-login-prompt">
                    <span>Đăng nhập để chia sẻ đánh giá của bạn.</span>
                    <button type="button" onClick={() => navigate('/login')}>Đăng nhập</button>
                </div>
            )}

            {isLoggedIn && hasReviewed && (
                <p className="service-review-already-posted">
                    Bạn đã gửi đánh giá cho dịch vụ này. Bình luận của bạn được hiển thị đầu tiên.
                </p>
            )}

            {isLoggedIn && !isLoading && !error && !hasReviewed && !canReview && (
                <p className="service-review-already-posted">
                    Bạn cần sử dụng dịch vụ và có đơn hàng ở trạng thái hoàn tất trước khi đánh giá.
                </p>
            )}

            {error && <p className="service-review-error" role="alert">{error}</p>}

            {isLoading ? (
                <p className="service-reviews-empty">Đang tải bình luận...</p>
            ) : reviews.length === 0 ? (
                <p className="service-reviews-empty">Chưa có bình luận. Hãy là người đầu tiên đánh giá dịch vụ này.</p>
            ) : (
                <div className="service-review-list">
                    {reviews.map(review => (
                        <article className={`service-review${review.mine ? ' is-mine' : ''}`} key={review.id}>
                            <div className="service-review-avatar" aria-hidden="true">
                                {(review.customerName || 'K').trim().charAt(0).toUpperCase()}
                            </div>
                            <div className="service-review-content">
                                <div className="service-review-topline">
                                    <div className="service-review-author">
                                        <strong>{review.customerName || 'Khách hàng'}</strong>
                                        {review.mine && <span className="service-review-you">Bạn</span>}
                                        <time dateTime={review.createdAt}>{formatReviewDate(review.createdAt)}</time>
                                    </div>
                                    {review.mine && (
                                        <button
                                            type="button"
                                            className="service-review-delete"
                                            onClick={() => handleDelete(review.id)}
                                            disabled={deletingId === review.id}
                                            aria-label="Xóa bình luận của bạn"
                                        >
                                            {deletingId === review.id ? 'Đang xóa...' : 'Xóa'}
                                        </button>
                                    )}
                                </div>
                                <StarRating value={review.rating} />
                                <p className="service-review-comment">{review.comment}</p>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            {!isLoading && hasMore && (
                <button
                    type="button"
                    className="service-review-load-more"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                >
                    {isLoadingMore ? 'Đang tải...' : 'Xem thêm 10 bình luận'}
                </button>
            )}
        </section>
    );
}

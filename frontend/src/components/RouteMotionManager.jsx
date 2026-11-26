import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const REVEAL_SELECTORS = [
    ".home .section-heading",
    ".home .service-card",
    ".home .partner-card",
    ".home .process-card",
    ".home .commitment-card",
    ".home .review-card",
    ".home .cta",
    ".services-page .service-card",
    ".public-providers-page .providers-card",
    ".provider-main .provider-service-card",
    ".rewards-page .rewards-gift",
    ".rewards-page .rewards-panel",
    ".checkout-page .checkout-section-card",
    ".cart-page .provider-cart-card",
    ".bp-page .bp-card",
    ".customer-reports-page .report-card",
].join(", ");

/**
 * Manages global route-change choreography:
 * 1. Sleek top brand progress bar on navigation
 * 2. Automatic scroll-to-top on pathname change
 * 3. Safe IntersectionObserver scroll-reveal for cards & sections (with immediate visibility fallback)
 */
export function RouteMotionManager() {
    const location = useLocation();
    const [progressKey, setProgressKey] = useState(0);
    const [showBar, setShowBar] = useState(false);

    // Trigger top route progress sweep & reset scroll position cleanly
    useEffect(() => {
        if (!location.hash) {
            window.scrollTo({ top: 0, left: 0, behavior: "instant" });
        }

        setProgressKey((k) => k + 1);
        setShowBar(true);

        const timer = setTimeout(() => {
            setShowBar(false);
        }, 520);

        return () => clearTimeout(timer);
    }, [location.pathname]);

    // Progressive Scroll Reveal observer for public & customer pages
    useEffect(() => {
        const prefersReduced =
            typeof window !== "undefined" &&
            window.matchMedia &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        if (prefersReduced || typeof IntersectionObserver === "undefined") {
            return undefined;
        }

        const observed = new WeakSet();

        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("cm-reveal-visible");
                        io.unobserve(entry.target);
                    }
                });
            },
            {
                rootMargin: "0px 0px -36px 0px",
                threshold: 0.06,
            }
        );

        const scanAndObserve = () => {
            const nodes = document.querySelectorAll(REVEAL_SELECTORS);
            const vh = window.innerHeight || 900;

            nodes.forEach((el) => {
                if (observed.has(el)) return;
                observed.add(el);

                const rect = el.getBoundingClientRect();
                // Already visible in viewport: animate immediately without waiting for scroll
                if (rect.top < vh * 0.95) {
                    el.classList.add("cm-reveal", "cm-reveal-visible");
                    return;
                }

                // Assign subtle sibling stagger (capped so rows never feel sluggish)
                const parent = el.parentElement;
                if (parent) {
                    const idx = Array.prototype.indexOf.call(parent.children, el);
                    const staggerMs = Math.min((idx % 6) * 55, 275);
                    el.style.setProperty("--cm-reveal-delay", `${staggerMs}ms`);
                }

                el.classList.add("cm-reveal");
                io.observe(el);
            });
        };

        // Initial scan + re-scan when async API data renders cards (e.g., Home services / Services grid)
        const rafId = requestAnimationFrame(scanAndObserve);
        const mo = new MutationObserver(() => {
            scanAndObserve();
        });
        const root = document.getElementById("root");
        if (root) {
            mo.observe(root, { childList: true, subtree: true });
        }

        // Safety fallback so no element can ever stay hidden if layout changes dramatically
        const safetyTimer = setTimeout(() => {
            document.querySelectorAll(".cm-reveal:not(.cm-reveal-visible)").forEach((el) => {
                const rect = el.getBoundingClientRect();
                if (rect.top < (window.innerHeight || 900) * 1.15) {
                    el.classList.add("cm-reveal-visible");
                }
            });
        }, 900);

        return () => {
            cancelAnimationFrame(rafId);
            clearTimeout(safetyTimer);
            mo.disconnect();
            io.disconnect();
        };
    }, [location.pathname, location.search]);

    if (!showBar) return null;

    return (
        <div className="cm-route-progress-track" aria-hidden="true">
            <div key={progressKey} className="cm-route-progress-bar" />
        </div>
    );
}

/**
 * Lightweight smooth page-entrance transition wrapper keyed by route pathname.
 */
export function PageTransition({ children, className = "" }) {
    const location = useLocation();
    return (
        <div
            key={location.pathname}
            className={`cm-page-transition${className ? ` ${className}` : ""}`}
        >
            {children}
        </div>
    );
}

export default RouteMotionManager;

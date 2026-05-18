





function splitHeroLetters() {
    document.querySelectorAll('[data-split]').forEach(el => {
        const text = el.textContent;
        el.innerHTML = '';
        [...text].forEach((char, i) => {
            const span = document.createElement('span');
            span.classList.add('hero-letter');
            span.textContent = char === ' ' ? '\u00A0' : char;
            span.style.animation = `letterDrop 0.6s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.038}s both`;
            el.appendChild(span);
        });
    });
}



function initReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const delay = entry.target.dataset.delay || 0;
                setTimeout(() => entry.target.classList.add('visible'), Number(delay));
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}



function initFaq() {
    document.querySelectorAll('.faq-item').forEach(item => {
        const trigger = item.querySelector('.faq-trigger');
        const body    = item.querySelector('.faq-body');
        trigger.addEventListener('click', () => {
            const isOpen = item.classList.contains('is-open');
            document.querySelectorAll('.faq-item').forEach(other => {
                other.classList.remove('is-open');
                other.querySelector('.faq-body').style.maxHeight = '0px';
            });
            if (!isOpen) {
                item.classList.add('is-open');
                body.style.maxHeight = body.scrollHeight + 'px';
            }
        });
    });
}



function initModal() {
    const overlay = document.getElementById('regulamin-modal');
    window.openModal = () => {
        overlay.classList.add('is-open');
        document.body.style.overflow = 'hidden';
    };
    window.closeModal = () => {
        overlay.classList.remove('is-open');
        document.body.style.overflow = '';
    };
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}



function initNavScroll() {
    const nav = document.querySelector('.site-nav');
    window.addEventListener('scroll', () => {
        nav.style.boxShadow = window.scrollY > 30 ? '0 1px 40px rgba(0,0,0,.7)' : 'none';
    }, { passive: true });
}

function initCardTilt() {
    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('mousemove', e => {
            const r  = card.getBoundingClientRect();
            const rx = ((e.clientY - r.top  - r.height / 2) / (r.height / 2)) * -4;
            const ry = ((e.clientX - r.left - r.width  / 2) / (r.width  / 2)) *  4;
            card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-7px) scale(1.01)`;
        });
        card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    });
}



document.addEventListener('DOMContentLoaded', () => {
    splitHeroLetters();
    initReveal();
    initFaq();
    initModal();
    initNavScroll();
    initCardTilt();
});



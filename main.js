(function () {
  "use strict";

  var openE2eeModal = function () {};

  var prefersReduced =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var SUPPORTED_LOCALES = [
    "cs",
    "de",
    "el",
    "en",
    "es",
    "fr",
    "hr",
    "it",
    "ja",
    "ko",
    "nb",
    "nl",
    "pl",
    "pt",
    "sk",
    "sv",
    "tr",
    "uk",
    "zh",
  ];

  var supportedSet = {};
  SUPPORTED_LOCALES.forEach(function (l) {
    supportedSet[l] = true;
  });

  function normalizeLocaleTag(tag) {
    if (!tag || typeof tag !== "string") return null;
    var primary = tag.toLowerCase().replace(/_/g, "-").split("-")[0];
    if (supportedSet[primary]) return primary;
    return null;
  }

  function pickLocale() {
    var list = [];
    if (navigator.languages && navigator.languages.length) {
      for (var i = 0; i < navigator.languages.length; i++) {
        list.push(navigator.languages[i]);
      }
    }
    if (navigator.language) list.push(navigator.language);
    for (var j = 0; j < list.length; j++) {
      var loc = normalizeLocaleTag(list[j]);
      if (loc) return loc;
    }
    return "en";
  }

  function getPath(obj, path) {
    if (!obj || !path) return undefined;
    var parts = path.split(".");
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      var key = parts[i];
      cur = /^\d+$/.test(key) ? cur[Number(key)] : cur[key];
    }
    return cur;
  }

  function setModalScrollLock() {
    var sec = document.getElementById("security-modal");
    var e2ee = document.getElementById("e2ee-modal");
    var contact = document.getElementById("contact-modal");
    var documents = document.getElementById("documents-modal");
    var downloadChoice = document.getElementById("download-choice-modal");
    var locked =
      (sec && !sec.hasAttribute("hidden")) ||
      (e2ee && !e2ee.hasAttribute("hidden")) ||
      (contact && !contact.hasAttribute("hidden")) ||
      (documents && !documents.hasAttribute("hidden")) ||
      (downloadChoice && !downloadChoice.hasAttribute("hidden"));
    document.documentElement.style.overflow = locked ? "hidden" : "";
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function localeToMdFilenameCode(primary) {
    var p = (primary || "en").toLowerCase();
    if (p === "nb") return "no";
    var inRepo = {
      bg: 1,
      cs: 1,
      da: 1,
      de: 1,
      el: 1,
      en: 1,
      fi: 1,
      fr: 1,
      hu: 1,
      it: 1,
      nl: 1,
      no: 1,
      pl: 1,
      pt: 1,
      ro: 1,
      ru: 1,
      sk: 1,
      sv: 1,
      tr: 1,
      uk: 1,
    };
    if (inRepo[p]) return p;
    return "en";
  }

  function fetchLocalizedMarkdown(subfolder) {
    var lang = document.documentElement.getAttribute("lang") || "en";
    var primary = lang.toLowerCase().split("-")[0];
    var termsPlOnly = subfolder === "regulamin";
    var code = termsPlOnly ? "pl" : localeToMdFilenameCode(primary);
    var base = "dokumenty/" + subfolder + "/";

    function loadFile(c) {
      return fetch(base + c + ".md", { credentials: "same-origin" }).then(
        function (r) {
          if (!r.ok) throw new Error("md");
          return r.text();
        }
      );
    }

    function nonEmpty(text) {
      if (text == null || !String(text).trim()) throw new Error("empty");
      return String(text);
    }

    return loadFile(code)
      .then(nonEmpty)
      .catch(function () {
        if (termsPlOnly) throw new Error("md");
        if (code !== "en") return loadFile("en").then(nonEmpty);
        throw new Error("md");
      });
  }

  function markdownPlainToHtml(raw) {
    var blocks = String(raw)
      .replace(/\r\n/g, "\n")
      .split(/\n{2,}/)
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
    if (!blocks.length) {
      return '<div class="documents-modal__doc"></div>';
    }
    return (
      '<div class="documents-modal__doc">' +
      blocks
        .map(function (block) {
          return (
            '<p class="documents-modal__p">' +
            escapeHtml(block).replace(/\n/g, "<br />") +
            "</p>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function loadMessages(locale) {
    var url = "i18n/" + locale + ".json";
    return fetch(url, { credentials: "same-origin" }).then(function (r) {
      if (!r.ok) throw new Error("i18n " + r.status);
      return r.json();
    });
  }

  function applyI18n(data) {
    if (!data || typeof data !== "object") return;

    var metaTitle = getPath(data, "meta.title");
    if (metaTitle) document.title = metaTitle;

    var metaDesc = getPath(data, "meta.description");
    if (metaDesc) {
      var m = document.querySelector('meta[name="description"]');
      if (m) m.setAttribute("content", metaDesc);
    }

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      var val = getPath(data, key);
      if (val != null && typeof val === "string") el.textContent = val;
    });

    document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-html");
      var val = getPath(data, key);
      if (val != null && typeof val === "string") el.innerHTML = val;
    });

    document.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
      var raw = el.getAttribute("data-i18n-attr");
      if (!raw || raw.indexOf("|") === -1) return;
      var pipe = raw.indexOf("|");
      var attr = raw.slice(0, pipe).trim();
      var key = raw.slice(pipe + 1).trim();
      var val = getPath(data, key);
      if (val != null && typeof val === "string") el.setAttribute(attr, val);
    });
  }

  function initI18n() {
    var requested = pickLocale();
    var resolved = requested;

    return loadMessages(requested)
      .catch(function () {
        resolved = "en";
        return loadMessages("en");
      })
      .then(function (data) {
        applyI18n(data);
        document.documentElement.lang = resolved;
      })
      .catch(function () {
        document.documentElement.lang = "en";
      });
  }

  function initReveal() {
    var nodes = document.querySelectorAll(".reveal");
    if (!nodes.length) return;

    if (prefersReduced) {
      nodes.forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { root: null, rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );

    nodes.forEach(function (el) {
      observer.observe(el);
    });
  }

  function preventEmptyHashNav() {
    document.addEventListener("click", function (e) {
      var a = e.target && e.target.closest && e.target.closest("a[href='#']");
      if (!a) return;
      e.preventDefault();
    });
  }

  function initPrimaryCtaScrollToBottom() {
    var btn = document.querySelector(".btn.btn--primary");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var maxY =
        document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({
        top: Math.max(0, maxY),
        behavior: prefersReduced ? "auto" : "smooth",
      });
    });
  }

  function assetUrl(relativePath) {
    try {
      return new URL(relativePath, window.location.href).href;
    } catch (e) {
      return relativePath;
    }
  }

  function detectStorePlatform() {
    try {
      var params = new URLSearchParams(window.location.search);
      var q = (params.get("store") || "").toLowerCase().trim();
      if (q === "ios" || q === "iphone" || q === "ipad") return "ios";
      if (q === "android") return "android";
      if (q === "desktop" || q === "pc" || q === "web") return "desktop";
    } catch (e) {}

    var ua = navigator.userAgent || "";
    if (/iPad|iPhone|iPod/.test(ua)) return "ios";
    if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
      return "ios";
    if (/Android/i.test(ua)) return "android";
    return "desktop";
  }

  function initStoreCtaAndModal() {
    var root = document.querySelector("[data-store-cta]");
    var popup = document.getElementById("store-desktop-popup");
    if (!root || !popup) return;

    var desktop = root.querySelector(".js-cta-desktop");
    var ios = root.querySelector(".js-cta-ios");
    var android = root.querySelector(".js-cta-android");
    if (!desktop || !ios || !android) return;

    var iosImg = ios.querySelector("img");
    var androidImg = android.querySelector("img");
    if (iosImg) iosImg.src = assetUrl("app-store.svg");
    if (androidImg) androidImg.src = assetUrl("google-play.svg");

    var platform = detectStorePlatform();
    document.documentElement.setAttribute("data-store-mode", platform);

    function setStoreCtaAria() {
      desktop.setAttribute("aria-hidden", platform !== "desktop" ? "true" : "false");
      ios.setAttribute("aria-hidden", platform !== "ios" ? "true" : "false");
      android.setAttribute("aria-hidden", platform !== "android" ? "true" : "false");
    }
    setStoreCtaAria();

    var panel = popup.querySelector(".store-popup__panel");

    function focusPopupBtn() {
      var btn = popup.querySelector(".store-popup__btn");
      if (btn && btn.focus) btn.focus();
    }

    function lockPageScroll() {
      document.documentElement.style.overflow = "hidden";
    }

    function unlockPageScroll() {
      document.documentElement.style.overflow = "";
    }

    function openPopup() {
      popup.classList.remove("store-popup--open");
      popup.removeAttribute("hidden");
      lockPageScroll();
      if (prefersReduced) {
        popup.classList.add("store-popup--open");
        focusPopupBtn();
        return;
      }
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          popup.classList.add("store-popup--open");
          focusPopupBtn();
        });
      });
    }

    function closePopup() {
      if (prefersReduced) {
        popup.classList.remove("store-popup--open");
        popup.setAttribute("hidden", "");
        unlockPageScroll();
        return;
      }
      popup.classList.remove("store-popup--open");
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        popup.setAttribute("hidden", "");
        unlockPageScroll();
        if (panel) panel.removeEventListener("transitionend", onEnd);
      }
      function onEnd(e) {
        if (e.target !== panel) return;
        if (e.propertyName !== "opacity" && e.propertyName !== "transform")
          return;
        finish();
      }
      if (panel) panel.addEventListener("transitionend", onEnd);
      window.setTimeout(finish, 450);
    }

    ios.addEventListener("click", function (e) {
      e.preventDefault();
      openPopup();
    });
    android.addEventListener("click", function (e) {
      e.preventDefault();
      openPopup();
    });

    popup.addEventListener("click", function (e) {
      if (e.target.closest(".js-store-popup-close")) closePopup();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (popup.hasAttribute("hidden")) return;
      var downloadChoiceEl = document.getElementById("download-choice-modal");
      if (downloadChoiceEl && !downloadChoiceEl.hasAttribute("hidden"))
        return;
      closePopup();
    });
  }

  function initSecurityModal() {
    var popup = document.getElementById("security-modal");
    if (!popup) return;
    var panel = popup.querySelector(".security-modal__panel");

    function openModal() {
      popup.classList.remove("security-modal--open");
      popup.removeAttribute("hidden");
      setModalScrollLock();
      if (prefersReduced) {
        popup.classList.add("security-modal--open");
        focusHeading();
        return;
      }
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          popup.classList.add("security-modal--open");
          focusHeading();
        });
      });
    }

    function focusHeading() {
      var h = document.getElementById("security-modal-heading");
      if (h && h.focus) h.focus();
    }

    function closeModal() {
      if (prefersReduced) {
        popup.classList.remove("security-modal--open");
        popup.setAttribute("hidden", "");
        setModalScrollLock();
        return;
      }
      popup.classList.remove("security-modal--open");
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        popup.setAttribute("hidden", "");
        setModalScrollLock();
        if (panel) panel.removeEventListener("transitionend", onEnd);
      }
      function onEnd(e) {
        if (e.target !== panel) return;
        if (e.propertyName !== "opacity") return;
        finish();
      }
      if (panel) panel.addEventListener("transitionend", onEnd);
      window.setTimeout(finish, 200);
    }

    document.addEventListener(
      "click",
      function (e) {
        var el = e.target;
        if (el && el.nodeType === 3) el = el.parentElement;
        var t = el && el.closest && el.closest(".js-open-security-modal");
        if (!t) return;
        e.preventDefault();
        openModal();
      },
      true
    );

    popup.addEventListener("click", function (e) {
      if (e.target.closest(".js-open-e2ee-modal")) {
        e.preventDefault();
        openE2eeModal();
        return;
      }
      if (e.target.closest(".js-security-modal-close")) closeModal();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (popup.hasAttribute("hidden")) return;
      var e2eeEl = document.getElementById("e2ee-modal");
      if (e2eeEl && !e2eeEl.hasAttribute("hidden")) return;
      var contactEl = document.getElementById("contact-modal");
      if (contactEl && !contactEl.hasAttribute("hidden")) return;
      var documentsEl = document.getElementById("documents-modal");
      if (documentsEl && !documentsEl.hasAttribute("hidden")) return;
      var downloadChoiceEl = document.getElementById("download-choice-modal");
      if (downloadChoiceEl && !downloadChoiceEl.hasAttribute("hidden"))
        return;
      closeModal();
    });
  }

  function initContactModal() {
    var popup = document.getElementById("contact-modal");
    if (!popup) return;
    var panel = popup.querySelector(".security-modal__panel");

    function openModal() {
      popup.classList.remove("security-modal--open");
      popup.removeAttribute("hidden");
      setModalScrollLock();
      if (prefersReduced) {
        popup.classList.add("security-modal--open");
        focusHeading();
        return;
      }
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          popup.classList.add("security-modal--open");
          focusHeading();
        });
      });
    }

    function focusHeading() {
      var h = document.getElementById("contact-modal-heading");
      if (h && h.focus) h.focus();
    }

    function closeModal() {
      if (prefersReduced) {
        popup.classList.remove("security-modal--open");
        popup.setAttribute("hidden", "");
        setModalScrollLock();
        return;
      }
      popup.classList.remove("security-modal--open");
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        popup.setAttribute("hidden", "");
        setModalScrollLock();
        if (panel) panel.removeEventListener("transitionend", onEnd);
      }
      function onEnd(e) {
        if (e.target !== panel) return;
        if (e.propertyName !== "opacity") return;
        finish();
      }
      if (panel) panel.addEventListener("transitionend", onEnd);
      window.setTimeout(finish, 200);
    }

    document.addEventListener(
      "click",
      function (e) {
        var el = e.target;
        if (el && el.nodeType === 3) el = el.parentElement;
        var t = el && el.closest && el.closest(".js-open-contact-modal");
        if (!t) return;
        e.preventDefault();
        openModal();
      },
      true
    );

    popup.addEventListener("click", function (e) {
      if (e.target.closest(".js-contact-modal-close")) closeModal();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (popup.hasAttribute("hidden")) return;
      var documentsEl = document.getElementById("documents-modal");
      if (documentsEl && !documentsEl.hasAttribute("hidden")) return;
      var downloadChoiceEl = document.getElementById("download-choice-modal");
      if (downloadChoiceEl && !downloadChoiceEl.hasAttribute("hidden"))
        return;
      closeModal();
    });
  }

  function initDocumentsModal() {
    var popup = document.getElementById("documents-modal");
    if (!popup) return;
    var panel = popup.querySelector(".security-modal__panel");
    var bodyEl = document.getElementById("documents-modal-body");
    var tabTerms = document.getElementById("documents-tab-terms");
    var tabPrivacy = document.getElementById("documents-tab-privacy");
    var tabPanel = document.getElementById("documents-tabpanel");
    var loadingTextEl = document.getElementById("documents-i18n-loading");
    var errorTextEl = document.getElementById("documents-i18n-load-error");
    if (!bodyEl || !tabTerms || !tabPrivacy || !tabPanel) return;

    var cache = { terms: "", privacy: "", lang: "" };
    var activeKind = "terms";

    function loadingMessage() {
      return loadingTextEl && loadingTextEl.textContent
        ? loadingTextEl.textContent.trim()
        : "…";
    }

    function errorMessage() {
      return errorTextEl && errorTextEl.textContent
        ? errorTextEl.textContent.trim()
        : "Error";
    }

    function invalidateCacheIfLangChanged() {
      var lang = document.documentElement.getAttribute("lang") || "en";
      if (cache.lang !== lang) {
        cache.terms = "";
        cache.privacy = "";
        cache.lang = lang;
      }
    }

    function setTabUi(kind) {
      activeKind = kind;
      var isTerms = kind === "terms";
      tabTerms.setAttribute("aria-selected", isTerms ? "true" : "false");
      tabPrivacy.setAttribute("aria-selected", isTerms ? "false" : "true");
      tabPanel.setAttribute(
        "aria-labelledby",
        isTerms ? "documents-tab-terms" : "documents-tab-privacy"
      );
    }

    function showLoading() {
      bodyEl.innerHTML =
        '<p class="documents-modal__loading">' +
        escapeHtml(loadingMessage()) +
        "</p>";
    }

    function showError() {
      bodyEl.innerHTML =
        '<p class="documents-modal__error">' +
        escapeHtml(errorMessage()) +
        "</p>";
    }

    function showContent(kind, text) {
      bodyEl.innerHTML = markdownPlainToHtml(text);
    }

    function loadKind(kind) {
      invalidateCacheIfLangChanged();
      var sub = kind === "terms" ? "regulamin" : "polityka";
      if (kind === "terms" && cache.terms) {
        showContent(kind, cache.terms);
        return;
      }
      if (kind === "privacy" && cache.privacy) {
        showContent(kind, cache.privacy);
        return;
      }
      showLoading();
      fetchLocalizedMarkdown(sub)
        .then(function (text) {
          if (kind === "terms") cache.terms = text;
          else cache.privacy = text;
          if (activeKind === kind) showContent(kind, text);
        })
        .catch(function () {
          if (activeKind === kind) showError();
        });
    }

    function openModal() {
      invalidateCacheIfLangChanged();
      popup.classList.remove("security-modal--open");
      popup.removeAttribute("hidden");
      setModalScrollLock();
      setTabUi("terms");
      showLoading();
      if (prefersReduced) {
        popup.classList.add("security-modal--open");
        loadKind("terms");
        focusHeading();
        return;
      }
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          popup.classList.add("security-modal--open");
          loadKind("terms");
          focusHeading();
        });
      });
    }

    function focusHeading() {
      var h = document.getElementById("documents-modal-heading");
      if (h && h.focus) h.focus();
    }

    function closeModal() {
      if (prefersReduced) {
        popup.classList.remove("security-modal--open");
        popup.setAttribute("hidden", "");
        setModalScrollLock();
        return;
      }
      popup.classList.remove("security-modal--open");
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        popup.setAttribute("hidden", "");
        setModalScrollLock();
        if (panel) panel.removeEventListener("transitionend", onEnd);
      }
      function onEnd(e) {
        if (e.target !== panel) return;
        if (e.propertyName !== "opacity") return;
        finish();
      }
      if (panel) panel.addEventListener("transitionend", onEnd);
      window.setTimeout(finish, 200);
    }

    document.addEventListener(
      "click",
      function (e) {
        var el = e.target;
        if (el && el.nodeType === 3) el = el.parentElement;
        var t = el && el.closest && el.closest(".js-open-documents-modal");
        if (!t) return;
        e.preventDefault();
        openModal();
      },
      true
    );

    popup.addEventListener("click", function (e) {
      var tab = e.target.closest && e.target.closest(".js-documents-tab");
      if (tab) {
        e.preventDefault();
        var kind = tab.getAttribute("data-doc");
        if (kind !== "terms" && kind !== "privacy") return;
        setTabUi(kind);
        loadKind(kind);
        tab.focus();
        return;
      }
      if (e.target.closest(".js-documents-modal-close")) closeModal();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (popup.hasAttribute("hidden")) return;
      var downloadChoiceEl = document.getElementById("download-choice-modal");
      if (downloadChoiceEl && !downloadChoiceEl.hasAttribute("hidden"))
        return;
      closeModal();
    });
  }

  function initE2eeModal() {
    var popup = document.getElementById("e2ee-modal");
    if (!popup) return;
    var panel = popup.querySelector(".security-modal__panel");

    function openModal() {
      popup.classList.remove("security-modal--open");
      popup.removeAttribute("hidden");
      setModalScrollLock();
      if (prefersReduced) {
        popup.classList.add("security-modal--open");
        focusHeading();
        return;
      }
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          popup.classList.add("security-modal--open");
          focusHeading();
        });
      });
    }

    function focusHeading() {
      var h = document.getElementById("e2ee-modal-heading");
      if (h && h.focus) h.focus();
    }

    function closeModal() {
      if (prefersReduced) {
        popup.classList.remove("security-modal--open");
        popup.setAttribute("hidden", "");
        setModalScrollLock();
        return;
      }
      popup.classList.remove("security-modal--open");
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        popup.setAttribute("hidden", "");
        setModalScrollLock();
        if (panel) panel.removeEventListener("transitionend", onEnd);
      }
      function onEnd(e) {
        if (e.target !== panel) return;
        if (e.propertyName !== "opacity") return;
        finish();
      }
      if (panel) panel.addEventListener("transitionend", onEnd);
      window.setTimeout(finish, 200);
    }

    openE2eeModal = openModal;

    popup.addEventListener("click", function (e) {
      if (e.target.closest(".js-e2ee-modal-close")) closeModal();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (popup.hasAttribute("hidden")) return;
      var contactEl = document.getElementById("contact-modal");
      if (contactEl && !contactEl.hasAttribute("hidden")) return;
      var documentsEl = document.getElementById("documents-modal");
      if (documentsEl && !documentsEl.hasAttribute("hidden")) return;
      var downloadChoiceEl = document.getElementById("download-choice-modal");
      if (downloadChoiceEl && !downloadChoiceEl.hasAttribute("hidden"))
        return;
      closeModal();
      e.stopImmediatePropagation();
    });
  }

  function initDownloadChoiceModal() {
    var root = document.querySelector("[data-store-cta]");
    var desktop = root && root.querySelector(".js-cta-desktop");
    var popup = document.getElementById("download-choice-modal");
    if (!desktop || !popup) return;
    var panel = popup.querySelector(".security-modal__panel");
    var webCta = popup.querySelector(".download-choice__cta");
    if (webCta) webCta.setAttribute("href", assetUrl("prace.html"));

    function openModal() {
      popup.classList.remove("security-modal--open");
      popup.removeAttribute("hidden");
      setModalScrollLock();
      if (prefersReduced) {
        popup.classList.add("security-modal--open");
        focusHeading();
        return;
      }
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          popup.classList.add("security-modal--open");
          focusHeading();
        });
      });
    }

    function focusHeading() {
      var h = document.getElementById("download-choice-heading");
      if (h && h.focus) h.focus();
    }

    function closeModal() {
      if (prefersReduced) {
        popup.classList.remove("security-modal--open");
        popup.setAttribute("hidden", "");
        setModalScrollLock();
        return;
      }
      popup.classList.remove("security-modal--open");
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        popup.setAttribute("hidden", "");
        setModalScrollLock();
        if (panel) panel.removeEventListener("transitionend", onEnd);
      }
      function onEnd(e) {
        if (e.target !== panel) return;
        if (e.propertyName !== "opacity") return;
        finish();
      }
      if (panel) panel.addEventListener("transitionend", onEnd);
      window.setTimeout(finish, 200);
    }

    desktop.addEventListener("click", function (e) {
      e.preventDefault();
      openModal();
    });

    popup.addEventListener("click", function (e) {
      if (e.target.closest(".js-download-choice-close")) closeModal();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (popup.hasAttribute("hidden")) return;
      closeModal();
    });
  }

  function initScrollToWhy() {
    var btn = document.querySelector(".js-scroll-why");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var el = document.getElementById("why");
      if (!el) return;
      var top = el.getBoundingClientRect().top + window.scrollY;
      var liftRatio = window.innerWidth < 900 ? 0.09 : 0.14;
      var lift = Math.round(window.innerHeight * liftRatio);
      var extraDown = window.innerWidth < 454 ? 15 : 0;
      var nudgeUp = window.innerWidth > 900 ? 16 : 0;
      window.scrollTo({
        top: Math.max(0, top - lift + extraDown - nudgeUp),
        behavior: prefersReduced ? "auto" : "smooth",
      });
    });
  }

  initI18n()
    .catch(function () {})
    .then(function () {
      initReveal();
      preventEmptyHashNav();
      initPrimaryCtaScrollToBottom();
      initScrollToWhy();
      initE2eeModal();
      initSecurityModal();
      initContactModal();
      initDocumentsModal();
      initStoreCtaAndModal();
      initDownloadChoiceModal();
    });
})();

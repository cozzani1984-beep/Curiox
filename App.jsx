import React, { useState, useEffect, useCallback } from "react";
import { Heart, Users, Shuffle, ChevronDown, ChevronUp, RotateCcw, Plus, Minus, X, Trophy, Share2, Sparkles } from "lucide-react";
import LOGO_SRC from "./logo.png";
import CARD_BACK_SRC from "./card-back.jpeg";
import { CATEGORIES, CARDS } from "./cards.js";
let lastGeneratedCanvas = null;

const PALETTE = {
  bg: "#14101F",
  panel: "#1F1832",
  panelSoft: "#241C3A",
  text: "#F4EFE6",
  textMuted: "#B9AECF",
  gold: "#C9A227",
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function wrapLines(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    if (ctx.measureText(testLine).width > maxWidth && n > 0) {
      lines.push(line.trim());
      line = words[n] + " ";
    } else {
      line = testLine;
    }
  }
  lines.push(line.trim());
  return lines;
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

let cachedLogoImage = null;
function loadLogoImage() {
  if (cachedLogoImage) return Promise.resolve(cachedLogoImage);
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      cachedLogoImage = img;
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = LOGO_SRC;
  });
}

export default function Curiox() {
  const [mode, setMode] = useState("coppia");
  const [active, setActive] = useState(new Set(Object.keys(CATEGORIES)));
  const [deck, setDeck] = useState([]);
  const [pointer, setPointer] = useState(-1);
  const [flipped, setFlipped] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [players, setPlayers] = useState([]);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [previewUrl, setPreviewUrl] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [quizAnswer, setQuizAnswer] = useState(null);
  const [drawing, setDrawing] = useState(false);
  const [shareStatus, setShareStatus] = useState(null);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const FREE_CARD_LIMIT = 10;
  const PAYWALL_COOLDOWN_MS = 48 * 60 * 60 * 1000;
function isPaywallCoolingDown() {
  const t = window.localStorage.getItem("curiox_paywall_hit_at");
  if (!t) return false;
  return Date.now() - Number(t) < PAYWALL_COOLDOWN_MS;
}

  const [isPremium, setIsPremium] = useState(
    typeof window !== "undefined" && window.localStorage.getItem("curiox_premium") === "true"
  );
  const [paywallOpen, setPaywallOpen] = useState(false);
const [installPrompt, setInstallPrompt] = useState(null);
const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

useEffect(() => {
  const handler = (e) => {
    e.preventDefault();
    setInstallPrompt(e);
  };
  window.addEventListener("beforeinstallprompt", handler);
  return () => window.removeEventListener("beforeinstallprompt", handler);
}, []);

const handleInstallClick = async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  setInstallPrompt(null);
};

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("unlocked") === "true") {
      window.localStorage.setItem("curiox_premium", "true");
      setIsPremium(true);
      params.delete("unlocked");
      const cleanUrl = window.location.pathname + (params.toString() ? "?" + params.toString() : "");
      window.history.replaceState({}, "", cleanUrl);
    }
  }, []);
useEffect(() => {
  const syncPremium = () => {
    if (window.localStorage.getItem("curiox_premium") === "true") {
      setIsPremium(true);
    }
  };
  window.addEventListener("storage", syncPremium);
  document.addEventListener("visibilitychange", syncPremium);
  window.addEventListener("focus", syncPremium);
  syncPremium();
  return () => {
    window.removeEventListener("storage", syncPremium);
    document.removeEventListener("visibilitychange", syncPremium);
    window.removeEventListener("focus", syncPremium);
  };
}, []);
const VALID_CODE = "CURIOX2026";
const [manualCode, setManualCode] = useState("");
const [showCodeInput, setShowCodeInput] = useState(false);

const handleManualUnlock = () => {
  if (manualCode.trim().toUpperCase() === VALID_CODE) {
    window.localStorage.setItem("curiox_premium", "true");
    setIsPremium(true);
    setPaywallOpen(false);

    alert("Sbloccato con successo!");
  } else {
    alert("Codice non valido.");
  }
};


  const startCheckout = () => {
    const link = import.meta.env.VITE_STRIPE_PAYMENT_LINK;
    if (link) {
      window.location.href = link;
    } else {
      alert("Aggiungi VITE_STRIPE_PAYMENT_LINK nel file .env per attivare il pagamento (vedi README).");
    }
  };

  const generatePreview = async (card) => {
    if (!card) return;
    if (card.cat === "quiz" || card.jolly) {
      setPreviewUrl(null);
      setGenerating(false);
      return;
    }
    setGenerating(true);
    setPreviewUrl(null);
    try {
      await Promise.race([
        Promise.all([
          document.fonts.load('600 22px "Work Sans"'),
          document.fonts.load('500 40px "Fraunces"'),
          document.fonts.load('700 30px "Fraunces"'),
        ]),
        new Promise((resolve) => setTimeout(resolve, 700)),
      ]);
    } catch (e) {
      // fonts unavailable, canvas will fall back to system fonts
    }
    try {
    const meta = CATEGORIES[card.cat];
    const W = 640,
      H = 853;
    const scale = 2;
    const canvas = document.createElement("canvas");
      lastGeneratedCanvas = canvas;

    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);

    // background
    ctx.fillStyle = "#000000";
    roundRectPath(ctx, 0, 0, W, H, 0);
    ctx.fill();

    // border
    ctx.lineWidth = 3;
    ctx.strokeStyle = meta.color + "AA";
    roundRectPath(ctx, 6, 6, W - 12, H - 12, 0);
    ctx.stroke();

    // category pill
    ctx.font = '600 22px "Work Sans", sans-serif';
    const pillLabel = meta.label.toUpperCase();
    const pillWidth = ctx.measureText(pillLabel).width + 48;
    ctx.fillStyle = meta.color + "33";
    roundRectPath(ctx, 56, 64, pillWidth, 46, 23);
    ctx.fill();
    ctx.fillStyle = meta.color;
    ctx.textBaseline = "middle";
    ctx.fillText(pillLabel, 80, 88);

    // question text, vertically centered in the mid section
    ctx.fillStyle = "#FFFFFF";
    ctx.font = '500 40px "Fraunces", serif';
    ctx.textBaseline = "alphabetic";
    const lines = wrapLines(ctx, card.text, W - 112);
    const lineHeight = 52;
    const blockHeight = lines.length * lineHeight;
    let startY = H / 2 - blockHeight / 2 + 32;
    lines.forEach((line, i) => {
      ctx.fillText(line, 56, startY + i * lineHeight);
    });

    // footer wordmark
    const logoImg = await loadLogoImage();
    if (logoImg) {
      const dl = 76;
      ctx.save();
      ctx.beginPath();
      ctx.arc(W / 2, H - 96, dl / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(logoImg, W / 2 - dl / 2, H - 96 - dl / 2, dl, dl);
      ctx.restore();
    } else {
      ctx.font = '700 30px "Fraunces", serif';
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.fillText("Curiox", W / 2, H - 56);
      ctx.textAlign = "left";
    }

    setPreviewUrl(canvas.toDataURL("image/png"));
    } catch (e) {
      setPreviewUrl(null);
    } finally {
      setGenerating(false);
    }
  };

  const addPlayer = () => {
    const name = newPlayerName.trim();
    if (!name) return;
    setPlayers((prev) => [...prev, { id: Date.now(), name, points: 0 }]);
    setNewPlayerName("");
  };

  const removePlayer = (id) => {
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  };

  const changePoints = (id, delta) => {
    setPlayers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, points: Math.max(0, p.points + delta) } : p))
    );
  };

  const resetPoints = () => {
    setPlayers((prev) => prev.map((p) => ({ ...p, points: 0 })));
  };

  const buildDeck = useCallback(() => {
    const pool = CARDS.filter(
      (c) =>
        active.has(c.cat) &&
        (mode === "coppia" || c.cat !== "intimita") &&
        (mode === "gruppo" || c.cat !== "quiz") &&
        (mode === "gruppo" || !c.groupOnly)
    );
    setDeck(shuffle(pool));
    setPointer(-1);
    setFlipped(false);
    setPreviewUrl(null);
    setFullscreen(false);
    setQuizAnswer(null);
    setShareMenuOpen(false);
  }, [active, mode]);

  useEffect(() => {
    buildDeck();
  }, [buildDeck]);

  const currentCard = pointer >= 0 && pointer < deck.length ? deck[pointer] : null;
  const remaining = deck.length - (pointer + 1);
  const exhausted = deck.length > 0 && pointer >= deck.length - 1 && flipped;
  const explored = Math.min(pointer + 1, deck.length);
  const exploredPct = deck.length > 0 ? Math.round((explored / deck.length) * 100) : 0;

  const toggleCategory = (key) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const draw = () => {
    if (pending) return;
    if (!isPremium && (pointer + 1 >= FREE_CARD_LIMIT || isPaywallCoolingDown())) {
  if (!window.localStorage.getItem("curiox_paywall_hit_at")) {
    window.localStorage.setItem("curiox_paywall_hit_at", Date.now().toString());
  }
  setPaywallOpen(true);
  return;
}

    setDrawing(true);
    setTimeout(() => setDrawing(false), 550);
    setShareMenuOpen(false);
    if (pointer === -1) {
      setPointer(0);
      setFullscreen(true);
      setQuizAnswer(null);
      requestAnimationFrame(() =>
        setTimeout(() => {
          setFlipped(true);
          generatePreview(deck[0]);
        }, 40)
      );
      return;
    }
    if (pointer >= deck.length - 1) return;
    const nextIndex = pointer + 1;
    setPending(true);
    setFlipped(false);
    setQuizAnswer(null);
    setTimeout(() => {
      setPointer(nextIndex);
      setTimeout(() => {
        setFlipped(true);
        generatePreview(deck[nextIndex]);
        setPending(false);
      }, 450);
    }, 450);
  };

  const catMeta = currentCard ? CATEGORIES[currentCard.cat] : null;

  const getShareText = () => {
    if (!currentCard) return "";
    return catMeta ? `[${catMeta.label}] ${currentCard.text} — gioca a Curiox!` : `${currentCard.text} — gioca a Curiox!`;
  };

  const openShareLink = (platform) => {
    const text = getShareText();
    let url = "";
    if (platform === "whatsapp") {
      url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    } else if (platform === "telegram") {
      url = `https://t.me/share/url?url=&text=${encodeURIComponent(text)}`;
    } else if (platform === "x") {
      url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    } else if (platform === "facebook") {
      url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent("https://claude.ai")}&quote=${encodeURIComponent(text)}`;
    } else if (platform === "instagram") {
      navigator.clipboard.writeText(text).catch(() => {});
      setShareStatus("instagram");
      setTimeout(() => setShareStatus(null), 3000);
      window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
      setShareMenuOpen(false);
      return;
    }
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    setShareMenuOpen(false);
  };

  const copyShareText = async () => {
    try {
      await navigator.clipboard.writeText(getShareText());
      setShareStatus("copiato");
    } catch (e) {
      setShareStatus("errore");
    }
    setTimeout(() => setShareStatus(null), 2000);
    setShareMenuOpen(false);
  };

  const shareCard = async () => {
  if (!currentCard) return;
  const text = getShareText();
  try {
    await generatePreview(currentCard);
    if (navigator.share) {
      if (lastGeneratedCanvas) {
        const blob = await new Promise((resolve) => lastGeneratedCanvas.toBlob(resolve, "image/png"));
        if (blob) {
          const file = new File([blob], "curiox-carta.png", { type: "image/png" });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ title: "Curiox", text, files: [file] });
            return;
          }
        }
      }
      await navigator.share({ title: "Curiox", text });
      return;
    }
  } catch (e) {
    if (e && e.name === "AbortError") return;
  }
  setShareMenuOpen((v) => !v);
};


  return (
    <div
      style={{ background: PALETTE.bg, color: PALETTE.text, minHeight: "100dvh" }}
      className="w-full flex flex-col items-center px-4 py-10 font-sans"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Work+Sans:wght@400;500;600&display=swap');
        .curiox-serif { font-family: 'Fraunces', serif; }
        .curiox-sans { font-family: 'Work Sans', sans-serif; }
        .card-scene { perspective: 1600px; }
        .card-flip {
          transform-style: preserve-3d;
          transition: transform 0.9s cubic-bezier(.4,.1,.2,1);
        }
        .card-flip.is-flipped { transform: rotateY(180deg); }
        .card-face { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
        .card-face.back { transform: rotateY(180deg); }
        .deck-layer { transition: transform 0.3s ease; }
        @keyframes deckDraw {
          0% { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 1; }
          60% { transform: translate(10px, -50px) rotate(8deg) scale(1.04); opacity: 1; }
          100% { transform: translate(10px, -90px) rotate(10deg) scale(1.04); opacity: 0; }
        }
        .deck-draw { animation: deckDraw 0.5s cubic-bezier(.4,.1,.2,1) forwards; }
        @media (prefers-reduced-motion: reduce) {
          .card-flip { transition: none; }
          .deck-draw { animation: none; }
        }
      `}</style>

      {/* Wordmark */}
      <div className="text-center mb-8">
        <img
          src={LOGO_SRC}
          alt="Curiox"
          className="w-20 h-20 mx-auto mb-3 rounded-full object-cover"
          style={{ boxShadow: `0 0 0 1px ${PALETTE.gold}55` }}
        />
        <h1 className="curiox-serif text-6xl tracking-tight" style={{ color: PALETTE.text }}>
          Curiox
        </h1>
        <p className="curiox-sans text-sm mt-2" style={{ color: PALETTE.textMuted }}>
          Un solo mazzo, infinite conversazioni. Perfetto per giocare in coppia o in gruppo.
        </p>
      </div>

      {/* Mode selector */}
      <div className="flex gap-3 mb-6">
        {[
          { key: "coppia", label: "In coppia", icon: Heart },
          { key: "gruppo", label: "In gruppo", icon: Users },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className="curiox-sans flex items-center gap-2 px-4 py-2 rounded-full text-sm transition"
            style={{
              background: mode === key ? PALETTE.gold : PALETTE.panelSoft,
              color: mode === key ? PALETTE.bg : PALETTE.textMuted,
              fontWeight: mode === key ? 600 : 500,
            }}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap justify-center gap-2 mb-8 max-w-md">
        {Object.entries(CATEGORIES)
          .filter(([, meta]) => (!meta.coupleOnly || mode === "coppia") && (!meta.groupOnly || mode === "gruppo"))
          .map(([key, meta]) => {
          const on = active.has(key);
          return (
            <button
              key={key}
              onClick={() => toggleCategory(key)}
              className="curiox-sans flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition"
              style={{
                borderColor: meta.color,
                background: on ? meta.color + "26" : "transparent",
                color: on ? PALETTE.text : PALETTE.textMuted,
                opacity: on ? 1 : 0.55,
              }}
            >
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: meta.color }}
              />
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* Card */}
      <div className="card-scene w-full max-w-sm relative" style={{ paddingBottom: "133.33%" }}>
        <div className={`card-flip absolute inset-0 ${flipped ? "is-flipped" : ""}`}>
          {/* Back face: stacked deck */}
          <div className="card-face absolute inset-0">
            <div
              className="deck-layer absolute inset-0 rounded-2xl overflow-hidden"
              style={{
                transform: "rotate(-6deg) translate(-8px, 8px)",
                boxShadow: "0 12px 30px -18px rgba(0,0,0,0.6)",
                border: `1px solid ${PALETTE.gold}22`,
              }}
            >
              <img src={CARD_BACK_SRC} alt="" className="w-full h-full object-cover" />
            </div>
            <div
              className="deck-layer absolute inset-0 rounded-2xl overflow-hidden"
              style={{
                transform: "rotate(-3deg) translate(-4px, 4px)",
                boxShadow: "0 16px 35px -18px rgba(0,0,0,0.6)",
                border: `1px solid ${PALETTE.gold}28`,
              }}
            >
              <img src={CARD_BACK_SRC} alt="" className="w-full h-full object-cover" />
            </div>
            <div
              className={`absolute inset-0 rounded-2xl overflow-hidden ${drawing ? "deck-draw" : ""}`}
              style={{
                boxShadow: "0 20px 50px -20px rgba(0,0,0,0.6)",
                border: `1px solid ${PALETTE.gold}33`,
              }}
            >
              <img
                src={CARD_BACK_SRC}
                alt="Curiox"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Front face */}
          <div
            className="card-face back absolute inset-0 rounded-2xl flex flex-col p-8"
            style={
              currentCard && currentCard.jolly
                ? {
                    background: "linear-gradient(160deg, #2A2110 0%, #171029 60%)",
                    boxShadow: "0 20px 50px -18px rgba(201,162,39,0.35)",
                    border: `1px solid ${PALETTE.gold}88`,
                  }
                : {
                    background: PALETTE.panel,
                    boxShadow: "0 20px 50px -20px rgba(0,0,0,0.6)",
                    border: catMeta ? `1px solid ${catMeta.color}55` : `1px solid ${PALETTE.gold}33`,
                  }
            }
          >
            {currentCard && currentCard.jolly ? (
              <div className="flex-1 flex flex-col justify-center items-center text-center gap-4">
                <span
                  className="curiox-sans self-center text-xs px-4 py-1.5 rounded-full flex items-center gap-1.5"
                  style={{ background: `${PALETTE.gold}26`, color: PALETTE.gold, fontWeight: 700, letterSpacing: "0.05em" }}
                >
                  <Sparkles size={13} />
                  JOLLY
                </span>
                <p className="curiox-serif text-xl leading-snug" style={{ color: PALETTE.text }}>
                  {currentCard.text.replace("JOLLY! ", "")}
                </p>
                <span
                  className="curiox-serif text-3xl"
                  style={{ color: PALETTE.gold }}
                >
                  +{currentCard.bonus} punti
                </span>
              </div>
            ) : (
              <>
                {catMeta && (
                  <span
                    className="curiox-sans self-start text-xs px-3 py-1 rounded-full mb-6"
                    style={{ background: catMeta.color + "26", color: catMeta.color, fontWeight: 600 }}
                  >
                    {catMeta.label}
                  </span>
                )}
                {currentCard && currentCard.cat === "quiz" ? (
              <div className="flex-1 flex flex-col justify-center gap-3 overflow-y-auto">
                <p className="curiox-serif text-xl leading-snug" style={{ color: PALETTE.text }}>
                  {currentCard.text}
                </p>
                <div className="flex flex-col gap-2 mt-1">
                  {currentCard.options.map((opt, i) => {
                    const isCorrect = i === currentCard.correct;
                    const isSelected = quizAnswer === i;
                    const showResult = quizAnswer !== null;
                    return (
                      <button
                        key={i}
                        onClick={() => setQuizAnswer(i)}
                        disabled={showResult}
                        className="curiox-sans text-left px-4 py-3 rounded-xl text-sm transition"
                        style={{
                          background: showResult && isCorrect ? "#7CAD6B22" : showResult && isSelected ? "#C24B4B22" : PALETTE.panelSoft,
                          border: showResult && isCorrect ? "1px solid #7CAD6B" : showResult && isSelected ? "1px solid #C24B4B" : "1px solid transparent",
                          color: PALETTE.text,
                        }}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="curiox-serif text-2xl leading-snug flex-1 flex items-center" style={{ color: PALETTE.text }}>
                {currentCard ? currentCard.text : ""}
              </p>
            )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center gap-3 mt-8 w-full max-w-sm">
        {!exhausted ? (
          <button
            onClick={draw}
            disabled={pending}
            className="curiox-sans w-full py-3 rounded-full text-base transition"
            style={{ background: PALETTE.gold, color: PALETTE.bg, fontWeight: 600, opacity: pending ? 0.7 : 1 }}
          >
            {pointer === -1 ? "Pesca una carta" : "Prossima carta"}
          </button>
        ) : (
          <div
            className="curiox-sans w-full text-center py-3 rounded-full text-sm"
            style={{ background: PALETTE.panelSoft, color: PALETTE.textMuted }}
          >
            Avete pescato tutte le carte disponibili.
          </div>
        )}
        <div className="flex items-center gap-4">
          <span className="curiox-sans text-xs" style={{ color: PALETTE.textMuted }}>
            Carte esplorate: {explored}/{deck.length} ({exploredPct}%)
          </span>
          <button
            onClick={buildDeck}
            className="curiox-sans flex items-center gap-1.5 text-xs"
            style={{ color: PALETTE.gold }}
          >
            {pointer === -1 ? <Shuffle size={14} /> : <RotateCcw size={14} />}
            Rimescola
          </button>
        </div>
        {currentCard && (
          <div className="relative mt-3">
            <button
              onClick={shareCard}
              className="curiox-sans flex items-center gap-1.5 text-xs"
              style={{ color: PALETTE.textMuted }}
            >
              <Share2 size={14} />
              {shareStatus === "copiato" ? "Copiato negli appunti" : shareStatus === "instagram" ? "Testo copiato, incollalo su Instagram" : shareStatus === "errore" ? "Impossibile condividere" : "Condividi carta"}
            </button>
            {shareMenuOpen && (
              <div
                className="flex flex-wrap gap-2 mt-2 p-2 rounded-xl"
                style={{ background: PALETTE.panelSoft }}
              >
                <button
                  onClick={() => openShareLink("whatsapp")}
                  className="curiox-sans text-xs px-3 py-1.5 rounded-full"
                  style={{ background: PALETTE.bg, color: PALETTE.text }}
                >
                  WhatsApp
                </button>
                <button
                  onClick={() => openShareLink("telegram")}
                  className="curiox-sans text-xs px-3 py-1.5 rounded-full"
                  style={{ background: PALETTE.bg, color: PALETTE.text }}
                >
                  Telegram
                </button>
                <button
                  onClick={() => openShareLink("x")}
                  className="curiox-sans text-xs px-3 py-1.5 rounded-full"
                  style={{ background: PALETTE.bg, color: PALETTE.text }}
                >
                  X
                </button>
                <button
                  onClick={() => openShareLink("facebook")}
                  className="curiox-sans text-xs px-3 py-1.5 rounded-full"
                  style={{ background: PALETTE.bg, color: PALETTE.text }}
                >
                  Facebook
                </button>
                <button
                  onClick={() => openShareLink("instagram")}
                  className="curiox-sans text-xs px-3 py-1.5 rounded-full"
                  style={{ background: PALETTE.bg, color: PALETTE.text }}
                >
                  Instagram
                </button>
                <button
                  onClick={copyShareText}
                  className="curiox-sans text-xs px-3 py-1.5 rounded-full"
                  style={{ background: PALETTE.bg, color: PALETTE.text }}
                >
                  Copia testo
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scoreboard for sfide in gruppo */}
      {mode === "gruppo" && (
        <div className="w-full max-w-sm mt-10">
          <div className="flex items-center justify-between mb-2">
            <p className="curiox-sans text-sm flex items-center gap-2" style={{ color: PALETTE.text }}>
              <Trophy size={15} style={{ color: CATEGORIES.sfida.color }} />
              Punteggio sfide/quiz
            </p>
            {players.length > 0 && (
              <button
                onClick={resetPoints}
                className="curiox-sans text-xs"
                style={{ color: PALETTE.textMuted }}
              >
                Azzera
              </button>
            )}
          </div>

          <div
            className="rounded-xl overflow-hidden"
            style={{ background: PALETTE.panelSoft }}
          >
            {players.length === 0 && (
              <p className="curiox-sans text-xs px-4 py-4" style={{ color: PALETTE.textMuted }}>
                Aggiungi i giocatori per tenere il punteggio delle carte Sfida e Quiz.
              </p>
            )}
            {players
              .slice()
              .sort((a, b) => b.points - a.points)
              .map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-4 py-3"
                  style={{ borderTop: `1px solid ${PALETTE.bg}55` }}
                >
                  <span className="curiox-sans text-sm truncate" style={{ color: PALETTE.text }}>
                    {p.name}
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => changePoints(p.id, -1)}
                      className="w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ background: PALETTE.bg, color: PALETTE.textMuted }}
                    >
                      <Minus size={12} />
                    </button>
                    <span
                      className="curiox-serif text-base w-5 text-center"
                      style={{ color: CATEGORIES.sfida.color }}
                    >
                      {p.points}
                    </span>
                    <button
                      onClick={() => changePoints(p.id, 1)}
                      className="w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ background: PALETTE.bg, color: PALETTE.textMuted }}
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      onClick={() => removePlayer(p.id)}
                      className="w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ color: PALETTE.textMuted }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))}
          </div>

          <div className="flex gap-2 mt-2">
            <input
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPlayer()}
              placeholder="Nome giocatore"
              className="curiox-sans flex-1 px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: PALETTE.panelSoft, color: PALETTE.text }}
            />
            <button
              onClick={addPlayer}
              className="curiox-sans px-4 py-2 rounded-lg text-sm"
              style={{ background: CATEGORIES.sfida.color, color: PALETTE.text, fontWeight: 600 }}
            >
              Aggiungi
            </button>
          </div>
        </div>
      )}

      {/* Rules */}
      <div className="w-full max-w-sm mt-10">
        <button
          onClick={() => setRulesOpen((v) => !v)}
          className="curiox-sans w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm"
          style={{ background: PALETTE.panelSoft, color: PALETTE.text }}
        >
          Come si gioca
          {rulesOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {rulesOpen && (
          <div
            className="curiox-sans text-sm mt-2 px-4 py-4 rounded-xl leading-relaxed"
            style={{ background: PALETTE.panelSoft, color: PALETTE.textMuted }}
          >
            {mode === "coppia" ? (
              <ul className="space-y-2 list-disc pl-4">
                <li>Scegliete a turno chi pesca la prima carta.</li>
                <li>Leggete la domanda ad alta voce e rispondete entrambi, uno dopo l'altro.</li>
                <li>Le carte della categoria Sfida vanno svolte insieme, non solo raccontate.</li>
                <li>La categoria Intimità è pensata solo per la coppia: scompare automaticamente in modalità gruppo.</li>
                <li>La categoria Quiz è pensata solo per il gruppo: compare solo in modalità gruppo.</li>
                <li>Nessun obbligo: se una domanda non vi convince, potete scartarla e pescarne un'altra.</li>
              </ul>
            ) : (
              <ul className="space-y-2 list-disc pl-4">
                <li>Sedetevi in cerchio. Chi pesca legge la carta ad alta voce e risponde per primo.</li>
                <li>A turno, chiunque altro può aggiungere la propria risposta se vuole.</li>
                <li>Dopo la risposta, la carta passa alla persona alla propria sinistra, che pesca la successiva.</li>
                <li>Prima di iniziare, aggiungete i nomi dei giocatori (o delle coppie, se giocate a squadre) nella sezione "Punteggio sfide/quiz" qui sotto: scrivete il nome e toccate "Aggiungi".</li>
                <li>Per le carte Sfida, chi pesca sceglie chi coinvolgere nell'azione: chi vince la sfida riceve un punto, da assegnare con il pulsante + accanto al suo nome nel punteggio.</li>
                <li>Per le carte Quiz, chi pesca legge la domanda e le 3 risposte: chi indovina per primo tocca l'opzione corretta e riceve un punto, sempre con il pulsante + nel punteggio.</li>
                <li>La classifica si aggiorna da sola in base ai punti: chi ne ha di più sale automaticamente in cima. Usate "Azzera" per ripartire da zero in una nuova partita.</li>
                <li>Usate i filtri per categoria in alto per adattare il mazzo al gruppo e al momento della serata.</li>
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Fullscreen card view */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-between px-6 py-8"
          style={{ background: "#000000" }}
        >
          <div className="w-full flex items-center justify-between">
            <span className="curiox-sans text-xs" style={{ color: "#FFFFFF99" }}>
              Carte esplorate: {explored}/{deck.length} ({exploredPct}%)
            </span>
            <button
              onClick={() => setFullscreen(false)}
              className="curiox-sans flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
              style={{ background: "#FFFFFF1A", color: "#FFFFFF" }}
            >
              <X size={14} />
              Chiudi
            </button>
          </div>

          <div className="card-scene w-full max-w-md flex-1 flex items-center py-6" style={{ minHeight: 0 }}>
            <div className="relative w-full" style={{ paddingBottom: "133.33%" }}>
              <div className={`card-flip absolute inset-0 ${flipped ? "is-flipped" : ""}`}>
              <div
                className="card-face absolute inset-0 rounded-3xl overflow-hidden"
                style={{
                  boxShadow: "0 30px 70px -25px rgba(0,0,0,0.9)",
                  border: "1px solid #FFFFFF22",
                }}
              >
                <img
                  src={CARD_BACK_SRC}
                  alt="Curiox"
                  className="w-full h-full object-cover"
                />
              </div>

              <div
                className="card-face back absolute inset-0 rounded-3xl overflow-hidden flex items-center justify-center"
                style={{
                  background: "#000000",
                  boxShadow: "0 30px 70px -25px rgba(0,0,0,0.9)",
                  border: "1px solid #FFFFFF22",
                }}
              >
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Carta Curiox generata"
                    className="w-full h-full object-cover"
                  />
                ) : generating ? (
                  <div className="flex flex-col items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full animate-spin"
                      style={{
                        border: "3px solid #FFFFFF22",
                        borderTopColor: catMeta ? catMeta.color : "#FFFFFF",
                      }}
                    />
                    <span className="curiox-sans text-xs" style={{ color: "#FFFFFF99" }}>
                      Genero la carta...
                    </span>
                  </div>
                ) : (
                  <div
                    className="w-full h-full flex flex-col p-9 overflow-y-auto"
                    style={
                      currentCard && currentCard.jolly
                        ? { background: "linear-gradient(160deg, #2A2110 0%, #000000 65%)" }
                        : undefined
                    }
                  >
                    {currentCard && currentCard.jolly ? (
                      <div className="flex-1 flex flex-col justify-center items-center text-center gap-5">
                        <span
                          className="curiox-sans self-center text-sm px-5 py-2 rounded-full flex items-center gap-2"
                          style={{ background: `${PALETTE.gold}26`, color: PALETTE.gold, fontWeight: 700, letterSpacing: "0.05em" }}
                        >
                          <Sparkles size={16} />
                          JOLLY
                        </span>
                        <p
                          className="curiox-serif leading-snug"
                          style={{ color: "#FFFFFF", fontSize: "clamp(1.3rem, 4.5vw, 2rem)" }}
                        >
                          {currentCard.text.replace("JOLLY! ", "")}
                        </p>
                        <span className="curiox-serif" style={{ color: PALETTE.gold, fontSize: "clamp(2rem, 8vw, 3rem)" }}>
                          +{currentCard.bonus} punti
                        </span>
                      </div>
                    ) : (
                      <>
                        {catMeta && (
                          <span
                            className="curiox-sans self-start text-sm px-4 py-1.5 rounded-full mb-8"
                            style={{ background: catMeta.color + "33", color: catMeta.color, fontWeight: 600 }}
                          >
                            {catMeta.label}
                          </span>
                        )}
                        {currentCard && currentCard.cat === "quiz" ? (
                      <div className="flex-1 flex flex-col justify-center gap-4">
                        <p
                          className="curiox-serif leading-snug"
                          style={{ color: "#FFFFFF", fontSize: "clamp(1.3rem, 4.5vw, 2rem)" }}
                        >
                          {currentCard.text}
                        </p>
                        <div className="flex flex-col gap-3 mt-2">
                          {currentCard.options.map((opt, i) => {
                            const isCorrect = i === currentCard.correct;
                            const isSelected = quizAnswer === i;
                            const showResult = quizAnswer !== null;
                            return (
                              <button
                                key={i}
                                onClick={() => setQuizAnswer(i)}
                                disabled={showResult}
                                className="curiox-sans text-left px-5 py-4 rounded-2xl text-base transition"
                                style={{
                                  background: showResult && isCorrect ? "#7CAD6B33" : showResult && isSelected ? "#C24B4B33" : "#FFFFFF14",
                                  border: showResult && isCorrect ? "1px solid #7CAD6B" : showResult && isSelected ? "1px solid #C24B4B" : "1px solid #FFFFFF22",
                                  color: "#FFFFFF",
                                }}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <p
                        className="curiox-serif leading-snug flex-1 flex items-center"
                        style={{ color: "#FFFFFF", fontSize: "clamp(1.5rem, 5vw, 2.4rem)" }}
                      >
                        {currentCard ? currentCard.text : ""}
                      </p>
                    )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            </div>
          </div>

          <div className="w-full max-w-md flex flex-col items-center gap-3">
            {!exhausted ? (
              <button
                onClick={draw}
                disabled={pending}
                className="curiox-sans w-full py-4 rounded-full text-base transition"
                style={{ background: PALETTE.gold, color: PALETTE.bg, fontWeight: 600, opacity: pending ? 0.7 : 1 }}
              >
                Prossima carta
              </button>
            ) : (
              <div
                className="curiox-sans w-full text-center py-4 rounded-full text-sm"
                style={{ background: "#FFFFFF1A", color: "#FFFFFFCC" }}
              >
                Avete pescato tutte le carte disponibili.
              </div>
            )}
            {currentCard && (
              <div className="w-full">
                <button
                  onClick={shareCard}
                  className="curiox-sans w-full py-3 rounded-full text-sm flex items-center justify-center gap-2"
                  style={{ background: "#FFFFFF14", color: "#FFFFFF", border: "1px solid #FFFFFF33" }}
                >
                  <Share2 size={16} />
                  {shareStatus === "copiato" ? "Copiato negli appunti" : shareStatus === "instagram" ? "Testo copiato, incollalo su Instagram" : shareStatus === "errore" ? "Impossibile condividere" : "Condividi carta"}
                </button>
                {shareMenuOpen && (
                  <div className="flex flex-wrap justify-center gap-2 mt-2">
                    <button
                      onClick={() => openShareLink("whatsapp")}
                      className="curiox-sans text-xs px-3 py-1.5 rounded-full"
                      style={{ background: "#FFFFFF1A", color: "#FFFFFF" }}
                    >
                      WhatsApp
                    </button>
                    <button
                      onClick={() => openShareLink("telegram")}
                      className="curiox-sans text-xs px-3 py-1.5 rounded-full"
                      style={{ background: "#FFFFFF1A", color: "#FFFFFF" }}
                    >
                      Telegram
                    </button>
                    <button
                      onClick={() => openShareLink("x")}
                      className="curiox-sans text-xs px-3 py-1.5 rounded-full"
                      style={{ background: "#FFFFFF1A", color: "#FFFFFF" }}
                    >
                      X
                    </button>
                    <button
                      onClick={() => openShareLink("facebook")}
                      className="curiox-sans text-xs px-3 py-1.5 rounded-full"
                      style={{ background: "#FFFFFF1A", color: "#FFFFFF" }}
                    >
                      Facebook
                    </button>
                    <button
                      onClick={() => openShareLink("instagram")}
                      className="curiox-sans text-xs px-3 py-1.5 rounded-full"
                      style={{ background: "#FFFFFF1A", color: "#FFFFFF" }}
                    >
                      Instagram
                    </button>
                    <button
                      onClick={copyShareText}
                      className="curiox-sans text-xs px-3 py-1.5 rounded-full"
                      style={{ background: "#FFFFFF1A", color: "#FFFFFF" }}
                    >
                      Copia testo
                    </button>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={buildDeck}
              className="curiox-sans flex items-center gap-1.5 text-xs"
              style={{ color: PALETTE.gold }}
            >
              <Shuffle size={14} />
              Rimescola
            </button>
          </div>
        </div>
      )}

      {/* Paywall */}
      {paywallOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-6"
          style={{ background: "rgba(0,0,0,0.75)" }}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 text-center"
            style={{ background: PALETTE.panel, border: `1px solid ${PALETTE.gold}44` }}
          >
            <img src={LOGO_SRC} alt="Curiox" className="w-16 h-16 mx-auto mb-4 rounded-full object-cover" />
            <h2 className="curiox-serif text-2xl mb-2" style={{ color: PALETTE.text }}>
              Hai esplorato le carte gratuite
            </h2>
            <p className="curiox-sans text-sm mb-6" style={{ color: PALETTE.textMuted }}>
              Sblocca il mazzo completo con tutte le categorie, i Quiz, le carte Intimità e i Jolly.
            </p>
            {isIOS && (

            <p className="curiox-sans text-xs mb-2" style={{ color: PALETTE.textMuted }}>
  Utilizza Safari per acquistare il gioco. Dopo l'acquisto, tocca Condividi → Aggiungi alla schermata Home per avere l'applicazione direttamente sulla schermata.
</p>
)}

            <button
              onClick={startCheckout}
              className="curiox-sans w-full py-3 rounded-full text-base mb-3"
              style={{ background: PALETTE.gold, color: PALETTE.bg, fontWeight: 700 }}
            >
              Sblocca il mazzo completo a soli €2,99
            </button>
            <div className="mt-3 text-center">
  {!showCodeInput ? (
    <button
      onClick={() => setShowCodeInput(true)}
      className="curiox-sans text-xs underline"
      style={{ color: PALETTE.textMuted }}
    >
      Utilizza codice
    </button>
  ) : (
    <div className="mt-2">
      <input
        type="text"
        value={manualCode}
        onChange={(e) => setManualCode(e.target.value)}
        placeholder="Inserisci codice"
        className="curiox-sans text-sm px-3 py-2 rounded-lg w-full mb-2"
        style={{ background: PALETTE.panelSoft, color: PALETTE.text, border: `1px solid ${PALETTE.gold}` }}
      />
      <button
        onClick={handleManualUnlock}
        className="curiox-sans text-sm w-full py-2 rounded-lg"
        style={{ background: PALETTE.gold, color: PALETTE.bg }}
      >
        Sblocca
      </button>
    </div>
  )}
</div>

            {installPrompt && (
  <button
    onClick={handleInstallClick}
    className="curiox-sans w-full py-3 rounded-full text-sm mb-3"
    style={{ background: "transparent", color: PALETTE.gold, border: `1px solid ${PALETTE.gold}55`, fontWeight: 600 }}
  >
    📲 Installa Curiox sul telefono
  </button>
)}

  
    
  


            <button
              onClick={() => setPaywallOpen(false)}
              className="curiox-sans text-xs"
              style={{ color: PALETTE.textMuted }}
            >
              Continua a esplorare più tardi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// features/meta — CSS for the scrapbook (kraft paper + taped cards), the quest
// board (slate + gold, like the 2D shop family), title chips and the streak pill.
import { css } from "../../core/ctx.js";

css("meta", `
/* centred, wide cards even over the title screen's left-aligned layout */
body.title-mode.meta-open .screen { justify-content: center !important; padding-left: 16px !important; }
body.title-mode .card.meta-book, body.title-mode .card.meta-quests { width: min(900px, 100%); }
.card.nopop { animation: none !important; }
.card.meta-book, .card.meta-quests { width: min(900px, 100%); text-align: left; position: relative; }

/* ── scrapbook ── */
.card.meta-book { color: #3E2723; padding: 16px 20px 18px 30px;
  background: repeating-linear-gradient(180deg, transparent 0 27px, rgba(90,60,30,.10) 27px 28px), linear-gradient(#C8A97E, #A07E55); }
.card.meta-book::before { content: ""; position: absolute; left: 9px; top: 18px; bottom: 18px; width: 7px;
  background: radial-gradient(circle, rgba(60,40,20,.38) 3px, transparent 3.6px) 0 0 / 7px 34px repeat-y; pointer-events: none; }
.meta-book h2, .meta-quests h2 { margin: 2px 0 2px; text-align: center; }
.meta-book .mb-head h2 { color: #FFF8E1; text-shadow: 0 3px 0 #4E342E, 0 0 6px rgba(78,52,46,.6); letter-spacing: .02em; }
.mb-sub { text-align: center; font-weight: 700; color: #FFE082; text-shadow: 0 2px 0 #4E342E; }
.mb-tabs { display: flex; gap: 6px; align-items: center; margin: 12px 0 6px; }
.mb-tabs .mb-g { flex: none; opacity: .85; }
.mb-tab { flex: 1; min-width: 0; border: none; border-radius: 12px; padding: 10px 6px; font: 700 16px var(--font); cursor: pointer;
  background: rgba(78,52,46,.55); color: #FFF8E1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mb-tab.on { background: #FFF8E1; color: #4E342E; box-shadow: inset 0 0 0 2px #8D6E63; }
.mb-tab.focus, .mb-badge.focus, .meta-book .nav.focus, .mq-card.nav.focus, .mq-claim.focus, .meta-book .mb-bk-row .btn.focus {
  outline: 4px solid #fff; box-shadow: 0 0 0 8px rgba(233,30,99,.55); }
.mb-body { animation: mbIn .28s cubic-bezier(.2,1.4,.4,1); }
@keyframes mbIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
.mb-paper { position: relative; background: #FFFDF5; border-radius: 12px; border: 1.5px solid rgba(120,90,60,.45);
  box-shadow: 3px 4px 0 rgba(60,40,20,.25); padding: 14px 16px; margin: 16px 4px 10px; }
.mb-paper::before { content: ""; position: absolute; top: -9px; left: 50%; width: 78px; height: 18px; transform: translateX(-50%) rotate(-3deg);
  background: rgba(255,241,118,.62); box-shadow: 0 1px 2px rgba(0,0,0,.08); }
.mb-sect { margin: 14px 4px 4px; font-weight: 700; color: #FFF8E1; text-shadow: 0 2px 0 #4E342E; }
.mb-foot { text-align: center; font-size: 13px !important; color: #FFF8E1; opacity: .85; text-shadow: 0 1px 0 #4E342E; }

.mb-info { display: flex; gap: 14px; align-items: center; position: sticky; top: 4px; z-index: 2; min-height: 92px; }
.mb-info-ic { flex: none; width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 34px;
  background: rgba(78,52,46,.14); border: 2px dashed rgba(78,52,46,.5); }
.mb-info-ic.got { background: radial-gradient(circle at 35% 30%, #FFF59D, #FFD54F 55%, #FFB300); border: 3px solid #E65100; }
.mb-info-tx { flex: 1; min-width: 0; }
.mb-info-nm { font-weight: 700; font-size: 19px; color: #4E342E; }
.mb-info-ds { font-size: 15px; color: #5D4037; margin: 2px 0 6px; }
.mb-bar { position: relative; height: 18px; border-radius: 9px; background: rgba(78,52,46,.18); overflow: hidden; }
.mb-bar i { position: absolute; inset: 0 auto 0 0; background: linear-gradient(90deg, #FFD54F, #FFB300); border-radius: 9px; min-width: 18px; }
.mb-bar b { position: relative; display: block; text-align: center; font-size: 12px; line-height: 18px; color: #3E2723; }
.mb-hint { font-style: italic; font-size: 13px; color: #8D6E63; }
.mb-got { font-weight: 700; color: #2E7D32; font-size: 14px; }

.mb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(98px, 1fr)); gap: 6px; margin: 6px 0; }
.mb-badge { border: none; background: transparent; border-radius: 14px; padding: 7px 4px 6px; display: flex; flex-direction: column;
  align-items: center; gap: 4px; cursor: pointer; font: 700 12px/1.15 var(--font); color: rgba(62,39,35,.62); text-align: center; }
.mb-badge .medal { width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 29px;
  background: rgba(78,52,46,.16); border: 2px dashed rgba(78,52,46,.5); position: relative; }
.mb-badge .medal span { opacity: .33; filter: grayscale(1); }
.mb-badge.got { color: #3E2723; }
.mb-badge.got .medal { background: radial-gradient(circle at 35% 30%, #FFF59D, #FFD54F 55%, #FFB300); border: 3px solid #E65100;
  box-shadow: 0 3px 0 rgba(0,0,0,.2); }
.mb-badge.got .medal span { opacity: 1; filter: none; }
.mb-badge.got .medal::after { content: ""; position: absolute; bottom: -9px; left: 50%; width: 20px; height: 12px; transform: translateX(-50%);
  background: linear-gradient(90deg, #E91E63 0 45%, transparent 45% 55%, #7E57C2 55%); clip-path: polygon(0 0, 100% 0, 100% 100%, 75% 70%, 50% 100%, 25% 70%, 0 100%); z-index: -1; }
.mb-badge.secret.got .medal { border-color: #7E57C2; }
.mb-badge.sel, .mb-badge.focus { background: rgba(255,248,225,.72); }

.mb-pic { flex: none; width: 96px; height: 96px; border-radius: 10px; background: #ECEFF1 center / cover no-repeat;
  display: flex; align-items: center; justify-content: center; font-size: 46px; border: 5px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,.25); }
.mb-pic.ready span { display: none; }
.mb-pic.mug { background-color: #CFD8DC; background-image: repeating-linear-gradient(180deg, transparent 0 15px, rgba(0,0,0,.18) 15px 16px); }
.mb-pic.mug.ready { background-size: cover, auto; }

.mb-rap { background: #F3EBD3; }
.mb-rap-h { text-align: center; font: 700 15px "Courier New", monospace; color: #5D4037; margin-bottom: 8px; }
.mb-rap-row { display: flex; gap: 16px; align-items: flex-start; }
.mb-mug { flex: none; display: flex; flex-direction: column; align-items: center; }
.mb-mug .mb-pic { width: 118px; height: 132px; border-radius: 4px; }
.mb-plate { margin-top: -18px; background: #263238; color: #fff; font: 700 12px "Courier New", monospace; padding: 3px 10px; position: relative; z-index: 1; }
.mb-file { flex: 1; min-width: 0; }
.mb-line { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; padding: 4px 2px; font-size: 15px; color: #5D4037; }
.mb-line b { color: #3E2723; font-size: 17px; white-space: nowrap; }
.mb-line small { display: block; font-size: 11px; opacity: .7; }
.mb-stamp { margin: 10px auto 2px; width: fit-content; border: 3px solid; border-radius: 6px; padding: 3px 12px; transform: rotate(-4deg);
  font: 700 16px "Courier New", monospace; letter-spacing: .04em; }
.mb-warrants { text-align: center; font-weight: 700; font-size: 13px; color: #5D4037; margin-top: 8px; }
.mb-warrants.hot { color: #B71C1C; }
.mb-er { background: #E3F2FD; }
.mb-er-row { display: flex; gap: 16px; align-items: center; }
.mb-er-h { font-weight: 700; color: #0D47A1; font-size: 15px; margin-bottom: 8px; }
.mb-punch { display: grid; grid-template-columns: repeat(5, 30px); gap: 10px 16px; }
.mb-punch i { width: 30px; height: 30px; border-radius: 50%; border: 2px solid #1565C0; display: flex; align-items: center; justify-content: center; font-style: normal; font-size: 16px; }
.mb-punch i.on { background: radial-gradient(circle, #1565C0 58%, transparent 60%); }
.mb-er-ft { text-align: center; font-weight: 700; font-size: 13px; color: #0D47A1; margin-top: 10px; }

.mb-avi { background: #F3E5F5; }
.mb-avi-row { display: flex; gap: 16px; align-items: center; }
.mb-avi-tx { flex: 1; min-width: 0; }
.mb-avi-nm { font-weight: 700; color: #6A1B9A; font-size: 13px; letter-spacing: .1em; }
.mb-avi-lbl { font-weight: 700; font-size: 21px; color: #4A148C; margin-bottom: 8px; }
.mb-meter { position: relative; height: 20px; border-radius: 10px; border: 2px solid #4A148C; background: linear-gradient(90deg, #E53935, #FFB300, #AB47BC); margin: 0 12px; }
.mb-meter i { position: absolute; top: 50%; width: 28px; height: 28px; margin-left: -14px; transform: translateY(-50%); border-radius: 50%; background: #fff;
  border: 3px solid #4A148C; font: 700 11px/22px var(--font); text-align: center; font-style: normal; color: #4A148C; }
.mb-meter-ends { display: flex; justify-content: space-between; font-size: 12px; color: #7B1FA2; margin: 4px 0 8px; }
.mb-avi-l { font-size: 15px; color: #4A148C; }
.mb-fam { background: #FFF3E0; }
.mb-fam-h { text-align: center; font-weight: 700; color: #BF360C; font-size: 16px; margin-bottom: 10px; }
.mb-fam-row { display: flex; flex-wrap: wrap; justify-content: space-around; gap: 12px; }
.mb-fam-c { display: flex; flex-direction: column; align-items: center; text-align: center; width: 128px; gap: 4px; }
.mb-fam-c b { color: #4E342E; font-size: 15px; } .mb-fam-c span { color: #6D4C41; font-size: 13px; }
.mb-fam-ft { text-align: center; font-weight: 700; color: #BF360C; font-size: 14px; margin-top: 12px; }

.mb-stats .mb-line:nth-child(odd) { background: rgba(141,110,99,.08); border-radius: 6px; }
.mb-backup { text-align: center; font-weight: 700; font-size: 14px; color: #FFF8E1; text-shadow: 0 2px 0 #4E342E; margin: 14px 0 8px; }
.mb-bk-row { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
.mb-bk-row .btn { width: min(260px, 100%); font-size: 16px; }
.mb-code { display: block; width: 100%; min-height: 110px; max-height: 190px; resize: vertical; border-radius: 12px; border: 2px solid #8D6E63; padding: 10px;
  font: 12px/1.35 ui-monospace, "Courier New", monospace; color: #3E2723; background: #FFFDF5; word-break: break-all; user-select: text; -webkit-user-select: text; }
.meta-code p, .meta-code h2 { color: #3E2723; text-align: center; }
.meta-code .quote { text-align: center; }
.mb-err { color: #B71C1C; font-weight: 700; text-align: center; min-height: 1.4em; margin-top: 6px; }

/* ── quest board ── */
.card.meta-quests { color: #ECEFF1; background: radial-gradient(ellipse at 50% 0%, rgba(255,215,0,.18), transparent 55%),
  repeating-conic-gradient(rgba(255,255,255,.03) 0 25%, transparent 0 50%) 0 0 / 20px 20px, linear-gradient(#455A64, #263238); }
.mq-head { position: relative; }
.mq-head h2 { color: #FFD700; text-shadow: 0 3px 0 #000; }
.mq-coins { position: absolute; right: 0; top: 4px; background: rgba(0,0,0,.35); border-radius: 999px; padding: 4px 12px; font-weight: 700; color: #FFD54F; display: flex; align-items: center; gap: 6px; }
.mq-sub { text-align: center; color: #B0BEC5; font-weight: 600; font-size: 14px; margin-bottom: 8px; }
.mq-card { display: flex; gap: 14px; align-items: center; background: linear-gradient(#33424C, #1c262c); border: 3px solid #37474F; border-radius: 16px;
  padding: 14px; margin: 12px 0; animation: mqPop .35s cubic-bezier(.2,1.6,.4,1) backwards; }
.mq-card:nth-of-type(2) { animation-delay: .08s; } .mq-card:nth-of-type(3) { animation-delay: .16s; }
@keyframes mqPop { from { transform: scale(.8); opacity: 0; } to { transform: none; opacity: 1; } }
.mq-card.done { border-color: #FFC107; } .mq-card.claimed { border-color: #43A047; opacity: .78; }
.mq-ic { flex: none; width: 68px; height: 68px; border-radius: 12px; background: linear-gradient(#3d4d57, #141c22); border: 2px solid rgba(255,215,0,.45);
  display: flex; align-items: center; justify-content: center; font-size: 38px; }
.mq-tx { flex: 1; min-width: 0; }
.mq-top { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
.mq-nm { font-size: 20px; color: #fff; }
.mq-rw { flex: none; background: rgba(255,193,7,.16); border: 1.5px solid rgba(255,193,7,.55); border-radius: 999px; padding: 2px 10px; color: #FFD54F;
  font-weight: 700; display: flex; align-items: center; gap: 4px; }
.mq-ds { color: #90A4AE; font-size: 14px; margin: 2px 0 8px; }
.mq-bar { position: relative; height: 20px; border-radius: 10px; background: rgba(10,15,20,.75); border: 1.5px solid rgba(255,255,255,.12); overflow: hidden; flex: 1; }
.mq-bar i { position: absolute; inset: 0 auto 0 0; border-radius: 10px; background: linear-gradient(90deg, #FFD54F, #FFB300); min-width: 0; }
.mq-bar b { position: relative; display: block; text-align: center; font-size: 12px; line-height: 17px; color: #fff; text-shadow: 0 1px 2px #000; }
.mq-foot { display: flex; gap: 12px; align-items: center; }
.mq-claim { flex: none; border: none; border-radius: 12px; padding: 9px 14px; font: 700 16px var(--font); color: #3a2b00; cursor: pointer;
  background: linear-gradient(#FFD54F, #FFB300); box-shadow: 0 4px 0 #F57F17; display: flex; align-items: center; gap: 6px; animation: mqPulse 1.1s ease-in-out infinite; }
.mq-claim .glyph { background: rgba(255,255,255,.9); color: #2b1b2e; }
@keyframes mqPulse { 50% { box-shadow: 0 4px 0 #F57F17, 0 0 18px 4px rgba(255,215,0,.75); } }
.mq-claimed { background: rgba(67,160,71,.22); border: 2px solid #43A047; border-radius: 10px; text-align: center; font-weight: 700; color: #A5D6A7; padding: 4px; }
.mq-done { text-align: center; color: #69F0AE; font-weight: 700; margin: 8px 0; }
.mq-lock { display: flex; gap: 14px; align-items: center; background: rgba(0,0,0,.25); border-radius: 16px; padding: 14px; margin: 10px 0; }
.mq-lock > div:last-child { flex: 1; } .mq-lock .mq-bar { margin: 8px 0 4px; }
.mq-lock small { color: #B0BEC5; }
.mq-lock-ic { font-size: 42px; }
.mq-preview { opacity: .75; background: rgba(0,0,0,.18); border-radius: 14px; padding: 10px 14px; }
.mq-pv-h { font-weight: 700; color: #B0BEC5; font-size: 13px; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 4px; }
.mq-pv { font-size: 14px; color: #CFD8DC; padding: 3px 0; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }

.meta-confetti { position: fixed; inset: 0; pointer-events: none; z-index: 80; }
.meta-confetti i { position: absolute; width: 9px; height: 13px; border-radius: 2px; animation: metaConf 1.3s cubic-bezier(.2,.7,.4,1) forwards; }
@keyframes metaConf { to { transform: translate(var(--dx), calc(var(--dy) + 340px)) rotate(var(--r)); opacity: 0; } }

/* ── title bits ── */
.meta-chip { background: rgba(255,255,255,.25); border-radius: 999px; padding: 1px 9px; font-size: 14px; }
.meta-dot { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: #FF5252;
  color: #fff; font-size: 14px; box-shadow: 0 0 10px rgba(255,82,82,.8); animation: metaDot 1s ease-in-out infinite alternate; }
.meta-dot.gold { background: #FFD700; color: #4527A0; box-shadow: 0 0 10px rgba(255,215,0,.8); }
@keyframes metaDot { to { transform: scale(1.18); } }
.meta-holiday { display: inline-block; margin: 6px auto 2px; background: rgba(13,71,161,.86); color: #FFF8E1; border: 1.5px solid #FFD54F;
  border-radius: 999px; padding: 4px 14px; font-weight: 700; font-size: 15px; }
.meta-line { font-size: 13px; font-weight: 600; opacity: .8; margin-top: 4px; }

/* the daily-streak pill under the trip bar */
.meta-streak { background: linear-gradient(#FFF8E1, #FFE082); color: #5D4037; border: 2px solid #FFB300; border-radius: 16px; padding: 7px 18px;
  text-align: center; box-shadow: 0 6px 20px rgba(0,0,0,.25); animation: metaToastIn .4s cubic-bezier(.2,1.6,.4,1); transition: opacity .45s, transform .45s; }
.meta-streak b { display: flex; align-items: center; gap: 6px; justify-content: center; font-size: 19px; }
.meta-streak small { display: block; font-size: 13px; font-weight: 600; opacity: .75; }
.meta-streak.out { opacity: 0; transform: translateY(-12px); }

/* phones */
@media (max-width: 600px) {
  .card.meta-book { padding: 12px 12px 14px 22px; }
  .mb-tab span { display: none; } .mb-tab { font-size: 20px; }
  .mb-tabs .mb-g { display: none; }
  .mb-grid { grid-template-columns: repeat(auto-fill, minmax(82px, 1fr)); }
  .mb-rap-row, .mb-avi-row { flex-direction: column; align-items: center; }
  .mb-file, .mb-avi-tx { width: 100%; }
  .mb-punch { grid-template-columns: repeat(5, 26px); gap: 8px 10px; } .mb-punch i { width: 26px; height: 26px; }
  .mq-ic { width: 52px; height: 52px; font-size: 30px; } .mq-nm { font-size: 17px; }
  .mq-foot { flex-direction: column; align-items: stretch; } .mq-coins { position: static; width: fit-content; margin: 0 auto 4px; }
  .mb-fam-c { width: 42%; }
}
/* short landscape screens (phones sideways, 540p): keep the three quests + Back on one page */
@media (max-height: 620px) {
  .meta-quests h2, .meta-book .mb-head h2 { font-size: 24px; }
  .mq-card { padding: 9px 12px; margin: 7px 0; } .mq-ic { width: 52px; height: 52px; font-size: 30px; }
  .mq-nm { font-size: 17px; } .mq-ds { margin: 0 0 5px; font-size: 13px; } .mq-sub { margin-bottom: 2px; }
  .mb-tabs { margin: 8px 0 4px; } .mb-tab { padding: 8px 6px; }
}
/* TV / console: big type, big targets */
body.tv .card.meta-book, body.tv .card.meta-quests { width: min(1300px, 100%); }
body.tv .mb-tab { font-size: 26px; padding: 14px; } body.tv .mb-sub { font-size: 24px; }
body.tv .mb-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
body.tv .mb-badge { font-size: 17px; } body.tv .mb-badge .medal { width: 82px; height: 82px; font-size: 42px; }
body.tv .mb-info-nm { font-size: 28px; } body.tv .mb-info-ds { font-size: 22px; } body.tv .mb-info-ic { width: 92px; height: 92px; font-size: 50px; }
body.tv .mb-line { font-size: 22px; } body.tv .mb-line b { font-size: 24px; } body.tv .mb-pic { width: 140px; height: 140px; font-size: 64px; }
body.tv .mb-mug .mb-pic { width: 160px; height: 180px; } body.tv .mb-avi-lbl { font-size: 30px; } body.tv .mb-avi-l, body.tv .mb-fam-c span { font-size: 20px; }
body.tv .mb-fam-c { width: 190px; } body.tv .mb-fam-c b { font-size: 22px; } body.tv .mb-bk-row .btn { font-size: 22px; width: min(380px, 100%); }
body.tv .mq-card { padding: 20px; } body.tv .mq-ic { width: 96px; height: 96px; font-size: 54px; } body.tv .mq-nm { font-size: 30px; }
body.tv .mq-ds { font-size: 22px; } body.tv .mq-rw { font-size: 22px; } body.tv .mq-bar { height: 28px; } body.tv .mq-bar b { font-size: 18px; line-height: 25px; }
body.tv .mq-claim { font-size: 24px; padding: 12px 20px; } body.tv .mq-sub { font-size: 22px; } body.tv .meta-holiday { font-size: 22px; }
body.tv .meta-chip { font-size: 20px; } body.tv .meta-line { font-size: 20px; } body.tv .meta-streak b { font-size: 28px; } body.tv .meta-streak small { font-size: 20px; }
`);

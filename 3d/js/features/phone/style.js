// features/phone — the look: a portrait handset (bezel, notch, status bar, a pink
// sunset wallpaper), a 3-across grid of big app icons, light app screens with
// friendly rows. Slides up from the bottom-right (wide screens) / the bottom (portrait).
import { css } from "../../core/ctx.js";

css("phone", `
/* the corner button: 📱 takes the ❚❚ spot while she drives / walks */
#phoneBtn { display: none; position: relative; font-size: 22px; padding: 0; align-items: center; justify-content: center; }
body.phone-ok #phoneBtn { display: inline-flex; }
body.phone-ok #pauseBtn { display: none; }
#phoneBtn .lp-dot { position: absolute; top: -3px; right: -3px; min-width: 19px; height: 19px; padding: 0 5px; border-radius: 999px; background: #FF3B30;
  color: #fff; font: 700 11px/19px var(--font); font-style: normal; box-shadow: 0 0 0 2px #fff; display: none; box-sizing: border-box; }
#phoneBtn .lp-dot.on { display: block; }
#phoneBtn .lp-key { position: absolute; top: calc(100% + 4px); left: 50%; transform: translateX(-50%); display: none; white-space: nowrap; }
#phoneBtn .lp-key.on { display: block; }
#phoneBtn .lp-key .glyph { font-size: 11px; height: 20px; min-width: 20px; }

/* the radio ticker would sit on the handset's top edge: the Radio app shows now-playing itself */
body.phone-open .hs-radio { visibility: hidden; }
/* the screen behind it: dim the right side only, the road stays visible */
body.phone-open #screen { justify-content: flex-end; align-items: flex-end;
  padding: 14px max(22px, env(safe-area-inset-right)) max(14px, env(safe-area-inset-bottom)) 14px;
  background: linear-gradient(90deg, rgba(43, 27, 46, 0) 40%, rgba(43, 27, 46, 0.42)); }
body .card.lphone { width: 300px; height: min(610px, calc(100vh - 28px)); max-height: none; padding: 8px; border-radius: 44px; overflow: hidden;
  text-align: left; background: linear-gradient(150deg, #4a3550, #1a1020 60%); box-shadow: inset 0 0 0 2px #6d5872, 0 18px 50px rgba(0,0,0,.45);
  animation: lpIn .2s cubic-bezier(.2, .9, .3, 1); }
@keyframes lpIn { from { transform: translateY(105%) rotate(3deg); opacity: .4; } to { transform: none; opacity: 1; } }
.lp-frame { height: 100%; }
.lp-scr { height: 100%; border-radius: 37px; overflow: hidden; display: flex; flex-direction: column; position: relative; color: #fff;
  background: radial-gradient(130% 75% at 15% 0%, #FFE0E9 0%, #FF9EBB 30%, #E2457A 62%, #7B1F57 100%); }
.lp-status { flex: none; display: flex; align-items: center; justify-content: space-between; padding: 9px 20px 2px; height: 26px; font-size: 13px; }
.lp-status .lp-time { font-weight: 700; min-width: 54px; }
.lp-notch { width: 74px; height: 20px; background: #1a1020; border-radius: 999px; }
.lp-st { display: flex; align-items: center; gap: 6px; min-width: 54px; justify-content: flex-end; }
.lp-sig { display: inline-flex; align-items: flex-end; gap: 1.5px; height: 11px; }
.lp-sig i { width: 3px; background: #fff; border-radius: 1px; } .lp-sig i:nth-child(1) { height: 4px; } .lp-sig i:nth-child(2) { height: 6px; } .lp-sig i:nth-child(3) { height: 8px; } .lp-sig i:nth-child(4) { height: 11px; }
.lp-want { color: #FFD54F; font-size: 11px; letter-spacing: -1px; text-shadow: 0 0 4px #000; }
.lp-bat { width: 22px; height: 11px; border: 1.5px solid #fff; border-radius: 3px; position: relative; box-sizing: border-box; }
.lp-bat i { position: absolute; left: 1px; top: 1px; bottom: 1px; max-width: calc(100% - 2px); background: #fff; border-radius: 1px; }
.lp-body { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.lp-foot { flex: none; display: flex; align-items: center; justify-content: space-between; padding: 4px 10px 9px; }
.lp-fb { border: none; cursor: pointer; font: 700 13px var(--font); color: #fff; padding: 5px 10px; border-radius: 999px; background: rgba(26, 16, 32, .32);
  display: inline-flex; gap: 5px; align-items: center; }
.lp-fb .glyph { height: 19px; min-width: 19px; font-size: 10px; background: #fff; color: var(--ink); }
body.dev-touch .lp-fb .glyph { display: none; }
.lp-hb { width: 72px; height: 5px; border-radius: 3px; background: rgba(255, 255, 255, .85); }
.lp-toast { position: absolute; top: 40px; left: 50%; transform: translate(-50%, -8px); background: rgba(26, 16, 32, .9); color: #fff; border-radius: 999px;
  padding: 6px 14px; font-weight: 700; font-size: 13px; opacity: 0; pointer-events: none; transition: opacity .15s, transform .15s; max-width: 85%; text-align: center; z-index: 3; }
.lp-toast.on { opacity: 1; transform: translate(-50%, 0); }

/* home */
.lp-home { padding: 4px 14px 0; display: flex; flex-direction: column; height: 100%; min-height: 0; }
.lp-big { font-size: 48px; font-weight: 700; text-align: center; line-height: 1.05; margin-top: 8px; text-shadow: 0 2px 10px rgba(123, 31, 87, .35); }
.lp-hello { text-align: center; font-size: 13px; font-weight: 600; min-height: 1.2em; margin: 2px 0 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px 4px; margin: auto 0 10px; overflow: auto; padding: 6px 2px; }
.lp-app { border: none; background: none; color: #fff; font: inherit; display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer;
  border-radius: 18px; padding: 6px 0 4px; }
.lp-ic { width: 60px; height: 60px; border-radius: 17px; display: flex; align-items: center; justify-content: center; font-size: 32px; position: relative;
  background: linear-gradient(160deg, var(--a), var(--b)); box-shadow: 0 4px 10px rgba(60, 10, 40, .3), inset 0 1px 0 rgba(255, 255, 255, .4); transition: transform .1s; }
.lp-nm { font-size: 12.5px; font-weight: 700; text-shadow: 0 1px 3px rgba(60, 10, 40, .5); white-space: nowrap; }
.lp-app.focus { background: rgba(255, 255, 255, .18); outline: none; }
.lp-app.focus .lp-ic { transform: scale(1.1); box-shadow: 0 0 0 3px #fff, 0 6px 16px rgba(60, 10, 40, .4); }
.lp-app:active .lp-ic { transform: scale(.94); }
.lp-badge { position: absolute; top: -6px; right: -6px; min-width: 21px; height: 21px; border-radius: 999px; background: #FF3B30; color: #fff;
  font: 700 12px/21px var(--font); font-style: normal; text-align: center; padding: 0 5px; box-sizing: border-box; box-shadow: 0 0 0 2px #fff; }

/* the home screen's notification cards (latest unread texts) */
.lp-notes { display: flex; flex-direction: column; gap: 6px; }
.lp-notif { border: none; font: inherit; cursor: pointer; display: flex; align-items: center; gap: 9px; text-align: left; color: var(--ink);
  background: rgba(255, 255, 255, .86); border-radius: 16px; padding: 7px 10px; box-shadow: 0 3px 10px rgba(60, 10, 40, .18); }
.lp-notif .lp-av { width: 32px; height: 32px; font-size: 18px; }
.lp-notif small { -webkit-line-clamp: 1; }
.lp-notif.focus { outline: none; box-shadow: 0 0 0 3px #fff, 0 3px 12px rgba(60, 10, 40, .3); }
body.tv .lp-notif { padding: 10px 14px; } body.tv .lp-notif .lp-av { width: 44px; height: 44px; font-size: 26px; }
/* an app */
.lp-appv { display: flex; flex-direction: column; height: 100%; min-height: 0; background: #FFF6F9; color: var(--ink); }
.lp-head { flex: none; display: flex; align-items: center; gap: 8px; padding: 8px 14px 9px; color: #fff; font-size: 17px;
  background: linear-gradient(120deg, var(--a), var(--b)); box-shadow: 0 2px 8px rgba(0, 0, 0, .15); }
.lp-hic { font-size: 22px; }
.lp-appbody { flex: 1; min-height: 0; overflow: auto; padding: 10px 10px 6px; display: flex; flex-direction: column; gap: 8px; }
.lphone .btn.lp-row { width: 100%; min-height: 52px; flex: none; justify-content: flex-start; text-align: left; gap: 10px; padding: 7px 10px; border-radius: 15px;
  background: #fff; color: var(--ink); font-size: 15px; box-shadow: 0 2px 0 rgba(43, 27, 46, .08), 0 1px 6px rgba(43, 27, 46, .06); }
.lphone .btn.lp-row.focus { transform: none; box-shadow: 0 0 0 3px var(--a, #E91E63), 0 2px 8px rgba(0, 0, 0, .12); }
.lphone .btn.lp-row.on { background: color-mix(in srgb, var(--a, #E91E63) 14%, #fff); }
.lphone .btn.lp-row[disabled] { opacity: .6; cursor: default; }
.lphone .btn.lp-row.new b { color: #C2185B; }
.lphone .btn.lp-mini { min-height: 40px; justify-content: center; font-size: 14px; background: rgba(43, 27, 46, .06); box-shadow: none; }
.lp-av { flex: none; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 21px;
  background: color-mix(in srgb, var(--c, #F48FB1) 25%, #fff); }
.lp-tx { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.lp-tx b { font-size: 14.5px; line-height: 1.2; }
.lp-tx small { font-size: 12px; font-weight: 500; opacity: .72; line-height: 1.25; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.lp-meta { flex: none; font-size: 12px; font-weight: 600; opacity: .7; display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
.lp-meta .lp-badge { position: static; box-shadow: none; }
.lp-go { opacity: 1; background: var(--a, #E91E63); color: #fff; border-radius: 999px; padding: 4px 10px; }
.lp-card { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 15px; background: #fff; border-left: 5px solid var(--a, #E91E63); flex: none; }
.lp-note { margin: 2px 4px; font-size: 13px; font-weight: 600; text-align: center; color: #8D4F6E; }
.lp-fine { margin: 0 4px; font-size: 12px; opacity: .6; text-align: center; }
.lp-empty { margin: auto; text-align: center; font-weight: 600; opacity: .7; }
.lp-dist { display: flex; flex-direction: column; align-items: center; padding: 14px 6px; border-radius: 18px; color: #fff; flex: none;
  background: linear-gradient(140deg, var(--a), var(--b)); }
.lp-dist b { font-size: 40px; line-height: 1.1; } .lp-dist small { font-size: 12.5px; font-weight: 600; opacity: .9; }
/* the radio's equaliser */
.lp-eq { flex: none; display: inline-flex; align-items: flex-end; gap: 3px; height: 28px; width: 38px; justify-content: center; }
.lp-eq i { width: 5px; background: var(--a); border-radius: 2px; animation: lpEq .9s infinite ease-in-out alternate; }
.lp-eq i:nth-child(2) { animation-delay: -.3s; } .lp-eq i:nth-child(3) { animation-delay: -.6s; } .lp-eq i:nth-child(4) { animation-delay: -.45s; }
.lp-eq.off i { animation: none; height: 4px; opacity: .4; }
@keyframes lpEq { from { height: 5px; } to { height: 26px; } }
/* messages */
.lp-chat-h { display: flex; align-items: center; gap: 8px; font-size: 15px; flex: none; }
.lp-chat { display: flex; flex-direction: column; gap: 6px; overflow: auto; min-height: 0; flex: 1; padding: 2px; }
.lp-bub { align-self: flex-start; max-width: 86%; background: #fff; border-radius: 16px 16px 16px 5px; padding: 7px 11px; font-size: 14px; font-weight: 600;
  line-height: 1.3; box-shadow: 0 1px 4px rgba(43, 27, 46, .1); border-left: 3px solid var(--c, #E91E63); }
.lp-bub b { display: block; font-size: 11.5px; color: var(--c, #E91E63); letter-spacing: .02em; }
.lp-bub small { display: block; font-size: 10.5px; opacity: .5; text-align: right; margin-top: 2px; }

/* phone landscape / short screens: 4 across, smaller clock */
@media (max-height: 520px) {
  body .card.lphone { width: 330px; height: calc(100vh - 20px); border-radius: 34px; padding: 6px; }
  body.phone-open #screen { padding-top: 10px; padding-bottom: max(10px, env(safe-area-inset-bottom)); }
  .lp-scr { border-radius: 29px; }
  .lp-big { font-size: 30px; margin-top: 2px; } .lp-hello { margin-bottom: 2px; } .lp-notes { display: none; }
  .lp-grid { grid-template-columns: repeat(4, 1fr); gap: 6px 2px; margin-bottom: 4px; }
  .lp-ic { width: 50px; height: 50px; font-size: 27px; border-radius: 14px; }
  .lp-nm { font-size: 11px; }
  .lp-status { padding-top: 6px; height: 22px; } .lp-foot { padding-bottom: 6px; }
  .lp-appbody { padding: 7px 8px 4px; gap: 6px; } .lphone .btn.lp-row { min-height: 46px; padding: 5px 9px; }
  .lp-head { padding: 5px 12px 6px; font-size: 15px; }
}
/* portrait: centred at the bottom, a bit bigger */
@media (max-aspect-ratio: 1/1) {
  body.phone-open #screen { justify-content: center; padding-left: 14px; padding-right: 14px; background: linear-gradient(180deg, rgba(43, 27, 46, 0) 30%, rgba(43, 27, 46, .45)); }
  body .card.lphone { width: min(360px, 92vw); height: min(660px, 80vh); }
  .lp-big { font-size: 54px; }
}
/* TV / console: big, readable from the couch */
body.tv .card.lphone { width: 440px; height: min(900px, calc(100vh - 8vh)); padding: 12px; border-radius: 60px; }
body.tv.phone-open #screen { padding: 4vh 4vw; }
body.tv .lp-scr { border-radius: 50px; }
body.tv .lp-status { font-size: 18px; height: 36px; padding: 12px 30px 4px; } body.tv .lp-notch { width: 100px; height: 26px; }
body.tv .lp-big { font-size: 72px; } body.tv .lp-hello { font-size: 19px; }
body.tv .lp-ic { width: 92px; height: 92px; font-size: 50px; border-radius: 26px; } body.tv .lp-nm { font-size: 18px; }
body.tv .lp-grid { gap: 20px 6px; }
body.tv .lp-fb { font-size: 18px; padding: 8px 14px; } body.tv .lp-fb .glyph { height: 26px; min-width: 26px; font-size: 14px; }
body.tv .lp-head { font-size: 24px; padding: 12px 20px; } body.tv .lp-hic { font-size: 30px; }
body.tv .lphone .btn.lp-row { min-height: 72px; font-size: 20px; } body.tv .lp-tx b { font-size: 20px; } body.tv .lp-tx small { font-size: 16px; }
body.tv .lp-av { width: 52px; height: 52px; font-size: 30px; } body.tv .lp-meta { font-size: 16px; }
body.tv .lp-bub { font-size: 19px; } body.tv .lp-bub b { font-size: 15px; } body.tv .lp-note { font-size: 17px; } body.tv .lp-dist b { font-size: 56px; }
body.tv #phoneBtn { font-size: 30px; }
`);
